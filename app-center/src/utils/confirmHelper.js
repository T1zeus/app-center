import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * 确认对话框工具函数
 * 统一处理删除、更新等操作的确认提示
 */

/**
 * 显示确认对话框
 * @param {Object} options - 选项
 * @param {string} options.title - 标题，默认 "确认操作"
 * @param {string} options.content - 内容
 * @param {string} options.okText - 确认按钮文字，默认 "确认"
 * @param {string} options.cancelText - 取消按钮文字，默认 "取消"
 * @param {string} options.type - 类型：'delete' | 'update' | 'custom'，默认 'custom'
 * @param {Function} options.onOk - 确认回调
 * @param {Function} options.onCancel - 取消回调（可选）
 * @returns {Promise} Promise 对象
 */
export function showConfirm(options = {}) {
  const {
    title,
    content,
    okText = '确认',
    cancelText = '取消',
    type = 'custom',
    onOk,
    onCancel,
  } = options;
  
  // 根据类型设置默认标题和内容
  let finalTitle = title;
  let finalContent = content;
  
  if (type === 'delete') {
    finalTitle = title || '确认删除';
    finalContent = content || '确定要删除此项吗？删除后无法恢复。';
  } else if (type === 'update') {
    finalTitle = title || '确认更新';
    finalContent = content || '确定要更新此项吗？';
  } else {
    finalTitle = title || '确认操作';
    finalContent = content || '确定要执行此操作吗？';
  }
  
  return new Promise((resolve, reject) => {
    Modal.confirm({
      title: finalTitle,
      content: finalContent,
      icon: <ExclamationCircleOutlined />,
      okText,
      cancelText,
      okType: type === 'delete' ? 'danger' : 'primary',
      onOk: async () => {
        try {
          if (onOk) {
            await onOk();
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      onCancel: () => {
        if (onCancel) {
          onCancel();
        }
        reject(new Error('用户取消操作'));
      },
    });
  });
}

/**
 * 显示删除确认对话框
 * @param {Object} options - 选项
 * @param {string} options.itemName - 要删除的项名称（可选）
 * @param {string} options.content - 自定义内容（可选）
 * @param {Function} options.onOk - 确认回调
 * @returns {Promise} Promise 对象
 */
export function showDeleteConfirm(options = {}) {
  const { itemName, content, onOk } = options;
  
  let finalContent = content;
  if (!finalContent && itemName) {
    finalContent = `确定要删除"${itemName}"吗？删除后无法恢复。`;
  } else if (!finalContent) {
    finalContent = '确定要删除此项吗？删除后无法恢复。';
  }
  
  return showConfirm({
    type: 'delete',
    title: '确认删除',
    content: finalContent,
    onOk,
  });
}

/**
 * 显示更新确认对话框
 * @param {Object} options - 选项
 * @param {string} options.content - 内容（可选）
 * @param {Function} options.onOk - 确认回调
 * @returns {Promise} Promise 对象
 */
export function showUpdateConfirm(options = {}) {
  const { content, onOk } = options;
  
  return showConfirm({
    type: 'update',
    title: '确认更新',
    content: content || '确定要更新此项吗？',
    onOk,
  });
}

export default {
  showConfirm,
  showDeleteConfirm,
  showUpdateConfirm,
};

