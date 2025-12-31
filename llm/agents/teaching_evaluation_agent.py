"""
教学评价智能体
基于LLM对模板内容进行教学评价
"""

import json
import asyncio
import sys
import os
from typing import Dict, Any, Optional

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


class TeachingEvaluationAgent:
    """教学评价智能体"""

    def __init__(self):
        """初始化智能体"""
        self.llm_client = get_default_client()
        if not self.llm_client.is_configured():
            logger.warning("⚠️  LLM未配置，教学评价将无法使用")

    async def evaluate_teaching(self, text: str, template_id: str = None, custom_prompt: str = None) -> Dict[str, Any]:
        """
        对模板内容进行教学评价

        Args:
            text: 模板文本内容
            template_id: 模板ID（如SY001、SY002等）

        Returns:
            评价结果字典，包含：
            {
                "evaluation": "评价内容",
                "strengths": ["优点1", "优点2", ...],
                "improvements": ["改进建议1", "改进建议2", ...],
                "overall_score": 评分（1-10）
            }
        """
        if not self.llm_client.is_configured():
            logger.error("❌ LLM未配置，无法进行教学评价")
            return {
                "evaluation": "LLM未配置，无法进行教学评价",
                "strengths": [],
                "improvements": [],
                "overall_score": 0
            }

        # 根据模板类型确定评价重点
        template_info = self._get_template_info(template_id)
        
        # 如果提供了自定义提示词，使用自定义提示词；否则使用默认提示词
        if custom_prompt and custom_prompt.strip():
            # 使用自定义提示词
            user_prompt = f"""{custom_prompt.strip()}

课程内容：
{text}

请以JSON格式返回评价结果，格式如下：
{{
    "evaluation": "总体评价（200-300字，包括课程的整体质量、设计思路、适用性等）",
    "strengths": [
        "优点1（课程设计的亮点）",
        "优点2",
        "优点3"
    ],
    "improvements": [
        "改进建议1（可以优化的方面）",
        "改进建议2",
        "改进建议3"
    ],
    "overall_score": 评分（1-10分，10分为满分）
}}

要求：
1. 只返回JSON格式，不要添加任何其他文字或解释

现在开始评价："""
            
            system_prompt = """你是一位资深的幼儿教育专家，具有丰富的课程设计和教学经验。"""
        else:
            # 使用默认提示词
            system_prompt = """你是一位资深的幼儿教育专家，具有丰富的课程设计和教学经验。你的任务是对课程模板进行全面、专业的教学评价。

评价维度包括：
1. 课程目标：目标是否明确、具体、可达成
2. 教学内容：内容是否适合幼儿年龄特点，是否有趣味性和教育性
3. 教学步骤：步骤是否清晰、逻辑是否合理、是否便于操作
4. 教学方法：方法是否多样、是否能够激发幼儿兴趣
5. 材料准备：材料是否充分、是否安全、是否便于获取
6. 时间安排：时间分配是否合理
7. 整体设计：课程设计是否完整、是否有创新点

请从专业角度给出客观、建设性的评价。"""

            user_prompt = f"""请对以下课程模板进行专业的教学评价。

模板类型：{template_info['name']}
模板说明：{template_info['description']}

课程内容：
{text}

请以JSON格式返回评价结果，格式如下：
{{
    "evaluation": "总体评价（200-300字，包括课程的整体质量、设计思路、适用性等）",
    "strengths": [
        "优点1（课程设计的亮点）",
        "优点2",
        "优点3"
    ],
    "improvements": [
        "改进建议1（可以优化的方面）",
        "改进建议2",
        "改进建议3"
    ],
    "overall_score": 评分（1-10分，10分为满分）
}}

要求：
1. 评价要客观、专业、有建设性
2. 优点要具体，不要泛泛而谈
3. 改进建议要可行、有针对性
4. 评分要合理，综合考虑各个方面
5. 只返回JSON格式，不要添加任何其他文字或解释

现在开始评价："""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            logger.info("🔍 开始使用LLM进行教学评价...")
            
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
                    "evaluation": "LLM调用失败，无法完成评价",
                    "strengths": [],
                    "improvements": [],
                    "overall_score": 0
                }

            # 解析结果
            if isinstance(result, dict):
                # 确保所有字段都存在
                evaluation_result = {
                    "evaluation": result.get("evaluation", "评价内容解析失败"),
                    "strengths": result.get("strengths", []),
                    "improvements": result.get("improvements", []),
                    "overall_score": result.get("overall_score", 0)
                }
                
                logger.info(f"✅ 教学评价完成，评分：{evaluation_result['overall_score']}/10")
                return evaluation_result
            else:
                logger.warning("⚠️  LLM返回格式异常")
                return {
                    "evaluation": "LLM返回格式异常",
                    "strengths": [],
                    "improvements": [],
                    "overall_score": 0
                }

        except Exception as e:
            logger.error(f"❌ 教学评价出错: {e}")
            return {
                "evaluation": f"评价过程出错：{str(e)}",
                "strengths": [],
                "improvements": [],
                "overall_score": 0
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


async def evaluate_teaching_content(text: str, template_id: str = None, custom_prompt: str = None) -> Dict[str, Any]:
    """
    便捷函数：对课程内容进行教学评价

    Args:
        text: 课程文本内容
        template_id: 模板ID
        custom_prompt: 自定义提示词（可选）

    Returns:
        评价结果字典
    """
    agent = TeachingEvaluationAgent()
    return await agent.evaluate_teaching(text, template_id, custom_prompt)


if __name__ == "__main__":
    # 测试示例
    test_text = """
    课程编号：SY002-001
    课程目标：
    1. 培养幼儿的身体协调能力
    2. 提高幼儿的运动兴趣
    3. 增强幼儿的团队合作意识
    
    课程材料：
    1. 软垫
    2. 小球
    3. 音乐播放器
    
    教学步骤：
    1. 热身+引入
    游戏1：小动物模仿
    ￮ 引导幼儿模仿各种小动物的动作
    ￮ 通过音乐节奏控制动作速度
    ￮ 指导语：小朋友们，我们来学小动物走路吧！
    """
    
    async def test():
        result = await evaluate_teaching_content(test_text, "SY002")
        print("评价结果：")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    asyncio.run(test())

