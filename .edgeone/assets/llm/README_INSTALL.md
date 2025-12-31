# LLM模块安装指南

## 快速安装

运行安装脚本：

```bash
cd llm
./install.sh
```

或者手动安装：

```bash
cd llm
pip install -r requirements.txt
```

## 配置

1. 复制环境变量文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的API密钥：
```env
MODELSCOPE_API_KEY=your_api_key_here
```

## 验证安装

运行测试：

```bash
cd llm
echo "今天天气很好，我们去公园玩。" | python agents/typo_check_api.py
```

如果看到JSON输出，说明安装成功。

## 常见问题

### 问题1: ModuleNotFoundError: No module named 'loguru'

**解决方法**：
```bash
cd llm
pip install -r requirements.txt
```

### 问题2: Python3 未找到

**解决方法**：
- macOS: `brew install python3`
- Ubuntu/Debian: `sudo apt-get install python3 python3-pip`
- 或从 https://www.python.org/downloads/ 下载安装

### 问题3: pip 命令不存在

**解决方法**：
```bash
python3 -m pip install -r requirements.txt
```

## 依赖说明

必需的Python包：
- `python-dotenv` - 环境变量管理
- `loguru` - 日志记录（可选，会自动降级到标准库）
- `litellm` - LLM API调用

安装后重启后端服务即可使用LLM智能体。

