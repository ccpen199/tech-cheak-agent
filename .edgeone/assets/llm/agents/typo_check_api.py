#!/usr/bin/env python3
"""
错别字检测API接口
用于从命令行调用，接收文本并返回JSON结果
"""

import sys
import os
import json
import asyncio

# 添加llm目录到Python路径
llm_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if llm_dir not in sys.path:
    sys.path.insert(0, llm_dir)

# 直接导入，避免相对导入问题
from agents.typo_agent import detect_typos_in_text


async def main():
    """主函数"""
    # 重定向LiteLLM的错误输出到stderr
    import warnings
    warnings.filterwarnings('ignore')
    
    try:
        # 从标准输入读取文本
        text = sys.stdin.read()
        
        if not text:
            result = {"error": "未提供文本", "typos": [], "summary": "未提供文本", "count": 0}
            # 直接输出JSON，不换行
            sys.stdout.write(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            return
        
        # 检测错别字
        result = await detect_typos_in_text(text)
        
        # 确保结果是字典格式
        if not isinstance(result, dict):
            result = {
                "typos": result if isinstance(result, list) else [],
                "summary": "检测完成",
                "count": len(result) if isinstance(result, list) else 0
            }
        
        # 标记LLM是否成功调用（即使没有检测到错别字，也算成功）
        # 如果result中有typos字段，说明LLM调用成功
        if "typos" in result:
            result["llm_success"] = True
        else:
            result["llm_success"] = False
        
        # 输出JSON结果到stdout（使用write而不是print，避免换行）
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "typos": [],
            "summary": "检测失败",
            "count": 0
        }
        sys.stdout.write(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        # 错误信息输出到stderr
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

