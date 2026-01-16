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
    // 检查是否已登录，如果过期则尝试刷新
    const checkAuth = async () => {
      const token = authService.getToken();
      const isExpired = authService.isTokenExpired();
      
      if (token && !isExpired) {
        // Token 有效，直接通过
        setIsAuthenticated(true);
        setIsChecking(false);
        return;
      }
      
      // Token 过期或不存在，尝试刷新
      const refreshToken = authService.getRefreshToken();
      if (refreshToken && isExpired) {
        try {
          // 尝试刷新 token
          const response = await authService.refreshToken(refreshToken);
          if (response.data) {
            authService.saveToken(response.data);
            setIsAuthenticated(true);
            setIsChecking(false);
            return;
          }
        } catch (error) {
          console.error('刷新 token 失败:', error);
          // 刷新失败，清除 token
          authService.clearToken();
        }
      }
      
      // 无法刷新或没有 refresh_token，需要登录
      setIsAuthenticated(false);
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

