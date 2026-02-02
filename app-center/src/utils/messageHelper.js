import { message } from 'antd';

/**
 * 消息提示工具函数
 * 统一处理成功、错误、警告、信息提示
 */

/**
 * 显示成功消息
 * @param {string} content - 消息内容
 * @param {number} duration - 显示时长（秒），默认 3
 */
export function showSuccess(content, duration = 3) {
  message.success({
    content,
    duration,
  });
}

/**
 * 显示错误消息
 * @param {string|Error} error - 错误消息或错误对象
 * @param {string} defaultMessage - 默认错误消息
 * @param {number} duration - 显示时长（秒），默认 4
 */
export function showError(error, defaultMessage = '操作失败', duration = 4) {
  let errorMessage = defaultMessage;
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message || defaultMessage;
  } else if (error && typeof error === 'object') {
    // 尝试从错误对象中提取消息
    if (error.data) {
      if (typeof error.data === 'string') {
        try {
          const parsed = JSON.parse(error.data);
          errorMessage = parsed.message || parsed.error || error.data;
        } catch {
          errorMessage = error.data || errorMessage;
        }
      } else if (typeof error.data === 'object') {
        errorMessage = error.data.message || error.data.error || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
  }
  
  message.error({
    content: errorMessage,
    duration,
  });
}

/**
 * 显示警告消息
 * @param {string} content - 消息内容
 * @param {number} duration - 显示时长（秒），默认 3
 */
export function showWarning(content, duration = 3) {
  message.warning({
    content,
    duration,
  });
}

/**
 * 显示信息消息
 * @param {string} content - 消息内容
 * @param {number} duration - 显示时长（秒），默认 3
 */
export function showInfo(content, duration = 3) {
  message.info({
    content,
    duration,
  });
}

/**
 * 显示加载消息（返回关闭函数）
 * @param {string} content - 消息内容，默认 "加载中..."
 * @returns {Function} 关闭消息的函数
 */
export function showLoading(content = '加载中...') {
  const hide = message.loading({
    content,
    duration: 0, // 不自动关闭
  });
  return hide;
}

/**
 * 统一处理 API 错误
 * @param {Error} error - 错误对象
 * @param {string} defaultMessage - 默认错误消息
 * @param {Object} options - 选项
 * @param {boolean} options.showMessage - 是否显示消息，默认 true
 * @returns {string} 错误消息
 */
export function handleApiError(error, defaultMessage = '操作失败', options = {}) {
  const { showMessage = true } = options;

  // 检查是否是取消的请求（AbortError），如果是则不显示错误消息
  const isAborted = error && typeof error === 'object' &&
                    (error.name === 'AbortError' || error.isAborted === true);

  if (isAborted) {
    // 取消的请求不显示错误消息
    return '请求已取消';
  }

  let errorMessage = defaultMessage;

  if (error && typeof error === 'object') {
    // 尝试从错误对象中提取消息
    if (error.data) {
      if (typeof error.data === 'string') {
        try {
          const parsed = JSON.parse(error.data);
          errorMessage = parsed.message || parsed.error || error.data;
        } catch {
          errorMessage = error.data || errorMessage;
        }
      } else if (typeof error.data === 'object') {
        errorMessage = error.data.message || error.data.error || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  if (showMessage) {
    showError(errorMessage);
  }

  return errorMessage;
}

/**
 * 从分页列表 API 响应中提取数据
 * 后端返回格式：{ code: 0, message: "string", data: { page_info: {...}, rows: [...] } }
 * @param {Object} response - API 响应对象
 * @returns {Object} 包含 rows（数据列表）和 total（总数）的对象
 */
export function extractPageData(response) {
  let rows = [];
  let total = 0;

  if (response?.data && typeof response.data === 'object') {
    rows = response.data.rows || [];
    if (response.data.page_info) {
      total = response.data.page_info.total || 0;
    } else {
      total = rows.length || 0;
    }
  }

  return { rows, total };
}

export default {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showLoading,
  handleApiError,
};

