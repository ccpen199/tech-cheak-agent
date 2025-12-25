#!/usr/bin/env python3
"""
教学评价API接口
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
from agents.teaching_evaluation_agent import evaluate_teaching_content


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
                "evaluation": "未提供数据",
                "strengths": [],
                "improvements": [],
                "overall_score": 0
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
                "evaluation": "未提供文本内容",
                "strengths": [],
                "improvements": [],
                "overall_score": 0
            }
            sys.stdout.write(json.dumps(result, ensure_ascii=False))
            sys.stdout.flush()
            return
        
        # 进行教学评价
        result = await evaluate_teaching_content(text, template_id)
        
        # 确保结果是字典格式
        if not isinstance(result, dict):
            result = {
                "evaluation": "评价完成",
                "strengths": [],
                "improvements": [],
                "overall_score": 0
            }
        
        # 输出JSON结果到stdout
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "evaluation": f"评价失败：{str(e)}",
            "strengths": [],
            "improvements": [],
            "overall_score": 0
        }
        sys.stdout.write(json.dumps(error_result, ensure_ascii=False))
        sys.stdout.flush()
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
