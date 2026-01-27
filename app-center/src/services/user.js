import api from './api';

/**
 * 用户管理服务
 * 参考后端文档：用户管理模块
 */
export const userService = {
    /**
     * 获取分页用户列表
     * @param {Object} params - 查询参数
     * @param {number} params.page - 页码，默认 1
     * @param {number} params.page_size - 每页数量，默认 10
     * @param {string} params.sort - 排序，多个排序条件用英文逗号分隔，-表示降序
     * @returns {Promise} 用户列表响应
     */
    getUserList: (params = {}) => {
        return api.get('/user', { params });
    },

    /**
     * 获取用户详情
     * @param {string} owner - 所属组织
     * @param {string} name - 用户名
     * @returns {Promise} 用户详情响应
     */
    getUserDetail: (owner, name) => {
        return api.get(`/user/${owner}/${name}`);
    },

    /**
     * 创建用户
     * @param {Object} params - 创建参数
     * @param {string} params.name - 用户名（必需）
     * @param {string} params.display_name - 昵称（必需）
     * @param {string} params.owner - 所属组织（必需）
     * @param {string} params.password - 密码（必需，6-100 位）
     * @returns {Promise} 创建响应
     */
    createUser: (params = {}) => {
        return api.post('/user', params);
    },

    /**
     * 更新用户信息
     * @param {string} owner - 所属组织
     * @param {string} name - 用户名
     * @param {Object} params - 更新参数
     * @param {string} params.display_name - 昵称（必需）
     * @returns {Promise} 更新响应
     */
    updateUser: (owner, name, params = {}) => {
        return api.patch(`/user/${owner}/${name}`, params);
    },

    /**
     * 修改用户密码
     * @param {string} owner - 所属组织
     * @param {string} name - 用户名
     * @param {Object} params - 密码参数
     * @param {string} params.old_password - 旧密码（可选，管理员重置密码时可不传）
     * @param {string} params.new_password - 新密码（必需，6-100 位）
     * @returns {Promise} 修改密码响应
     */
    changePassword: (owner, name, params = {}) => {
        return api.post(`/user/${owner}/${name}/password`, params);
    },
};

