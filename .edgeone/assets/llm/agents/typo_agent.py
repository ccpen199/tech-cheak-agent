"""
错别字检测智能体
基于LLM识别文档内容中的错别字
"""

import json
import asyncio
import sys
import os
from typing import List, Dict, Any, Optional

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


class TypoAgent:
    """错别字检测智能体"""

    def __init__(self):
        """初始化智能体"""
        self.llm_client = get_default_client()
        if not self.llm_client.is_configured():
            logger.warning("⚠️  LLM未配置，错别字检测将无法使用")

    async def detect_typos(self, text: str) -> List[Dict[str, Any]]:
        """
        检测文本中的错别字

        Args:
            text: 要检测的文本内容

        Returns:
            错别字列表，格式: [
                {
                    "word": "错别字",
                    "correct": "正确字",
                    "position": 位置,
                    "context": "上下文"
                },
                ...
            ]
        """
        if not self.llm_client.is_configured():
            logger.error("❌ LLM未配置，无法检测错别字")
            return []

        # 构建提示词
        system_prompt = """你是一个专业的中文错别字检测专家。你的任务是仔细检查文本中的错别字，包括：
1. 同音字错误（如：的/得/地、在/再、做/作）
2. 形近字错误（如：己/已、未/末）
3. 常见易错字（如：必需/必须、制定/制订）
4. 标点符号错误
5. 其他语法和用词错误

请仔细分析文本，找出所有错别字，并给出正确的写法。"""

        user_prompt = f"""请仔细检查以下文本中的错别字。请逐字逐句分析，找出所有错别字。

文本内容：
{text}

请以JSON格式返回检测结果，格式如下：
{{
    "typos": [
        {{
            "word": "错别字",
            "correct": "正确字",
            "position": 位置索引（从0开始的数字，表示错别字在文本中的位置）,
            "context": "包含错别字的上下文（前后各20字左右）"
        }}
    ]
}}

要求：
1. 仔细检查每个字词，不要遗漏
2. 对于同音字错误（如的/得/地），需要根据语境判断是否正确
3. 对于明显的错别字（如冰激凌应为冰淇淋），必须检测出来
4. 如果没有错别字，返回：{{"typos": []}}
5. 只返回JSON格式，不要添加任何其他文字或解释

现在开始检测："""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        try:
            logger.info("🔍 开始使用LLM检测错别字...")
            
            # 调用LLM API
            result = await self.llm_client.call_api(
                messages,
                temperature=0.1,  # 低温度，确保准确性
                response_format={"type": "json_object"},
                timeout=120,
                max_retries=3
            )

            if not result:
                logger.error("❌ LLM调用失败")
                return []

            # 解析结果
            if "typos" in result:
                typos = result["typos"]
                logger.info(f"✅ 检测到 {len(typos)} 个错别字")
                
                # 验证和格式化结果
                formatted_typos = []
                for typo in typos:
                    if isinstance(typo, dict) and "word" in typo and "correct" in typo:
                        formatted_typos.append({
                            "word": str(typo["word"]),
                            "correct": str(typo["correct"]),
                            "position": typo.get("position", 0),
                            "context": typo.get("context", "")
                        })
                
                return formatted_typos
            else:
                logger.warning("⚠️  LLM返回格式异常")
                return []

        except Exception as e:
            logger.error(f"❌ 错别字检测出错: {e}")
            return []

    async def format_typo_summary(self, typos: List[Dict[str, Any]]) -> str:
        """
        格式化错别字摘要，用于显示和同步到飞书

        Args:
            typos: 错别字列表

        Returns:
            格式化的摘要文本
        """
        if not typos:
            return "未发现错别字"

        summary_lines = [f"发现 {len(typos)} 个错别字："]
        
        for i, typo in enumerate(typos, 1):
            summary_lines.append(
                f"{i}. \"{typo['word']}\" → \"{typo['correct']}\""
            )
            if typo.get("context"):
                summary_lines.append(f"   上下文: {typo['context'][:50]}...")

        return "\n".join(summary_lines)


async def detect_typos_in_text(text: str) -> Dict[str, Any]:
    """
    便捷函数：检测文本中的错别字

    Args:
        text: 要检测的文本

    Returns:
        包含错别字列表和摘要的字典
    """
    agent = TypoAgent()
    typos = await agent.detect_typos(text)
    summary = await agent.format_typo_summary(typos)
    
    return {
        "typos": typos,
        "summary": summary,
        "count": len(typos)
    }


if __name__ == "__main__":
    # 测试示例
    test_text = """
    今天天气很好，我们去公园玩。小明说："我要去买冰激凌。"
    小红回答："我也要去，我们一起走吧。"
    """
    
    async def test():
        result = await detect_typos_in_text(test_text)
        print("检测结果：")
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    asyncio.run(test())

