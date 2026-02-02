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
  Alert,
  Dropdown,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, MoreOutlined } from '@ant-design/icons';

import './index.less';
import { organizationService } from '../../services/organization';
import { showSuccess, handleApiError, extractPageData } from '../../utils/messageHelper';
import { useMobile } from '../../hooks/useMobile';

function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [viewingOrg, setViewingOrg] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createdAdminInfo, setCreatedAdminInfo] = useState(null);
  const [form] = Form.useForm();

  // 检测是否是移动端
  const isMobile = useMobile();

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    loadOrganizations(pagination.current, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrganizations = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await organizationService.getOrganizationList({
        page,
        page_size: pageSize,
        sort: '-name', // 按名称降序
      });

      // 提取分页数据
      const { rows, total } = extractPageData(response);

      // 转换数据格式
      const orgsData = rows.map((org) => ({
        id: org.name, // 使用 name 作为唯一标识
        name: org.name, // 组织唯一标识符
        displayName: org.display_name || org.name, // 组织名称
      }));

      setOrganizations(orgsData);
      setPagination({
        current: page,
        pageSize,
        total,
      });
    } catch (error) {
      handleApiError(error, '加载组织列表失败');
      setOrganizations([]);
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
    setEditingOrg(null);
    setCreatedAdminInfo(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingOrg(record);
    setCreatedAdminInfo(null);
    try {
      // 获取最新的组织详情
      const response = await organizationService.getOrganizationDetail(record.name);
      const orgData = response.data || {};
      
      // 转换数据格式用于表单回填
      form.setFieldsValue({
        name: orgData.name,
        display_name: orgData.display_name || orgData.name,
      });
      setModalVisible(true);
    } catch {
      // 如果获取详情失败，使用列表中的数据
      form.setFieldsValue({
        name: record.name,
        display_name: record.displayName,
      });
      setModalVisible(true);
    }
  };

  const handleViewDetail = async (record) => {
    setViewingOrg(record);
    setDetailLoading(true);
    setDetailModalVisible(true);
    
    try {
      // 获取最新的组织详情
      const response = await organizationService.getOrganizationDetail(record.name);
      const orgData = response.data || {};
      
      // 转换数据格式
      const orgDetail = {
        name: orgData.name,
        displayName: orgData.display_name || orgData.name,
      };
      
      setViewingOrg(orgDetail);
    } catch {
      // 如果获取详情失败，使用列表中的数据
      setViewingOrg(record);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingOrg) {
        // 更新组织
        const updateParams = {
          display_name: values.display_name,
        };
        
        await organizationService.updateOrganization(editingOrg.name, updateParams);
        showSuccess('更新成功');
        setModalVisible(false);
        form.resetFields();
        setEditingOrg(null);
        loadOrganizations(pagination.current, pagination.pageSize);
      } else {
        // 创建组织
        // 根据API文档：name 和 display_name 都是必需的
        const createParams = {
          name: String(values.name || '').trim(),
          display_name: String(values.display_name || '').trim(),
        };
        
        const response = await organizationService.createOrganization(createParams);
        showSuccess('创建成功');
        
        // 显示自动生成的企业管理员账号信息
        // 根据 API 文档，响应中包含：name, admin_user_name, admin_user_password
        // 企业管理员密码现在由后端随机生成
        const responseData = response.data || {};
        if (responseData.admin_user_name && responseData.admin_user_password) {
          setCreatedAdminInfo({
            username: responseData.admin_user_name,
            password: responseData.admin_user_password,
          });
        } else {
          // 如果后端没有返回管理员信息，显示错误提示
          handleApiError('创建组织成功，但未获取到管理员账号信息', '警告');
        }
      }
    } catch (error) {
      handleApiError(error, editingOrg ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    {
      title: '组织标识',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 100 : 200,
      ellipsis: true,
    },
    {
      title: '组织名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: isMobile ? 100 : 200,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: isMobile ? 80 : 250,
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
          </div>
        );
      },
    },
  ];

  return (
    <div className="admin-organizations">
      <Card>
        <div className="page-header">
          <h2>组织管理</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建组织
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={organizations}
          rowKey="id"
          loading={loading}
          scroll={{ x: isMobile ? 300 : 1200 }}
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
              loadOrganizations(page, pageSize);
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
              loadOrganizations(1, size);
            },
          }}
        />
      </Card>

      {/* 创建/编辑组织弹窗 */}
      <Modal
        title={editingOrg ? '编辑组织' : '创建组织'}
        open={modalVisible}
        onCancel={() => {
          const hadAdminInfo = !!createdAdminInfo;
          setModalVisible(false);
          form.resetFields();
          setEditingOrg(null);
          setCreatedAdminInfo(null);
          if (hadAdminInfo) {
            // 如果显示了管理员信息，关闭时刷新列表
            loadOrganizations(pagination.current, pagination.pageSize);
          }
        }}
        onOk={() => {
          if (createdAdminInfo) {
            // 如果显示了管理员信息，点击确认按钮关闭弹窗
            setModalVisible(false);
            form.resetFields();
            setCreatedAdminInfo(null);
            loadOrganizations(pagination.current, pagination.pageSize);
          } else {
            // 否则提交表单
            form.submit();
          }
        }}
        okText={createdAdminInfo ? '已了解' : '确认'}
        cancelText="关闭"
        width={600}
        destroyOnHidden
      >
        {createdAdminInfo && (
          <Alert
            message="企业管理员账号已自动生成"
            description={
              <div>
                <p><strong>用户名：</strong>{createdAdminInfo.username}</p>
                <p><strong>密码：</strong>{createdAdminInfo.password}</p>
                <p style={{ color: '#ff4d4f', marginTop: 8 }}>
                  请妥善保管此账号信息，复制完成后可点击"已了解"或"关闭"按钮关闭
                </p>
              </div>
            }
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="组织标识"
            rules={[
              { required: true, message: '请输入组织标识' },
              { max: 100, message: '组织标识长度不能超过100个字符' },
            ]}
            tooltip="组织唯一标识符，创建后不可修改"
          >
            <Input 
              placeholder="请输入组织唯一标识符" 
              disabled={!!editingOrg || !!createdAdminInfo}
              maxLength={100}
            />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="组织名称"
            rules={[
              { required: true, message: '请输入组织名称' },
              { max: 100, message: '组织名称长度不能超过100个字符' },
            ]}
          >
            <Input 
              placeholder="请输入组织名称" 
              disabled={!!createdAdminInfo}
              maxLength={100}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 组织详情弹窗 */}
      <Modal
        title="组织详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewingOrg(null);
        }}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            onClick={() => {
              if (viewingOrg) {
                handleEdit(viewingOrg);
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
        ) : viewingOrg ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="组织标识">
              {viewingOrg.name}
            </Descriptions.Item>
            <Descriptions.Item label="组织名称">
              {viewingOrg.displayName}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div>组织不存在</div>
        )}
      </Modal>
    </div>
  );
}

export default Organizations;

