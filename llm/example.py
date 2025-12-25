"""
LLM客户端使用示例
"""

import asyncio
from llm.modelscope_client import get_default_client


async def example_basic():
    """基本使用示例"""
    print("=" * 60)
    print("基本使用示例")
    print("=" * 60)
    
    client = get_default_client()
    
    if not client.is_configured():
        print("❌ 请先配置 MODELSCOPE_API_KEY 环境变量")
        return
    
    messages = [
        {"role": "system", "content": "你是一个有用的AI助手。"},
        {"role": "user", "content": "请用一句话介绍你自己。"}
    ]
    
    result = await client.call_api(messages)
    
    if result:
        print("\n✅ 响应成功：")
        print(result.get("content", "无内容"))
        if "_usage" in result:
            print(f"\n📊 Token使用情况：{result['_usage']}")
    else:
        print("\n❌ API调用失败")


async def example_json_format():
    """JSON格式响应示例"""
    print("\n" + "=" * 60)
    print("JSON格式响应示例")
    print("=" * 60)
    
    client = get_default_client()
    
    messages = [
        {"role": "system", "content": "你是一个数据格式化助手，总是返回JSON格式。"},
        {"role": "user", "content": "请返回一个包含姓名、年龄、城市的JSON对象。"}
    ]
    
    result = await client.call_api(
        messages,
        response_format={"type": "json_object"}
    )
    
    if result:
        print("\n✅ JSON响应：")
        import json
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("\n❌ API调用失败")


async def example_custom_client():
    """自定义客户端示例"""
    print("\n" + "=" * 60)
    print("自定义客户端示例")
    print("=" * 60)
    
    from llm.modelscope_client import create_client
    
    # 创建自定义客户端（使用环境变量中的配置）
    client = create_client(
        model_name="Qwen/Qwen3-235B-A22B-Instruct-2507"
    )
    
    messages = [
        {"role": "user", "content": "1+1等于几？"}
    ]
    
    result = await client.call_api(messages, temperature=0.1)
    
    if result:
        print("\n✅ 响应：", result.get("content", "无内容"))


async def main():
    """运行所有示例"""
    await example_basic()
    await example_json_format()
    await example_custom_client()


if __name__ == "__main__":
    asyncio.run(main())

