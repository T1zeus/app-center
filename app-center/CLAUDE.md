# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 开发服务器
npm run dev

# 构建
npm run build

# 代码检查
npm run lint

# 预览构建
npm run preview
```

## 环境变量

需要在项目根目录创建 `.env` 文件（参考 `.env.example`）：

```env
# API 基础地址
VITE_API_BASE_URL=http://10.1.2.237:19000/api/v1
VITE_API_PREFIX=/api
VITE_API_VERSION=/v1

# Mock 开关（开发测试用）
VITE_USE_MOCK=true
```

## 项目架构

### 技术栈
- React 19 + Vite 6 + Antd 6
- React Router 7（路由管理）
- Less（CSS 预处理器）
- 自研 Request 类（非 axios，支持拦截器）

### 目录结构

```
src/
├── components/       # 公共组件
│   ├── ProtectedRoute/        # 需要登录的路由保护
│   ├── PublicRoute/           # 公开路由（已登录重定向）
│   ├── RoleProtectedRoute/    # 基于角色的路由保护
│   ├── AdminLayout/           # 管理后台布局
│   ├── PermissionWrapper/     # 权限包装器
│   └── Forbidden/             # 403 页面
│
│   **AdminLayout 组件**（[components/AdminLayout/index.jsx](src/components/AdminLayout/index.jsx)）：
│   - 支持桌面端和移动端响应式布局（移动端使用 Dropdown 菜单）
│   - 根据用户角色动态显示菜单（系统管理员/企业管理员/员工）
│   - 内置修改密码功能（调用 `userService.changePassword`）
│   - 退出登录时清除本地 token 并调用后端 logout 接口
├── pages/            # 页面组件
│   ├── Login/                  # 登录页
│   ├── Home/                   # 首页
│   ├── Organizations/          # 组织管理（仅系统管理员）
│   ├── Applications/           # 应用管理（仅系统管理员）
│   ├── Subscriptions/          # 订阅管理（仅系统管理员）
│   └── Users/                  # 用户管理（系统管理员+企业管理员）
├── services/         # API 服务层
│   ├── api.js                 # 核心 API 实例（含拦截器）
│   ├── auth.js                # OAuth2 认证服务
│   ├── application.js         # 应用相关 API
│   ├── organization.js        # 组织相关 API
│   ├── subscription.js        # 订阅相关 API
│   └── user.js                # 用户相关 API
└── utils/            # 工具函数
    ├── request.js             # 自研 Request 类
    ├── role.js                # 角色权限工具
    ├── appJump.js             # 应用跳转（SSO）
    ├── formRules.js           # 表单验证规则
    ├── confirmHelper.js       # 确认对话框
    └── messageHelper.js       # 消息提示
```

## 认证与授权

### OAuth2 认证流程

项目使用标准 OAuth2 认证，支持三种授权方式：

1. **授权码模式**（SSO）：`authService.getAuthorizeUrl()`
2. **密码模式**（登录）：`authService.loginWithPassword()`
3. **刷新令牌**：`authService.refreshToken()`

Token 存储在 `localStorage`，包括：
- `auth_token` - 访问令牌
- `refresh_token` - 刷新令牌
- `token_expires_at` - 过期时间戳
- `user_info` - 用户信息

### Token 自动刷新机制

[api.js](src/services/api.js) 实现了智能的 token 自动刷新：

- 在请求拦截器中检查 token 是否即将过期
- 如果过期，自动调用刷新接口
- 使用 `isRefreshing` 标志防止并发刷新
- 使用 `pendingRequests` 队列保存等待中的请求
- 刷新成功后自动重试所有挂起的请求

**重要**：[ProtectedRoute](src/components/ProtectedRoute/index.jsx) 不再主动检查 token 过期，只要有 token 就认为已登录，让 API 请求在 401 时自动刷新。

### 菜单配置

[AdminLayout](src/components/AdminLayout/index.jsx) 中根据用户角色动态显示菜单：

| 角色 | 可见菜单 |
|------|----------|
| `system_admin` | 应用中心、组织管理、应用管理、订阅管理、用户管理 |
| `org_admin` | 应用中心、用户管理 |
| `employee` | 应用中心 |

### 角色权限系统

角色定义（[role.js](src/utils/role.js)）：

| 角色 | 条件 |
|------|------|
| `system_admin` | `owner === 'built-in'` 且 `is_admin === true` |
| `org_admin` | `owner !== 'built-in'` 且 `is_admin === true` |
| `employee` | 其他所有情况 |

路由权限配置（[App.jsx](src/App.jsx)）：
- `/` - 所有已登录用户
- `/organizations` - 仅系统管理员
- `/applications` - 仅系统管理员
- `/subscriptions` - 仅系统管理员
- `/users` - 系统管理员 + 企业管理员

### 错误处理

[api.js](src/services/api.js) 中的错误拦截器统一处理：
- 401：自动尝试刷新 token，失败则跳转登录
- 403：无权限提示
- 404：静默处理（由业务逻辑处理）
- 500/502/503：服务不可用提示

**特殊处理**：token 请求（`/auth/token`）的错误不显示全局提示，由登录页面自行处理。

## SSO 单点登录

应用跳转通过 [appJump.js](src/utils/appJump.js) 实现，支持三种跳转模式：

```javascript
import appJump from '@/utils/appJump';

// 方式1：自动选择（推荐）
// 如果应用配置了 OAuth2（有 clientId 和 redirectUris），使用 OAuth2 模式
// 否则降级为 URL 参数传递 token 模式
appJump.jumpToApp(appInfo, { openInNewTab: true });

// 方式2：强制使用 OAuth2 模式
appJump.jumpToApp(appInfo, { jumpMode: 'oauth2' });

// 方式3：强制使用 URL 参数传递 token 模式
appJump.jumpToApp(appInfo, { jumpMode: 'token' });

// 从应用列表直接跳转（自动获取应用详情）
appJump.jumpFromAppList(app, { openInNewTab: true });
```

**跳转模式说明**：
- `oauth2`：标准 OAuth2 授权码模式，后端验证用户身份后返回授权码
- `token`：URL 参数直接传递 access_token（简单但不安全，仅用于降级）
- `auto`：自动选择（默认，优先使用 OAuth2）

流程：
1. 确保 `access_token` 有效（过期则自动刷新）
2. 生成 OAuth2 授权 URL（包含 `access_token` 参数）
3. 跳转到目标应用

**后端要求**：后端 `/auth/authorize` 接口需要支持通过 URL 参数或 Cookie 验证用户身份，已登录用户直接生成授权码，无需重新登录。详见 [SSO_实现说明.md](SSO_实现说明.md)。

## 自研 Request 类

项目使用自研的 [Request 类](src/utils/request.js)（而非 axios），支持：

- 请求/响应拦截器
- 超时控制（默认 15 秒）
- 自动处理 GET 请求参数
- 错误拦截器（标记 `_isErrorInterceptor = true`）

使用方式：
```javascript
import api from '@/services/api';

// GET 请求
api.get('/users', { params: { page: 1 } });

// POST 请求
api.post('/users', { name: 'test' });

// 路径参数
api.get('/users/{id}', {
  pathParams: { id: 123 }
});
```

## 代码风格

ESLint 配置：
- 基于 `eslint:recommended`
- React Hooks 规则
- React Refresh 规则
- 未使用变量规则：`varsIgnorePattern: '^[A-Z_]'`（允许全大写变量）

## 注意事项

1. **不要使用 axios**：项目使用自研 Request 类，位于 [utils/request.js](src/utils/request.js)
2. **API 调用统一通过 services 层**：不要在页面组件中直接调用 api，应在 [services/](src/services/) 目录中创建对应的 service 文件
3. **Token 刷新是自动的**：API 层已实现自动刷新，组件中不需要手动处理
4. **404 错误静默处理**：详情请求的 404 由列表数据提供基本信息，不需要全局错误提示
5. **Mock 模式**：设置 `VITE_USE_MOCK=true` 可启用 Mock 数据，用于前端独立开发测试
