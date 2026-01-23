import { authService } from '../services/auth';
import { applicationService } from '../services/application';

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
        
        // 通过 URL 参数传递 token
        const separator = appUrl.includes('?') ? '&' : '?';
        const jumpUrl = `${appUrl}${separator}access_token=${encodeURIComponent(token)}`;
        
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
        
        const { appUrl, clientId, redirectUris } = appInfo;
        
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
            // 自动选择：如果有 clientId 和 redirectUris，优先使用 OAuth2
            if (clientId && redirectUris && redirectUris.length > 0) {
                finalJumpMode = 'oauth2';
            } else {
                finalJumpMode = 'token';
            }
        }
        
        if (finalJumpMode === 'oauth2') {
            // 使用 OAuth2 授权码模式
            return appJump.jumpWithOAuth2({ ...appInfo, appUrl: finalAppUrl }, { openInNewTab });
        } else {
            // 使用 URL 参数传递 token（降级方案）
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
        
        // 确保 token 有效（如果过期则自动刷新）
        // OAuth2 模式下，后端会验证当前用户的 token，所以需要确保 token 有效
        const token = await appJump.ensureValidToken();
        
        // 选择第一个重定向URI（或使用 appUrl）
        // 注意：redirect_uri 必须是应用配置的重定向URI之一
        const redirectUri = Array.isArray(redirectUris) ? redirectUris[0] : redirectUris;
        
        // 生成 OAuth2 授权 URL
        // 注意：这里使用应用的 client_id，让后端知道是要跳转到哪个应用
        // 后端会验证当前用户的 token（通过 Cookie 或请求头），如果有效则直接返回授权码，实现 SSO
        // 为了确保后端能识别已登录用户，我们在 URL 中添加 access_token 参数（后端会验证）
        // 或者后端通过 Cookie 中的 refresh_token 来验证用户身份
        let authorizeUrl = authService.getAuthorizeUrl({
            client_id: clientId,
            redirect_uri: redirectUri || appUrl, // 使用应用配置的 redirect_uri
            scope: 'profile',
        });
        
        // 在授权 URL 中添加 access_token 参数，让后端知道当前用户已登录
        // 后端会验证这个 token，如果有效则直接返回授权码，实现 SSO
        // 注意：这不是标准的 OAuth2 流程，但可以实现 SSO
        // 如果后端支持通过 Cookie 验证，可以移除这个参数
        const separator = authorizeUrl.includes('?') ? '&' : '?';
        authorizeUrl = `${authorizeUrl}${separator}access_token=${encodeURIComponent(token)}`;
        
        // 保存应用信息，用于回调后跳转
        if (appUrl) {
            sessionStorage.setItem('app_jump_url', appUrl);
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
                };
            } catch (error) {
                console.warn('获取应用详情失败，使用 URL 参数传递方式:', error);
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

