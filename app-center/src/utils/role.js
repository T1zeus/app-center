import { authService } from '../services/auth';

/**
 * 角色常量定义
 */
export const USER_ROLES = {
  SYSTEM_ADMIN: 'system_admin',  // 系统管理员
  ORG_ADMIN: 'org_admin',        // 企业管理员
  EMPLOYEE: 'employee',          // 员工
};

/**
 * 判断 is_admin 字段是否为 true
 * 兼容多种格式：true, 1, 'true', '1'
 * @param {any} isAdmin - is_admin 字段值
 * @returns {boolean} 是否为管理员
 */
export function isAdminValue(isAdmin) {
  return isAdmin === true || isAdmin === 1 || isAdmin === 'true' || isAdmin === '1';
}

/**
 * 从用户信息中获取用户角色
 * @param {Object} userInfo - 用户信息对象
 * @returns {string|null} 用户角色（'system_admin' | 'org_admin' | 'employee' | null）
 */
export function getUserRole(userInfo) {
  if (!userInfo) {
    return null;
  }

  const isAdmin = 'is_admin' in userInfo ? isAdminValue(userInfo.is_admin) : false;
  const owner = userInfo.owner;

  if (owner === 'built-in' && isAdmin) {
    return USER_ROLES.SYSTEM_ADMIN;
  }

  if (owner && owner !== 'built-in' && isAdmin) {
    return USER_ROLES.ORG_ADMIN;
  }

  return USER_ROLES.EMPLOYEE;
}

/**
 * 标准化用户信息中的 is_admin 字段为布尔值
 * @param {Object} userInfo - 用户信息对象
 * @returns {Object} 标准化后的用户信息
 */
export function normalizeUserInfo(userInfo) {
  if (!userInfo) return userInfo;
  return { ...userInfo, is_admin: isAdminValue(userInfo.is_admin) };
}

/**
 * 判断用户是否为系统管理员
 * @param {Object} userInfo - 用户信息对象（可选，如果不传则从 authService 获取）
 * @returns {boolean} 是否为系统管理员
 */
export function isSystemAdmin(userInfo = null) {
  return getUserRole(userInfo || authService.getUserInfo()) === USER_ROLES.SYSTEM_ADMIN;
}

/**
 * 检查用户是否有指定角色
 * @param {string|Array<string>} roles - 允许的角色或角色数组
 * @param {Object} userInfo - 用户信息对象（可选）
 * @returns {boolean} 是否有权限
 */
export function hasRole(roles, userInfo = null) {
  const userRole = getUserRole(userInfo || authService.getUserInfo());
  if (!userRole) {
    return false;
  }

  const rolesList = Array.isArray(roles) ? roles : [roles];
  return rolesList.includes(userRole);
}

