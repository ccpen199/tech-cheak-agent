# 安装指南

## 系统要求

- Node.js >= 16.0.0
- npm >= 8.0.0

## 安装步骤

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 3. 配置环境变量（可选）

如果需要使用飞书功能，请复制 `backend/.env.example` 为 `backend/.env` 并填入相关信息：

```bash
cd ../backend
cp .env.example .env
# 然后编辑 .env 文件
```

如果不配置飞书，系统会运行在模拟模式下，文档处理功能正常，但不会真正上传到飞书。

### 4. 启动服务

#### 方式一：使用启动脚本（推荐）

```bash
# 在项目根目录
chmod +x start.sh stop.sh
./start.sh
```

#### 方式二：手动启动

**终端1 - 启动后端：**
```bash
cd backend
npm start
```

**终端2 - 启动前端：**
```bash
cd frontend
npm run dev
```

### 5. 访问应用

打开浏览器访问：http://localhost:3005

## 验证安装

访问以下URL验证服务是否正常：

- 前端：http://localhost:3005
- 后端健康检查：http://localhost:4004/api/health

## 常见问题

### 端口被占用

如果端口被占用，可以修改：

- **前端端口**：编辑 `frontend/vite.config.js` 中的 `server.port`
- **后端端口**：编辑 `backend/.env` 中的 `PORT` 或环境变量

### 依赖安装失败

如果npm install失败，可以尝试：

```bash
# 清除npm缓存
npm cache clean --force

# 删除node_modules和package-lock.json后重新安装
rm -rf node_modules package-lock.json
npm install
```

### 文档处理失败

确保已安装所有依赖：

```bash
cd backend
npm install mammoth docx
```

## 开发模式

后端开发模式（自动重启）：
```bash
cd backend
npm run dev
```

前端开发模式（热重载）：
```bash
cd frontend
npm run dev
```
