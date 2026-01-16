# 项目配置说明

## 环境变量配置

请手动创建 `.env` 文件（项目根目录），内容如下：

```env
# API 基础地址
VITE_API_BASE_URL=http://10.1.2.237:19000/api/v1

# API 前缀（可选，默认 /api）
VITE_API_PREFIX=/api

# API 版本（可选，默认 /v1）
VITE_API_VERSION=/v1
```

**注意**: `.env` 文件已添加到 `.gitignore`，不会被提交到版本控制。

## 已安装的依赖

- **antd**: ^6.1.1 - UI 组件库
- **react-router-dom**: ^7.10.1 - 路由管理
- **dayjs**: ^1.11.19 - 日期处理
- **less**: ^4.5.1 - CSS 预处理器

## 项目结构

```
src/
├── components/    # 公共组件
├── pages/        # 页面组件
├── services/      # API 服务
└── utils/         # 工具函数
```

## 启动项目

```bash
npm run dev
```

