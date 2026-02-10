// src/services/api.js
import Request from '../utils/request';
import { message } from 'antd';
import { authService } from './auth';
import { API } from '../constants';

// 创建 API 实例
const api = new Request({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: API.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token 刷新标志，防止并发刷新
let isRefreshing = false;
let refreshPromise = null;
// 请求队列：存储等待 token 刷新完成的请求
let pendingRequests = [];

/**
 * 辅助函数：保存请求配置的关键字段，避免 undefined 传播
 * @param {Object} originalRequest - 原始请求配置
 * @returns {Object} 保存的配置对象
 */
function saveRequestConfig(originalRequest) {
  const savedConfig = {
    url: originalRequest.url,
    method: originalRequest.method || 'GET',
    headers: originalRequest.headers ? { ...originalRequest.headers } : {},
  };
  // 保存 data 和 params（如果存在）
  if (originalRequest.data) savedConfig.data = originalRequest.data;
  if (originalRequest.params) savedConfig.params = { ...originalRequest.params };
  if (originalRequest.extraOptions) savedConfig.extraOptions = { ...originalRequest.extraOptions };
  return savedConfig;
}

// 请求拦截器 - 添加认证 token 和统一路径处理
api.useRequestInterceptor(async (config) => {
  // 刷新 token 的请求不需要添加 access_token，也不需要检查过期
  const isTokenRequest = config.url === '/auth/token';
  
  // 确保 GET/HEAD 请求没有 body
  const method = (config.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    // 移除可能存在的 data，避免 GET 请求带 body
    delete config.data;
    // 如果 data 存在且 params 不存在，将 data 转为 params（兼容某些库的用法）
    if (config.data && !config.params) {
      config.params = config.data;
      delete config.data;
    }
  }
  
  // 检查 token 是否过期，如果过期且不是刷新 token 的请求，则先刷新
  if (!isTokenRequest && authService.isTokenExpired()) {
    if (!isRefreshing) {
      // 开始刷新 token
      isRefreshing = true;
      refreshPromise = authService.refreshToken()
        .then(response => {
          if (response.data) {
            authService.saveToken(response.data);
            const newToken = response.data.access_token || response.data.accessToken;
            // 执行所有挂起的请求
            pendingRequests.forEach(callback => {
              try {
                callback(newToken);
              } catch {
                // 执行挂起请求失败，静默处理
              }
            });
            pendingRequests = [];
            isRefreshing = false;
            refreshPromise = null;
            return newToken;
          }
          throw new Error('刷新 token 失败');
        })
        .catch(error => {
          // 刷新失败，拒绝所有挂起的请求
          const failedCallbacks = [...pendingRequests];
          pendingRequests = [];
          
          failedCallbacks.forEach(callback => {
            try {
              // 传递 null 表示刷新失败
              if (typeof callback === 'function') {
                callback(null);
              }
            } catch {
              // 执行挂起请求失败，静默处理
            }
          });
          
          isRefreshing = false;
          refreshPromise = null;
          // 不在这里直接跳转登录，让错误拦截器处理401错误
          // 这样可以避免在请求拦截器中直接跳转，让错误处理更统一
          throw error;
        });
    }
    
    // 如果正在刷新，将当前请求加入队列
    if (isRefreshing && refreshPromise) {
      return new Promise((resolve, reject) => {
        const originalConfig = saveRequestConfig(config);
        let isResolved = false;

        pendingRequests.push((token) => {
          if (isResolved) return;
          if (!token) {
            isResolved = true;
            reject(new Error('token已失效，请重新登陆'));
            return;
          }

          const retryConfig = {
            ...originalConfig,
            headers: {
              ...originalConfig.headers,
              'Authorization': `Bearer ${token}`,
            },
          };

          // 确保 GET/HEAD 请求没有 body
          const pendingMethod = (retryConfig.method || 'GET').toUpperCase();
          if (pendingMethod === 'GET' || pendingMethod === 'HEAD') {
            delete retryConfig.data;
          }

          isResolved = true;
          api.request(retryConfig).then(resolve).catch(reject);
        });

        refreshPromise.catch(() => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error('token已失效，请重新登陆'));
          }
        });
      });
    }
  }

  // 添加认证 token（刷新 token 请求不需要）
  if (!isTokenRequest) {
    const token = authService.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
  }

  // 统一处理路径参数（将 {param} 替换为实际值）
  if (config.url && config.pathParams) {
    let url = config.url;
    Object.keys(config.pathParams).forEach(key => {
      url = url.replace(`{${key}}`, config.pathParams[key]);
    });
    config.url = url;
    delete config.pathParams; // 删除已处理的路径参数
  }

  return config;
});

// 响应拦截器 - 统一处理成功响应
api.useResponseInterceptor(async (response) => {
  // 如果响应数据是字符串，尝试解析为 JSON
  let responseData = response.data;
  if (typeof responseData === 'string') {
    try {
      responseData = JSON.parse(responseData);
      response.data = responseData;
    } catch {
      // 如果解析失败，保持原样
    }
  }
  
  // 处理业务逻辑错误码（如果后端返回格式为 { code, message, data }）
  if (responseData && typeof responseData === 'object') {
    // 如果后端使用 code 字段表示业务状态
    if ('code' in responseData && responseData.code !== 0 && responseData.code !== 200) {
      const errorMsg = responseData.message || '业务逻辑错误';
      throw new Error(errorMsg);
    }
    
    // 如果后端直接返回数据，则直接返回
    // 如果后端使用 data 字段包装，则返回 data
    if ('data' in responseData) {
      return {
        ...response,
        data: responseData.data,
      };
    }
  }

  return response;
});

// 错误拦截器 - 全局错误处理
// 注意：错误拦截器需要在 request.js 中特殊处理
const errorInterceptor = async (error) => {
  // 如果状态码是 200-299，说明实际上是成功响应，不应该被当作错误处理
  // 这种情况可能是响应拦截器处理时出现了问题，但响应本身是成功的
  if (error.status && error.status >= 200 && error.status < 300) {
    // 如果是成功响应被误判为错误，直接返回响应对象，让调用方处理
    // 将错误对象转换为响应对象
    const response = {
      data: error.data || error,
      status: error.status,
      statusText: error.statusText || 'OK',
      headers: error.headers,
      config: error.config,
    };
    // 不抛出错误，直接返回响应
    return response;
  }
  
  // 检查是否是 token 请求（登录/刷新 token）
  // 对于 token 请求的错误，不显示全局错误消息，让调用方（登录页面）自己处理
  const isTokenRequest = error.config?.url === '/auth/token' || 
                         error.config?.url?.includes('/auth/token');
  
  // 处理 HTTP 错误（只处理非 2xx 状态码）
  if (error.status && error.status >= 400) {
    // 解析错误数据（可能是字符串格式的 JSON）
    let errorData = error.data;
    if (typeof errorData === 'string') {
      try {
        errorData = JSON.parse(errorData);
        error.data = errorData;
      } catch {
        // 如果解析失败，保持原样
      }
    }
    
    // 提取错误信息
    const errorMessage = errorData?.message || errorData?.error || errorData?.error_description || error.message;
    
    switch (error.status) {
      case 401: {
        // 未授权，尝试使用 refresh_token 刷新
        // 但如果是 token 请求本身返回 401，不进行刷新（避免循环）
        if (isTokenRequest) {
          // token 请求返回 401，说明登录失败或 refresh_token 已失效，不显示全局错误，让调用方处理
          break;
        }

        // 获取原始请求配置
        const originalRequest = error.config;

        // 关键修复：如果请求配置不存在或 URL 无效，直接跳转登录
        if (!originalRequest || !originalRequest.url || typeof originalRequest.url !== 'string') {
          authService.clearToken();
          setTimeout(() => {
            window.location.href = '/login';
          }, API.REDIRECT_DELAY);
          break;
        }

        // 如果请求已经重试过，不再处理
        if (originalRequest._retry) {
          // 已经重试过仍然失败，说明 refresh_token 已失效
          authService.clearToken();
          setTimeout(() => {
            window.location.href = '/login';
          }, API.REDIRECT_DELAY);
          break;
        }

        // 如果正在刷新，将请求加入队列等待刷新完成
        if (isRefreshing && refreshPromise) {
          return new Promise((resolve, reject) => {
            const savedConfig = saveRequestConfig(originalRequest);
            let isResolved = false;

            pendingRequests.push((token) => {
              if (isResolved) return;
              if (!token) {
                isResolved = true;
                reject(new Error('token已失效，请重新登陆'));
                return;
              }

              const retryConfig = {
                ...savedConfig,
                headers: {
                  ...savedConfig.headers,
                  'Authorization': `Bearer ${token}`,
                },
                _retry: true,
              };

              isResolved = true;
              api.request(retryConfig).then(resolve).catch(reject);
            });

            refreshPromise.catch(() => {
              if (!isResolved) {
                isResolved = true;
                reject(new Error('token已失效，请重新登陆'));
              }
            });
          });
        }

        // 如果还没有开始刷新，尝试刷新
        if (!isRefreshing) {
          const savedConfig = saveRequestConfig(originalRequest);

          isRefreshing = true;
          refreshPromise = authService.refreshToken()
            .then(response => {
              if (response.data) {
                authService.saveToken(response.data);
                const newToken = response.data.access_token || response.data.accessToken;

                // 处理所有挂起的请求
                pendingRequests.forEach(callback => {
                  try {
                    callback(newToken);
                  } catch {
                    // 静默处理
                  }
                });
                pendingRequests = [];

                // 使用保存的配置和新 token 重试请求
                const retryConfig = {
                  ...savedConfig,
                  headers: {
                    ...savedConfig.headers,
                    'Authorization': `Bearer ${newToken}`,
                  },
                  _retry: true,
                };

                // 重新发起请求
                return api.request(retryConfig);
              }
              throw new Error('刷新 token 失败');
            })
            .catch(refreshError => {
              // 刷新失败，拒绝所有挂起的请求
              const failedCallbacks = [...pendingRequests];
              pendingRequests = [];

              failedCallbacks.forEach(callback => {
                try {
                  callback(null);
                } catch {
                  // 静默处理
                }
              });

              authService.clearToken();
              setTimeout(() => {
                window.location.href = '/login';
              }, 100);
              throw refreshError;
            })
            .finally(() => {
              isRefreshing = false;
              refreshPromise = null;
            });

          // 返回刷新和重试的结果
          try {
            return await refreshPromise;
          } catch {
            break;
          }
        }
        break;
      }
      case 403:
        if (!isTokenRequest) {
          message.error('没有权限访问该资源');
        }
        break;
      case 404: {
        // 对于404错误，不显示全局错误消息
        // 详情请求的404由列表数据提供基本信息，不需要错误提示
        // 其他404错误也由具体的业务逻辑处理，不需要全局提示
        // 静默处理，不显示错误消息
        break;
      }
      case 500:
        if (!isTokenRequest) {
          message.error('服务器内部错误，请稍后重试');
        }
        break;
      case 502:
      case 503:
        if (!isTokenRequest) {
          message.error('服务暂时不可用，请稍后重试');
        }
        break;
      default:
        // 对于 token 请求的 400 错误（如 invalid_grant），不显示全局错误消息
        // 让登录页面自己处理并显示更友好的错误信息
        if (!isTokenRequest) {
          message.error(`请求失败 (${error.status}): ${errorMessage}`);
        }
    }
  } else if (error.message) {
    // 处理业务逻辑错误或其他错误
    // 检查是否是取消的请求（AbortError），如果是则不显示错误消息
    const isAborted = error.name === 'AbortError' || error.isAborted === true;
    
    if (isAborted) {
      // 取消的请求不显示错误消息，直接抛出错误让调用方处理
      throw error;
    }
    
    // token 请求的业务逻辑错误也不显示全局消息
    if (!isTokenRequest) {
      message.error(error.message);
    }
  } else {
    // 网络错误
    // 检查是否是取消的请求
    const isAborted = error.name === 'AbortError' || error.isAborted === true;
    
    if (isAborted) {
      // 取消的请求不显示错误消息，直接抛出错误让调用方处理
      throw error;
    }
    
    if (!isTokenRequest) {
      message.error('网络请求失败，请检查网络连接');
    }
  }
  
  throw error;
};

// 标记为错误拦截器
errorInterceptor._isErrorInterceptor = true;
api.useResponseInterceptor(errorInterceptor);

export default api;

