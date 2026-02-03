// src/utils/request.js
// 常量定义
const DEFAULT_TIMEOUT = 10000; // 10秒

class Request {
  constructor(baseConfig = {}) {
    this.baseURL = baseConfig.baseURL || '';
    this.timeout = baseConfig.timeout || DEFAULT_TIMEOUT;
    this.headers = baseConfig.headers || {
      'Content-Type': 'application/json',
    };
    this.interceptors = {
      request: [],
      response: [],
    };
  }

  // 添加请求拦截器
  useRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  // 添加响应拦截器
  useResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }

  // 执行拦截器链
  async executeInterceptors(interceptors, data) {
    let result = data;
    for (const interceptor of interceptors) {
      result = await interceptor(result);
    }
    return result;
  }

  // 构建带参数的URL
  buildURLWithParams(url, params) {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();

    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          // 处理数组参数：key[]=value1&key[]=value2
          value.forEach(item => {
            searchParams.append(`${key}[]`, item);
          });
        } else {
          searchParams.append(key, value);
        }
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  // 核心请求方法
  async request(config) {
    try {
      // 合并配置
      const mergedConfig = {
        baseURL: this.baseURL,
        timeout: this.timeout,
        headers: this.headers,
        ...config,
      };

      // 处理GET请求参数
      let url = mergedConfig.url;
      if (mergedConfig.method?.toUpperCase() === 'GET' && mergedConfig.params) {
        url = this.buildURLWithParams(url, mergedConfig.params);
      }

      // 请求拦截器
      let requestConfig = await this.executeInterceptors(
        this.interceptors.request,
        { ...mergedConfig, url }
      );

      // 关键修复：检查拦截器返回的是配置对象还是响应对象
      // 如果返回的是响应对象（说明请求已经完成，比如在拦截器中直接 resolve 了响应），直接返回
      // 响应对象特征：有 status（数字）和 data 属性，且 status 是 HTTP 状态码
      // 配置对象特征：有 url（字符串）属性
      if (requestConfig && typeof requestConfig === 'object') {
        const hasStatus = 'status' in requestConfig && typeof requestConfig.status === 'number';
        const hasData = 'data' in requestConfig;
        const hasUrl = 'url' in requestConfig && typeof requestConfig.url === 'string';
        
        // 如果有 status 和 data，但没有有效的 url，说明是响应对象
        if (hasStatus && hasData && !hasUrl) {
          // 这是响应对象，不是配置对象，直接返回
          return requestConfig;
        }
      }

      // 关键修复：在构建完整 URL 之前，检查 URL 是否存在且有效
      if (!requestConfig || !requestConfig.url || typeof requestConfig.url !== 'string') {
        throw new Error('请求 URL 不能为空');
      }

      // 如果外部传入了 signal，使用外部的；否则创建新的用于超时控制
      const externalSignal = requestConfig.signal;
      const controller = externalSignal ? null : new AbortController();
      const signal = externalSignal || controller.signal;
      
      // 只有在使用内部 controller 时才设置超时
      let timeoutId = null;
      if (controller) {
        timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);
      }
      
      // 构建完整 URL
      const fullUrl = `${requestConfig.baseURL}${requestConfig.url}`;
      
      // 确定请求方法
      const method = (requestConfig.method || 'GET').toUpperCase();
      
      // GET 和 HEAD 请求不能有 body
      const requestOptions = {
        method: method,
        headers: requestConfig.headers,
        signal: signal,
        ...requestConfig.extraOptions,
      };
      
      // 只有非 GET/HEAD 请求才添加 body
      if (method !== 'GET' && method !== 'HEAD' && requestConfig.data) {
        requestOptions.body = JSON.stringify(requestConfig.data);
      }
      
      // 发起请求
      const response = await fetch(fullUrl, requestOptions);

      // 清除超时定时器（如果存在）
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 处理响应数据
      let responseData;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // 构建响应对象
      const responseObj = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        config: requestConfig,
      };

      // 检查 HTTP 状态码
      if (!response.ok) {
        // 构建错误对象，包含状态码和响应数据
        const errorObj = {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          message: responseData?.message || `HTTP error! status: ${response.status}`,
          config: requestConfig, // 添加请求配置，供错误拦截器使用
        };
        
        // 抛出错误，让 catch 块处理
        throw errorObj;
      }

      // 响应拦截器（成功响应）
      const finalResponse = await this.executeInterceptors(
        this.interceptors.response,
        responseObj
      );

      return finalResponse;

    } catch (error) {
      // 错误处理 - 执行错误拦截器
      // 错误拦截器是响应拦截器的一种，通过 _isErrorInterceptor 属性标识
      const errorInterceptors = this.interceptors.response.filter(
        (interceptor) => interceptor._isErrorInterceptor === true
      );
      
      // 处理特殊错误类型
      let finalError = error;
      if (error.name === 'AbortError') {
        // 保留 AbortError 的原始信息，但添加更友好的消息
        finalError = new Error('请求超时');
        finalError.name = 'AbortError'; // 保留原始错误类型，方便调用方识别
        finalError.isAborted = true; // 添加标记，方便识别
      }
      
      // 如果有错误拦截器，执行它们
      if (errorInterceptors.length > 0) {
        const result = await this.executeInterceptors(errorInterceptors, finalError);
        // 如果错误拦截器返回了响应对象（说明是成功响应被误判），直接返回
        if (result && result.status && result.status >= 200 && result.status < 300) {
          return result;
        }
      }
      
      // 抛出错误
      throw finalError;
    }
  }

  // 快捷方法
  get(url, config = {}) {
    return this.request({ ...config, method: 'GET', url });
  }

  post(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'POST', url, data });
  }

  put(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'PUT', url, data });
  }

  delete(url, config = {}) {
    return this.request({ ...config, method: 'DELETE', url });
  }

  patch(url, data = {}, config = {}) {
    return this.request({ ...config, method: 'PATCH', url, data });
  }
}

export default Request;

