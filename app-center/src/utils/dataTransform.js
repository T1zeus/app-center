/**
 * 数据转换工具函数
 * 统一处理后端返回的数据格式
 */

/**
 * 转换应用数据
 * @param {Object} app - 后端返回的应用对象
 * @returns {Object} 转换后的应用对象
 */
export function transformApplication(app) {
  return {
    id: app.name,
    name: app.name,
    displayName: app.display_name || app.name,
    organization: app.organization || '-',
    clientId: app.client_id || '-',
    redirectUris: app.redirect_uris || [],
    isShared: app.is_shared || false,
  };
}

/**
 * 转换组织数据
 * @param {Object} org - 后端返回的组织对象
 * @returns {Object} 转换后的组织对象
 */
export function transformOrganization(org) {
  return {
    id: org.name,
    name: org.name,
    displayName: org.display_name || org.name,
  };
}

/**
 * 转换用户数据
 * @param {Object} user - 后端返回的用户对象
 * @returns {Object} 转换后的用户对象
 */
export function transformUser(user) {
  return {
    id: user.id || user.name,
    name: user.name,
    displayName: user.display_name || user.name,
    owner: user.owner || '-',
    is_admin: user.is_admin || user.isAdmin || false,
    email: user.email || '-',
    phone: user.phone || '-',
  };
}

/**
 * 转换订阅数据
 * @param {Object} sub - 后端返回的订阅对象
 * @returns {Object} 转换后的订阅对象
 */
export function transformSubscription(sub) {
  return {
    id: `${sub.owner}-${sub.plan}`,
    name: sub.name,
    owner: sub.owner,
    plan: sub.plan,
    displayName: sub.display_name || `${sub.owner}-${sub.plan}`,
    startTime: sub.start_time,
    endTime: sub.end_time,
    state: sub.state,
  };
}

/**
 * 批量转换数据
 * @param {Array} items - 数据数组
 * @param {Function} transformer - 转换函数
 * @returns {Array} 转换后的数组
 */
export function transformList(items, transformer) {
  if (!Array.isArray(items)) return [];
  return items.map(transformer);
}

/**
 * 为 Select 组件转换组织选项
 * @param {Array} orgs - 组织数组
 * @returns {Array} Select 选项数组
 */
export function transformToSelectOptions(orgs) {
  return orgs.map((org) => ({
    label: org.display_name || org.name,
    value: org.name,
  }));
}
