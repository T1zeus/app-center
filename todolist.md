# 应用大平台开发任务清单

## 项目概述
构建一个类似"XX应用大平台"的网站，作为流量入口和用户、组织管理的统一平台。系统管理员可以添加企业，企业管理员可以管理用户，用户可以选择应用跳转到对应的业务系统（如安全培训系统）。

---

## 一、项目初始化

### 1.1 项目配置
- [x] 初始化 Vite + React 项目
- [x] 配置 Less 预处理器
- [x] 安装依赖：antd、react-router-dom、dayjs
- [x] 配置 ESLint
- [x] 配置环境变量（API 地址等）
- [x] 创建项目基础目录结构（pages、components、services、utils）

### 1.2 基础工具类
- [x] 创建 `utils/request.js` - HTTP 请求封装（参考 admin-side）
- [x] 创建 `services/api.js` - API 实例配置（包含请求/响应拦截器）
- [x] 创建 `services/auth.js` - OAuth2 认证服务
- [x] 创建 `components/ProtectedRoute` - 路由保护组件
- [x] 创建 `components/PublicRoute` - 公开路由组件

---

## 二、认证登录模块

### 2.1 登录页面
- [x] 创建 `pages/Login/index.jsx` - 登录页面
- [x] 创建 `pages/Login/index.less` - 登录页面样式
- [x] 实现 OAuth2 授权码模式登录流程
- [x] 处理登录回调（code、state、error 参数）
- [x] 使用授权码换取 access_token
- [x] Token 存储到 localStorage
- [x] 登录成功后跳转到首页

### 2.2 认证服务
- [x] 实现 `getAuthorizeUrl` - 生成授权 URL
- [x] 实现 `getTokenByCode` - 使用授权码换取 token
- [x] 实现 `refreshToken` - 刷新 token
- [x] 实现 `saveToken` - 保存 token（支持 access_token 和 accessToken 兼容）
- [x] 实现 `clearToken` - 清除 token
- [x] 实现 `isTokenExpired` - 检查 token 是否过期
- [x] 实现 `isAuthenticated` - 检查是否已认证
- [x] 实现 `getUserInfo` - 获取用户信息
- [x] 实现 `saveUserInfo` - 保存用户信息

### 2.3 Token 自动刷新
- [x] 在请求拦截器中检查 token 过期
- [x] 自动使用 refresh_token 刷新
- [x] 处理并发请求时的 token 刷新
- [x] Token 刷新失败时跳转登录页
- [x] 完善 ProtectedRoute 中的 token 刷新逻辑
- [x] 完善错误拦截器中的 401 处理

---

## 三、系统管理员功能模块

### 3.1 组织管理页面
- [x] 创建 `pages/Organizations/index.jsx` - 组织列表页面
- [x] 创建 `pages/Organizations/index.less` - 组织列表样式
- [x] 实现组织列表展示（表格，支持分页）
- [x] 实现创建组织功能（Modal 表单）
  - [x] 组织标识（name）
  - [x] 组织名称（display_name）
- [x] 实现查看组织详情
- [x] 实现编辑组织信息
- [x] 显示自动生成的企业管理员账号信息（用户名、密码提示）

### 3.2 组织管理服务
- [x] 创建 `services/organization.js`
- [x] 实现 `getOrganizationList` - 获取组织列表（分页）
- [x] 实现 `getOrganizationDetail` - 获取组织详情
- [x] 实现 `createOrganization` - 创建组织
- [x] 实现 `updateOrganization` - 更新组织

### 3.3 应用管理页面（系统管理员）
- [x] 创建 `pages/Applications/index.jsx` - 应用列表页面
- [x] 创建 `pages/Applications/index.less` - 应用列表样式
- [x] 实现应用列表展示（表格，支持分页）
- [x] 实现创建应用功能（Modal 表单）
  - [x] 应用标识（name）
  - [x] 应用名称（display_name）
  - [x] 重定向 URI 列表（redirect_uris）
- [x] 实现查看应用详情（显示 client_id、client_secret）
- [x] 实现编辑应用信息

### 3.4 应用管理服务
- [x] 创建 `services/application.js`
- [x] 实现 `getApplicationList` - 获取应用列表（分页）
- [x] 实现 `getApplicationDetail` - 获取应用详情
- [x] 实现 `createApplication` - 创建应用
- [x] 实现 `updateApplication` - 更新应用

---

## 四、企业管理员功能模块

### 4.1 用户管理页面
- [x] 创建 `pages/Users/index.jsx` - 用户列表页面
- [x] 创建 `pages/Users/index.less` - 用户列表样式
- [x] 实现用户列表展示（表格，支持分页）
  - [x] 只显示当前组织下的用户（后端自动过滤）
  - [x] 显示用户名、昵称、所属组织
- [x] 实现创建用户功能（Modal 表单）
  - [x] 用户名（name）
  - [x] 昵称（display_name）
  - [x] 密码（password，6-100 位）
  - [x] 所属组织（自动填充当前组织）
- [x] 实现查看用户详情
- [x] 实现编辑用户信息
- [x] 实现重置用户密码功能（管理员重置，不需要旧密码）

### 4.2 用户管理服务
- [x] 创建 `services/user.js`
- [x] 实现 `getUserList` - 获取用户列表（分页，后端自动过滤当前组织）
- [x] 实现 `getUserDetail` - 获取用户详情
- [x] 实现 `createUser` - 创建用户
- [x] 实现 `updateUser` - 更新用户
- [x] 实现 `changePassword` - 修改密码（支持管理员重置）

### 4.3 个人中心
- [x] 在 AdminLayout 中实现修改密码功能
- [x] 实现退出登录功能
- [x] 显示当前用户信息（用户名、所属组织）
- [x] 创建 AdminLayout 组件（管理后台布局）
- [x] 实现侧边栏导航（可折叠）
- [x] 实现顶部导航栏（用户信息下拉菜单）
- [x] 根据用户角色动态显示菜单

---

## 五、应用展示和跳转模块

### 5.1 应用中心首页
- [x] 创建 `pages/Home/index.jsx` - 应用中心首页
- [x] 创建 `pages/Home/index.less` - 首页样式
- [x] 实现应用卡片展示（Grid 布局）
  - [x] 显示应用图标（支持自定义图标或默认图标）
  - [x] 显示应用名称
  - [x] 显示应用描述
- [x] 实现应用搜索功能
- [x] 实现点击应用卡片跳转功能（携带 token 实现 SSO）

### 5.2 应用跳转逻辑
- [x] 实现应用跳转函数
  - [x] 获取目标应用的 app_url
  - [x] 携带当前用户的 access_token（作为参数或 header）
  - [x] 跳转到目标应用
- [x] 处理跳转时的 token 传递方式
  - [x] 方案1：URL 参数传递（降级方案，用于 OAuth2 不可用时）
  - [x] 方案2：使用 OAuth2 授权码模式（推荐，优先使用）

### 5.3 SSO 单点登录集成
- [x] 实现应用间 SSO 跳转
  - [x] 用户点击应用后，携带 token 跳转
  - [x] 目标应用接收 token 并验证（通过 OAuth2 授权码模式）
  - [x] 目标应用自动完成登录（使用授权码换取 token）
- [x] 处理 token 过期情况
  - [x] 跳转前检查 token 是否有效
  - [x] 如果过期，先刷新 token 再跳转
  - [x] 刷新失败时提示用户重新登录
- [x] 实现安全培训系统的 SSO 集成示例（通过 OAuth2 授权码模式实现）

---

## 六、布局和导航

### 6.1 管理后台布局
- [x] 创建 `components/AdminLayout/index.jsx` - 管理后台布局
- [x] 创建 `components/AdminLayout/index.less` - 布局样式
- [x] 实现侧边栏导航（可折叠）
- [x] 实现顶部导航栏
  - [x] 显示平台标题
  - [x] 用户信息下拉菜单（修改密码、退出登录）
- [x] 实现内容区域
- [x] 实现底部 Footer

### 6.2 菜单配置
- [x] 系统管理员菜单
  - [x] 应用中心（首页）
  - [x] 组织管理
  - [x] 应用管理
- [x] 企业管理员菜单
  - [x] 应用中心（首页）
  - [x] 用户管理
- [x] 根据用户角色动态显示菜单
  - [x] 实现角色判断函数
  - [x] 根据 role 字段或 owner 字段判断用户角色
  - [x] 动态显示对应角色的菜单

### 6.3 路由配置
- [x] 配置 `App.jsx` 路由
  - [x] `/login` - 登录页（PublicRoute）
  - [x] `/` - 应用中心首页（ProtectedRoute）
  - [x] `/organizations` - 组织管理（系统管理员）
  - [x] `/applications` - 应用管理（系统管理员）
  - [x] `/users` - 用户管理（企业管理员）
- [x] 实现路由权限控制
  - [x] 创建 RoleProtectedRoute 组件
  - [x] 系统管理员才能访问组织管理和应用管理
  - [x] 企业管理员只能访问用户管理
  - [x] 无权限访问时显示 403 页面

---

## 七、权限控制

### 7.1 角色识别
- [x] 从 token 或用户信息中获取用户角色
- [x] 区分系统管理员和企业管理员
- [x] 实现角色常量定义
  - [x] 创建 `utils/role.js` - 角色工具函数
  - [x] 定义角色常量（SYSTEM_ADMIN、ORG_ADMIN）
  - [x] 实现角色判断函数（isSystemAdmin、isOrgAdmin）
  - [x] 实现权限检查函数（hasRole、hasSystemAdminPermission、hasOrgAdminPermission）

### 7.2 权限拦截
- [x] 在 ProtectedRoute 中实现权限检查（已在 RoleProtectedRoute 中实现）
- [x] 无权限访问时显示 403 页面
  - [x] 创建 `components/Forbidden/index.jsx` - 403 页面组件
  - [x] 在 RoleProtectedRoute 中使用 Forbidden 组件
- [x] 在菜单中根据权限隐藏/显示菜单项（已在 AdminLayout 中实现）
- [x] 在页面中根据权限显示/隐藏功能按钮
  - [x] 创建 `components/PermissionWrapper/index.jsx` - 权限包装组件
  - [x] 提供权限控制工具函数供页面使用

---

## 八、UI/UX 优化

### 8.1 样式统一
- [x] 参考 admin-side 项目的样式风格
- [x] 统一颜色主题
  - [x] 创建 `styles/variables.less` - 全局样式变量
  - [x] 定义颜色主题（主色调、功能色、中性色等）
  - [x] 定义尺寸、间距、字体等变量
- [x] 统一组件样式（按钮、表格、表单等）
  - [x] 创建 `styles/common.less` - 全局通用样式
  - [x] 统一按钮样式
  - [x] 统一表格样式
  - [x] 统一表单样式
  - [x] 统一卡片、Modal、消息提示等样式
  - [x] 创建工具类（间距、文本对齐、文本颜色等）
- [x] 实现响应式布局
  - [x] 定义响应式断点变量
  - [x] 侧边栏响应式处理（移动端隐藏）
  - [x] 应用中心首页响应式优化
  - [x] 登录页面响应式优化（已有）

### 8.2 交互优化
- [x] 添加加载状态（Spin）
  - [x] 表格加载状态（已有）
  - [x] 详情加载状态（已有）
  - [x] 页面加载状态（已有）
- [x] 添加操作成功/失败提示（message）
  - [x] 创建 `utils/messageHelper.js` - 消息提示工具函数
  - [x] 统一成功、错误、警告、信息提示
  - [x] 统一错误处理逻辑
  - [x] 更新所有页面使用统一的消息提示
- [x] 添加确认对话框（Modal.confirm）
  - [x] 创建 `utils/confirmHelper.js` - 确认对话框工具函数
  - [x] 支持删除、更新等操作的确认提示
  - [x] 提供快捷方法（showDeleteConfirm、showUpdateConfirm）
- [x] 优化表单验证提示
  - [x] 创建 `utils/formRules.js` - 表单验证规则工具
  - [x] 统一密码、用户名、显示名称等验证规则
  - [x] 统一验证提示信息
  - [x] 更新所有表单使用统一的验证规则
- [x] 优化错误提示信息
  - [x] 统一错误信息解析逻辑
  - [x] 提供友好的错误提示
  - [x] 支持自定义默认错误消息

### 8.3 页面优化
- [x] 应用中心首页美化（卡片式布局）
  - [x] 优化卡片图标样式（渐变背景、悬停效果）
  - [x] 优化卡片内容布局（标题、描述、组织信息）
  - [x] 优化卡片悬停动画效果
  - [x] 优化空状态展示样式
- [x] 表格操作列优化（编辑、删除等）
  - [x] 创建 `styles/table.less` - 表格样式优化
  - [x] 统一操作列按钮样式（间距、颜色、悬停效果）
  - [x] 优化表格空状态展示
  - [x] 优化表格分页样式
  - [x] 更新所有表格使用统一的 table-actions 类
- [x] 表单布局优化（Modal 表单）
  - [x] 创建 `styles/form.less` - 表单样式优化
  - [x] 优化 Modal 头部、body、footer 样式
  - [x] 优化表单输入框样式（边框、焦点、错误状态）
  - [x] 优化表单标签和提示信息样式
  - [x] 优化移动端表单布局
- [x] 空状态展示（无数据提示）
  - [x] 优化表格空状态样式
  - [x] 优化应用中心首页空状态样式
  - [x] 统一空状态提示信息

---

## 九、错误处理和边界情况

### 9.1 错误处理
- [ ] 网络错误处理
- [ ] 401 未授权处理（跳转登录）
- [ ] 403 无权限处理（显示提示）
- [ ] 500 服务器错误处理
- [ ] 业务错误提示（后端返回的错误信息）

### 9.2 边界情况
- [ ] Token 过期自动刷新
- [ ] 刷新 token 失败处理
- [ ] 登录回调参数缺失处理
- [ ] 应用跳转失败处理
- [ ] 分页边界处理（空列表、最后一页等）

---

## 十、测试和优化

### 10.1 功能测试
- [ ] 测试登录流程（OAuth2 授权码模式）
- [ ] 测试系统管理员功能（组织管理、应用管理）
- [ ] 测试企业管理员功能（用户管理）
- [ ] 测试应用跳转和 SSO
- [ ] 测试权限控制

### 10.2 性能优化
- [ ] 代码分割（路由懒加载）
- [ ] 图片优化
- [ ] API 请求优化（防抖、节流）
- [ ] 列表虚拟滚动（如果数据量大）

### 10.3 代码质量
- [ ] ESLint 检查通过
- [ ] 代码格式化统一
- [ ] 注释完善
- [ ] 变量命名规范

---

## 十一、文档和部署

### 11.1 文档
- [ ] 更新 README.md（项目说明、启动方式）
- [ ] 添加 API 接口文档注释
- [ ] 添加组件使用说明

### 11.2 部署准备
- [ ] 配置生产环境变量
- [ ] 构建优化配置
- [ ] 部署脚本准备

---

## 技术栈参考

- **框架**: React 19 + Vite
- **UI 库**: Ant Design 6
- **路由**: React Router 7
- **样式**: Less
- **HTTP 请求**: 自定义 Request 类（基于 fetch）
- **认证**: OAuth2 授权码模式
- **状态管理**: localStorage + React Hooks

---

## 注意事项

1. **编码风格**: 参考 `admin-side` 项目的编码习惯和文件结构
2. **API 接口**: 所有接口需要携带 `Authorization: Bearer {access_token}` 请求头
3. **密码处理**: 前端不进行 MD5 等加密处理，直接传递明文密码（后端处理）
4. **Token 安全**: Token 存储在 localStorage，注意 XSS 防护
5. **SSO 实现**: 应用跳转时需要考虑 token 传递的安全性和有效性
6. **权限控制**: 严格区分系统管理员和企业管理员的权限范围

