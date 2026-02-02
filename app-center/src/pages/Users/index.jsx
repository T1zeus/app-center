import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Card,
  Descriptions,
  Spin,
  Select,
  Dropdown,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, KeyOutlined, MoreOutlined } from '@ant-design/icons';

import './index.less';
import { userService } from '../../services/user';
import { authService } from '../../services/auth';
import { organizationService } from '../../services/organization';
import { isSystemAdmin } from '../../utils/role';
import { showSuccess, handleApiError } from '../../utils/messageHelper';
import { usernameRules, displayNameRules, passwordRules } from '../../utils/formRules';

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  
  // 获取当前用户信息，判断是否为系统管理员
  const userInfo = authService.getUserInfo() || {};
  const isSysAdmin = isSystemAdmin(userInfo);
  
  // 检测是否是移动端
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 767);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 767);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    loadUsers(pagination.current, pagination.pageSize);
    // 如果是系统管理员，加载组织列表
    if (isSysAdmin) {
      loadOrganizations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // 加载组织列表（仅系统管理员需要）
  const loadOrganizations = async () => {
    setOrganizationsLoading(true);
    try {
      const response = await organizationService.getOrganizationList({
        page: 1,
        page_size: 1000, // 获取所有组织
      });
      
      let orgsData = [];
      if (response.data && typeof response.data === 'object') {
        orgsData = response.data.rows || [];
      }
      
      // 转换为 Select 组件需要的格式
      const orgOptions = orgsData.map((org) => ({
        label: org.display_name || org.name,
        value: org.name,
      }));
      
      setOrganizations(orgOptions);
    } catch (error) {
      handleApiError(error, '加载组织列表失败');
    } finally {
      setOrganizationsLoading(false);
    }
  };

  const loadUsers = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      // 根据当前用户的组织过滤用户列表
      // 后端会根据 token 中的用户信息自动过滤当前组织的用户
      const response = await userService.getUserList({
        page,
        page_size: pageSize,
        sort: '-name', // 按名称降序
      });
      
      // 处理响应数据
      // 后端返回格式：{ code: 0, message: "string", data: { page_info: {...}, rows: [...] } }
      let responseData = [];
      let total = 0;
      
      if (response.data && typeof response.data === 'object') {
        // 从 data.rows 获取列表数据
        responseData = response.data.rows || [];
        
        // 从 data.page_info 获取分页信息
        if (response.data.page_info) {
          total = response.data.page_info.total || 0;
        } else {
          total = responseData.length || 0;
        }
      }
      
      // 转换数据格式
      const usersData = responseData.map((user) => {
        // 判断 is_admin 字段的值（兼容多种格式：布尔值、数字、字符串）
        // 注意：需要明确检查，不能使用 || false，因为 0 也是有效值
        let isAdmin = false;
        if ('is_admin' in user) {
          const adminValue = user.is_admin;
          isAdmin = adminValue === true || adminValue === 1 || adminValue === 'true' || adminValue === '1';
        } else if ('isAdmin' in user) {
          // 兼容驼峰命名
          const adminValue = user.isAdmin;
          isAdmin = adminValue === true || adminValue === 1 || adminValue === 'true' || adminValue === '1';
        }
        
        return {
        id: user.id || user.name, // 用户ID或用户名作为唯一标识
        name: user.name, // 用户名
        displayName: user.display_name || user.name, // 昵称
        owner: user.owner || '-', // 所属组织
          is_admin: isAdmin, // 是否为管理员
        };
      });

      setUsers(usersData);
      setPagination({
        current: page,
        pageSize,
        total,
      });
    } catch (error) {
      handleApiError(error, '加载用户列表失败');
      setUsers([]);
      setPagination({
        current: page,
        pageSize,
        total: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    // 企业管理员自动填充当前组织，系统管理员不填充（让用户选择）
    if (!isSysAdmin && userInfo && userInfo.owner) {
      form.setFieldsValue({
        owner: userInfo.owner,
      });
    }
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingUser(record);
    try {
      // 获取最新的用户详情
      const owner = record.owner && record.owner !== '-' ? record.owner : null;
      if (!owner) {
        throw new Error('无法获取用户所属组织');
      }
      const response = await userService.getUserDetail(owner, record.name);
      const userData = response.data || {};
      
      // 转换数据格式用于表单回填
      form.setFieldsValue({
        name: userData.name,
        display_name: userData.display_name || userData.name,
        email: userData.email || '',
        phone: userData.phone || '',
        owner: userData.owner || '',
        is_admin: userData.is_admin || false,
      });
      setModalVisible(true);
    } catch {
      // 如果获取详情失败，使用列表中的数据
      form.setFieldsValue({
        name: record.name,
        display_name: record.displayName,
        email: '',
        phone: '',
        owner: record.owner || '',
        is_admin: false,
      });
      setModalVisible(true);
    }
  };

  const handleViewDetail = async (record) => {
    setViewingUser(record);
    setDetailLoading(true);
    setDetailModalVisible(true);
    
    try {
      // 获取最新的用户详情
      const owner = record.owner && record.owner !== '-' ? record.owner : null;
      if (!owner) {
        throw new Error('无法获取用户所属组织');
      }
      const response = await userService.getUserDetail(owner, record.name);
      const userData = response.data || {};
      
      // 转换数据格式
      const userDetail = {
        id: userData.id || userData.name,
        name: userData.name,
        displayName: userData.display_name || userData.name,
        email: userData.email || '-',
        phone: userData.phone || '-',
        owner: userData.owner || '-',
        is_admin: userData.is_admin || false,
      };
      
      setViewingUser(userDetail);
    } catch {
      // 如果获取详情失败，使用列表中的数据
      setViewingUser(record);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResetPassword = (record) => {
    setResettingPasswordUser(record);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingUser) {
        // 更新用户
        // 根据API文档：只能更新 display_name
        const owner = editingUser.owner && editingUser.owner !== '-' ? editingUser.owner : null;
        if (!owner) {
          throw new Error('无法获取用户所属组织');
        }
        const updateParams = {
          display_name: values.display_name,
        };
        
        await userService.updateUser(owner, editingUser.name, updateParams);
        showSuccess('更新成功');
        setModalVisible(false);
        form.resetFields();
        setEditingUser(null);
        loadUsers(pagination.current, pagination.pageSize);
      } else {
        // 创建用户
        // 根据API文档：name、display_name、owner、password 都是必需的
        const createParams = {
          name: String(values.name || '').trim(),
          display_name: String(values.display_name || '').trim(),
          owner: String(values.owner || '').trim(),
          password: values.password,
        };
        
        await userService.createUser(createParams);
        showSuccess('创建成功');
        setModalVisible(false);
        form.resetFields();
        loadUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      handleApiError(error, editingUser ? '更新失败' : '创建失败');
    }
  };

  const handlePasswordSubmit = async (values) => {
    if (!resettingPasswordUser) return;
    
    try {
      // 管理员重置密码时，不需要 old_password
      const owner = resettingPasswordUser.owner && resettingPasswordUser.owner !== '-' ? resettingPasswordUser.owner : null;
      if (!owner) {
        throw new Error('无法获取用户所属组织');
      }
      const passwordParams = {
        new_password: values.new_password,
        // old_password 可选，管理员重置时可不传
        ...(values.old_password && { old_password: values.old_password }),
      };
      
      await userService.changePassword(owner, resettingPasswordUser.name, passwordParams);
      showSuccess('密码修改成功');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
      setResettingPasswordUser(null);
    } catch (error) {
      handleApiError(error, '密码修改失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 80 : 150,
      ellipsis: true,
    },
    {
      title: '昵称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: isMobile ? 80 : 150,
      ellipsis: true,
    },
    {
      title: '所属组织',
      dataIndex: 'owner',
      key: 'owner',
      width: isMobile ? 80 : 150,
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: 'is_admin',
      key: 'is_admin',
      width: isMobile ? 60 : 120,
      render: (isAdmin) => {
        // 判断 is_admin 的值（可能是布尔值、数字或字符串）
        const isAdminValue = isAdmin === true || isAdmin === 1 || isAdmin === 'true' || isAdmin === '1';
        return (
          <Tag color={isAdminValue ? 'blue' : 'default'} style={{ margin: 0 }}>
            {isAdminValue ? '管理员' : '普通用户'}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: isMobile ? 80 : 300,
      fixed: isMobile ? false : 'right',
      render: (_, record) => {
        if (isMobile) {
          // 移动端使用下拉菜单
          const menuItems = [
            {
              key: 'view',
              label: (
                <Button 
                  type="text" 
                  icon={<EyeOutlined />} 
                  onClick={() => handleViewDetail(record)}
                  style={{ padding: 0, width: '100%', textAlign: 'left' }}
                >
                  查看详情
                </Button>
              ),
            },
            {
              key: 'edit',
              label: (
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={() => handleEdit(record)}
                  style={{ padding: 0, width: '100%', textAlign: 'left' }}
                >
                  编辑
                </Button>
              ),
            },
            {
              key: 'reset',
              label: (
                <Button 
                  type="text" 
                  icon={<KeyOutlined />} 
                  onClick={() => handleResetPassword(record)}
                  style={{ padding: 0, width: '100%', textAlign: 'left' }}
                >
                  重置密码
                </Button>
              ),
            },
          ];
          
          return (
            <Dropdown 
              menu={{ items: menuItems }} 
              trigger={['click']}
              placement="bottomRight"
            >
              <Button 
                type="text" 
                icon={<MoreOutlined />} 
                style={{ fontSize: '16px' }}
              />
            </Dropdown>
          );
        }
        
        // 桌面端使用按钮
        return (
          <div className="table-actions">
            <Button 
              type="link" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewDetail(record)}
            >
              查看详情
            </Button>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button 
              type="link" 
              icon={<KeyOutlined />} 
              onClick={() => handleResetPassword(record)}
            >
              重置密码
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="admin-users">
      <Card>
        <div className="page-header">
          <h2>用户管理</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建用户
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: isMobile ? 500 : 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize }));
              loadUsers(page, pageSize);
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
              loadUsers(1, size);
            },
          }}
        />
      </Card>

      {/* 创建/编辑用户弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '创建用户'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingUser(null);
        }}
        onOk={() => form.submit()}
        okText="确认"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="用户名"
            rules={usernameRules(100)}
            tooltip={editingUser ? '用户名不可修改' : '用户名作为唯一标识符，创建后不可修改'}
          >
            <Input 
              placeholder="请输入用户名" 
              disabled={!!editingUser}
              maxLength={100}
            />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="昵称"
            rules={displayNameRules(100).map(rule => ({
              ...rule,
              message: rule.message.replace('名称', '昵称'),
            }))}
          >
            <Input 
              placeholder="请输入昵称" 
              maxLength={100}
            />
          </Form.Item>
          {editingUser && (
            <>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { type: 'email', message: '请输入正确的邮箱格式' },
                  { max: 100, message: '邮箱长度不能超过100个字符' },
                ]}
              >
                <Input 
                  placeholder="请输入邮箱" 
                  maxLength={100}
                  disabled
                />
              </Form.Item>
              <Form.Item
                name="phone"
                label="电话"
                rules={[
                  { max: 20, message: '电话长度不能超过20个字符' },
                  { pattern: /^[\d\s\-+()]*$/, message: '请输入正确的电话号码格式' },
                ]}
              >
                <Input 
                  placeholder="请输入电话" 
                  maxLength={20}
                  disabled
                />
              </Form.Item>
              <Form.Item
                name="owner"
                label="所属组织"
              >
                <Input 
                  disabled
                />
              </Form.Item>
              {isSysAdmin && (
                <Form.Item
                  name="is_admin"
                  label="是否管理员"
                  getValueFromEvent={(value) => value}
                  getValueProps={(value) => ({ value: value ? '是' : '否' })}
                >
                  <Input 
                    disabled
                  />
                </Form.Item>
              )}
            </>
          )}
          {!editingUser && (
            <>
              <Form.Item
                name="owner"
                label="所属组织"
                rules={[
                  { required: true, message: isSysAdmin ? '请选择所属组织' : '请输入所属组织' },
                  { max: 100, message: '组织名称长度不能超过100个字符' },
                ]}
                tooltip={isSysAdmin ? '系统管理员可以为任意组织创建用户' : '企业管理员只能创建本组织的用户'}
              >
                {isSysAdmin ? (
                  <Select
                    placeholder="请选择所属组织"
                    loading={organizationsLoading}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={organizations}
                  />
                ) : (
                  <Input 
                    placeholder="请输入所属组织" 
                    maxLength={100}
                    disabled
                  />
                )}
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={passwordRules(6, 100)}
                tooltip="密码长度要求 6-100 位"
              >
                <Input.Password 
                  placeholder="请输入密码（6-100位）" 
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* 用户详情弹窗 */}
      <Modal
        title="用户详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewingUser(null);
        }}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            onClick={() => {
              if (viewingUser) {
                handleEdit(viewingUser);
                setDetailModalVisible(false);
              }
            }}
          >
            编辑
          </Button>,
        ]}
        width={600}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
          </div>
        ) : viewingUser ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="用户ID">
              {viewingUser.id}
            </Descriptions.Item>
            <Descriptions.Item label="用户名">
              {viewingUser.name}
            </Descriptions.Item>
            <Descriptions.Item label="昵称">
              {viewingUser.displayName}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {viewingUser.email}
            </Descriptions.Item>
            <Descriptions.Item label="电话">
              {viewingUser.phone}
            </Descriptions.Item>
            <Descriptions.Item label="所属组织">
              {viewingUser.owner}
            </Descriptions.Item>
            {isSysAdmin && (
              <Descriptions.Item label="是否管理员">
                {viewingUser.is_admin ? '是' : '否'}
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : (
          <div>用户不存在</div>
        )}
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title="重置密码"
        open={passwordModalVisible}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
          setResettingPasswordUser(null);
        }}
        onOk={() => passwordForm.submit()}
        okText="确认"
        cancelText="取消"
        width={500}
        destroyOnHidden
      >
        {resettingPasswordUser && (
          <div style={{ marginBottom: 16 }}>
            <p>重置用户 <strong>{resettingPasswordUser.displayName}</strong> 的密码</p>
          </div>
        )}
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
        >
          <Form.Item
            name="old_password"
            label="旧密码"
            tooltip="管理员重置密码时可不填旧密码"
            rules={[
              { min: 6, message: '密码长度至少6位' },
              { max: 100, message: '密码长度不能超过100位' },
            ]}
          >
            <Input.Password 
              placeholder="请输入旧密码（管理员重置时可留空）" 
            />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度至少6位' },
              { max: 100, message: '密码长度不能超过100位' },
            ]}
          >
            <Input.Password 
              placeholder="请输入新密码（6-100位）" 
            />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password 
              placeholder="请再次输入新密码" 
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Users;

