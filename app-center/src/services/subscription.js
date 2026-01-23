import api from './api';

/**
 * 订阅管理服务
 * 参考后端文档：订阅管理模块
 */
export const subscriptionService = {
    /**
     * 获取分页订阅列表
     * @param {Object} params - 查询参数
     * @param {number} params.page - 页码，默认 1
     * @param {number} params.page_size - 每页数量，默认 10
     * @param {string} params.sort - 排序，多个排序条件用英文逗号分隔，-表示降序
     * @param {string} params.owner - 组织唯一标识符
     * @param {string} params.plan - 订阅计划(应用唯一标识符)
     * @param {string} params.start_time - 开始时间
     * @param {string} params.end_time - 结束时间
     * @param {string} params.state - 状态: Active(激活)、Suspended(停用)
     * @returns {Promise} 订阅列表响应
     */
    getSubscriptionList: (params = {}) => {
        return api.get('/subscription', { params });
    },

    /**
     * 获取订阅详情
     * @param {string} owner - 组织唯一标识符
     * @param {string} plan - 订阅计划(应用唯一标识符)
     * @returns {Promise} 订阅详情响应
     */
    getSubscriptionDetail: (owner, plan) => {
        return api.get(`/subscription/${owner}/${plan}`);
    },

    /**
     * 创建订阅
     * @param {Object} params - 创建参数
     * @param {string} params.plan - 订阅计划(应用唯一标识符)（必需）
     * @param {string} params.owner - 组织唯一标识符（必需）
     * @param {string} params.start_time - 开始时间（必需）
     * @param {string} params.end_time - 结束时间（必需）
     * @returns {Promise} 创建响应
     */
    createSubscription: (params = {}) => {
        return api.post('/subscription', params);
    },

    /**
     * 更新订阅信息
     * @param {string} owner - 组织唯一标识符
     * @param {string} plan - 订阅计划(应用唯一标识符)
     * @param {Object} params - 更新参数
     * @param {string} params.start_time - 开始时间（可选）
     * @param {string} params.end_time - 结束时间（可选）
     * @param {string} params.state - 状态: Active(激活)、Suspended(停用)（可选）
     * @returns {Promise} 更新响应
     */
    updateSubscription: (owner, plan, params = {}) => {
        return api.patch(`/subscription/${owner}/${plan}`, params);
    },
};

