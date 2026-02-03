/**
 * 全局常量定义
 */

// 分页相关
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: ['10', '20', '50', '100'],
  MAX_PAGE_SIZE: 1000,
};

// 字符串长度限制
export const MAX_LENGTH = {
  USERNAME: 100,
  DISPLAY_NAME: 100,
  EMAIL: 100,
  PHONE: 20,
  PASSWORD: 50,
  ORGANIZATION: 100,
  DESCRIPTION: 500,
};

// 时间相关（毫秒）
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

// API 相关
export const API = {
  TIMEOUT: 15000,
  REDIRECT_DELAY: 100,
};
