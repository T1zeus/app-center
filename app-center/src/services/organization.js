import api from './api';

/**
 * 组织管理服务
 * 参考后端文档：组织管理模块
 */
export const organizationService = {
    /**
     * 获取分页组织列表
     * @param {Object} params - 查询参数
     * @param {number} params.page - 页码，默认 1
     * @param {number} params.page_size - 每页数量，默认 10
     * @param {string} params.sort - 排序，多个排序条件用英文逗号分隔，-表示降序
     * @returns {Promise} 组织列表响应
     */
    getOrganizationList: (params = {}) => {
        return api.get('/organization', { params });
    },

    /**
     * 获取组织详情
     * @param {string} name - 组织唯一标识符
     * @returns {Promise} 组织详情响应
     */
    getOrganizationDetail: (name) => {
        return api.get(`/organization/${name}`);
    },

    /**
     * 创建组织
     * @param {Object} params - 创建参数
     * @param {string} params.name - 组织唯一标识符（必需）
     * @param {string} params.display_name - 组织名称（必需）
     * @returns {Promise} 创建响应
     */
    createOrganization: (params = {}) => {
        return api.post('/organization', params);
    },

    /**
     * 更新组织信息
     * @param {string} name - 组织唯一标识符
     * @param {Object} params - 更新参数
     * @param {string} params.display_name - 组织名称（可选）
     * @returns {Promise} 更新响应
     */
    updateOrganization: (name, params = {}) => {
        return api.patch(`/organization/${name}`, params);
    },
};

