# 教案评审系统

一个基于React和Node.js的教案评审系统，可以自动检测文档中的错别字、检查格式，并将评审结果登记到飞书。

## 功能特性

1. **文档上传**：支持上传Word文档（.doc, .docx格式）
2. **文档登记**：自动提取文档编号和名称，登记到飞书多维表格
3. **错别字检测**：自动检测文档中的错别字
4. **格式检查**：检查文档格式问题（标题、段落、标点符号等）
5. **文档处理**：生成标注了错别字和格式问题的处理版本
6. **飞书集成**：将评审意见和处理后的文档上传到飞书

## 项目结构

```
tech-cheak-agent/
├── backend/          # 后端服务
│   ├── src/
│   │   ├── index.js              # 主服务文件
│   │   └── services/
│   │       ├── documentProcessor.js  # 文档处理服务
│   │       ├── typoChecker.js        # 错别字检测
│   │       ├── formatChecker.js      # 格式检查
│   │       └── larkService.js        # 飞书服务
│   ├── uploads/      # 上传文件存储
│   └── processed/    # 处理后的文件存储
├── frontend/         # 前端应用
│   └── src/
│       ├── App.jsx   # 主应用组件
│       └── ...
├── start.sh          # 启动脚本
└── stop.sh           # 停止脚本
```

## 快速开始

### 方式一：使用启动脚本（推荐）

```bash
# 给脚本添加执行权限
chmod +x start.sh stop.sh

# 启动服务
./start.sh

# 停止服务
./stop.sh
```

### 方式二：手动启动

#### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

#### 2. 配置飞书云表格（可选）

**方式一：使用配置助手（推荐）**

```bash
cd backend
node setup-lark.js
```

按照提示输入飞书配置信息即可。

**方式二：手动配置**

1. 复制 `backend/.env.example` 为 `backend/.env`
2. 参考 `飞书配置指南.md` 获取配置信息
3. 填入飞书应用信息：

```env
LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret
LARK_BITABLE_APP_TOKEN=your_bitable_app_token
LARK_BITABLE_TABLE_ID=your_bitable_table_id
PORT=4004
```

**注意**：
- 如果不配置飞书信息，系统会运行在模拟模式下，文档处理功能正常，但不会真正上传到飞书
- 详细的配置步骤请参考 `飞书配置指南.md`

#### 3. 启动服务

```bash
# 终端1：启动后端（端口4004）
cd backend
npm start

# 终端2：启动前端（端口3005）
cd frontend
npm run dev
```

#### 4. 访问应用

打开浏览器访问：http://localhost:3005

## 端口配置

- **前端**：3005
- **后端**：4004

## 使用说明

1. 在浏览器中打开前端应用
2. 点击"选择文档"按钮，选择要评审的Word文档
3. 点击"开始处理"按钮
4. 系统将自动：
   - 提取文档编号和名称
   - 检测错别字
   - 检查格式问题
   - 生成处理后的文档
   - 登记到飞书（如果已配置）
5. 查看处理结果并下载修改后的文档

## 飞书配置说明

### 1. 创建飞书应用

1. 登录飞书开放平台：https://open.feishu.cn
2. 创建企业自建应用
3. 获取 App ID 和 App Secret

### 2. 创建多维表格

1. 在飞书中创建一个多维表格
2. 添加以下字段：
   - 文档编号（文本）
   - 文档名称（文本）
   - 原文件名（文本）
   - 错别字数量（数字）
   - 格式问题数量（数字）
   - 评审意见（多行文本）
   - 处理后的文档（附件）
3. 获取表格的 App Token 和 Table ID

### 3. 配置权限

在飞书开放平台的应用管理页面，为应用添加以下权限：
- `bitable:app:readonly` - 查看多维表格
- `bitable:app` - 编辑多维表格
- `drive:drive:readonly` - 查看云文档
- `drive:drive` - 上传文件到云文档

### 4. 配置环境变量

将获取到的信息填入 `backend/.env` 文件。

## 技术栈

- **前端**：React + Vite
- **后端**：Node.js + Express
- **文档处理**：mammoth (Word转文本) + docx (生成Word)
- **飞书集成**：飞书开放平台API

## 开发说明

### 后端API

- `POST /api/upload` - 上传并处理文档
- `GET /api/download?path=xxx` - 下载处理后的文档
- `GET /api/health` - 健康检查

### 扩展错别字检测

可以在 `backend/src/services/typoChecker.js` 中的 `typoDict` 对象中添加更多错别字。

也可以集成第三方错别字检测API（如百度、腾讯等）。

## 注意事项

1. 文件大小限制：单文件最大10MB
2. 支持格式：仅支持 .doc 和 .docx 格式
3. 飞书配置：未配置飞书时系统会运行在模拟模式，不影响本地功能

## 许可证

ISC
