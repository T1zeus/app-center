import { Navigate, useLocation } from 'react-router-dom';
import { useAuthCheck } from '../../hooks/useAuthCheck';
import { LoadingScreen } from '../LoadingScreen';

/**
 * 受保护的路由组件
 * 用于保护需要登录才能访问的页面
 */
function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isChecking, isAuthenticated } = useAuthCheck(false);

  if (isChecking) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default ProtectedRoute;

