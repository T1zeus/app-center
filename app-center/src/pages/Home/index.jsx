import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Input,
  Row,
  Col,
  Spin,
  Empty,
  Pagination,
} from 'antd';
import { SearchOutlined, AppstoreOutlined } from '@ant-design/icons';

import './index.less';
import { applicationService } from '../../services/application';
import appJump from '../../utils/appJump';
import { handleApiError } from '../../utils/messageHelper';

const { Search } = Input;

// 统一的数据转换函数
// 只保留后端实际返回的字段（参考后端接口返回的 JSON 结构）
const transformAppData = (app) => ({
  id: app.name,
  name: app.name,
  displayName: app.display_name || app.name,
  description: app.description || '暂无描述',
  icon: app.icon_url || null,
  appUrl: app.app_url || null,
  organization: app.organization || '-',
});

// 过滤掉"默认应用"
const filterDefaultApps = (apps) => apps.filter(app => app.displayName !== '默认应用');

function Home() {
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [displayApplications, setDisplayApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const abortControllerRef = useRef(null);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 12,
    total: 0,
  });

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
            app.name.toLowerCase().includes(searchLower) ||
            app.description.toLowerCase().includes(searchLower)
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
          placeholder="搜索应用名称或描述"
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
                      className="app-card"
                      hoverable
                      onClick={() => handleAppClick(app)}
                      cover={
                        app.icon ? (
                          <div className="app-card-icon">
                            <img src={app.icon} alt={app.displayName} />
                          </div>
                        ) : (
                          <div className="app-card-icon-default">
                            <AppstoreOutlined />
                          </div>
                        )
                      }
                    >
                      <Card.Meta
                        title={app.displayName}
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
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 个，共 ${total} 个应用`}
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
                onShowSizeChange={(current, size) => {
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

