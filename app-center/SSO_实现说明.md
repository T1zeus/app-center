# SSO（单点登录）实现说明

## ⚠️ 当前状态

### 系统架构说明

- **应用大平台后端（授权服务器）**：`http://10.1.2.237:19000/api/v1/auth/authorize`
  - 这是 OAuth2 的授权服务器，负责验证用户身份、生成授权码
  - **前端应该调用这个接口**（✅ 当前实现正确）

- **安全培训系统后端（资源服务器）**：`http://10.1.2.237:17890/api/v1/auth/authorize`
  - 这是目标应用的资源服务器
  - **不应该直接调用这个接口进行 SSO**

### OAuth2 标准流程

1. 用户在应用大平台登录（后端：19000）
2. 用户点击跳转到安全培训系统
3. **前端调用应用大平台后端（19000）的 `/auth/authorize`**，传递安全培训系统的 `client_id`
4. 应用大平台后端验证用户身份，生成授权码
5. 重定向到安全培训系统的 `redirect_uri`，带上授权码
6. 安全培训系统使用授权码调用应用大平台后端（19000）的 `/auth/token` 换取 token

### 当前问题

**前端已准备就绪**：前端代码已正确实现，生成的 URL 包含 `access_token` 参数，且指向应用大平台后端（`10.1.2.237:19000`）。

**问题在后端**：应用大平台后端（19000）的 `/auth/authorize` 接口直接重定向到了 Casdoor（`10.1.2.237:8800`），没有检查用户是否已登录，也没有保留 `access_token` 参数。

**验证日志**（浏览器控制台）：
```
[Auth] 生成的授权 URL: http://10.1.2.237:19000/api/v1/auth/authorize?...&access_token=eyJhbGciOi...
[SSO] Token 长度: 1298
```

但实际跳转到了：`http://10.1.2.237:8800/login/oauth/authorize?...`（没有 `access_token`）

---

## 一、当前前端实现原理

### 1.1 前端实现方式

当前前端在 `app-center/src/utils/appJump.js` 中的 `jumpWithOAuth2` 方法实现了以下逻辑：

1. **确保 Token 有效**
   - 调用 `ensureValidToken()` 确保 `access_token` 有效
   - 如果过期，自动调用 `/auth/token` 刷新 token

2. **生成授权 URL**
   - 调用 `authService.getAuthorizeUrl()` 生成标准的 OAuth2 授权 URL
   - URL 格式：`http://10.1.2.237:19000/api/v1/auth/authorize?client_id=xxx&redirect_uri=xxx&response_type=code&scope=profile&state=xxx`

3. **添加 access_token 参数（备选方案）**
   - 在授权 URL 中添加 `access_token` 参数
   - 最终 URL：`http://10.1.2.237:19000/api/v1/auth/authorize?client_id=xxx&redirect_uri=xxx&response_type=code&scope=profile&state=xxx&access_token=xxx`

4. **跳转到授权端点**
   - 使用 `window.open()` 或 `window.location.href` 跳转到授权 URL

### 1.2 前端传递的信息

前端通过以下两种方式向后端传递用户身份信息：

**方案A：Cookie 方式（推荐，但可能受跨域限制）**
- `refresh_token` 存储在 HttpOnly Cookie 中
- 浏览器自动携带 Cookie 到后端
- **限制**：如果应用大平台和后端鉴权网关不在同一域名/端口，Cookie 可能无法携带

**方案B：URL 参数方式（备选）**
- 在授权 URL 中添加 `access_token` 参数
- 后端可以通过验证这个 token 来识别用户身份
- **优势**：不受跨域限制

## 二、后端需要实现的功能（⚠️ 关键）

### 2.1 应用大平台后端（19000）的 `/auth/authorize` 接口需要支持 SSO

**重要说明**：
- **应用大平台后端（19000）** 是 OAuth2 的授权服务器，负责验证用户身份、生成授权码
- **安全培训系统后端（17890）** 是资源服务器，不应该直接调用它的 `/auth/authorize` 接口
- 前端调用应用大平台后端（19000）的接口是**正确的**

**当前问题**：应用大平台后端（19000）的 `/auth/authorize` 接口直接重定向到了 Casdoor，没有检查用户是否已登录。

**需要修改**：应用大平台后端（19000）需要修改 `/auth/authorize` 接口，在重定向到 Casdoor 之前，先检查用户是否已登录。如果已登录，直接生成授权码并返回，不跳转登录页。

### 2.2 实现步骤

后端需要修改 `/auth/authorize` 接口，添加以下逻辑：

#### 2.1.1 检查用户是否已登录

在重定向到 Casdoor 登录页之前，后端需要先检查用户是否已经登录：

```python
# 伪代码示例
def authorize(request):
    # 1. 优先检查 Cookie 中的 refresh_token（方案A）
    refresh_token = request.cookies.get('refresh_token')
    if refresh_token:
        user = validate_refresh_token(refresh_token)
        if user and user.is_authenticated:
            # 用户已登录，直接生成授权码并返回，不跳转登录页
            code = generate_authorization_code(user, client_id, redirect_uri)
            return redirect(f"{redirect_uri}?code={code}&state={state}")
    
    # 2. 备选方案：检查 URL 参数中的 access_token（方案B）
    access_token = request.GET.get('access_token')
    if access_token:
        user = validate_access_token(access_token)
        if user and user.is_authenticated:
            # 用户已登录，直接生成授权码并返回，不跳转登录页
            code = generate_authorization_code(user, client_id, redirect_uri)
            return redirect(f"{redirect_uri}?code={code}&state={state}")
    
    # 3. 如果两种方式都验证失败，说明用户未登录，跳转到 Casdoor 登录页
    return redirect(f"{casdoor_login_url}?client_id={client_id}&redirect_uri={redirect_uri}&state={state}")
```

#### 2.1.2 验证逻辑说明

1. **验证 refresh_token（Cookie）**
   - 从请求的 Cookie 中读取 `refresh_token`
   - 验证 token 是否有效（未过期、未撤销）
   - 如果有效，获取对应的用户信息

2. **验证 access_token（URL 参数）**
   - 从 URL 参数中读取 `access_token`
   - 验证 token 是否有效（未过期、未撤销）
   - 如果有效，获取对应的用户信息

3. **生成授权码**
   - 如果用户已登录（通过任一方式验证成功），直接生成授权码
   - 授权码应该与用户、client_id、redirect_uri 绑定
   - 重定向到 `redirect_uri?code=xxx&state=xxx`，**不跳转到登录页**

4. **跳转登录页**
   - 只有当两种验证方式都失败时，才跳转到 Casdoor 登录页

### 2.2 Cookie 配置要求（如果使用方案A）

如果后端要支持通过 Cookie 传递 `refresh_token`，需要确保：

1. **Cookie 域名设置**
   - 如果应用大平台和后端鉴权网关在同一域名下（如 `example.com`），设置 Cookie 域名为 `.example.com`
   - 这样 Cookie 可以在子域名之间共享

2. **Cookie 属性设置**
   ```python
   # 设置 refresh_token Cookie 时
   response.set_cookie(
       'refresh_token',
       value=refresh_token,
       domain='.example.com',  # 允许子域名共享
       httponly=True,          # 防止 JavaScript 访问
       secure=True,             # 仅 HTTPS（生产环境）
       samesite='Lax'          # 允许跨站请求携带
   )
   ```

3. **跨域问题**
   - 如果应用大平台和后端鉴权网关在不同域名/端口，Cookie 无法共享
   - 这种情况下，必须使用方案B（URL 参数传递 access_token）

### 2.3 安全考虑

1. **Token 验证**
   - 验证 token 时，需要检查 token 是否在黑名单中（已撤销）
   - 检查 token 的签名和有效期
   - 验证 token 对应的用户是否有权限访问目标应用

2. **授权码生成**
   - 授权码应该是临时、一次性使用的
   - 授权码应该与 client_id、redirect_uri 绑定
   - 授权码应该有较短的过期时间（如 10 分钟）

3. **URL 参数中的 access_token**
   - 虽然这不是标准的 OAuth2 流程，但可以实现 SSO
   - 建议在日志中记录使用 URL 参数验证的情况
   - 考虑在生产环境中限制这种方式的使用（仅用于 SSO）

## 三、实现流程图

### 3.1 当前流程（未实现 SSO）

```
用户点击应用链接
  ↓
前端调用 /auth/authorize?client_id=xxx&redirect_uri=xxx&access_token=xxx
  ↓
后端直接跳转到 Casdoor 登录页 ❌（用户需要重新登录）
  ↓
用户在 Casdoor 输入账号密码
  ↓
Casdoor 返回授权码
  ↓
前端使用授权码换取 token
```

### 3.2 期望流程（实现 SSO 后）

```
用户点击应用链接
  ↓
前端调用 /auth/authorize?client_id=xxx&redirect_uri=xxx&access_token=xxx
  ↓
后端检查用户是否已登录：
  ├─ 检查 Cookie 中的 refresh_token
  ├─ 检查 URL 参数中的 access_token
  ↓
如果用户已登录：
  ├─ 后端直接生成授权码
  ├─ 重定向到 redirect_uri?code=xxx&state=xxx ✅（无需登录）
  └─ 前端使用授权码换取 token
  ↓
如果用户未登录：
  └─ 跳转到 Casdoor 登录页（正常流程）
```

## 四、后端实现检查清单

- [ ] `/auth/authorize` 接口添加 Cookie 验证逻辑（检查 `refresh_token`）
- [ ] `/auth/authorize` 接口添加 URL 参数验证逻辑（检查 `access_token`）
- [ ] 实现 `validate_refresh_token()` 函数（验证 refresh_token 有效性）
- [ ] 实现 `validate_access_token()` 函数（验证 access_token 有效性）
- [ ] 实现 `generate_authorization_code()` 函数（生成授权码）
- [ ] 如果用户已登录，直接返回授权码，不跳转登录页
- [ ] 如果用户未登录，跳转到 Casdoor 登录页
- [ ] 配置 Cookie 域名（如果使用方案A）
- [ ] 添加日志记录（记录 SSO 成功/失败的情况）
- [ ] 添加安全验证（检查 token 黑名单、用户权限等）

## 五、测试验证

### 5.1 测试场景

1. **用户已登录，点击应用链接**
   - 期望：直接跳转到目标应用，无需输入账号密码

2. **用户未登录，点击应用链接**
   - 期望：跳转到 Casdoor 登录页

3. **Token 过期，点击应用链接**
   - 期望：前端自动刷新 token，然后实现 SSO

4. **跨域场景**
   - 期望：即使 Cookie 无法携带，也能通过 URL 参数实现 SSO

### 5.2 调试方法

1. **检查 Cookie**
   - 在浏览器开发者工具中查看 Cookie
   - 确认 `refresh_token` Cookie 是否存在
   - 确认 Cookie 的域名是否正确

2. **检查请求**
   - 在浏览器开发者工具中查看网络请求
   - 确认 `/auth/authorize` 请求是否携带 Cookie
   - 确认 URL 参数中是否包含 `access_token`

3. **检查后端日志**
   - 查看后端日志，确认是否检测到已登录用户
   - 确认是否生成了授权码
   - 确认是否跳转到登录页（不应该跳转）

## 六、总结

### 6.1 问题确认

**前端状态**：✅ 已准备就绪
- 生成的 URL 正确：`http://10.1.2.237:19000/api/v1/auth/authorize?...&access_token=xxx`
- Token 有效且已添加到 URL 参数中
- 浏览器会自动携带 Cookie 中的 `refresh_token`

**后端状态**：❌ 需要实现
- 当前直接重定向到 Casdoor，没有检查用户是否已登录
- 重定向时丢失了 `access_token` 参数
- 没有实现 SSO 逻辑

### 6.2 解决方案

后端需要在 `/auth/authorize` 接口中添加用户身份验证逻辑：

1. **优先检查 Cookie 中的 `refresh_token`**（方案A）
   - 从请求的 Cookie 中读取 `refresh_token`
   - 验证 token 是否有效（未过期、未撤销）
   - 如果有效，获取对应的用户信息

2. **备选检查 URL 参数中的 `access_token`**（方案B）
   - 从 URL 参数中读取 `access_token`
   - 验证 token 是否有效（未过期、未撤销）
   - 如果有效，获取对应的用户信息

3. **如果用户已登录**（通过任一方式验证成功）
   - 直接生成授权码（与用户、client_id、redirect_uri 绑定）
   - 重定向到 `redirect_uri?code=xxx&state=xxx`
   - **不跳转到 Casdoor 登录页**

4. **如果用户未登录**（两种验证方式都失败）
   - 跳转到 Casdoor 登录页（正常流程）

### 6.3 关键点

- **前端已准备就绪**：前端已经实现了在授权 URL 中添加 `access_token` 参数，并确保 token 有效
- **后端需要实现**：后端需要实现上述 SSO 逻辑，才能实现自动登录
- **验证方式**：后端应该优先使用 Cookie 验证（方案A），URL 参数作为备选（方案B）

只要后端实现了上述逻辑，SSO 就能正常工作。

