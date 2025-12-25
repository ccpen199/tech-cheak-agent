# Zeabur 部署配置指南

## 问题描述
错误：`Error: Cannot find module '/src/index.js'`

原因：Zeabur 默认在根目录寻找 `/src/index.js`，但实际入口文件在 `backend/src/index.js`

## 解决方案

### 方案 1：使用 zeabur.json 配置（已配置）

已创建 `zeabur.json` 配置文件，指定：
- 根目录：`backend`
- 启动命令：`npm start`

### 方案 2：在 Zeabur 控制台手动配置

如果 `zeabur.json` 没有生效，请在 Zeabur 控制台手动设置：

1. 进入你的项目设置页面
2. 找到 **Build Settings** 或 **部署设置**
3. 设置以下参数：
   - **Root Directory（根目录）**: `backend`
   - **Install Command（安装命令）**: `npm install`
   - **Build Command（构建命令）**: （留空）
   - **Start Command（启动命令）**: `npm start`

### 方案 3：使用 Dockerfile（如果需要）

如果上述方案都不行，可以创建 Dockerfile：

```dockerfile
FROM node:22
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
EXPOSE 4004
ENV PORT=4004
CMD ["npm", "start"]
```

然后在 Zeabur 设置中选择使用 Dockerfile 部署。

## 验证配置

部署成功后，应用应该：
- 在端口 4004 上运行（或 Zeabur 分配的端口）
- 可以通过 `/api/health` 端点检查健康状态

## 环境变量

确保在 Zeabur 控制台设置以下环境变量（如果需要）：
- `PORT`: 端口号（通常由 Zeabur 自动设置）
- 其他应用所需的环境变量

## 注意事项

1. 确保 `backend/package.json` 中的 `start` 脚本正确：`"start": "node src/index.js"`
2. 确保所有依赖都已正确安装
3. 如果修改了配置，需要重新部署才能生效

