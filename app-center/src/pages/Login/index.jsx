import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button, message, Spin, Input } from 'antd';

import './index.less';
import { authService } from '../../services/auth';
import { userService } from '../../services/user';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const organizationFromUrl = searchParams.get('organization'); // 从 URL 参数获取组织名称
  const [organization, setOrganization] = useState(''); // 组织名称输入框的值
  const isProcessingRef = useRef(false); // 防止重复执行
  const processedCodeRef = useRef(null); // 记录已处理的 code，避免重复处理
  
  // 初始化组织名称：优先使用 URL 参数，其次使用之前登录用户的组织信息
  useEffect(() => {
    if (organizationFromUrl) {
      setOrganization(organizationFromUrl);
    } else {
      // 尝试从之前登录的用户信息中获取组织
      const previousUserInfo = authService.getUserInfo();
      if (previousUserInfo && previousUserInfo.owner && previousUserInfo.owner !== 'built-in') {
        setOrganization(previousUserInfo.owner);
      }
    }
  }, [organizationFromUrl]);

  // 处理 OAuth2 回调
  useEffect(() => {
    // 如果正在处理或没有 code，直接返回
    if (isProcessingRef.current || !code) {
      return;
    }
    
    // 如果这个 code 已经被处理过，直接返回
    // 使用 sessionStorage 来跨渲染周期保存已处理的 code
    const processedCodeKey = `processed_code_${code}`;
    if (sessionStorage.getItem(processedCodeKey)) {
      // 清除 URL 参数并跳转
      window.history.replaceState({}, '', '/login');
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
      return;
    }

    const handleCallback = async () => {
      // 防止重复执行
      if (isProcessingRef.current) {
        return;
      }
      isProcessingRef.current = true;
      
      // 标记这个 code 已被处理
      sessionStorage.setItem(processedCodeKey, 'true');
      processedCodeRef.current = code;
      // 如果有错误参数，显示错误信息
      if (error) {
        message.error(`登录失败: ${error}`);
        // 清除 URL 参数
        window.history.replaceState({}, '', '/login');
        return;
      }

      // 如果有 code，说明是回调（state 是可选的，后端可能不返回）
      if (code) {
        // 注意：state 验证应该由后端完成
        // 前端只负责传递 state 参数，不进行验证
        // 因为跳转到授权页面后，sessionStorage 可能会丢失
        
        // 清除保存的 state（如果存在）
        sessionStorage.removeItem('oauth_state');
        localStorage.removeItem('oauth_state');

        try {
          // 使用授权码换取 token
          // 根据 API 文档，token 请求只需要 grant_type、code 和可选的 state
          const response = await authService.getTokenByCode({ 
            code, 
            ...(state && { state }), // state 是可选的
          });
          
          // 保存 token
          // 后端返回格式：{ code: 0, message: "string", data: { access_token, token_type, expires_in, refresh_token, scope } }
          // 响应拦截器已经处理过，response.data 就是 data 字段的内容
          const tokenData = response.data;
          
          if (tokenData && (tokenData.access_token || tokenData.accessToken)) {
            authService.saveToken(tokenData);
            
            // 获取用户信息（如果后端返回）
            if (tokenData.user_info) {
              // 确保 is_admin 字段被正确保存（兼容多种格式）
              const userInfo = {
                ...tokenData.user_info,
                // 标准化 is_admin 字段：确保是布尔值
                is_admin: tokenData.user_info.is_admin === true || 
                         tokenData.user_info.is_admin === 1 || 
                         tokenData.user_info.is_admin === 'true' || 
                         tokenData.user_info.is_admin === '1',
              };
              
              authService.saveUserInfo(userInfo);
            } else {
              // Token 中没有 user_info，尝试从 JWT token 中解析用户名，然后调用用户详情接口
              // 尝试解析 JWT token 获取用户名
              let username = null;
              try {
                const accessToken = tokenData.access_token || tokenData.accessToken;
                if (accessToken) {
                  // JWT token 格式：header.payload.signature
                  const payload = JSON.parse(atob(accessToken.split('.')[1]));
                  username = payload.name || payload.sub;
                }
              } catch (err) {
                // 解析失败，忽略
              }
              
              // 如果有用户名，调用用户详情接口获取完整信息
              if (username) {
                try {
                  const userDetailResponse = await userService.getUserDetail(username);
                  
                  if (userDetailResponse && userDetailResponse.data) {
                    // 保存完整的用户信息，包括 owner 和 is_admin
                    const fullUserInfo = {
                      name: userDetailResponse.data.name || username,
                      display_name: userDetailResponse.data.display_name || userDetailResponse.data.name || username,
                      owner: userDetailResponse.data.owner || undefined, // 保存 owner 字段
                      is_admin: userDetailResponse.data.is_admin === true || 
                               userDetailResponse.data.is_admin === 1 || 
                               userDetailResponse.data.is_admin === 'true' || 
                               userDetailResponse.data.is_admin === '1',
                      id: userDetailResponse.data.id,
                      // 保留其他字段
                      ...userDetailResponse.data,
                    };
                    
                    authService.saveUserInfo(fullUserInfo);
                  } else {
                    throw new Error('用户详情接口返回数据为空');
                  }
                } catch (err) {
                  // 如果获取失败，尝试从 JWT token 中提取 owner
                  try {
                    const accessToken = tokenData.access_token || tokenData.accessToken;
                    if (accessToken) {
                      const payload = JSON.parse(atob(accessToken.split('.')[1]));
                      
                      // 使用 JWT token 中的信息
                      const fallbackUserInfo = {
                        name: username || '管理员',
                        owner: payload.owner || undefined,
                        is_admin: payload.isAdmin === true || payload.isAdmin === 1 || payload.isAdmin === 'true' || payload.isAdmin === '1',
                      };
                      
                      authService.saveUserInfo(fallbackUserInfo);
                    }
                  } catch (jwtErr) {
                    // 如果都失败，使用默认值
                    authService.saveUserInfo({
                      name: username || '管理员',
                      is_admin: false,
                    });
                  }
                }
              } else {
                // 如果无法获取用户名，使用默认值
                authService.saveUserInfo({
                  name: '管理员',
                  is_admin: false, // 默认不是管理员
                });
              }
            }
            
            message.success('登录成功');
            // 清除 URL 参数（立即清除，避免重复处理）
            window.history.replaceState({}, '', '/login');
            // 清除已处理的 code 标记（延迟清除，确保跳转完成）
            setTimeout(() => {
              sessionStorage.removeItem(processedCodeKey);
            }, 1000);
            // 跳转到之前尝试访问的页面，如果没有则跳转到应用中心首页
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
            // 重置处理标志（跳转后组件会卸载，但为了安全还是重置）
            isProcessingRef.current = false;
          } else {
            message.error('登录失败：未获取到 token');
            window.history.replaceState({}, '', '/login');
            isProcessingRef.current = false;
          }
        } catch (err) {
          // 如果状态码是 200 且有 token 数据，说明实际上是成功的，只是被错误拦截器捕获了
          if (err.status === 200 && err.data && (err.data.access_token || err.data.accessToken)) {
            try {
              authService.saveToken(err.data);
              
              if (err.data.user_info) {
                // 确保 is_admin 字段被正确保存（兼容多种格式）
                const userInfo = {
                  ...err.data.user_info,
                  // 标准化 is_admin 字段：确保是布尔值
                  is_admin: err.data.user_info.is_admin === true || 
                           err.data.user_info.is_admin === 1 || 
                           err.data.user_info.is_admin === 'true' || 
                           err.data.user_info.is_admin === '1',
                };
                authService.saveUserInfo(userInfo);
              } else {
                authService.saveUserInfo({
                  name: '管理员',
                  is_admin: false, // 默认不是管理员
                });
              }
              
              message.success('登录成功');
              window.history.replaceState({}, '', '/login');
              // 跳转到之前尝试访问的页面，如果没有则跳转到应用中心首页
              const from = location.state?.from?.pathname || '/';
              navigate(from, { replace: true });
              isProcessingRef.current = false;
              return;
            } catch (saveError) {
              isProcessingRef.current = false;
            }
          }
          
          // 尝试解析错误信息
          let errorMessage = '登录失败，请重试';
          if (err.data) {
            // 如果 data 是对象，尝试获取错误信息
            if (typeof err.data === 'object') {
              // OAuth2 错误格式：{ error: "invalid_grant", error_description: "..." }
              const oauthError = err.data.error;
              const oauthErrorDesc = err.data.error_description;
              
              // 将 OAuth2 错误代码转换为友好的中文消息
              if (oauthError) {
                const errorMessages = {
                  'invalid_grant': '授权码无效或已过期，请重新登录',
                  'invalid_client': '客户端认证失败',
                  'invalid_request': '请求参数错误',
                  'unauthorized_client': '客户端未授权',
                  'unsupported_grant_type': '不支持的授权类型',
                  'invalid_scope': '授权范围无效',
                  'server_error': '服务器错误，请稍后重试',
                  'temporarily_unavailable': '服务暂时不可用，请稍后重试',
                };
                
                errorMessage = errorMessages[oauthError] || oauthErrorDesc || oauthError;
              } else {
                errorMessage = err.data.error_description 
                  || err.data.error 
                  || err.data.message 
                  || JSON.stringify(err.data);
              }
            } else if (typeof err.data === 'string') {
              // 如果是字符串，尝试解析为 JSON
              try {
                const parsed = JSON.parse(err.data);
                const oauthError = parsed.error;
                const oauthErrorDesc = parsed.error_description;
                
                if (oauthError) {
                  const errorMessages = {
                    'invalid_grant': '授权码无效或已过期，请重新登录',
                    'invalid_client': '客户端认证失败',
                    'invalid_request': '请求参数错误',
                    'unauthorized_client': '客户端未授权',
                    'unsupported_grant_type': '不支持的授权类型',
                    'invalid_scope': '授权范围无效',
                    'server_error': '服务器错误，请稍后重试',
                    'temporarily_unavailable': '服务暂时不可用，请稍后重试',
                  };
                  
                  errorMessage = errorMessages[oauthError] || oauthErrorDesc || oauthError;
                } else {
                  errorMessage = parsed.error_description 
                    || parsed.error 
                    || parsed.message 
                    || err.data;
                }
              } catch {
                errorMessage = err.data;
              }
            }
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          message.error(errorMessage);
          // 清除 URL 参数
          window.history.replaceState({}, '', '/login');
          // 清除已处理的 code 标记（即使失败也要清除，避免永久阻塞）
          if (processedCodeRef.current === code) {
            sessionStorage.removeItem(processedCodeKey);
            processedCodeRef.current = null;
          }
          isProcessingRef.current = false;
        }
      }
    };

    handleCallback();

    // 清理函数：组件卸载时重置标志
    return () => {
      // 注意：不要在这里重置 isProcessingRef，因为可能正在处理中
      // 只在组件真正卸载时才清理
    };
  }, [code, state, error, navigate, location]);

  // 如果正在处理回调，显示加载状态
  if (code) {
    return (
      <div className='login'>
        <div className='title'>应用大平台</div>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666' }}>正在登录...</div>
        </div>
      </div>
    );
  }

  const handleLogin = () => {
    // 跳转到 OAuth2 授权端点
    const redirectUri = window.location.origin + '/login';
    
    // 根据 API 文档，client_id 是组织唯一标识
    // 优先级：1. 输入框中的组织名称 2. URL 参数中的 organization
    const orgName = organization.trim() || organizationFromUrl || null;
    const clientId = orgName || null;
    
    const authorizeUrl = authService.getAuthorizeUrl({
      // client_id: 组织唯一标识，不传则使用默认组织（built-in）
      ...(clientId && { client_id: clientId }),
      // redirect_uri: 重定向URI，不传则使用默认值
      redirect_uri: redirectUri,
    });
    
    // 跳转到授权页面
    window.location.href = authorizeUrl;
  };

  return (
    <div className='login'>
      <div className='title'>应用大平台</div>
      <div className='login-form'>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="请输入企业名称（可选，不填则使用默认组织）"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            size="large"
            allowClear
            onPressEnter={handleLogin}
          />
        </div>
        <Button 
          block 
          type="primary" 
          onClick={handleLogin}
          size="large"
        >
          登录
        </Button>
        <div className='login-bg'></div>
      </div>
    </div>
  )
}

export default Login

