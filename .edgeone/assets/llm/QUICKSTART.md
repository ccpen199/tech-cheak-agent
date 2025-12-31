# LLM错别字检测快速开始

## 问题诊断

如果错别字检测结果为0，通常是因为：

1. **Python依赖未安装** - 最常见的问题
2. **LLM API未配置** - 缺少API密钥
3. **网络连接问题** - 无法访问LLM API

## 快速修复

### 步骤1：安装Python依赖

```bash
cd llm
pip install -r requirements.txt
```

或者使用安装脚本：

```bash
cd llm
./install.sh
```

### 步骤2：配置API密钥

创建 `llm/.env` 文件：

```bash
cd llm
cp .env.example .env
```

编辑 `.env` 文件，填入你的 `MODELSCOPE_API_KEY`。

### 步骤3：测试

```bash
cd llm
echo "今天天气很好，我们去公园玩。" | python3 agents/typo_check_api.py
```

如果看到JSON输出，说明配置成功。

### 步骤4：重启后端

```bash
cd backend
npm start
```

## 验证

上传一个文档后，检查后端日志：

- ✅ 如果看到 "✅ LLM智能体检测结果: X 个错别字"，说明LLM正常工作
- ⚠️ 如果看到 "⚠️ LLM检测无结果"，检查上述配置步骤

## 注意事项

- 传统方法检测能力有限，只能检测明显的错别字
- **强烈建议配置LLM以获得准确的错别字检测**
- LLM检测失败时，系统会自动降级到传统方法（但检测能力有限）

