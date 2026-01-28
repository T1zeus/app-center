import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  BankOutlined,
  AppstoreOutlined,
  TeamOutlined,
  KeyOutlined,
  LogoutOutlined,
  DownOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Dropdown, Modal, Form, Input, message } from 'antd';

import './index.less';
import LogoImg from '/vite.svg';
import AvatarImg from '/avatar.png';
import { authService } from '../../services/auth';
import { userService } from '../../services/user';
import { isSystemAdmin, isOrgAdmin, getUserRole, USER_ROLES } from '../../utils/role';
import { showSuccess, handleApiError } from '../../utils/messageHelper';

const { Header, Content, Footer, Sider } = Layout;


/**
 * 菜单配置
 * 根据用户角色显示不同的菜单项
 */

// 系统管理员菜单配置
const SYSTEM_ADMIN_MENU_ITEMS = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '应用中心',
  },
  {
    key: '/organizations',
    icon: <BankOutlined />,
    label: '组织管理',
  },
  {
    key: '/applications',
    icon: <AppstoreOutlined />,
    label: '应用管理',
  },
  {
    key: '/subscriptions',
    icon: <ShoppingCartOutlined />,
    label: '订阅管理',
  },
  {
    key: '/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
];

// 企业管理员菜单配置
const ORG_ADMIN_MENU_ITEMS = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '应用中心',
  },
  {
    key: '/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
];

// 员工菜单配置（只有应用中心）
const EMPLOYEE_MENU_ITEMS = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '应用中心',
  },
];


function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取用户信息
  const userInfo = authService.getUserInfo() || { name: '管理员' };
  
  // 根据用户角色动态显示菜单
  const userRole = getUserRole(userInfo);
  let menuItems;
  if (userRole === USER_ROLES.SYSTEM_ADMIN) {
    menuItems = SYSTEM_ADMIN_MENU_ITEMS;
  } else if (userRole === USER_ROLES.ORG_ADMIN) {
    menuItems = ORG_ADMIN_MENU_ITEMS;
  } else {
    // 员工或其他情况，只显示应用中心
    menuItems = EMPLOYEE_MENU_ITEMS;
  }

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'changePassword',
      icon: <KeyOutlined />,
      label: '修改密码',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleUserMenuClick = ({ key }) => {
    if (key === 'changePassword') {
      setChangePasswordVisible(true);
      passwordForm.resetFields();
    } else if (key === 'logout') {
      handleLogout();
    }
  };

  const handleChangePassword = async (values) => {
    try {
      // 获取当前用户名和组织
      const currentUser = userInfo.name;
      const owner = userInfo.owner;
      if (!currentUser) {
        handleApiError('无法获取当前用户信息', '操作失败');
        return;
      }
      if (!owner) {
        handleApiError('无法获取用户所属组织', '操作失败');
        return;
      }

      // 调用 API 修改密码
      await userService.changePassword(owner, currentUser, {
        old_password: values.oldPassword,
        new_password: values.newPassword,
      });

      showSuccess('密码修改成功');
      setChangePasswordVisible(false);
      passwordForm.resetFields();
    } catch (error) {
      handleApiError(error, '密码修改失败');
    }
  };

  const handleLogout = async () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 调用退出登录接口，会在应用平台、安全培训系统、鉴权网关都退出登录
          await authService.logout();
        } catch (error) {
          // 即使退出登录接口调用失败，也清除本地 token 并跳转
          // 静默处理错误，不显示错误消息
        } finally {
          // 清除本地认证信息
        authService.clearToken();
        message.success('已退出登录');
        navigate('/login');
        }
      },
    });
  };

  return (
    <Layout className={`admin-layout ${collapsed ? 'ant-layout-sider-collapsed' : ''}`}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        width={240}
        className="admin-sider"
        trigger={null}
      >
        <div className="sider-logo">
          <img src={LogoImg} alt="logo" className="logo-img" />
          {!collapsed && (
            <span className="logo-text">
              应用大平台
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={handleMenuClick}
          className="admin-menu"
        />
        <div 
          className="sider-trigger"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '→' : '←'}
        </div>
      </Sider>
      <Layout className="admin-content-layout">
        <Header className="admin-header">
          <div className="header-title">
            应用大平台
          </div>
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: handleUserMenuClick,
            }}
            placement="bottomRight"
          >
            <div className="header-user">
              <img 
                src={AvatarImg} 
                alt="avatar" 
                className="user-avatar"
              />
              <span className="user-name">{userInfo.display_name || userInfo.name || '管理员'}</span>
              <DownOutlined className="user-dropdown-icon" />
            </div>
          </Dropdown>
        </Header>
        <Content className="admin-content">
          <div className="content-wrapper">
            {children}
          </div>
        </Content>
        <Footer className="admin-footer">
          © {new Date().getFullYear()} BUGBANK（www.bugbank.cn） 版权所有
        </Footer>
      </Layout>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={changePasswordVisible}
        onCancel={() => {
          setChangePasswordVisible(false);
          passwordForm.resetFields();
        }}
        onOk={() => passwordForm.submit()}
        okText="确认"
        cancelText="取消"
        width={500}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[
              { required: true, message: '请输入原密码' },
              { min: 6, message: '密码长度至少6位' },
              { max: 100, message: '密码长度不能超过100位' },
            ]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' },
              { max: 100, message: '密码长度不能超过100位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（6-100位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default AdminLayout;

