import { useState, useEffect, useRef } from 'react';
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

function Home() {
  const [applications, setApplications] = useState([]);
  const [filteredApplications, setFilteredApplications] = useState([]);
  const [displayApplications, setDisplayApplications] = useState([]); // 当前页显示的应用
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const abortControllerRef = useRef(null); // 用于取消重复请求
  
  // 分页状态
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 12, // 默认每页12个应用（卡片布局）
    total: 0,
  });

  useEffect(() => {
    // 清理函数：组件卸载或重新渲染时取消之前的请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // 加载应用数据
  const loadApplications = async (page = 1, pageSize = 12) => {
    // 如果已经有请求在进行，先取消
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setLoading(true);
    try {
      const response = await applicationService.getApplicationList({
        page,
        page_size: pageSize,
        sort: 'display_name',
        // 不传 is_shared，显示所有应用
      }, {
        signal: controller.signal,
      });
      
      // 处理响应数据
      let responseData = [];
      let total = 0;
      
      if (response && response.data && typeof response.data === 'object') {
        responseData = response.data.rows || [];
        
        // 获取总数
        if (response.data.page_info) {
          total = response.data.page_info.total || 0;
        } else {
          total = responseData.length || 0;
        }
      }
      
      // 转换数据格式
      const appsData = responseData
        .map((app) => ({
          id: app.name,
          name: app.name,
          displayName: app.display_name || app.name,
          description: app.description || '暂无描述',
          icon: app.icon_url || null,
          appUrl: app.app_url || null,
          organization: app.organization || '-',
          clientId: app.client_id || null,
          redirectUris: app.redirect_uris || [],
        }))
        // 过滤掉"默认应用"
        .filter((app) => {
          const displayName = app.displayName || '';
          return displayName !== '默认应用';
        });
      
      // 更新总数（减去过滤掉的"默认应用"数量）
      const filteredTotal = total - (responseData.length - appsData.length);
      
      setApplications(appsData);
      setPagination(prev => ({
        ...prev,
        current: page,
        pageSize,
        total: filteredTotal,
      }));
    } catch (error) {
      // 如果是取消请求，不显示错误
      const isAborted = error.name === 'AbortError' || 
                       error.isAborted === true ||
                       (abortControllerRef.current && abortControllerRef.current.signal.aborted);
      
      if (isAborted) {
        return;
      }
      handleApiError(error, '加载应用列表失败');
      setApplications([]);
      setPagination(prev => ({
        ...prev,
        total: 0,
      }));
    } finally {
      setLoading(false);
      // 只有在当前 controller 还是活跃的 controller 时才清除引用
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  // 初始加载数据
  useEffect(() => {
    loadApplications(pagination.current, pagination.pageSize);
    
    // 清理函数：组件卸载时取消请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理搜索：如果有搜索文本，需要加载所有数据进行前端过滤
  useEffect(() => {
    if (searchText.trim()) {
      // 有搜索文本时，加载所有数据进行前端过滤
      const loadAllForSearch = async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        setLoading(true);
        try {
          // 加载大量数据用于搜索（假设最多1000个应用）
          const response = await applicationService.getApplicationList({
            page: 1,
            page_size: 1000,
            sort: 'display_name',
          }, {
            signal: controller.signal,
          });
          
          let responseData = [];
          if (response && response.data && typeof response.data === 'object') {
            responseData = response.data.rows || [];
          }
          
          const appsData = responseData
            .map((app) => ({
              id: app.name,
              name: app.name,
              displayName: app.display_name || app.name,
              description: app.description || '暂无描述',
              icon: app.icon_url || null,
              appUrl: app.app_url || null,
              organization: app.organization || '-',
              clientId: app.client_id || null,
              redirectUris: app.redirect_uris || [],
            }))
            .filter((app) => {
              const displayName = app.displayName || '';
              return displayName !== '默认应用';
            });
          
          // 前端过滤
          const searchLower = searchText.toLowerCase();
          const filtered = appsData.filter(app => (
            (app.displayName && app.displayName.toLowerCase().includes(searchLower)) ||
            (app.name && app.name.toLowerCase().includes(searchLower)) ||
            (app.description && app.description.toLowerCase().includes(searchLower))
          ));
          
          setFilteredApplications(filtered);
          setPagination(prev => ({
            ...prev,
            current: 1, // 搜索时重置到第一页
            total: filtered.length,
          }));
        } catch (error) {
          const isAborted = error.name === 'AbortError' || 
                           error.isAborted === true ||
                           (abortControllerRef.current && abortControllerRef.current.signal.aborted);
          
          if (!isAborted) {
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
      // 没有搜索文本时，清空过滤结果，重新加载后端分页数据
      setFilteredApplications([]);
      // 重置到第一页并重新加载
      setPagination(prev => ({ ...prev, current: 1 }));
      loadApplications(1, pagination.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);
  
  // 根据分页和过滤结果计算当前页显示的应用
  useEffect(() => {
    if (!searchText.trim()) {
      // 没有搜索时，直接使用后端返回的数据（已经是分页后的）
      setDisplayApplications(applications);
    } else {
      // 有搜索时，前端分页
      const start = (pagination.current - 1) * pagination.pageSize;
      const end = start + pagination.pageSize;
      setDisplayApplications(filteredApplications.slice(start, end));
    }
  }, [applications, filteredApplications, pagination.current, pagination.pageSize, searchText]);


  const handleAppClick = async (app) => {
    try {
      // 使用应用跳转工具，自动选择最佳跳转方式
      await appJump.jumpFromAppList(app, {
        openInNewTab: true,
        jumpMode: 'auto', // 自动选择：如果有 clientId 和 redirectUris，使用 OAuth2；否则使用 URL 参数传递
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

