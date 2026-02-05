import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Input,
  Row,
  Col,
  Spin,
  Empty,
  Pagination,
  Tag,
} from 'antd';
import { SearchOutlined, AppstoreOutlined, WarningOutlined } from '@ant-design/icons';

import './index.less';
import { applicationService } from '../../services/application';
import { subscriptionService } from '../../services/subscription';
import { authService } from '../../services/auth';
import appJump from '../../utils/appJump';
import { handleApiError } from '../../utils/messageHelper';
import { getUserRole, USER_ROLES } from '../../utils/role';

const { Search } = Input;

// 统一的数据转换函数
// 只保留后端实际返回的字段
const transformAppData = (app) => ({
  id: app.name,
  name: app.name,
  displayName: app.display_name || app.name,
  organization: app.organization || '-',
});

// 过滤掉"默认应用"
const filterDefaultApps = (apps) => apps.filter(app => app.displayName !== '默认应用');

// 订阅状态检查
const checkSubscriptionStatus = (subscription, isSystemAdmin = false) => {
  // 系统管理员不受订阅限制
  if (isSystemAdmin) {
    return { isActive: true, status: 'active', label: '可访问', color: 'blue' };
  }

  if (!subscription) {
    return { isActive: false, status: 'unsubscribed', label: '未订阅', color: 'default' };
  }

  const now = new Date();
  const endTime = subscription.end_time ? new Date(subscription.end_time) : null;
  const isExpired = endTime && endTime < now;

  if (subscription.state !== 'Active') {
    return { isActive: false, status: 'inactive', label: '已停用', color: 'red' };
  }

  if (isExpired) {
    return { isActive: false, status: 'expired', label: '已过期', color: 'orange' };
  }

  return { isActive: true, status: 'active', label: '已激活', color: 'green' };
};

function Home() {
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [displayApplications, setDisplayApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [subscriptions, setSubscriptions] = useState({});
  const abortControllerRef = useRef(null);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 12,
    total: 0,
  });

  // 获取当前用户信息
  const userInfo = authService.getUserInfo() || {};
  const userOwner = userInfo.owner;
  const userRole = getUserRole(userInfo);
  const isSystemAdmin = userRole === USER_ROLES.SYSTEM_ADMIN;

  // 统一的请求取消逻辑
  const cancelPendingRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // 检查是否为取消的请求
  const isAbortedRequest = useCallback((error) => {
    return error.name === 'AbortError' ||
           error.isAborted === true ||
           (abortControllerRef.current && abortControllerRef.current.signal.aborted);
  }, []);

  // 组件卸载时取消请求
  useEffect(() => {
    return cancelPendingRequest;
  }, [cancelPendingRequest]);

  // 加载订阅信息
  const loadSubscriptions = async () => {
    if (!userOwner) return;

    try {
      const response = await subscriptionService.getSubscriptionList({
        owner: userOwner,
        page: 1,
        page_size: 1000,
      });

      if (response?.data?.rows) {
        const subsMap = {};
        response.data.rows.forEach(sub => {
          subsMap[sub.plan] = sub;
        });
        setSubscriptions(subsMap);
      }
    } catch (error) {
      // 订阅加载失败不影响应用列表显示
      console.error('加载订阅信息失败:', error);
    }
  };

  // 统一的数据加载逻辑
  const loadAndTransformData = async (params, controller) => {
    const response = await applicationService.getApplicationList(params, {
      signal: controller.signal,
    });

    if (!response?.data || typeof response.data !== 'object') {
      return { apps: [], total: 0 };
    }

    const responseData = response.data.rows || [];
    const total = response.data.page_info?.total || responseData.length;

    // 使用统一的转换和过滤函数
    const apps = filterDefaultApps(responseData.map(transformAppData));

    return { apps, total, originalCount: responseData.length };
  };

  const loadApplications = async (page = 1, pageSize = 12) => {
    cancelPendingRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const { apps, total, originalCount } = await loadAndTransformData(
        { page, page_size: pageSize, sort: 'display_name' },
        controller
      );

      setApplications(apps);
      setPagination(prev => ({
        ...prev,
        current: page,
        pageSize,
        total: total - (originalCount - apps.length),
      }));
    } catch (error) {
      if (!isAbortedRequest(error)) {
        handleApiError(error, '加载应用列表失败');
        setApplications([]);
        setPagination(prev => ({ ...prev, total: 0 }));
      }
    } finally {
      setLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // 初始加载数据
  useEffect(() => {
    loadApplications(pagination.current, pagination.pageSize);
    loadSubscriptions();
    return cancelPendingRequest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理搜索
  useEffect(() => {
    if (searchText.trim()) {
      const loadAllForSearch = async () => {
        cancelPendingRequest();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        try {
          const { apps } = await loadAndTransformData(
            { page: 1, page_size: 1000, sort: 'display_name' },
            controller
          );

          const searchLower = searchText.toLowerCase();
          const filtered = apps.filter(app =>
            app.displayName.toLowerCase().includes(searchLower) ||
            app.name.toLowerCase().includes(searchLower)
          );

          setFilteredApplications(filtered);
          setPagination(prev => ({
            ...prev,
            current: 1,
            total: filtered.length,
          }));
        } catch (error) {
          if (!isAbortedRequest(error)) {
            handleApiError(error, '搜索应用失败');
            setFilteredApplications([]);
            setPagination(prev => ({ ...prev, total: 0 }));
          }
        } finally {
          setLoading(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      };

      loadAllForSearch();
    } else {
      setFilteredApplications([]);
      setPagination(prev => ({ ...prev, current: 1 }));
      loadApplications(1, pagination.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // 根据分页和过滤结果计算当前页显示的应用
  useEffect(() => {
    if (!searchText.trim()) {
      setDisplayApplications(applications);
    } else {
      const start = (pagination.current - 1) * pagination.pageSize;
      const end = start + pagination.pageSize;
      setDisplayApplications(filteredApplications.slice(start, end));
    }
  }, [applications, filteredApplications, pagination, searchText]);


  const handleAppClick = async (app) => {
    const subscription = subscriptions[app.name];
    const { isActive } = checkSubscriptionStatus(subscription, isSystemAdmin);

    if (!isActive) {
      return;
    }

    try {
      // 使用应用跳转工具
      // jumpMode: 'auto' 会在列表数据缺少 appUrl 时自动获取应用详情
      await appJump.jumpFromAppList(app, {
        openInNewTab: true,
        jumpMode: 'auto',
      });
    } catch (error) {
      handleApiError(error, '跳转失败');
    }
  };

  return (
    <div className="app-center-home">
      <div className="home-header">
        <h1>应用中心</h1>
        <p className="home-subtitle">选择应用，快速访问</p>
      </div>
      <div className="home-search">
        <Search
          placeholder="搜索应用名称"
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="home-loading">
          <Spin size="large" />
        </div>
      ) : displayApplications.length === 0 ? (
        <div className="home-empty">
          <Empty
            description={searchText ? '未找到匹配的应用' : '暂无应用'}
          />
        </div>
      ) : (
        <>
          <div className="home-apps">
            <Row gutter={[24, 24]}>
              {displayApplications.map((app) => {
                const subscription = subscriptions[app.name];
                const { isActive, label, color } = checkSubscriptionStatus(subscription, isSystemAdmin);

                return (
                  <Col
                    key={app.id}
                    xs={24}
                    sm={12}
                    md={8}
                    lg={6}
                    xl={5}
                    xxl={4}
                  >
                    <Card
                      className={`app-card ${!isActive ? 'app-card-disabled' : ''}`}
                      hoverable={isActive}
                      onClick={() => handleAppClick(app)}
                      cover={
                        <div className="app-card-cover">
                          {app.icon ? (
                            <div className="app-card-icon">
                              <img src={app.icon} alt={app.displayName} />
                            </div>
                          ) : (
                            <div className="app-card-icon-default">
                              <AppstoreOutlined />
                            </div>
                          )}
                          {!isActive && !isSystemAdmin && (
                            <div className="app-card-disabled-overlay">
                              <WarningOutlined />
                            </div>
                          )}
                        </div>
                      }
                    >
                      <Card.Meta
                        title={
                          <div className="app-card-title">
                            <span className="app-name">{app.displayName}</span>
                            {!isSystemAdmin && (
                              <Tag color={color} className="app-status-tag">
                                {label}
                              </Tag>
                            )}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* 分页组件 */}
          {pagination.total > 0 && (
            <div className="home-pagination">
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                showTotal={(total) => `共 ${total} 个应用`}
                showSizeChanger={true}
                showQuickJumper={true}
                pageSizeOptions={['12', '24', '48', '96']}
                onChange={(page, pageSize) => {
                  if (!searchText.trim()) {
                    // 没有搜索时，使用后端分页
                    setPagination(prev => ({ ...prev, current: page, pageSize }));
                    loadApplications(page, pageSize);
                  } else {
                    // 有搜索时，前端分页
                    setPagination(prev => ({ ...prev, current: page, pageSize }));
                  }
                }}
                onShowSizeChange={(_current, size) => {
                  setPagination(prev => ({ ...prev, current: 1, pageSize: size }));
                  if (!searchText.trim()) {
                    // 没有搜索时，使用后端分页
                    loadApplications(1, size);
                  }
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Home;
