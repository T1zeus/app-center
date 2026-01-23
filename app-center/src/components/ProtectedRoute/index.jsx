import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useState, useEffect } from 'react';
import { authService } from '../../services/auth';

/**
 * 受保护的路由组件
 * 用于保护需要登录才能访问的页面
 */
function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 检查是否已登录
    // 注意：不再主动检查 token 过期，改为在 401 错误时自动刷新
    // 只要有 token 就认为已登录，让后续的 API 请求在 401 时自动刷新
    const checkAuth = () => {
      const token = authService.getToken();
      
      if (token) {
        // 有 token，认为已登录（即使过期，也会在 401 时自动刷新）
        setIsAuthenticated(true);
      } else {
        // 没有 token，需要登录
        setIsAuthenticated(false);
      }
      
      setIsChecking(false);
    };

    checkAuth();
  }, []);

  // 正在检查时显示加载状态
  if (isChecking) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#666' }}>正在验证登录状态...</div>
      </div>
    );
  }

  // 如果未登录，重定向到登录页，并保存当前路径以便登录后返回
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // 已登录，渲染子组件
  return children;
}

export default ProtectedRoute;

