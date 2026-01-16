import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useState, useEffect } from 'react';
import { authService } from '../../services/auth';

/**
 * 公共路由组件
 * 用于登录页面，如果已登录则重定向到应用中心首页
 */
function PublicRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // 检查是否已登录
    const checkAuth = () => {
      const token = authService.getToken();
      const isExpired = authService.isTokenExpired();
      
      if (token && !isExpired) {
        setIsAuthenticated(true);
      } else {
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

  // 如果已登录，重定向到应用中心首页
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // 未登录，渲染登录页面
  return children;
}

export default PublicRoute;

