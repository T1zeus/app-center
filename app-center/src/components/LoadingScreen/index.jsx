import { Spin } from 'antd';

/**
 * 全屏加载组件
 * @param {Object} props
 * @param {string} props.message - 加载提示文字，默认 "正在验证登录状态..."
 */
export function LoadingScreen({ message = '正在验证登录状态...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}>
      <Spin size="large" />
      <div style={{ marginTop: 16, color: '#666' }}>{message}</div>
    </div>
  );
}
