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
     * URL 参数传递 token 方式
     * @param {string} redirectUri - 重定向URI（来自 redirect_uris）
     * @param {Object} options - 选项
     * @param {boolean} options.openInNewTab - 是否在新标签页打开，默认 true
     * @returns {Promise<void>}
     */
    jumpWithTokenInUrl: async (redirectUri, options = {}) => {
        const { openInNewTab = true } = options;

        const token = await appJump.ensureValidToken();

        const userInfo = authService.getUserInfo();
        const organization = userInfo?.owner || null;

        // 处理目标 URL：确保跳转到登录页面
        let targetUrl = redirectUri;
        try {
            const urlObj = new URL(redirectUri);
            let path = urlObj.pathname;
            if (path === '/' || path === '' || !path.includes('/login')) {
                path = '/login';
            }
            targetUrl = `${urlObj.origin}${path}`;
        } catch {
            targetUrl = redirectUri;
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
     * 使用 target app 的 client_id、redirect_uris 和 homepage_url 进行跳转
     * @param {Object} appInfo - 应用信息
     * @param {string} appInfo.name - 应用标识
     * @param {string} appInfo.clientId - 应用客户端ID
     * @param {string} appInfo.homepageUrl - 应用首页链接（用于跳转）
     * @param {string|Array<string>} appInfo.redirectUris - 重定向URI列表
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

        // 优先使用 homepage_url 进行跳转
        let jumpUrl = appInfo.homepageUrl || null;

        // 如果没有 homepage_url，回退到 redirect_uris
        if (!jumpUrl) {
            const { redirectUris } = appInfo;
            jumpUrl = redirectUris && redirectUris.length > 0
                ? (Array.isArray(redirectUris) ? redirectUris[0] : redirectUris)
                : null;
        }

        if (!jumpUrl) {
            throw new Error('该应用暂未配置跳转地址');
        }

        // 确保 token 有效（如果过期则自动刷新）
        await appJump.ensureValidToken();

        // 根据跳转模式选择方案
        const finalJumpMode = jumpMode === 'auto' ? 'token' : jumpMode;

        if (finalJumpMode === 'oauth2') {
            return appJump.jumpWithOAuth2(appInfo, { openInNewTab });
        } else {
            return appJump.jumpWithTokenInUrl(jumpUrl, { openInNewTab });
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
        
        // 选择第一个重定向URI
        // 注意：OAuth2 规范要求 redirect_uri 必须与注册的完全匹配，不能添加查询参数
        let redirectUri = Array.isArray(redirectUris) ? redirectUris[0] : redirectUris;

        // 移除 redirectUri 中已有的查询参数（OAuth2 规范要求）
        if (redirectUri) {
            try {
                const redirectUriObj = new URL(redirectUri);
                redirectUri = `${redirectUriObj.origin}${redirectUriObj.pathname}`;
                // 移除末尾斜杠（如果存在），确保 URL 格式一致
                if (redirectUri.endsWith('/')) {
                    redirectUri = redirectUri.slice(0, -1);
                }
            } catch {
                // URL 解析失败，使用原始 redirectUri
            }
        }

        // ========== 从 redirect_uris 推断目标应用的后端地址 ==========
        let targetBackendBaseUrl = null;

        // 从 redirect_uris 提取后端地址
        if (redirectUris && redirectUris.length > 0) {
            const firstRedirectUri = Array.isArray(redirectUris) ? redirectUris[0] : redirectUris;
            try {
                const redirectUriObj = new URL(firstRedirectUri);
                targetBackendBaseUrl = redirectUriObj.origin;
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
            const state = generateState();
            sessionStorage.setItem('oauth_state', state);
            localStorage.setItem('oauth_state', state);

            const queryParams = new URLSearchParams({
                response_type: 'code',
                client_id: clientId,
                redirect_uri: redirectUri,
                scope: 'profile',
                state,
            });
            authorizeUrl = `${targetBackendBaseUrl}/api/v1/auth/authorize?${queryParams.toString()}`;
        } else {
            authorizeUrl = authService.getAuthorizeUrl({
                client_id: clientId,
                redirect_uri: redirectUri,
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
     * @param {Object} options - 选项
     * @param {boolean} options.openInNewTab - 是否在新标签页打开，默认 true
     * @param {string} options.jumpMode - 跳转模式：'oauth2' | 'token' | 'auto'，默认 'auto'
     * @returns {Promise<void>}
     */
    jumpFromAppList: async (app, options = {}) => {
        const { name } = app;

        // 尝试获取应用详情（获取 homepage_url 等完整信息）
        let appInfo = { ...app };

        // 如果没有 homepageUrl 或 clientId，尝试获取应用详情
        if (!app.homepageUrl || (options.jumpMode === 'oauth2' && !app.clientId)) {
            try {
                const response = await applicationService.getApplicationDetail(name);
                const appData = response.data || {};

                appInfo = {
                    ...app,
                    homepageUrl: appData.homepage_url || app.homepageUrl || '',
                    clientId: appData.client_id || app.clientId || '',
                    redirectUris: appData.redirect_uris || app.redirectUris || [],
                    organization: app.organization || appData.organization || null,
                };
            } catch {
                // 如果获取详情失败，尝试使用列表中的数据
                let fallbackUrl = app.homepageUrl || null;
                if (!fallbackUrl) {
                    fallbackUrl = app.redirectUris && app.redirectUris.length > 0
                        ? (Array.isArray(app.redirectUris) ? app.redirectUris[0] : app.redirectUris)
                        : null;
                }
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

