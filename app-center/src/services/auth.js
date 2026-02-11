import api from './api';

// 常量定义
const MS_PER_SECOND = 1000;

/**
 * OAuth2 认证服务
 * 参考后端文档：OAuth2 授权端点和令牌端点
 */
export const authService = {
    /**
     * 获取授权 URL
     * @param {Object} params - 授权参数
     * @param {string} params.client_id - 组织唯一标识（可选，不传则使用默认组织）
     * @param {string} params.redirect_uri - 重定向URI（可选，不传则使用默认值）
     * @param {string} params.state - 状态参数，用于CSRF防护（可选）
     * @param {string} params.scope - 授权范围，默认 "profile"（可选）
     * @returns {string} 授权 URL
     */
    getAuthorizeUrl: (params = {}) => {
        const {
            client_id,
            redirect_uri = window.location.origin + '/login',
            state = generateState(),
            scope = 'profile',
        } = params;

        // 保存 state 到 sessionStorage 和 localStorage，用于回调时验证
        // 使用两种存储方式，防止跳转后 sessionStorage 丢失
        sessionStorage.setItem('oauth_state', state);
        localStorage.setItem('oauth_state', state);

        const queryParams = new URLSearchParams({
            response_type: 'code', // 固定为 'code'
            ...(client_id && { client_id }), // 组织唯一标识，不传则使用默认组织
            ...(redirect_uri && { redirect_uri }), // 重定向URI，不传则使用默认值
            state, // 状态参数，用于 CSRF 防护
            scope, // 授权范围，默认 'profile'
        });

        // 授权端点需要使用完整的后端 URL
        // 从环境变量获取 baseURL，如果包含 /api/v1，则提取基础部分
        let baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
        const apiPrefix = import.meta.env.VITE_API_PREFIX || '/api';
        const apiVersion = import.meta.env.VITE_API_VERSION || '/v1';
        
        // 如果 baseURL 已经包含 /api/v1，则提取基础部分
        if (baseURL.includes('/api/v1')) {
            baseURL = baseURL.replace(/\/api\/v1.*$/, '');
        }
        
        // 如果 baseURL 是完整 URL，直接使用；否则拼接
        const authorizeBase = baseURL.startsWith('http') 
            ? baseURL 
            : `${window.location.protocol}//${window.location.host}${baseURL}`;
        
        const finalUrl = `${authorizeBase}${apiPrefix}${apiVersion}/auth/authorize?${queryParams.toString()}`;
        
        return finalUrl;
    },

    /**
     * 使用授权码换取 token
     * @param {Object} params - Token 请求参数
     * @param {string} params.code - 授权码（grant_type=authorization_code 时必填）
     * @param {string} params.state - 状态参数（可选）
     * @returns {Promise} Token 响应
     */
    getTokenByCode: (params = {}) => {
        const { code, state } = params;
        
        const requestBody = {
            grant_type: 'authorization_code',
            code,
            ...(state && { state }), // 状态参数，可选
        };
        
        return api.post('/auth/token', requestBody);
    },

    /**
     * 使用用户名密码直接登录（资源所有者密码凭据授权）
     * @param {Object} params - 登录参数
     * @param {string} params.username - 用户名
     * @param {string} params.password - 密码
     * @param {string} params.client_id - 客户端ID（可选）
     * @param {string} params.scope - 授权范围，默认 "profile"（可选）
     * @returns {Promise} Token 响应
     */
    loginWithPassword: (params = {}) => {
        const { username, password, client_id, scope = 'profile' } = params;
        
        return api.post('/auth/token', {
            grant_type: 'password',
            username,
            password,
            ...(client_id && { client_id }),
            scope,
        });
    },

    /**
     * 使用 refresh_token 刷新 token
     * 注意：refresh_token 存储在 HttpOnly Cookie 中，浏览器会自动携带
     * @returns {Promise} Token 响应
     */
    refreshToken: () => {
        return api.post('/auth/token', {
            grant_type: 'refresh_token',
        });
    },

    /**
     * 保存 token 到 localStorage
     * @param {Object} tokenData - Token 数据
     * @param {string} tokenData.access_token - 访问令牌（或 tokenData.accessToken）
     * @param {number} tokenData.expires_in - 过期时间（秒）
     * @param {string} tokenData.refresh_token - 刷新令牌（由后端通过 Cookie 设置，前端不处理）
     */
    saveToken: (tokenData) => {
        // 兼容两种字段名：access_token 和 accessToken
        const accessToken = tokenData.access_token || tokenData.accessToken;
        const { expires_in } = tokenData;

        if (accessToken) {
            localStorage.setItem('auth_token', accessToken);
        }

        // refresh_token 由后端通过 HttpOnly Cookie 设置，前端不需要存储

        // 计算过期时间戳
        if (expires_in) {
            const expiresAt = Date.now() + expires_in * MS_PER_SECOND;
            localStorage.setItem('token_expires_at', expiresAt.toString());
        }
    },

    /**
     * 清除 token
     * refresh_token 由后端通过 HttpOnly Cookie 管理，前端无需清除
     */
    clearToken: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_expires_at');
        localStorage.removeItem('user_info');
    },

    /**
     * 检查 token 是否过期
     * @returns {boolean} 是否过期
     */
    isTokenExpired: () => {
        const expiresAt = localStorage.getItem('token_expires_at');
        if (!expiresAt) {
            return true; // 如果没有过期时间，认为已过期
        }
        return Date.now() >= parseInt(expiresAt, 10);
    },

    /**
     * 获取当前 token
     * @returns {string|null} 访问令牌
     */
    getToken: () => {
        return localStorage.getItem('auth_token');
    },

    /**
     * 检查是否已认证（有有效的 token）
     * @returns {boolean} 是否已认证
     */
    isAuthenticated: () => {
        const token = authService.getToken();
        if (!token) {
            return false;
        }
        return !authService.isTokenExpired();
    },

    /**
     * 获取用户信息
     * @returns {Object|null} 用户信息对象
     */
    getUserInfo: () => {
        const userInfoStr = localStorage.getItem('user_info');
        if (!userInfoStr) {
            return null;
        }
        try {
            return JSON.parse(userInfoStr);
        } catch {
            return null;
        }
    },

    /**
     * 保存用户信息到 localStorage
     * @param {Object} userInfo - 用户信息对象
     */
    saveUserInfo: (userInfo) => {
        if (userInfo) {
            localStorage.setItem('user_info', JSON.stringify(userInfo));
        } else {
            localStorage.removeItem('user_info');
        }
    },

    /**
     * 退出登录
     * 调用后会在应用平台、安全培训系统、鉴权网关都退出登录
     * @returns {Promise} 退出登录响应
     */
    logout: () => {
        return api.post('/auth/logout');
    },
};

/**
 * 生成随机 state 参数，用于 CSRF 防护
 * @returns {string} 随机 state 字符串
 */
function generateState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

