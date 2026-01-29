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
  Tag,
  InputNumber,
  Space,
  Dropdown,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, CopyOutlined, MoreOutlined } from '@ant-design/icons';

import './index.less';
import { applicationService } from '../../services/application';
import { showSuccess, handleApiError } from '../../utils/messageHelper';

const { TextArea } = Input;

function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [viewingApp, setViewingApp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form] = Form.useForm();
  
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
    loadApplications(pagination.current, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadApplications = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await applicationService.getApplicationList({
        page,
        page_size: pageSize,
        sort: '-name', // 按名称降序
        // 移除 is_shared 筛选，显示所有应用
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
      const appsData = responseData.map((app) => ({
        id: app.name, // 使用 name 作为唯一标识
        name: app.name, // 应用唯一标识符
        displayName: app.display_name || app.name, // 应用名称
        organization: app.organization || '-', // 所属组织
        clientId: app.client_id || '-', // 客户端ID
        redirectUris: app.redirect_uris || [], // 重定向URI列表
        isShared: app.is_shared || false, // 是否为共享应用
      }));

      setApplications(appsData);
      setPagination({
        current: page,
        pageSize,
        total,
      });
    } catch (error) {
      handleApiError(error, '加载应用列表失败');
      setApplications([]);
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
    setEditingApp(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingApp(record);
    try {
      // 获取最新的应用详情
      const response = await applicationService.getApplicationDetail(record.name);
      const appData = response.data || {};
      
      // 转换数据格式用于表单回填
      form.setFieldsValue({
        name: appData.name,
        display_name: appData.display_name || appData.name,
        redirect_uris: appData.redirect_uris ? appData.redirect_uris.join('\n') : '',
      });
      setModalVisible(true);
    } catch {
      // 如果获取详情失败，使用列表中的数据
      form.setFieldsValue({
        name: record.name,
        display_name: record.displayName,
        redirect_uris: record.redirectUris ? record.redirectUris.join('\n') : '',
      });
      setModalVisible(true);
    }
  };

  const handleViewDetail = async (record) => {
    // 先使用列表中的数据显示，避免等待API响应
    setViewingApp(record);
    setDetailLoading(true);
    setDetailModalVisible(true);
    
    try {
      // 获取最新的应用详情
      const response = await applicationService.getApplicationDetail(record.name);
      const appData = response.data || {};
      
      // 转换数据格式
      const appDetail = {
        name: appData.name,
        displayName: appData.display_name || appData.name,
        organization: appData.organization || '-',
        clientId: appData.client_id || '-',
        clientSecret: appData.client_secret || '-',
        redirectUris: appData.redirect_uris || [],
        isShared: appData.is_shared || false, // 是否为共享应用
      };
      
      setViewingApp(appDetail);
    } catch (error) {
      // 如果获取详情失败，静默使用列表中的数据
      // 不显示错误提示，因为列表数据已经足够显示基本信息
      // 错误拦截器已经处理了404错误的显示，这里不需要再次处理
      // 使用列表中的数据（已经在上面设置了）
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('已复制到剪贴板');
    }).catch(() => {
      handleApiError('复制失败', '操作失败');
    });
  };

  const handleSubmit = async (values) => {
    try {
      if (editingApp) {
        // 更新应用
        const updateParams = {
          display_name: values.display_name,
        };
        
        // 处理重定向URI列表（如果用户填写了）
        if (values.redirect_uris) {
          const redirectUris = values.redirect_uris
            .split('\n')
            .map(uri => uri.trim())
            .filter(uri => uri.length > 0);
          
          // 如果有有效的URI，则添加到更新参数中
          if (redirectUris.length > 0) {
            updateParams.redirect_uris = redirectUris;
          }
        }
        
        await applicationService.updateApplication(editingApp.name, updateParams);
        showSuccess('更新成功');
        setModalVisible(false);
        form.resetFields();
        setEditingApp(null);
        loadApplications(pagination.current, pagination.pageSize);
      } else {
        // 创建应用
        // 根据API文档：name、display_name、redirect_uris 都是必需的
        const redirectUris = values.redirect_uris
          .split('\n')
          .map(uri => uri.trim())
          .filter(uri => uri.length > 0);
        
        if (redirectUris.length === 0) {
          handleApiError('至少需要一个重定向URI', '创建失败', { showMessage: true });
          return;
        }
        
        const createParams = {
          name: String(values.name || '').trim(),
          display_name: String(values.display_name || '').trim(),
          redirect_uris: redirectUris,
        };
        
        await applicationService.createApplication(createParams);
        showSuccess('创建成功');
        setModalVisible(false);
        form.resetFields();
        loadApplications(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      handleApiError(error, editingApp ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    {
      title: '应用标识',
      dataIndex: 'name',
      key: 'name',
      width: isMobile ? 100 : 200,
      ellipsis: true,
    },
    {
      title: '应用名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: isMobile ? 100 : 200,
      ellipsis: true,
    },
    {
      title: '所属组织',
      dataIndex: 'organization',
      key: 'organization',
      width: isMobile ? 80 : 150,
      ellipsis: true,
    },
    {
      title: '客户端ID',
      dataIndex: 'clientId',
      key: 'clientId',
      width: isMobile ? 120 : 200,
      ellipsis: true,
    },
    {
      title: '是否共享',
      dataIndex: 'isShared',
      key: 'isShared',
      width: isMobile ? 60 : 120,
      render: (isShared) => (
        <Tag color={isShared ? 'green' : 'default'} style={{ margin: 0 }}>
          {isShared ? '是' : '否'}
        </Tag>
      ),
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
    <div className="admin-applications">
      <Card>
        <div className="page-header">
          <h2>应用管理</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建应用
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={applications}
          rowKey="id"
          loading={loading}
          scroll={{ x: isMobile ? 600 : 1200 }}
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
              loadApplications(page, pageSize);
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
              loadApplications(1, size);
            },
          }}
        />
      </Card>

      {/* 创建/编辑应用弹窗 */}
      <Modal
        title={editingApp ? '编辑应用' : '创建应用'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingApp(null);
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
            label="应用标识"
            rules={[
              { required: true, message: '请输入应用标识' },
              { max: 100, message: '应用标识长度不能超过100个字符' },
            ]}
            tooltip="应用唯一标识符，创建后不可修改"
          >
            <Input 
              placeholder="请输入应用唯一标识符" 
              disabled={!!editingApp}
              maxLength={100}
            />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="应用名称"
            rules={[
              { required: true, message: '请输入应用名称' },
              { max: 100, message: '应用名称长度不能超过100个字符' },
            ]}
          >
            <Input 
              placeholder="请输入应用名称" 
              maxLength={100}
            />
          </Form.Item>
          <Form.Item
            name="redirect_uris"
            label="重定向URI列表"
            rules={[
              { 
                required: !editingApp, 
                message: '请输入至少一个重定向URI' 
              },
              {
                validator: (_, value) => {
                  if (!value || !value.trim()) {
                    // 编辑模式下允许为空
                    if (editingApp) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('请输入至少一个重定向URI'));
                  }
                  // 验证是否有有效的URI
                  const uris = value.split('\n').map(uri => uri.trim()).filter(uri => uri.length > 0);
                  if (uris.length === 0) {
                    return Promise.reject(new Error('请输入至少一个重定向URI'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
            tooltip={editingApp ? "每行一个URI，留空则不更新重定向URI列表" : "每行一个URI，例如：http://localhost:3000/callback"}
          >
            <TextArea 
              placeholder={editingApp ? "请输入重定向URI，每行一个，留空则不更新&#10;例如：&#10;http://localhost:3000/callback&#10;https://example.com/callback" : "请输入重定向URI，每行一个&#10;例如：&#10;http://localhost:3000/callback&#10;https://example.com/callback"}
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 应用详情弹窗 */}
      <Modal
        title="应用详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewingApp(null);
        }}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            onClick={() => {
              if (viewingApp) {
                handleEdit(viewingApp);
                setDetailModalVisible(false);
              }
            }}
          >
            编辑
          </Button>,
        ]}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
          </div>
        ) : viewingApp ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="应用标识">
              {viewingApp.name}
            </Descriptions.Item>
            <Descriptions.Item label="应用名称">
              {viewingApp.displayName}
            </Descriptions.Item>
            <Descriptions.Item label="所属组织">
              {viewingApp.organization}
            </Descriptions.Item>
            <Descriptions.Item label="客户端ID">
              <Space>
                <span style={{ fontFamily: 'monospace' }}>{viewingApp.clientId}</span>
                {viewingApp.clientId !== '-' && (
                  <Button 
                    type="link" 
                    icon={<CopyOutlined />} 
                    size="small"
                    onClick={() => handleCopy(viewingApp.clientId)}
                  >
                    复制
                  </Button>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="客户端密钥">
              <Space>
                <span style={{ fontFamily: 'monospace' }}>{viewingApp.clientSecret}</span>
                {viewingApp.clientSecret !== '-' && (
                  <Button 
                    type="link" 
                    icon={<CopyOutlined />} 
                    size="small"
                    onClick={() => handleCopy(viewingApp.clientSecret)}
                  >
                    复制
                  </Button>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="重定向URI列表">
              {viewingApp.redirectUris && viewingApp.redirectUris.length > 0 ? (
                <div>
                  {viewingApp.redirectUris.map((uri, index) => (
                    <Tag key={index} style={{ marginBottom: 4 }}>
                      {uri}
                    </Tag>
                  ))}
                </div>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="是否共享">
              <Space>
                <Tag color={viewingApp.isShared ? 'green' : 'default'}>
                  {viewingApp.isShared ? '是' : '否'}
                </Tag>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {viewingApp.isShared ? '（可在应用大厅显示）' : '（不在应用大厅显示）'}
                </span>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div>应用不存在</div>
        )}
      </Modal>
    </div>
  );
}

export default Applications;

