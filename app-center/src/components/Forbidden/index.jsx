import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

/**
 * 403 无权限页面组件
 * @param {Object} props - 组件属性
 * @param {string} props.title - 标题，默认 "403"
 * @param {string} props.subTitle - 副标题，默认 "抱歉，您没有权限访问此页面。"
 * @param {React.ReactNode} props.extra - 额外的操作按钮
 */
function Forbidden({ 
  title = '403',
  subTitle = '抱歉，您没有权限访问此页面。',
  extra,
}) {
  const navigate = useNavigate();
  
  const defaultExtra = (
    <Button type="primary" onClick={() => navigate('/')}>
      返回首页
    </Button>
  );
  
  return (
    <Result
      status="403"
      title={title}
      subTitle={subTitle}
      extra={extra || defaultExtra}
    />
  );
}

export default Forbidden;

