import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/auth';
import { hasRole } from '../../utils/role';
import Forbidden from '../Forbidden';

/**
 * 基于角色的路由保护组件
 * @param {Object} props - 组件属性
 * @param {React.ReactNode} props.children - 子组件
 * @param {string|Array<string>} props.allowedRoles - 允许访问的角色（'system_admin' | 'org_admin'）
 * @param {boolean} props.requireSystemAdmin - 是否要求系统管理员（快捷方式）
 * @param {boolean} props.requireOrgAdmin - 是否要求企业管理员（快捷方式）
 */
function RoleProtectedRoute({ 
  children, 
  allowedRoles, 
  requireSystemAdmin = false,
  requireOrgAdmin = false,
}) {
  const location = useLocation();
  
  // 获取用户信息
  const userInfo = authService.getUserInfo();
  
  if (!userInfo) {
    // 如果没有用户信息，重定向到登录页
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // 确定允许的角色
  let allowedRolesList = allowedRoles;
  if (requireSystemAdmin) {
    allowedRolesList = ['system_admin'];
  } else if (requireOrgAdmin) {
    allowedRolesList = ['org_admin'];
  }
  
  // 如果没有指定允许的角色，默认允许所有已登录用户
  if (!allowedRolesList || allowedRolesList.length === 0) {
    return children;
  }
  
  // 检查用户是否有权限
  const hasPermission = hasRole(allowedRolesList, userInfo);
  
  // 如果没有权限，显示 403 页面
  if (!hasPermission) {
    return <Forbidden />;
  }
  
  // 有权限，渲染子组件
  return children;
}

export default RoleProtectedRoute;

