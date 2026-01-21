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
 * 角色显示名称映射
 */
export const ROLE_DISPLAY_NAMES = {
  [USER_ROLES.SYSTEM_ADMIN]: '系统管理员',
  [USER_ROLES.ORG_ADMIN]: '企业管理员',
  [USER_ROLES.EMPLOYEE]: '员工',
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
 * @returns {string|null} 用户角色（'system_admin' | 'org_admin' | 'employee' | null）
 */
export function getUserRole(userInfo) {
  if (!userInfo) {
    return null;
  }
  
  // 判断 is_admin 字段的值
  const isAdmin = 'is_admin' in userInfo ? isAdminValue(userInfo.is_admin) : false;
  const owner = userInfo.owner;
  
  // 规则1：owner 为 'built-in' 且 is_admin 为 true → 系统管理员
  if (owner === 'built-in' && isAdmin) {
    return USER_ROLES.SYSTEM_ADMIN;
  }
  
  // 规则2：owner 不为 'built-in' 且 is_admin 为 true → 企业管理员
  if (owner && owner !== 'built-in' && isAdmin) {
    return USER_ROLES.ORG_ADMIN;
  }
  
  // 规则3：其他情况 → 员工
  return USER_ROLES.EMPLOYEE;
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
 * 判断用户是否为员工
 * @param {Object} userInfo - 用户信息对象（可选，如果不传则从 authService 获取）
 * @returns {boolean} 是否为员工
 */
export function isEmployee(userInfo = null) {
  const user = userInfo || authService.getUserInfo();
  return getUserRole(user) === USER_ROLES.EMPLOYEE;
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

