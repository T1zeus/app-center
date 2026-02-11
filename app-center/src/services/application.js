import api from './api';

/**
 * 应用管理服务
 * 参考后端文档：应用管理模块
 */
export const applicationService = {
    /**
     * 获取分页应用列表
     * @param {Object} params - 查询参数
     * @param {number} params.page - 页码，默认 1
     * @param {number} params.page_size - 每页数量，默认 10
     * @param {string} params.sort - 排序，多个排序条件用英文逗号分隔，-表示降序
     * @param {Object} config - 请求配置（可选，如 signal 用于取消请求）
     * @returns {Promise} 应用列表响应
     */
    getApplicationList: (params = {}, config = {}) => {
        return api.get('/application', { params, ...config });
    },

    /**
     * 获取应用详情
     * @param {string} name - 应用唯一标识符
     * @returns {Promise} 应用详情响应
     */
    getApplicationDetail: (name) => {
        return api.get(`/application/${name}`);
    },

    /**
     * 创建应用
     * @param {Object} params - 创建参数
     * @param {string} params.name - 应用唯一标识符（必需）
     * @param {string} params.display_name - 应用名称（必需）
     * @param {Array<string>} params.redirect_uris - 重定向URI列表（必需）
     * @param {string} params.homepage_url - 应用首页链接（可选）
     * @param {string} params.description - 应用描述（可选）
     * @returns {Promise} 创建响应
     */
    createApplication: (params = {}) => {
        return api.post('/application', params);
    },

    /**
     * 更新应用信息
     * @param {string} name - 应用唯一标识符
     * @param {Object} params - 更新参数
     * @param {string} params.display_name - 应用名称（可选）
     * @param {Array<string>} params.redirect_uris - 重定向URI列表（可选）
     * @param {string} params.homepage_url - 应用首页链接（可选）
     * @param {string} params.description - 应用描述（可选）
     * @returns {Promise} 更新响应
     */
    updateApplication: (name, params = {}) => {
        return api.patch(`/application/${name}`, params);
    },
};

