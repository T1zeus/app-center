import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Organizations from './pages/Organizations';
import Applications from './pages/Applications';
import Users from './pages/Users';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 登录页面 - 使用 PublicRoute，已登录用户会被重定向 */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        
        {/* 需要登录的管理后台路由 - 使用 ProtectedRoute 保护整个 AdminLayout */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Routes>
                  {/* 应用中心首页 - 所有已登录用户都可以访问 */}
                  <Route path="/" element={<Home />} />
                  
                  {/* 系统管理员路由 - 只有系统管理员可以访问 */}
                  <Route 
                    path="/organizations" 
                    element={
                      <RoleProtectedRoute requireSystemAdmin>
                        <Organizations />
                      </RoleProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/applications" 
                    element={
                      <RoleProtectedRoute requireSystemAdmin>
                        <Applications />
                      </RoleProtectedRoute>
                    } 
                  />
                  
                  {/* 用户管理路由 - 系统管理员和企业管理员都可以访问 */}
                  <Route 
                    path="/users" 
                    element={
                      <RoleProtectedRoute allowedRoles={['system_admin', 'org_admin']}>
                        <Users />
                      </RoleProtectedRoute>
                    }
                  />
                  
                  {/* 默认重定向到首页 */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AdminLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
