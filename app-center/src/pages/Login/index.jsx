import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button, message, Spin, Input } from 'antd';

import './index.less';
import { authService } from '../../services/auth';
import { userService } from '../../services/user';
import { normalizeUserInfo } from '../../utils/role';

/**
 * OAuth2 错误代码映射表
 */
const OAUTH_ERROR_MESSAGES = {
  'invalid_grant': '授权码无效或已过期，请重新登录',
  'invalid_client': '客户端认证失败',
  'invalid_request': '请求参数错误',
  'unauthorized_client': '客户端未授权',
  'unsupported_grant_type': '不支持的授权类型',
  'invalid_scope': '授权范围无效',
  'server_error': '服务器错误，请稍后重试',
  'temporarily_unavailable': '服务暂时不可用，请稍后重试',
};

/**
 * 从 JWT token 中解析用户信息
 */
function parseJwtPayload(accessToken) {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return {
      username: payload.name || payload.sub,
      owner: payload.owner,
    };
  } catch {
    return { username: null, owner: null };
  }
}

/**
 * 解析 OAuth2 错误信息
 */
function parseOAuth2Error(err) {
  let errorMessage = '登录失败，请重试';

  if (!err.data) {
    return err.message || errorMessage;
  }

  const parseErrorData = (data) => {
    if (typeof data === 'object') {
      const oauthError = data.error;
      const oauthErrorDesc = data.error_description;

      if (oauthError) {
        return OAUTH_ERROR_MESSAGES[oauthError] || oauthErrorDesc || oauthError;
      }
      return data.error_description || data.error || data.message || JSON.stringify(data);
    }

    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return parseErrorData(parsed);
      } catch {
        return data;
      }
    }

    return errorMessage;
  };

  return parseErrorData(err.data);
}

/**
 * 获取用户信息
 * 优先使用 token 中的 user_info，否则从 JWT 解析，最后调用详情接口
 */
async function fetchUserInfo(tokenData) {
  if (tokenData.user_info) {
    authService.saveUserInfo(normalizeUserInfo(tokenData.user_info));
    return;
  }

  const accessToken = tokenData.access_token || tokenData.accessToken;
  if (!accessToken) {
    authService.saveUserInfo({ name: '管理员', is_admin: false });
    return;
  }

  const { username, owner } = parseJwtPayload(accessToken);

  if (!username || !owner) {
    authService.saveUserInfo({
      name: username || '管理员',
      owner: owner || undefined,
      is_admin: false,
    });
    return;
  }

  try {
    const userDetailResponse = await userService.getUserDetail(owner, username);
    if (userDetailResponse?.data) {
      authService.saveUserInfo({
        ...userDetailResponse.data,
        name: userDetailResponse.data.name || username,
        display_name: userDetailResponse.data.display_name || userDetailResponse.data.name || username,
        owner: userDetailResponse.data.owner || owner,
      });
    } else {
      throw new Error('用户详情接口返回数据为空');
    }
  } catch {
    authService.saveUserInfo({
      name: username,
      owner,
      is_admin: false,
    });
  }
}

/**
 * 处理登录成功
 */
function handleLoginSuccess(tokenData, navigate, location, processedCodeKey) {
  authService.saveToken(tokenData);

  fetchUserInfo(tokenData).then(() => {
    message.success('登录成功');
    window.history.replaceState({}, '', '/login');

    setTimeout(() => {
      sessionStorage.removeItem(processedCodeKey);
    }, 1000);

    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  });
}

/**
 * 处理登录错误
 */
function handleLoginError(err, navigate, location, processedCodeKey, code, processedCodeRef) {
  // 特殊处理：状态码 200 且有 token 数据
  if (err.status === 200 && err.data?.access_token) {
    authService.saveToken(err.data);
    if (err.data.user_info) {
      authService.saveUserInfo(normalizeUserInfo(err.data.user_info));
    } else {
      authService.saveUserInfo({ name: '管理员', is_admin: false });
    }
    message.success('登录成功');
    window.history.replaceState({}, '', '/login');
    navigate(location.state?.from?.pathname || '/', { replace: true });
    return;
  }

  const errorMessage = parseOAuth2Error(err);
  message.error(errorMessage);
  window.history.replaceState({}, '', '/login');

  if (processedCodeRef.current === code) {
    sessionStorage.removeItem(processedCodeKey);
    processedCodeRef.current = null;
  }
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const organizationFromUrl = searchParams.get('organization');
  const [organization, setOrganization] = useState('');
  const isProcessingRef = useRef(false);
  const processedCodeRef = useRef(null);

  // 初始化组织名称
  useEffect(() => {
    if (organizationFromUrl) {
      setOrganization(organizationFromUrl);
    } else {
      const previousUserInfo = authService.getUserInfo();
      if (previousUserInfo?.owner && previousUserInfo.owner !== 'built-in') {
        setOrganization(previousUserInfo.owner);
      }
    }
  }, [organizationFromUrl]);

  // 处理 OAuth2 回调
  useEffect(() => {
    if (isProcessingRef.current || !code) {
      return;
    }

    const processedCodeKey = `processed_code_${code}`;
    if (sessionStorage.getItem(processedCodeKey)) {
      window.history.replaceState({}, '', '/login');
      navigate(location.state?.from?.pathname || '/', { replace: true });
      return;
    }

    const handleCallback = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      sessionStorage.setItem(processedCodeKey, 'true');
      processedCodeRef.current = code;

      if (error) {
        message.error(`登录失败: ${error}`);
        window.history.replaceState({}, '', '/login');
        isProcessingRef.current = false;
        return;
      }

      // 清除保存的 state
      sessionStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_state');

      try {
        const response = await authService.getTokenByCode({ code });
        const tokenData = response.data;

        if (tokenData?.access_token || tokenData?.accessToken) {
          handleLoginSuccess(tokenData, navigate, location, processedCodeKey);
          isProcessingRef.current = false;
        } else {
          message.error('登录失败：未获取到 token');
          window.history.replaceState({}, '', '/login');
          isProcessingRef.current = false;
        }
      } catch (err) {
        handleLoginError(err, navigate, location, processedCodeKey, code, processedCodeRef);
        isProcessingRef.current = false;
      }
    };

    handleCallback();

    return () => {
      // 清理函数
    };
  }, [code, error, navigate, location]);

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
    // 验证企业标识是否填写
    const orgName = organization.trim();
    if (!orgName) {
      message.error('请输入企业标识');
      return;
    }
    
    // 跳转到 OAuth2 授权端点
    const redirectUri = window.location.origin + '/login';
    
    // 根据 API 文档，client_id 是组织唯一标识
    // 使用输入框中的企业标识（必填）
    const clientId = orgName;
    
    const authorizeUrl = authService.getAuthorizeUrl({
      // client_id: 组织唯一标识，必填
      client_id: clientId,
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
            placeholder="请输入企业标识（必填）"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            size="large"
            allowClear
            onPressEnter={handleLogin}
            required
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

