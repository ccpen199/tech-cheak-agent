# 配置系统重构说明

## 变更概述

已将所有配置统一管理，解决了线上环境变量和Python路径问题。

## 主要变更

### 1. 创建统一配置管理 (`backend/src/config/appConfig.js`)

**功能**：
- 统一管理所有路径配置
- 统一管理环境变量加载
- 统一管理Python路径选择
- 自动验证配置完整性

**特点**：
- 自动检测虚拟环境
- 支持多环境（macOS/Linux）
- 启动时自动验证配置

### 2. 更新所有服务使用统一配置

**更新的文件**：
- `backend/src/services/cosService.js` - COS上传服务
- `backend/src/services/teachingEvaluationService.js` - 教学评价服务
- `backend/src/services/modificationSuggestionService.js` - 修改建议服务
- `backend/src/services/llmTypoChecker.js` - 错别字检测服务
- `backend/src/index.js` - 主入口文件

**改进**：
- 所有服务使用统一的Python路径
- 所有服务使用统一的脚本路径配置
- 统一的环境变量管理

### 3. 统一Python依赖管理

**创建统一的依赖文件**：
- 合并 `llm/requirements.txt` 和 `backend/services/requirements.txt` 到项目根目录的 `requirements.txt`
- 所有Python依赖统一管理在一个文件中
- 更新配置文件指向统一依赖文件

### 4. 修复的问题

1. **环境变量加载问题**：
   - 修复了PM2环境下.env文件未加载的问题
   - 支持多路径fallback机制

2. **Python路径问题**：
   - 修复了线上使用系统Python而非虚拟环境的问题
   - 自动检测并使用虚拟环境中的Python

3. **依赖管理问题**：
   - 统一了所有Python依赖的安装位置
   - 明确了依赖配置文档
   - 合并所有依赖到一个文件，便于管理

## 部署步骤

### 1. 确保环境变量文件存在

```bash
# 检查后端环境变量
ls -la ~/app/backend/.env

# 检查LLM环境变量
ls -la ~/app/llm/.env
```

### 2. 确保Python依赖已安装

```bash
cd ~/app/llm
source venv/bin/activate
# 安装所有依赖（从统一的requirements.txt）
pip install -r ../requirements.txt
# 或者检查是否已安装：
pip list | grep -E "cos-python-sdk-v5|litellm|loguru"
```

### 3. 重启服务

```bash
cd ~/app/backend
pm2 restart tech-agent
```

### 4. 验证配置

```bash
pm2 logs tech-agent --lines 50
```

**期望看到的日志**：
```
✅ 已加载环境变量: backend/.env
📋 应用配置:
  Python命令: /home/ubuntu/app/llm/venv/bin/python
  服务端口: 3000
  LLM目录: /home/ubuntu/app/llm
  虚拟环境: /home/ubuntu/app/llm/venv ✅
```

## 配置验证

启动服务后，检查以下内容：

1. ✅ 环境变量加载成功
2. ✅ Python路径正确（应指向虚拟环境）
3. ✅ 所有脚本路径存在
4. ⚠️ 如有警告，根据提示修复

## 文件结构

```
backend/
├── src/
│   ├── config/
│   │   └── appConfig.js          # 统一配置管理
│   └── services/
│       ├── cosService.js         # 已更新
│       ├── teachingEvaluationService.js  # 已更新
│       ├── modificationSuggestionService.js  # 已更新
│       └── llmTypoChecker.js     # 已更新
├── .env                          # 后端环境变量
└── services/
    └── cosUploader.py            # COS上传脚本

llm/
├── .env                          # LLM环境变量
├── venv/                         # Python虚拟环境
└── requirements.txt              # Python依赖

CONFIG.md                         # 配置说明文档
DEPENDENCIES.md                   # 依赖配置文档
```

## 注意事项

1. **Python虚拟环境**：
   - 所有Python依赖应安装在 `llm/venv` 中
   - 确保虚拟环境存在且已激活

2. **环境变量**：
   - `backend/.env` 用于后端服务配置
   - `llm/.env` 用于LLM模块配置
   - 两个文件都需要正确配置

3. **路径问题**：
   - 配置系统会自动检测路径
   - 如果路径错误，查看启动日志中的警告信息

## 回滚方案

如果新配置有问题，可以：

1. 恢复之前的代码（从git）
2. 或者手动修改服务文件使用原来的配置方式

## 后续优化建议

1. 考虑使用 `ecosystem.config.js` 管理PM2配置
2. 考虑使用配置中心管理环境变量
3. 添加配置热重载功能

