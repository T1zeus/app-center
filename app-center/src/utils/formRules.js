/**
 * 表单验证规则工具
 * 统一管理表单验证规则，确保验证提示信息一致
 */

/**
 * 必填验证
 * @param {string} fieldName - 字段名称
 * @returns {Object} 验证规则
 */
export function requiredRule(fieldName) {
  return {
    required: true,
    message: `请输入${fieldName}`,
  };
}

/**
 * 长度验证
 * @param {number} min - 最小长度
 * @param {number} max - 最大长度
 * @param {string} fieldName - 字段名称
 * @returns {Array} 验证规则数组
 */
export function lengthRules(min, max, fieldName) {
  const rules = [];
  
  if (min !== undefined && min !== null) {
    rules.push({
      min,
      message: `${fieldName}长度至少${min}位`,
    });
  }
  
  if (max !== undefined && max !== null) {
    rules.push({
      max,
      message: `${fieldName}长度不能超过${max}位`,
    });
  }
  
  return rules;
}

/**
 * 密码验证规则
 * @param {number} min - 最小长度，默认 6
 * @param {number} max - 最大长度，默认 100
 * @returns {Array} 验证规则数组
 */
export function passwordRules(min = 6, max = 100) {
  return [
    requiredRule('密码'),
    ...lengthRules(min, max, '密码'),
  ];
}

/**
 * 用户名验证规则
 * @param {number} max - 最大长度，默认 100
 * @returns {Array} 验证规则数组
 */
export function usernameRules(max = 100) {
  return [
    requiredRule('用户名'),
    ...lengthRules(null, max, '用户名'),
  ];
}

/**
 * 显示名称验证规则（昵称、组织名称、应用名称等）
 * @param {number} max - 最大长度，默认 100
 * @returns {Array} 验证规则数组
 */
export function displayNameRules(max = 100) {
  return [
    requiredRule('名称'),
    ...lengthRules(null, max, '名称'),
  ];
}

/**
 * 确认密码验证规则
 * @param {Function} getFieldValue - 获取字段值的函数
 * @returns {Object} 验证规则
 */
export function confirmPasswordRule(getFieldValue) {
  return {
    required: true,
    message: '请确认密码',
    validator: (_, value) => {
      if (!value || getFieldValue('newPassword') === value || getFieldValue('password') === value) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('两次输入的密码不一致'));
    },
  };
}

/**
 * 重定向URI验证规则
 * @returns {Array} 验证规则数组
 */
export function redirectUrisRules() {
  return [
    requiredRule('重定向URI'),
    {
      validator: (_, value) => {
        if (!value || value.trim() === '') {
          return Promise.reject(new Error('请输入重定向URI'));
        }
        
        const uris = value
          .split('\n')
          .map(uri => uri.trim())
          .filter(uri => uri.length > 0);
        
        if (uris.length === 0) {
          return Promise.reject(new Error('至少需要一个重定向URI'));
        }
        
        // 验证URI格式（简单验证）
        const uriPattern = /^https?:\/\/.+/;
        const invalidUris = uris.filter(uri => !uriPattern.test(uri));
        
        if (invalidUris.length > 0) {
          return Promise.reject(new Error('重定向URI格式不正确，应为 http:// 或 https:// 开头的完整URL'));
        }
        
        return Promise.resolve();
      },
    },
  ];
}

export default {
  requiredRule,
  lengthRules,
  passwordRules,
  usernameRules,
  displayNameRules,
  confirmPasswordRule,
  redirectUrisRules,
};

