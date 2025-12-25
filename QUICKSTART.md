# 快速开始

## 一键启动（推荐）

```bash
# 1. 安装依赖（首次运行）
npm run install:all

# 2. 启动服务
./start.sh
```

启动后访问：http://localhost:3005

## 手动启动

### 方式一：使用启动脚本

```bash
chmod +x start.sh stop.sh
./start.sh
```

### 方式二：分别启动

**终端1 - 后端：**
```bash
cd backend
npm install  # 首次运行需要
npm start
```

**终端2 - 前端：**
```bash
cd frontend
npm install  # 首次运行需要
npm run dev
```

## 使用流程

1. 打开浏览器访问 http://localhost:3005
2. 点击"选择文档"，上传Word文档（.doc或.docx格式）
3. 点击"开始处理"
4. 等待处理完成（系统会自动检测错别字和格式问题）
5. 查看处理结果，下载修改后的文档

## 端口配置

- **前端**：3005
- **后端**：4004

如需修改端口，请参考 `INSTALL.md`。

## 飞书配置（可选）

如需使用飞书功能，请：

1. 在飞书开放平台创建应用
2. 创建多维表格
3. 配置 `backend/.env` 文件

详细配置说明请参考 `README.md`。

不配置飞书也可以正常使用，系统会运行在模拟模式下。
