import { hasRole, USER_ROLES } from '../../utils/role';

/**
 * 权限包装组件
 * 根据用户权限显示或隐藏子组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 * @param {string|Array<string>} props.roles - 允许的角色或角色数组
 * @param {boolean} props.requireSystemAdmin - 是否要求系统管理员（快捷方式）
 * @param {boolean} props.requireOrgAdmin - 是否要求企业管理员（快捷方式）
 * @param {React.ReactNode} props.fallback - 无权限时显示的组件（可选）
 */
function PermissionWrapper({
  children,
  roles,
  requireSystemAdmin = false,
  requireOrgAdmin = false,
  fallback = null,
}) {
  // 确定允许的角色
  let allowedRoles = roles;
  if (requireSystemAdmin) {
    allowedRoles = [USER_ROLES.SYSTEM_ADMIN];
  } else if (requireOrgAdmin) {
    allowedRoles = [USER_ROLES.ORG_ADMIN];
  }

  // 如果没有指定角色，默认显示
  if (!allowedRoles || allowedRoles.length === 0) {
    return children;
  }

  // 检查权限
  const hasPermission = hasRole(allowedRoles);

  // 有权限则显示子组件，否则显示 fallback 或 null
  return hasPermission ? children : fallback;
}

export default PermissionWrapper;

