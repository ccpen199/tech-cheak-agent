#!/usr/bin/env python3
"""
修改意见API接口
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
from agents.modification_suggestion_agent import suggest_modifications_for_content


async def main():
    """主函数"""
    import warnings
    warnings.filterwarnings('ignore')
    
    try:
        # 从标准输入读取JSON数据
        input_data = sys.stdin.read()
        
        if not input_data:
            result = {
                "error": "未提供数据",
                "summary": "未提供数据",
                "suggestions": [],
                "count": 0
            }
            sys.stdout.write(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            return
        
        # 解析输入数据
        try:
            data = json.loads(input_data)
            text = data.get('text', '')
            template_id = data.get('template_id', None)
        except json.JSONDecodeError:
            # 如果不是JSON，直接作为文本处理
            text = input_data
            template_id = None
        
        if not text:
            result = {
                "error": "未提供文本内容",
                "summary": "未提供文本内容",
                "suggestions": [],
                "count": 0
            }
            sys.stdout.write(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            return
        
        # 提供修改建议
        result = await suggest_modifications_for_content(text, template_id)
        
        # 确保结果是字典格式
        if not isinstance(result, dict):
            result = {
                "summary": "建议生成完成",
                "suggestions": [],
                "count": 0
            }
        
        # 输出JSON结果到stdout
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "summary": f"建议生成失败：{str(e)}",
            "suggestions": [],
            "count": 0
        }
        sys.stdout.write(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
