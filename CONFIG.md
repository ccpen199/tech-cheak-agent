# 配置管理说明

## 概述

项目使用统一的配置管理系统，所有配置集中在 `backend/src/config/appConfig.js` 中。

## 环境变量配置

### 后端环境变量

**文件位置**：`backend/.env`

**必需配置**：
```env
PORT=3000
LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret
```

**可选配置**：
```env
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_REGION=ap-chengdu
COS_BUCKET_NAME=your_bucket_name
COS_BASE_URL=your_base_url
```

### LLM环境变量

**文件位置**：`llm/.env`

**必需配置**：
```env
MODELSCOPE_API_KEY=your_api_key
MODELSCOPE_API_BASE=https://api-inference.modelscope.cn/v1
MODELSCOPE_TEXT_MODELS=Qwen/Qwen3-235B-A22B-Instruct-2507
```

## 配置加载机制

1. **环境变量加载顺序**：
   - 优先：`backend/.env`
   - 备选：项目根目录 `.env`
   - 最后：系统环境变量

2. **Python路径选择**：
   - macOS：`/opt/homebrew/opt/python@3.12/bin/python3.12`
   - Linux：优先 `llm/venv/bin/python`，其次 `backend/services/venv/bin/python`，最后系统 `python3`

## 使用配置

在代码中导入配置：

```javascript
import appConfig from './config/appConfig.js';

// 使用Python命令
const pythonCommand = appConfig.python.command;

// 使用脚本路径
const scriptPath = appConfig.scripts.cosUploader;

// 使用环境变量
const port = appConfig.env.port;
const larkAppId = appConfig.env.larkAppId;
```

## 验证配置

启动服务时，会自动验证配置并输出：
- ✅ 已加载环境变量
- 📋 应用配置信息
- ⚠️ 配置警告（缺失的配置项）

## 线上部署检查清单

1. ✅ 确保 `backend/.env` 文件存在并配置正确
2. ✅ 确保 `llm/.env` 文件存在并配置正确
3. ✅ 确保 `llm/venv` 虚拟环境存在
4. ✅ 确保虚拟环境中安装了所有Python依赖：
   ```bash
   cd llm
   source venv/bin/activate
   pip list  # 检查是否包含 cos-python-sdk-v5
   ```
5. ✅ 重启PM2服务：
   ```bash
   pm2 restart tech-agent
   ```
6. ✅ 查看日志确认配置加载：
   ```bash
   pm2 logs tech-agent --lines 50
   ```

## 常见问题

### 问题1：环境变量未加载

**症状**：服务启动时没有看到"✅ 已加载环境变量"日志

**解决**：
1. 检查 `backend/.env` 文件是否存在
2. 检查文件路径是否正确
3. 检查文件权限

### 问题2：Python模块未找到

**症状**：`ModuleNotFoundError: No module named 'qcloud_cos'`

**解决**：
```bash
cd llm
source venv/bin/activate
pip install -r ../requirements.txt
pm2 restart tech-agent
```

### 问题3：使用了错误的Python版本

**症状**：Python脚本执行失败或找不到模块

**解决**：
1. 检查 `llm/venv/bin/python` 是否存在
2. 查看启动日志中的"Python命令"信息
3. 如果路径错误，检查虚拟环境是否正确创建

