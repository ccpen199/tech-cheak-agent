# 项目依赖配置说明

本文档列出了项目的所有依赖配置。

## Node.js 依赖

位置：`backend/package.json`

主要依赖：
- express - Web框架
- cors - 跨域支持
- multer - 文件上传
- dotenv - 环境变量管理
- mammoth - Word文档解析
- docx - Word文档生成

安装命令：
```bash
cd backend
npm install
```

## Python 依赖

### 统一依赖文件

**位置**：`requirements.txt`（项目根目录）

**包含所有Python依赖**：
- python-dotenv>=1.0.0 - 环境变量管理
- loguru>=0.7.0 - 日志管理
- litellm>=1.0.0 - LLM API调用
- cos-python-sdk-v5>=1.9.24 - 腾讯云COS SDK

**安装命令**：
```bash
cd llm
python3 -m venv venv
source venv/bin/activate
pip install -r ../requirements.txt
```

**注意**：
- 所有Python依赖统一安装在 `llm/venv` 虚拟环境中
- 旧的 `llm/requirements.txt` 和 `backend/services/requirements.txt` 已合并到根目录的 `requirements.txt`

## 环境变量配置

### 后端环境变量

位置：`backend/.env`

必需配置：
```env
# 服务器配置
PORT=3000

# 飞书配置
LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret

# COS配置（可选，代码中有默认值）
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_REGION=ap-chengdu
COS_BUCKET_NAME=your_bucket_name
COS_BASE_URL=your_base_url
```

### LLM环境变量

位置：`llm/.env`

必需配置：
```env
# 魔搭社区API配置
MODELSCOPE_API_KEY=your_api_key
MODELSCOPE_API_BASE=https://api-inference.modelscope.cn/v1
MODELSCOPE_TEXT_MODELS=Qwen/Qwen3-235B-A22B-Instruct-2507,Qwen/Qwen3-Next-80B-A3B-Instruct,deepseek-ai/DeepSeek-V3.2
```

## 配置加载顺序

1. **环境变量加载**：
   - 优先：`backend/.env`
   - 备选：项目根目录 `.env`
   - 最后：系统环境变量

2. **Python路径选择**：
   - macOS：`/opt/homebrew/opt/python@3.12/bin/python3.12`
   - Linux：优先 `llm/venv/bin/python`，其次 `backend/services/venv/bin/python`，最后系统 `python3`

## 验证配置

启动服务后，检查日志输出：
- ✅ 已加载环境变量: backend/.env
- 📋 应用配置: Python命令、服务端口、LLM目录等
- ⚠️ 配置警告: 缺失的配置项

## 常见问题

### 1. Python模块未找到

**问题**：`ModuleNotFoundError: No module named 'qcloud_cos'`

**解决**：
```bash
cd llm
source venv/bin/activate
pip install cos-python-sdk-v5
```

### 2. 环境变量未加载

**问题**：服务无法读取环境变量

**解决**：
- 确保 `.env` 文件在 `backend/` 目录下
- 检查文件权限
- 查看启动日志确认加载状态

### 3. Python路径错误

**问题**：找不到Python或使用了错误的Python版本

**解决**：
- 检查 `llm/venv/bin/python` 是否存在
- 如果不存在，创建虚拟环境：`cd llm && python3 -m venv venv`

