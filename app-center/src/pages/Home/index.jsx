import { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Input, 
  Row, 
  Col, 
  Spin, 
  Empty,
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
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const abortControllerRef = useRef(null); // 用于取消重复请求

  useEffect(() => {
    // 清理函数：组件卸载或重新渲染时取消之前的请求
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true; // 标记组件是否已挂载
    
    const loadData = async () => {
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
          page: 1,
          page_size: 100,
          sort: 'display_name',
          is_shared: true, // 传递 is_shared=true 返回有实际意义的共享应用
        }, {
          signal: controller.signal,
        });
        
        // 检查组件是否已卸载
        // 注意：即使 signal 被 abort，只要请求已经成功完成，就应该处理响应
        if (!isMounted) {
          return;
        }
        
        // 处理响应数据
        let responseData = [];
        
        if (response && response.data && typeof response.data === 'object') {
          responseData = response.data.rows || [];
        }
        
        // 转换数据格式
        const appsData = responseData.map((app) => ({
          id: app.name,
          name: app.name,
          displayName: app.display_name || app.name,
          description: app.description || '暂无描述',
          icon: app.icon_url || null,
          appUrl: app.app_url || null,
          organization: app.organization || '-',
          clientId: app.client_id || null,
          redirectUris: app.redirect_uris || [],
        }));
        
        // 只要组件还在挂载状态，就更新数据
        // 即使 signal 被 abort，只要请求已经成功完成，就应该更新数据
        if (isMounted) {
          setApplications(appsData);
          setFilteredApplications(appsData);
        }
      } catch (error) {
        // 如果是取消请求，不显示错误
        // 检查多种取消情况：AbortError、isAborted 标记、或 signal 已被 abort
        const isAborted = error.name === 'AbortError' || 
                         error.isAborted === true ||
                         (abortControllerRef.current && abortControllerRef.current.signal.aborted);
        
        if (isAborted) {
          return;
        }
        if (isMounted) {
          handleApiError(error, '加载应用列表失败');
          setApplications([]);
          setFilteredApplications([]);
        }
      } finally {
        // 只要组件还在挂载状态，就清除 loading
        // 注意：如果请求被取消，loading 状态也应该被清除
        if (isMounted) {
          setLoading(false);
        }
        // 只有在当前 controller 还是活跃的 controller 时才清除引用
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    };
    
    loadData();
    
    // 清理函数：防止 StrictMode 导致的重复请求
    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // 根据搜索文本过滤应用
    if (!searchText.trim()) {
      setFilteredApplications(applications);
    } else {
      const filtered = applications.filter(app => {
        const searchLower = searchText.toLowerCase();
        return (
          (app.displayName && app.displayName.toLowerCase().includes(searchLower)) ||
          (app.name && app.name.toLowerCase().includes(searchLower)) ||
          (app.description && app.description.toLowerCase().includes(searchLower))
        );
      });
      setFilteredApplications(filtered);
    }
  }, [searchText, applications]);


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
    <div className="app-center-home" style={{ background: '#fff', minHeight: '100%', padding: '20px', display: 'block' }}>
      <div className="home-header" style={{ display: 'block', visibility: 'visible' }}>
        <h1 style={{ color: '#000', display: 'block' }}>应用中心</h1>
        <p className="home-subtitle" style={{ color: '#666', display: 'block' }}>选择应用，快速访问</p>
      </div>
      <div className="home-search">
        <Search
          placeholder="搜索应用名称或描述"
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ maxWidth: 600 }}
        />
      </div>

      {loading ? (
        <div className="home-loading">
          <Spin size="large" />
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="home-empty">
          <Empty 
            description={searchText ? '未找到匹配的应用' : '暂无应用'}
          />
        </div>
      ) : (
        <div className="home-apps" style={{ display: 'block', visibility: 'visible', minHeight: '200px' }}>
          <Row gutter={[24, 24]} style={{ display: 'flex' }}>
            {filteredApplications.map((app) => {
              return (
                <Col 
                  key={app.id} 
                  xs={24} 
                  sm={12} 
                  md={8} 
                  lg={6} 
                  xl={6}
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
                      description={
                        <div>
                          <div className="app-card-desc">{app.description}</div>
                          {app.organization && app.organization !== '-' && (
                            <div className="app-card-org">{app.organization}</div>
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
      )}
    </div>
  );
}

export default Home;

