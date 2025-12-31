# 智能体使用说明

## 错别字检测智能体

### 功能
基于LLM的智能错别字检测，能够识别：
- 同音字错误（的/得/地、在/再等）
- 形近字错误（己/已、未/末等）
- 常见易错字
- 标点符号错误
- 其他语法和用词错误

### 使用方法

#### 1. 配置环境变量

在 `llm/.env` 文件中配置：
```env
MODELSCOPE_API_KEY=your_api_key_here
```

#### 2. 安装依赖

```bash
cd llm
pip install -r requirements.txt
```

#### 3. 测试智能体

```bash
cd llm
python -m agents.typo_agent
```

或使用API接口：
```bash
echo "今天天气很好，我们去公园玩。" | python agents/typo_check_api.py
```

### 集成到后端

后端会自动调用智能体进行错别字检测：
1. 优先使用LLM智能体检测
2. 如果LLM检测失败，自动降级到传统字典方法
3. 检测结果会同步到飞书表格的"错别字"列（第六列）

### 前端显示

前端会显示：
- 🤖 LLM智能检测标识
- 错别字列表和修正建议
- 上下文信息

### 注意事项

1. 确保Python环境已安装所需依赖
2. 确保配置了MODELSCOPE_API_KEY
3. 如果LLM不可用，系统会自动使用传统方法

