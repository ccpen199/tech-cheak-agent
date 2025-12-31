"""
LLM配置模块
提供基于魔搭社区API的LLM客户端
"""

from .modelscope_client import (
    ModelScopeClient,
    get_default_client,
    create_client,
)

__all__ = [
    "ModelScopeClient",
    "get_default_client",
    "create_client",
]

