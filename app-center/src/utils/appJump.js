import { authService } from '../services/auth';
import { applicationService } from '../services/application';

/**
 * 生成随机 state 参数，用于 CSRF 防护
 * @returns {string} 随机 state 字符串
 */
function generateState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 应用跳转工具
 * 支持 OAuth2 授权码模式和 URL 参数传递两种方式实现 SSO
 */
export const appJump = {
    /**
     * 确保 token 有效，如果过期则自动刷新
     * @returns {Promise<string>} 有效的 access_token
     */
    ensureValidToken: async () => {
        // 检查是否有 token
        const token = authService.getToken();
        if (!token) {
            throw new Error('未登录，无法跳转到应用');
        }
        
        // 检查 token 是否过期，如果过期则尝试刷新
        if (authService.isTokenExpired()) {
            // Token 已过期，尝试刷新
            // refresh_token 通过 Cookie 自动携带，无需手动传递
            try {
                // 刷新 token
                const response = await authService.refreshToken();
                if (response.data) {
                    // 保存新的 token
                    authService.saveToken(response.data);
                    // 返回新的 token
                    return response.data.access_token || response.data.accessToken || authService.getToken();
                }
                throw new Error('刷新 token 失败');
            } catch {
                // 刷新失败，清除 token
                authService.clearToken();
                throw new Error('Token 刷新失败，请重新登录');
            }
        }
        
        // Token 有效，直接返回
        return token;
    },

    /**
     * 方案1：URL 参数传递 token（简单但不安全，仅用于开发测试或 OAuth2 不可用时）
     * @param {string} appUrl - 应用地址
     * @param {Object} options - 选项
     * @param {boolean} options.openInNewTab - 是否在新标签页打开，默认 true
     * @returns {Promise<void>}
     */
    jumpWithTokenInUrl: async (appUrl, options = {}) => {
        const { openInNewTab = true } = options;

        // 确保 token 有效（如果过期则自动刷新）
        const token = await appJump.ensureValidToken();

        // 获取当前用户的企业标识（owner）
        const userInfo = authService.getUserInfo();
        // 修复：built-in 也是有效的企业标识，不应该被过滤掉
        const organization = userInfo?.owner || null;

        // 处理目标 URL：确保跳转到登录页面
        // 如果 appUrl 不是以 /login 结尾，则添加 /login 路径
        let targetUrl = appUrl;
        try {
            const urlObj = new URL(appUrl);
            // 移除已有的查询参数和哈希
            let path = urlObj.pathname;
            // 如果路径是根路径或不包含 /login，则设置为 /login
            if (path === '/' || path === '' || !path.includes('/login')) {
                path = '/login';
            }
            // 重建 URL（不带查询参数和哈希）
            targetUrl = `${urlObj.origin}${path}`;
        } catch {
            // URL 解析失败，使用原始 appUrl
            targetUrl = appUrl;
        }

        // 通过 URL 参数传递 token 和企业标识
        const separator = targetUrl.includes('?') ? '&' : '?';
        let jumpUrl = `${targetUrl}${separator}access_token=${encodeURIComponent(token)}`;

        // 添加 auto_login 参数
        jumpUrl += '&auto_login=true';

        // 如果有企业标识，添加到 URL 参数中
        if (organization) {
            jumpUrl += `&organization=${encodeURIComponent(organization)}`;
        }

        if (openInNewTab) {
            window.open(jumpUrl, '_blank');
        } else {
            window.location.href = jumpUrl;
        }
    },

    /**
     * 方案2：使用 OAuth2 授权码模式（推荐）
     * 使用目标应用的 client_id 和 redirect_uri 进行 OAuth2 授权
     * @param {Object} appInfo - 应用信息
     * @param {string} appInfo.name - 应用标识
     * @param {string} appInfo.appUrl - 应用地址
     * @param {string} appInfo.clientId - 应用客户端ID（可选，如果提供则使用 OAuth2 模式）
     * @param {string|Array<string>} appInfo.redirectUris - 重定向URI列表（可选）
     * @param {Object} options - 选项
     * @param {boolean} options.openInNewTab - 是否在新标签页打开，默认 true
     * @param {string} options.jumpMode - 跳转模式：'oauth2' | 'token' | 'auto'，默认 'auto'
     * @returns {Promise<void>}
     */
    jumpToApp: async (appInfo, options = {}) => {
        const {
            openInNewTab = true,
            jumpMode = 'auto', // 'oauth2' | 'token' | 'auto'
        } = options;

        const { appUrl, redirectUris } = appInfo;
        
        // 如果没有 appUrl，尝试使用 redirectUris 的第一个作为跳转地址
        let finalAppUrl = appUrl;
        if (!finalAppUrl && redirectUris && redirectUris.length > 0) {
            finalAppUrl = Array.isArray(redirectUris) ? redirectUris[0] : redirectUris;
        }
        
        // 检查应用地址
        if (!finalAppUrl) {
            throw new Error('该应用暂未配置跳转地址');
        }
        
        // 确保 token 有效（如果过期则自动刷新）
        await appJump.ensureValidToken();
        
        // 根据跳转模式选择方案
        let finalJumpMode = jumpMode;

        if (jumpMode === 'auto') {
            // 自动选择：默认使用 URL 参数方式（更简单，兼容性更好）
            // 只有明确指定 oauth2 时才使用 OAuth2 授权码模式
            finalJumpMode = 'token';
        }

        if (finalJumpMode === 'oauth2') {
            // 使用 OAuth2 授权码模式
            return appJump.jumpWithOAuth2({ ...appInfo, appUrl: finalAppUrl }, { openInNewTab });
        } else {
            // 使用 URL 参数传递方式（默认）
            return appJump.jumpWithTokenInUrl(finalAppUrl, { openInNewTab });
        }
    },

    /**
     * 使用 OAuth2 授权码模式跳转（推荐方式）
     * OAuth2 模式下，后端会验证当前用户的 token，如果有效则直接返回授权码
     * 目标应用使用授权码换取 token，实现 SSO
     * @param {Object} appInfo - 应用信息
     * @param {string} appInfo.appUrl - 应用地址（作为 redirect_uri）
     * @param {string} appInfo.clientId - 应用客户端ID
     * @param {string|Array<string>} appInfo.redirectUris - 重定向URI列表
     * @param {Object} options - 选项
     * @param {boolean} options.openInNewTab - 是否在新标签页打开，默认 true
     * @returns {Promise<void>}
     */
    jumpWithOAuth2: async (appInfo, options = {}) => {
        const { openInNewTab = true } = options;
        const { appUrl, clientId, redirectUris } = appInfo;
        
        if (!clientId) {
            throw new Error('应用未配置客户端ID，无法使用 OAuth2 模式跳转');
        }
        
        if (!redirectUris || redirectUris.length === 0) {
            throw new Error('应用未配置重定向URI，无法使用 OAuth2 模式跳转');
        }
        
        // ========== SSO（单点登录）实现原理 ==========
        // 
        // 目标：用户在应用大平台登录后，跳转到其他应用（如安全培训系统）时，
        //      能够自动登录，无需重新输入账号密码。
        //
        // 实现方式：
        // 1. 用户在应用大平台登录后，refresh_token 存储在 HttpOnly Cookie 中
        // 2. 跳转到其他应用时，调用 /auth/authorize 接口
        // 3. 后端检查用户是否已登录（通过以下方式之一）：
        //    
        //    方案A（推荐）：后端通过 Cookie 中的 refresh_token 验证用户身份
        //    - 如果 refresh_token 有效且用户已登录 → 直接返回授权码（不跳转登录页），实现 SSO
        //    - 如果 refresh_token 无效或未登录 → 跳转到 Casdoor 登录页面
        //    
        //    方案B（备选）：后端通过 URL 参数中的 access_token 验证用户身份
        //    - 前端在授权 URL 中添加 access_token 参数
        //    - 后端验证这个 token，如果有效则直接返回授权码，实现 SSO
        //    - 注意：这不是标准的 OAuth2 流程，但可以实现 SSO
        //
        // 当前实现：同时使用两种方案，确保 SSO 能够工作
        // - 浏览器会自动携带 Cookie 中的 refresh_token（方案A）
        // - 同时在 URL 中添加 access_token 参数（方案B，作为备选）
        
        // 确保 token 有效（如果过期则自动刷新）
        // 这样后端验证时，token 一定是有效的
        const token = await appJump.ensureValidToken();
        
        if (!token) {
            throw new Error('无法获取有效的 access_token，请重新登录');
        }
        
        // 获取当前用户的企业标识（owner）
        const userInfo = authService.getUserInfo();
        let organization = null;
        
        // 如果用户是企业用户（非系统管理员），使用用户的企业标识
        if (userInfo?.owner && userInfo.owner !== 'built-in') {
            organization = userInfo.owner;
        } 
        // 如果用户是系统管理员，使用应用的企业标识（包括 built-in）
        else if (userInfo?.owner === 'built-in' && appInfo.organization) {
            organization = appInfo.organization;
        }
        
        // 选择第一个重定向URI（或使用 appUrl）
        // 注意：OAuth2 规范要求 redirect_uri 必须与注册的完全匹配，不能添加查询参数
        let redirectUri = Array.isArray(redirectUris) ? redirectUris[0] : redirectUris;

        // 如果 appUrl 与 redirectUri 不同，优先使用 redirectUri（OAuth2 规范要求）
        if (!redirectUri && appUrl) {
            redirectUri = appUrl;
        }

        // 移除 redirectUri 中已有的查询参数（OAuth2 规范要求）
        if (redirectUri) {
            try {
                const redirectUriObj = new URL(redirectUri);
                // 保留基础 URL，移除所有查询参数
                redirectUri = `${redirectUriObj.origin}${redirectUriObj.pathname}`;
                // 移除末尾斜杠（如果存在），确保 URL 格式一致
                if (redirectUri.endsWith('/')) {
                    redirectUri = redirectUri.slice(0, -1);
                }
            } catch {
                // URL 解析失败，使用原始 redirectUri
            }
        }

        // ========== 关键：使用目标应用的授权端点 ==========
        // 目标应用（如安全培训系统）有自己的授权端点，应该调用目标应用的授权端点
        // 而不是应用大平台的授权端点
        //
        // 从 redirect_uris 推断目标应用的后端地址
        // 例如：如果 redirect_uris 是 http://localhost:5174/login，后端是 http://localhost:5174/api/v1
        let targetBackendBaseUrl = null;

        // 优先从 redirect_uris 提取后端地址
        if (redirectUris && redirectUris.length > 0) {
            const firstRedirectUri = Array.isArray(redirectUris) ? redirectUris[0] : redirectUris;
            try {
                const redirectUriObj = new URL(firstRedirectUri);
                // 使用 redirect_uri 的 origin 作为后端 base URL
                targetBackendBaseUrl = redirectUriObj.origin;
            } catch {
                // URL 解析失败，继续尝试其他方式
            }
        }

        // 如果 redirect_uris 无法解析，尝试从 appUrl 推断
        if (!targetBackendBaseUrl && appUrl) {
            try {
                const appUrlObj = new URL(appUrl);
                targetBackendBaseUrl = appUrlObj.origin;
            } catch {
                // URL 解析失败
            }
        }

        // 如果应用信息中有后端地址字段，优先使用
        if (appInfo.authBaseUrl || appInfo.backendUrl) {
            targetBackendBaseUrl = appInfo.authBaseUrl || appInfo.backendUrl;
        }
        
        // 生成 OAuth2 授权 URL
        let authorizeUrl;
        if (targetBackendBaseUrl) {
            // 使用目标应用的授权端点
            const state = generateState();
            // 保存 state 到 sessionStorage 和 localStorage
            sessionStorage.setItem('oauth_state', state);
            localStorage.setItem('oauth_state', state);

            const queryParams = new URLSearchParams({
                response_type: 'code',
                client_id: clientId,
                redirect_uri: redirectUri || appUrl,
                scope: 'profile',
                state,
            });
            authorizeUrl = `${targetBackendBaseUrl}/api/v1/auth/authorize?${queryParams.toString()}`;
        } else {
            // 使用应用大平台的授权端点（默认行为，但可能不正确）
            // 注意：这里应该改为使用目标应用的授权端点
            authorizeUrl = authService.getAuthorizeUrl({
                client_id: clientId,
                redirect_uri: redirectUri || appUrl,
                scope: 'profile',
            });
        }

        // 在授权 URL 中添加 SSO 相关参数
        // 这些参数会在后端重定向到登录页面时被保留，让目标应用识别这是 SSO 跳转
        const separator = authorizeUrl.includes('?') ? '&' : '?';

        // 添加 access_token 参数（让后端知道当前用户已登录）
        // 后端验证这个 token：
        // - 如果有效 → 直接返回授权码（不跳转登录页），实现 SSO
        // - 如果无效 → 跳转到目标应用的登录页面，并保留以下参数
        authorizeUrl = `${authorizeUrl}${separator}access_token=${encodeURIComponent(token)}`;

        // 添加 auto_login=true 参数（标识这是自动登录请求）
        authorizeUrl += `&auto_login=true`;

        // 如果有企业标识，添加到授权 URL 的查询参数中
        // 后端在重定向到登录页面时，应该将这个参数保留在重定向 URL 中
        // 这样目标应用的登录页面就能从 URL 参数中获取企业标识
        if (organization) {
            authorizeUrl += `&organization=${encodeURIComponent(organization)}`;
        }

        // 注意：由于 OAuth2 的 redirect_uri 必须与注册的完全匹配，
        // 我们不能在 redirect_uri 中添加查询参数，否则验证会失败
        // 
        // 如果后端在重定向到登录页面时没有保留 organization 参数，
        // 我们可以采用备用方案：直接跳转到登录页面并带上企业标识
        // 但这样会失去 SSO 功能，需要用户手动登录
        // 
        // 当前方案：期望后端在重定向时保留 organization 参数
        // 如果不行，需要后端支持或采用其他方案
        
        // 保存应用信息，用于回调后跳转
        if (appUrl) {
            sessionStorage.setItem('app_jump_url', appUrl);
        }
        
        // 如果有企业标识，保存到 sessionStorage，作为备用方案
        // 注意：如果跨域，sessionStorage 无法共享，但同域下可以工作
        if (organization) {
            sessionStorage.setItem('app_organization', organization);
        }
        
        if (openInNewTab) {
            window.open(authorizeUrl, '_blank');
        } else {
            window.location.href = authorizeUrl;
        }
    },

    /**
     * 从应用列表数据跳转（自动获取应用详情）
     * @param {Object} app - 应用对象（来自列表）
     * @param {string} app.name - 应用标识
     * @param {string} app.appUrl - 应用地址
     * @param {Object} options - 选项
     * @param {boolean} options.openInNewTab - 是否在新标签页打开，默认 true
     * @param {string} options.jumpMode - 跳转模式：'oauth2' | 'token' | 'auto'，默认 'auto'
     * @returns {Promise<void>}
     */
    jumpFromAppList: async (app, options = {}) => {
        const { name, appUrl } = app;
        
        // 如果应用列表中没有 clientId，尝试获取应用详情
        let appInfo = { ...app };
        
        // 如果跳转模式是 'oauth2' 或 'auto'，且没有 clientId，则获取应用详情
        if ((options.jumpMode === 'oauth2' || options.jumpMode === 'auto') && !app.clientId) {
            try {
                const response = await applicationService.getApplicationDetail(name);
                const appData = response.data || {};
                
                appInfo = {
                    ...app,
                    clientId: appData.client_id,
                    redirectUris: appData.redirect_uris || [],
                    // 如果列表中没有 appUrl，使用详情中的 app_url 或 redirect_uris 的第一个
                    appUrl: appUrl || appData.app_url || (appData.redirect_uris && appData.redirect_uris.length > 0 ? appData.redirect_uris[0] : null),
                    // 确保 organization 字段被传递（从列表或详情中获取）
                    organization: app.organization || appData.organization || null,
                };
            } catch {
                // 如果获取详情失败，且没有 appUrl，尝试使用 redirectUris
                const fallbackUrl = appUrl || (app.redirectUris && app.redirectUris.length > 0 ? app.redirectUris[0] : null);
                if (!fallbackUrl) {
                    throw new Error('该应用暂未配置跳转地址');
                }
                return appJump.jumpWithTokenInUrl(fallbackUrl, options);
            }
        }
        
        return appJump.jumpToApp(appInfo, options);
    },
};

export default appJump;

