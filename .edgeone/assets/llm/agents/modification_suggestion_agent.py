"""
修改意见智能体
基于LLM对模板内容提供修改建议
"""

import json
import asyncio
import sys
import os
from typing import Dict, Any, Optional, List

# 尝试导入loguru，如果不存在则使用标准库logging
try:
    from loguru import logger
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

# 处理相对导入和绝对导入
try:
    from ..modelscope_client import get_default_client
except ImportError:
    # 如果相对导入失败，尝试绝对导入
    llm_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if llm_dir not in sys.path:
        sys.path.insert(0, llm_dir)
    from modelscope_client import get_default_client


class ModificationSuggestionAgent:
    """修改意见智能体"""

    def __init__(self):
        """初始化智能体"""
        self.llm_client = get_default_client()
        if not self.llm_client.is_configured():
            logger.warning("⚠️  LLM未配置，修改意见将无法使用")

    async def suggest_modifications(self, text: str, template_id: str = None) -> Dict[str, Any]:
        """
        对模板内容提供修改建议

        Args:
            text: 模板文本内容
            template_id: 模板ID（如SY001、SY002等）

        Returns:
            修改建议字典，包含：
            {
                "summary": "总体修改建议摘要",
                "suggestions": [
                    {
                        "section": "部分名称（如：课程目标、教学步骤等）",
                        "issue": "问题描述",
                        "suggestion": "修改建议",
                        "priority": "优先级（high/medium/low）"
                    },
                    ...
                ],
                "count": 建议数量
            }
        """
        if not self.llm_client.is_configured():
            logger.error("❌ LLM未配置，无法提供修改建议")
            return {
                "summary": "LLM未配置，无法提供修改建议",
                "suggestions": [],
                "count": 0
            }

        # 根据模板类型确定检查重点
        template_info = self._get_template_info(template_id)
        
        # 构建提示词
        system_prompt = """你是一位资深的课程设计专家和编辑，具有丰富的课程优化经验。你的任务是对课程模板进行详细审查，找出可以改进的地方，并提供具体的修改建议。

审查重点包括：
1. 内容完整性：是否有缺失的重要部分
2. 逻辑性：步骤是否合理、顺序是否正确
3. 可操作性：指导语是否清晰、是否便于教师执行
4. 适龄性：内容是否适合目标年龄段
5. 安全性：是否有安全隐患
6. 创新性：是否可以增加更有趣的元素
7. 语言表达：用词是否准确、表达是否清晰

请提供具体、可操作的修改建议。"""

        user_prompt = f"""请对以下课程模板进行详细审查，找出可以改进的地方，并提供具体的修改建议。

模板类型：{template_info['name']}
模板说明：{template_info['description']}

课程内容：
{text}

请以JSON格式返回修改建议，格式如下：
{{
    "summary": "总体修改建议摘要（100-200字，概括主要问题和改进方向）",
    "suggestions": [
        {{
            "section": "部分名称（如：课程目标、教学步骤1、游戏1等）",
            "issue": "问题描述（具体指出哪里有问题）",
            "suggestion": "修改建议（具体说明如何修改，最好提供修改后的示例）",
            "priority": "优先级（high表示必须修改，medium表示建议修改，low表示可选优化）"
        }},
        ...
    ]
}}

要求：
1. 建议要具体、可操作，不要泛泛而谈
2. 最好能提供修改后的示例
3. 按照优先级排序，重要的问题放在前面
4. 每个建议都要明确指出是哪个部分
5. 如果没有明显问题，可以提出优化建议
6. 只返回JSON格式，不要添加任何其他文字或解释

现在开始审查："""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            logger.info("🔍 开始使用LLM提供修改建议...")
            
            # 调用LLM API
            result = await self.llm_client.call_api(
                messages,
                temperature=0.7,  # 适中的温度，保持创造性
                response_format={"type": "json_object"},
                timeout=120,
                max_retries=3
            )

            if not result:
                logger.error("❌ LLM调用失败")
                return {
                    "summary": "LLM调用失败，无法提供修改建议",
                    "suggestions": [],
                    "count": 0
                }

            # 解析结果
            if isinstance(result, dict):
                suggestions = result.get("suggestions", [])
                
                # 验证和格式化建议
                formatted_suggestions = []
                for suggestion in suggestions:
                    if isinstance(suggestion, dict) and "section" in suggestion and "suggestion" in suggestion:
                        formatted_suggestions.append({
                            "section": str(suggestion.get("section", "未知部分")),
                            "issue": str(suggestion.get("issue", "")),
                            "suggestion": str(suggestion.get("suggestion", "")),
                            "priority": str(suggestion.get("priority", "medium")).lower()
                        })
                
                modification_result = {
                    "summary": result.get("summary", "修改建议摘要解析失败"),
                    "suggestions": formatted_suggestions,
                    "count": len(formatted_suggestions)
                }
                
                logger.info(f"✅ 修改建议完成，共 {modification_result['count']} 条建议")
                return modification_result
            else:
                logger.warning("⚠️  LLM返回格式异常")
                return {
                    "summary": "LLM返回格式异常",
                    "suggestions": [],
                    "count": 0
                }

        except Exception as e:
            logger.error(f"❌ 修改建议出错: {e}")
            return {
                "summary": f"建议生成过程出错：{str(e)}",
                "suggestions": [],
                "count": 0
            }

    def _get_template_info(self, template_id: str) -> Dict[str, str]:
        """获取模板信息"""
        template_map = {
            "SY001": {
                "name": "节庆活动方案模板",
                "description": "用于设计各种节庆活动的课程方案"
            },
            "SY002": {
                "name": "体适能课模板",
                "description": "用于设计幼儿体适能训练课程"
            },
            "SY003": {
                "name": "主题活动通用模板",
                "description": "用于设计各种主题活动的通用模板"
            },
            "SY004": {
                "name": "绘本剧模板",
                "description": "用于设计基于绘本的戏剧表演课程"
            },
            "SY005": {
                "name": "食育课模板",
                "description": "用于设计幼儿食育教育课程"
            }
        }
        
        if template_id and template_id in template_map:
            return template_map[template_id]
        else:
            return {
                "name": "通用课程模板",
                "description": "通用课程设计模板"
            }


async def suggest_modifications_for_content(text: str, template_id: str = None) -> Dict[str, Any]:
    """
    便捷函数：对课程内容提供修改建议

    Args:
        text: 课程文本内容
        template_id: 模板ID

    Returns:
        修改建议字典
    """
    agent = ModificationSuggestionAgent()
    return await agent.suggest_modifications(text, template_id)


if __name__ == "__main__":
    # 测试示例
    test_text = """
    课程编号：SY002-001
    课程目标：
    1. 培养幼儿的身体协调能力
    2. 提高幼儿的运动兴趣
    
    课程材料：
    1. 软垫
    
    教学步骤：
    1. 热身+引入
    游戏1：小动物模仿
    ￮ 引导幼儿模仿各种小动物的动作
    ￮ 指导语：小朋友们，我们来学小动物走路吧！
    """
    
    async def test():
        result = await suggest_modifications_for_content(test_text, "SY002")
        print("修改建议：")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    asyncio.run(test())

