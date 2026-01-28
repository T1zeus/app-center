import { useState, useEffect, useRef } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Card,
  Descriptions,
  Spin,
  Tag,
  Select,
  DatePicker,
  Space,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import './index.less';
import { subscriptionService } from '../../services/subscription';
import { organizationService } from '../../services/organization';
import { applicationService } from '../../services/application';
import { showSuccess, handleApiError } from '../../utils/messageHelper';

const { RangePicker } = DatePicker;

function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [viewingSubscription, setViewingSubscription] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form] = Form.useForm();
  
  // 筛选条件
  const [filterOwner, setFilterOwner] = useState(undefined);
  const [filterPlan, setFilterPlan] = useState(undefined);
  const [filterState, setFilterState] = useState(undefined);
  
  // 组织和应用列表（用于下拉选择）
  const [organizations, setOrganizations] = useState([]);
  const [applications, setApplications] = useState([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  
  // 用于标记是否已初始化，避免筛选条件 useEffect 在首次渲染时触发
  const isInitialMount = useRef(true);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    loadSubscriptions(1, pagination.pageSize);
    loadOrganizations();
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听筛选条件变化，自动重新加载列表（重置到第一页）
  useEffect(() => {
    // 跳过首次渲染
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // 筛选条件变化时，重置到第一页并重新加载
    loadSubscriptions(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOwner, filterPlan, filterState]);

  // 加载组织列表
  const loadOrganizations = async () => {
    setOrganizationsLoading(true);
    try {
      const response = await organizationService.getOrganizationList({
        page: 1,
        page_size: 1000, // 获取所有组织
      });
      
      const orgsData = (response.data?.rows || []).map((org) => ({
        label: `${org.display_name || org.name} (${org.name})`,
        value: org.name,
      }));
      
      setOrganizations(orgsData);
    } catch (error) {
      handleApiError(error, '加载组织列表失败');
    } finally {
      setOrganizationsLoading(false);
    }
  };

  // 加载应用列表
  const loadApplications = async () => {
    setApplicationsLoading(true);
    try {
      const response = await applicationService.getApplicationList({
        page: 1,
        page_size: 1000, // 获取所有应用
      });
      
      const appsData = (response.data?.rows || []).map((app) => ({
        label: `${app.display_name || app.name} (${app.name})`,
        value: app.name,
      }));
      
      setApplications(appsData);
    } catch (error) {
      handleApiError(error, '加载应用列表失败');
    } finally {
      setApplicationsLoading(false);
    }
  };

  const loadSubscriptions = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        sort: '-name',
      };
      
      // 添加筛选条件
      if (filterOwner) {
        params.owner = filterOwner;
      }
      if (filterPlan) {
        params.plan = filterPlan;
      }
      if (filterState) {
        params.state = filterState;
      }
      
      const response = await subscriptionService.getSubscriptionList(params);
      
      // 处理响应数据
      let responseData = [];
      let total = 0;
      
      if (response.data && typeof response.data === 'object') {
        responseData = response.data.rows || [];
        
        if (response.data.page_info) {
          total = response.data.page_info.total || 0;
        } else {
          total = responseData.length || 0;
        }
      }
      
      // 转换数据格式
      const subsData = responseData.map((sub) => ({
        id: `${sub.owner}-${sub.plan}`, // 使用 owner-plan 作为唯一标识
        name: sub.name,
        owner: sub.owner,
        plan: sub.plan,
        displayName: sub.display_name || `${sub.owner}-${sub.plan}`,
        startTime: sub.start_time,
        endTime: sub.end_time,
        state: sub.state,
      }));

      setSubscriptions(subsData);
      setPagination({
        current: page,
        pageSize,
        total,
      });
    } catch (error) {
      handleApiError(error, '加载订阅列表失败');
      setSubscriptions([]);
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
    setEditingSubscription(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingSubscription(record);
    try {
      // 获取最新的订阅详情
      const response = await subscriptionService.getSubscriptionDetail(record.owner, record.plan);
      const subData = response.data || {};
      
      // 转换数据格式用于表单回填
      form.setFieldsValue({
        owner: subData.owner,
        plan: subData.plan,
        start_time: subData.start_time ? dayjs(subData.start_time) : null,
        end_time: subData.end_time ? dayjs(subData.end_time) : null,
        state: subData.state,
      });
      setModalVisible(true);
    } catch {
      // 如果获取详情失败，使用列表中的数据
      form.setFieldsValue({
        owner: record.owner,
        plan: record.plan,
        start_time: record.startTime ? dayjs(record.startTime) : null,
        end_time: record.endTime ? dayjs(record.endTime) : null,
        state: record.state,
      });
      setModalVisible(true);
    }
  };

  const handleViewDetail = async (record) => {
    setViewingSubscription(record);
    setDetailLoading(true);
    setDetailModalVisible(true);
    
    try {
      // 获取最新的订阅详情
      const response = await subscriptionService.getSubscriptionDetail(record.owner, record.plan);
      const subData = response.data || {};
      
      // 转换数据格式
      const subDetail = {
        name: subData.name,
        owner: subData.owner,
        plan: subData.plan,
        displayName: subData.display_name || `${subData.owner}-${subData.plan}`,
        startTime: subData.start_time,
        endTime: subData.end_time,
        state: subData.state,
      };
      
      setViewingSubscription(subDetail);
    } catch (error) {
      // 如果获取详情失败，静默使用列表中的数据
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingSubscription) {
        // 更新订阅
        const updateParams = {};
        
        if (values.start_time) {
          updateParams.start_time = values.start_time.format('YYYY-MM-DDTHH:mm:ss[Z]');
        }
        if (values.end_time) {
          updateParams.end_time = values.end_time.format('YYYY-MM-DDTHH:mm:ss[Z]');
        }
        if (values.state) {
          updateParams.state = values.state;
        }
        
        await subscriptionService.updateSubscription(
          editingSubscription.owner,
          editingSubscription.plan,
          updateParams
        );
        showSuccess('更新成功');
        setModalVisible(false);
        form.resetFields();
        setEditingSubscription(null);
        loadSubscriptions(pagination.current, pagination.pageSize);
      } else {
        // 创建订阅
        if (!values.start_time || !values.end_time) {
          handleApiError('请选择开始时间和结束时间', '创建失败', { showMessage: true });
          return;
        }
        
        if (values.end_time.isBefore(values.start_time)) {
          handleApiError('结束时间必须晚于开始时间', '创建失败', { showMessage: true });
          return;
        }
        
        const createParams = {
          owner: values.owner,
          plan: values.plan,
          start_time: values.start_time.format('YYYY-MM-DDTHH:mm:ss[Z]'),
          end_time: values.end_time.format('YYYY-MM-DDTHH:mm:ss[Z]'),
        };
        
        await subscriptionService.createSubscription(createParams);
        showSuccess('创建成功');
        setModalVisible(false);
        form.resetFields();
        loadSubscriptions(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      handleApiError(error, editingSubscription ? '更新失败' : '创建失败');
    }
  };

  const handleFilterChange = () => {
    // 筛选条件改变时重置到第一页并重新加载列表
    setPagination(prev => ({ ...prev, current: 1 }));
    loadSubscriptions(1, pagination.pageSize);
  };

  const columns = [
    {
      title: '组织',
      dataIndex: 'owner',
      key: 'owner',
      width: 150,
    },
    {
      title: '应用',
      dataIndex: 'plan',
      key: 'plan',
      width: 150,
    },
    {
      title: '订阅名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 200,
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 180,
      render: (text) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 100,
      render: (state) => (
        <Tag color={state === 'Active' ? 'green' : 'red'}>
          {state === 'Active' ? '激活' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
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
      ),
    },
  ];

  return (
    <div className="admin-subscriptions">
      <Card>
        <div className="page-header">
          <h2>订阅管理</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建订阅
          </Button>
        </div>

        {/* 筛选条件 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Select
                placeholder="选择组织"
                allowClear
                value={filterOwner}
                onChange={(value) => {
                  setFilterOwner(value);
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                loading={organizationsLoading}
                style={{ width: '100%' }}
                options={organizations}
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="选择应用"
                allowClear
                value={filterPlan}
                onChange={(value) => {
                  setFilterPlan(value);
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                loading={applicationsLoading}
                style={{ width: '100%' }}
                options={applications}
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="选择状态"
                allowClear
                value={filterState}
                onChange={(value) => {
                  setFilterState(value);
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                style={{ width: '100%' }}
                options={[
                  { label: '激活', value: 'Active' },
                  { label: '停用', value: 'Suspended' },
                ]}
              />
            </Col>
            <Col span={6}>
              <Button 
                onClick={() => {
                  setFilterOwner(undefined);
                  setFilterPlan(undefined);
                  setFilterState(undefined);
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
              >
                清除筛选
              </Button>
            </Col>
          </Row>
        </Card>

        <Table
          columns={columns}
          dataSource={subscriptions}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              loadSubscriptions(page, pageSize);
            },
          }}
        />
      </Card>

      {/* 创建/编辑订阅弹窗 */}
      <Modal
        title={editingSubscription ? '编辑订阅' : '创建订阅'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingSubscription(null);
        }}
        onOk={() => form.submit()}
        okText="确认"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="owner"
            label="组织"
            rules={[
              { required: !editingSubscription, message: '请选择组织' },
            ]}
          >
            <Select
              placeholder="请选择组织"
              disabled={!!editingSubscription}
              loading={organizationsLoading}
              options={organizations}
            />
          </Form.Item>
          <Form.Item
            name="plan"
            label="应用"
            rules={[
              { required: !editingSubscription, message: '请选择应用' },
            ]}
          >
            <Select
              placeholder="请选择应用"
              disabled={!!editingSubscription}
              loading={applicationsLoading}
              options={applications}
            />
          </Form.Item>
          <Form.Item
            name="start_time"
            label="开始时间"
            rules={[
              { required: !editingSubscription, message: '请选择开始时间' },
            ]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="请选择开始时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="end_time"
            label="结束时间"
            rules={[
              { required: !editingSubscription, message: '请选择结束时间' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value) {
                    return Promise.resolve();
                  }
                  const startTime = getFieldValue('start_time');
                  if (startTime && value.isBefore(startTime)) {
                    return Promise.reject(new Error('结束时间必须晚于开始时间'));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="请选择结束时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
          {editingSubscription && (
            <Form.Item
              name="state"
              label="状态"
            >
              <Select
                placeholder="请选择状态"
                options={[
                  { label: '激活', value: 'Active' },
                  { label: '停用', value: 'Suspended' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 订阅详情弹窗 */}
      <Modal
        title="订阅详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewingSubscription(null);
        }}
        footer={[
          <Button key="back" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button 
            key="edit" 
            type="primary" 
            onClick={() => {
              if (viewingSubscription) {
                handleEdit(viewingSubscription);
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
        ) : viewingSubscription ? (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="订阅标识">
              {viewingSubscription.name}
            </Descriptions.Item>
            <Descriptions.Item label="订阅名称">
              {viewingSubscription.displayName}
            </Descriptions.Item>
            <Descriptions.Item label="组织">
              {viewingSubscription.owner}
            </Descriptions.Item>
            <Descriptions.Item label="应用">
              {viewingSubscription.plan}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {viewingSubscription.startTime 
                ? dayjs(viewingSubscription.startTime).format('YYYY-MM-DD HH:mm:ss')
                : '-'
              }
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {viewingSubscription.endTime 
                ? dayjs(viewingSubscription.endTime).format('YYYY-MM-DD HH:mm:ss')
                : '-'
              }
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={viewingSubscription.state === 'Active' ? 'green' : 'red'}>
                {viewingSubscription.state === 'Active' ? '激活' : '停用'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <div>订阅不存在</div>
        )}
      </Modal>
    </div>
  );
}

export default Subscriptions;

