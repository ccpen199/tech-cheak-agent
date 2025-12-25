# LLM配置模块

基于魔搭社区API的LLM客户端配置，支持多API Key和多模型自动切换。

## 功能特性

- ✅ 支持多个API Key自动切换（认证失败时）
- ✅ 支持多个模型自动切换（限流时）
- ✅ 自动重试机制（连接错误时）
- ✅ JSON格式响应支持
- ✅ 详细的日志记录
- ✅ 环境变量配置

## 安装依赖

```bash
cd llm
pip install -r requirements.txt
```

## 配置

1. 复制环境变量示例文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的API密钥：
```env
MODELSCOPE_API_KEY=your_api_key_here
MODELSCOPE_TEXT_MODELS=Qwen/Qwen3-235B-A22B-Instruct-2507
```

## 使用方法

### 基本使用

```python
from llm.modelscope_client import get_default_client

# 获取默认客户端（单例模式）
client = get_default_client()

# 调用API
messages = [
    {"role": "system", "content": "你是一个有用的助手。"},
    {"role": "user", "content": "你好！"}
]

result = await client.call_api(messages)
if result:
    print(result["content"])
```

### 创建自定义客户端

```python
from llm.modelscope_client import create_client

# 创建自定义客户端
client = create_client(
    api_token="your_api_key",
    model_name="Qwen/Qwen3-235B-A22B-Instruct-2507"
)

result = await client.call_api(messages)
```

### JSON格式响应

```python
result = await client.call_api(
    messages,
    response_format={"type": "json_object"}
)

if result:
    # result 已经是解析好的JSON对象
    print(result)
```

### 同步调用示例

```python
import asyncio

async def main():
    client = get_default_client()
    messages = [
        {"role": "user", "content": "你好"}
    ]
    result = await client.call_api(messages)
    if result:
        print(result["content"])

# 运行
asyncio.run(main())
```

## 配置说明

### 环境变量

- `MODELSCOPE_API_KEY`: API密钥（必需）
- `MODELSCOPE_API_BASE`: API基础URL（可选，默认：https://api-inference.modelscope.cn/v1）
- `MODELSCOPE_TEXT_MODELS`: 模型列表，多个用逗号分隔（可选）

### 代码配置

```python
from llm.modelscope_client import create_client

client = create_client(
    api_token="your_api_key",           # 单个API Key
    api_keys=["key1", "key2"],         # 或多个API Key列表
    api_base="https://api.example.com", # 自定义API地址
    model_name="Qwen/Qwen3-235B-A22B-Instruct-2507"  # 指定模型
)
```

## 重试机制

客户端实现了三层重试机制：

1. **API Key切换**：当API Key认证失败时，自动切换到下一个API Key
2. **模型切换**：当遇到限流时，自动切换到下一个模型
3. **连接重试**：当遇到连接错误或超时时，自动重试（最多3次）

## 错误处理

客户端会自动处理以下错误：

- ✅ 认证错误（401/403）：切换API Key
- ✅ 限流错误（429）：切换模型
- ✅ 连接错误：自动重试
- ✅ JSON解析错误：记录日志并重试

## 日志

使用 `loguru` 记录详细的日志信息：

- 🔑 API Key切换信息
- 🔄 模型切换信息
- ✅ 成功调用信息
- ⚠️ 错误和警告信息

## 示例：智能体集成

```python
from llm.modelscope_client import get_default_client

class MyAgent:
    def __init__(self):
        self.llm_client = get_default_client()
    
    async def process(self, user_input: str):
        messages = [
            {"role": "system", "content": "你是一个专业的教案评审助手。"},
            {"role": "user", "content": user_input}
        ]
        
        result = await self.llm_client.call_api(
            messages,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        return result
```

## 注意事项

1. 确保已安装所有依赖：`pip install -r requirements.txt`
2. 配置API密钥：在 `.env` 文件中设置 `MODELSCOPE_API_KEY`
3. 异步调用：`call_api` 是异步方法，需要使用 `await` 或 `asyncio.run()`

