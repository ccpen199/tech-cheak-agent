"""
测试LLM简单内容生成功能
所有配置都写在此文件中，无需环境变量
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from modelscope_client import create_client


# ==================== 配置区域 ====================
# 所有配置都在这里，可以直接修改

# 魔搭社区API配置
CONFIG = {
    # API密钥（必填，需要替换为你的实际密钥）
    "api_token": "ms-9ac400ad-d469-4b18-a792-077c5740e628",
    
    # API基础URL（可选，默认使用魔搭社区）
    "api_base": "https://api-inference.modelscope.cn/v1",
    
    # 模型名称（可选，可以指定多个模型，用逗号分隔，会自动fallback）
    "model_name": "Qwen/Qwen3-235B-A22B-Instruct-2507",
    # 也可以使用多个模型作为fallback，例如：
    # "model_name": "Qwen/Qwen3-235B-A22B-Instruct-2507,Qwen/Qwen3-Next-80B-A3B-Instruct,deepseek-ai/DeepSeek-V3.2",
    
    # LLM调用参数
    "temperature": 0.7,          # 温度参数（控制输出的随机性，0.7表示较有创造性）
    "timeout": 120,              # API调用超时时间（秒）
    "max_retries": 3,            # 最大重试次数
    "retry_delay": 2,            # 重试延迟（秒）
}
# ==================== 配置区域结束 ====================


async def test_simple_content_generation():
    """
    测试简单的LLM内容生成
    """
    print("\n" + "="*60)
    print("LLM简单内容生成测试")
    print("="*60)
    
    # 检查配置
    if CONFIG["api_token"] == "your-modelscope-api-token-here":
        print("\n⚠️  警告: 请先配置 API_TOKEN")
        print("   请在文件顶部修改 CONFIG['api_token'] 为你的实际API密钥")
        return
    
    # 步骤1: 创建ModelScope客户端
    print(f"\n{'='*60}")
    print("步骤1: 创建ModelScope客户端")
    print(f"{'='*60}")
    
    client = create_client(
        api_token=CONFIG["api_token"],
        api_base=CONFIG["api_base"],
        model_name=CONFIG["model_name"]
    )
    
    # 检查配置
    if not client.is_configured():
        print("❌ 客户端未正确配置，请检查API_TOKEN")
        return
    
    print(f"✅ 客户端创建成功")
    print(f"   - API Base: {client.api_base}")
    print(f"   - Model: {client.model_name}")
    
    # 步骤2: 测试简单的对话生成
    print(f"\n{'='*60}")
    print("步骤2: 测试简单内容生成")
    print(f"{'='*60}")
    
    # 构建简单的对话消息
    messages = [
        {
            "role": "system",
            "content": "你是一个友好的助手，擅长用简洁明了的方式回答问题。"
        },
        {
            "role": "user",
            "content": "请用一句话介绍一下Python编程语言。"
        }
    ]
    
    print(f"发送消息: {messages[1]['content']}")
    print(f"   - 温度: {CONFIG['temperature']}")
    print(f"   - 最大重试: {CONFIG['max_retries']}")
    print(f"\n正在调用LLM API...")
    
    try:
        # 调用API（不指定JSON格式，返回文本）
        result = await client.call_api(
            messages=messages,
            temperature=CONFIG["temperature"],
            timeout=CONFIG["timeout"],
            max_retries=CONFIG["max_retries"],
            retry_delay=CONFIG["retry_delay"]
        )
        
        # 步骤3: 显示结果
        print(f"\n{'='*60}")
        print("步骤3: API响应结果")
        print(f"{'='*60}")
        
        if result:
            content = result.get('content', '')
            usage = result.get('_usage', {})
            
            print(f"✅ API调用成功！\n")
            print(f"响应内容:")
            print("-" * 60)
            print(content)
            print("-" * 60)
            
            if usage:
                print(f"\nToken使用情况:")
                if isinstance(usage, dict):
                    print(f"   - 提示Token: {usage.get('prompt_tokens', 'N/A')}")
                    print(f"   - 完成Token: {usage.get('completion_tokens', 'N/A')}")
                    print(f"   - 总计Token: {usage.get('total_tokens', 'N/A')}")
                else:
                    print(f"   {usage}")
        else:
            print("❌ API调用失败，未返回结果")
            
    except Exception as e:
        print(f"\n❌ API调用过程出错: {e}")
        import traceback
        traceback.print_exc()


async def test_json_response():
    """
    测试JSON格式的响应
    """
    print("\n" + "="*60)
    print("测试JSON格式响应")
    print("="*60)
    
    # 检查配置
    if CONFIG["api_token"] == "your-modelscope-api-token-here":
        print("\n⚠️  警告: 请先配置 API_TOKEN")
        return
    
    # 创建客户端
    client = create_client(
        api_token=CONFIG["api_token"],
        api_base=CONFIG["api_base"],
        model_name=CONFIG["model_name"]
    )
    
    if not client.is_configured():
        print("❌ 客户端未正确配置")
        return
    
    # 构建请求，要求返回JSON格式
    messages = [
        {
            "role": "system",
            "content": "你是一个数据提取专家，总是返回有效的JSON格式。"
        },
        {
            "role": "user",
            "content": "请从以下文本中提取关键信息，并返回JSON格式：产品名称：iPhone 15，价格：999美元，颜色：蓝色"
        }
    ]
    
    print(f"发送消息: {messages[1]['content']}")
    print(f"\n正在调用LLM API（JSON格式）...")
    
    try:
        # 指定JSON响应格式
        result = await client.call_api(
            messages=messages,
            temperature=CONFIG["temperature"],
            response_format={"type": "json_object"},
            timeout=CONFIG["timeout"],
            max_retries=CONFIG["max_retries"],
            retry_delay=CONFIG["retry_delay"]
        )
        
        if result:
            print(f"\n✅ API调用成功！\n")
            print(f"JSON响应:")
            print("-" * 60)
            # 移除内部使用的_usage字段再显示
            display_result = {k: v for k, v in result.items() if k != '_usage'}
            import json
            print(json.dumps(display_result, ensure_ascii=False, indent=2))
            print("-" * 60)
        else:
            print("❌ API调用失败")
            
    except Exception as e:
        print(f"\n❌ API调用过程出错: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """
    主函数：运行所有测试
    """
    print("\n" + "="*60)
    print("LLM简单内容生成测试程序")
    print("="*60)
    
    # 运行简单内容生成测试
    await test_simple_content_generation()
    
    # 运行JSON格式响应测试
    await test_json_response()


if __name__ == "__main__":
    # 运行测试
    asyncio.run(main())

