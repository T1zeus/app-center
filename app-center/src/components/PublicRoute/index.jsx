import { Navigate } from 'react-router-dom';
import { useAuthCheck } from '../../hooks/useAuthCheck';
import { LoadingScreen } from '../LoadingScreen';

/**
 * 公共路由组件
 * 用于登录页面，如果已登录则重定向到应用中心首页
 */
function PublicRoute({ children }) {
  const { isChecking, isAuthenticated } = useAuthCheck(true);

  if (isChecking) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default PublicRoute;

