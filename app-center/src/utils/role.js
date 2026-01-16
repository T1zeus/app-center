import { authService } from '../services/auth';

/**
 * 角色常量定义
 */
export const USER_ROLES = {
  SYSTEM_ADMIN: 'system_admin',  // 系统管理员
  ORG_ADMIN: 'org_admin',        // 企业管理员
};

/**
 * 角色显示名称映射
 */
export const ROLE_DISPLAY_NAMES = {
  [USER_ROLES.SYSTEM_ADMIN]: '系统管理员',
  [USER_ROLES.ORG_ADMIN]: '企业管理员',
};

/**
 * 判断 is_admin 字段是否为 true
 * 兼容多种格式：true, 1, 'true', '1'
 * @param {any} isAdmin - is_admin 字段值
 * @returns {boolean} 是否为管理员
 */
function isAdminValue(isAdmin) {
  return isAdmin === true || isAdmin === 1 || isAdmin === 'true' || isAdmin === '1';
}

/**
 * 从用户信息中获取用户角色
 * @param {Object} userInfo - 用户信息对象
 * @returns {string|null} 用户角色（'system_admin' | 'org_admin' | null）
 */
export function getUserRole(userInfo) {
  if (!userInfo) {
    return null;
  }
  
  // 方式1：优先判断 owner 字段，如果 owner 是 "built-in"，则为系统管理员（内建组织）
  if (userInfo.owner === 'built-in') {
    return USER_ROLES.SYSTEM_ADMIN;
  }
  
  // 方式2：通过 is_admin 字段判断
  // 如果 is_admin 为 true，则为系统管理员
  // 如果 is_admin 为 false 或不存在，则为企业管理员
  if ('is_admin' in userInfo) {
    if (isAdminValue(userInfo.is_admin)) {
      return USER_ROLES.SYSTEM_ADMIN;
    } else {
      // is_admin 为 false，判断为企业管理员
      return USER_ROLES.ORG_ADMIN;
    }
  }
  
  // 如果 is_admin 字段不存在，但有 owner 字段且不是 built-in，默认为企业管理员
  if (userInfo.owner) {
    return USER_ROLES.ORG_ADMIN;
  }
  
  // 如果既没有 owner 也没有 is_admin，默认为企业管理员（安全起见）
  return USER_ROLES.ORG_ADMIN;
}

/**
 * 判断用户是否为系统管理员
 * @param {Object} userInfo - 用户信息对象（可选，如果不传则从 authService 获取）
 * @returns {boolean} 是否为系统管理员
 */
export function isSystemAdmin(userInfo = null) {
  const user = userInfo || authService.getUserInfo();
  return getUserRole(user) === USER_ROLES.SYSTEM_ADMIN;
}

/**
 * 判断用户是否为企业管理员
 * @param {Object} userInfo - 用户信息对象（可选，如果不传则从 authService 获取）
 * @returns {boolean} 是否为企业管理员
 */
export function isOrgAdmin(userInfo = null) {
  const user = userInfo || authService.getUserInfo();
  return getUserRole(user) === USER_ROLES.ORG_ADMIN;
}

/**
 * 获取当前用户角色
 * @returns {string|null} 当前用户角色
 */
export function getCurrentUserRole() {
  const userInfo = authService.getUserInfo();
  return getUserRole(userInfo);
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

/**
 * 检查用户是否有系统管理员权限
 * @param {Object} userInfo - 用户信息对象（可选）
 * @returns {boolean} 是否有系统管理员权限
 */
export function hasSystemAdminPermission(userInfo = null) {
  return isSystemAdmin(userInfo);
}

/**
 * 检查用户是否有企业管理员权限
 * @param {Object} userInfo - 用户信息对象（可选）
 * @returns {boolean} 是否有企业管理员权限
 */
export function hasOrgAdminPermission(userInfo = null) {
  return isOrgAdmin(userInfo);
}

