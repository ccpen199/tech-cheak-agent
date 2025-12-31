import os
import json
import asyncio
import sys
from pathlib import Path
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

# 尝试导入dotenv，如果不存在则跳过
try:
    from dotenv import load_dotenv
    # 确定llm目录的路径（.env文件所在位置）
    # 如果当前文件在 llm/ 目录下，直接使用当前目录
    # 如果在 llm/agents/ 或其他子目录，需要向上查找
    current_file = Path(__file__).resolve()
    llm_dir = current_file.parent  # modelscope_client.py 应该在 llm/ 目录下
    env_path = llm_dir / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        # 如果找不到，尝试默认行为
        load_dotenv()
except ImportError:
    print("警告: python-dotenv 未安装，将使用环境变量", file=sys.stderr)

# 尝试导入loguru，如果不存在则使用标准库logging
try:
    from loguru import logger
except ImportError:
    import logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logger = logging.getLogger(__name__)


class ModelScopeClient:
    """魔搭社区API客户端封装类"""

    def __init__(
        self,
        api_token: Optional[str] = None,
        api_keys: Optional[List[str]] = None,
        api_base: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        """
        初始化魔搭社区API客户端

        Args:
            api_token: 单个API密钥（向后兼容），如果不提供则从环境变量读取
            api_keys: 多个API密钥列表，优先级高于 api_token
            api_base: API基础URL，如果不提供则从环境变量读取或使用默认值
            model_name: 模型名称，如果不提供则从环境变量读取或使用默认值
        """
        # 加载环境变量（确保从正确路径加载）
        try:
            from dotenv import load_dotenv
            current_file = Path(__file__).resolve()
            llm_dir = current_file.parent
            env_path = llm_dir / '.env'
            if env_path.exists():
                load_dotenv(dotenv_path=env_path, override=False)
            else:
                load_dotenv()
        except ImportError:
            pass  # dotenv未安装，使用系统环境变量

        # 处理多个 API Key：优先使用 api_keys，否则使用 api_token，最后尝试环境变量
        if api_keys:
            self.api_keys = [k for k in api_keys if k and k.strip()]
        elif api_token:
            self.api_keys = [api_token]
        else:
            env_key = os.getenv("MODELSCOPE_API_KEY")
            if env_key:
                # 支持多个API Key，用逗号分隔
                self.api_keys = [k.strip() for k in env_key.split(",") if k.strip()]
            else:
                self.api_keys = []

        self.api_base = api_base or os.getenv(
            "MODELSCOPE_API_BASE",
            "https://api-inference.modelscope.cn/v1",
        )
        self.model_name = (
            model_name
            or os.getenv(
                "MODELSCOPE_TEXT_MODELS",
                "Qwen/Qwen3-235B-A22B-Instruct-2507",
            )
            .split(",")[0]
            .strip()
        )

        # 检查API密钥是否配置
        if not self.api_keys:
            logger.warning("⚠️  未配置任何 API Key，API调用将失败")
        else:
            logger.info(f"✅ 已配置 {len(self.api_keys)} 个 API Key")

    def _get_model_candidates(self) -> List[str]:
        """
        获取模型候选列表，优先环境变量，多模型用逗号分隔。
        没有配置则使用内置 fallback 顺序。
        """
        env_models = os.getenv("MODELSCOPE_TEXT_MODELS")
        fallback = [
            "Qwen/Qwen3-235B-A22B-Instruct-2507",
            "Qwen/Qwen3-Next-80B-A3B-Instruct",
            "deepseek-ai/DeepSeek-V3.2",
            "Qwen/Qwen3-Coder-480B-A35B-Instruct",
        ]
        if env_models:
            models = [m.strip() for m in env_models.split(",") if m.strip()]
            # 如果只配置了一个模型，自动追加内置fallback，确保限流时能切换
            if len(models) == 1:
                models.extend(fallback)
        else:
            models = fallback.copy()
        # 将传入的 model_name 置顶，避免丢失用户显式指定
        if self.model_name and self.model_name not in models:
            models.insert(0, self.model_name)
        # 去重保序
        seen = set()
        uniq: List[str] = []
        for m in models:
            if m not in seen:
                seen.add(m)
                uniq.append(m)
        return uniq

    def is_configured(self) -> bool:
        """检查API是否已正确配置"""
        return bool(self.api_keys)

    @contextmanager
    def _disable_proxy(self):
        """
        临时禁用代理的上下文管理器
        确保 litellm 不使用代理，调用完成后恢复原始设置
        """
        original_https_proxy = os.environ.get("HTTPS_PROXY")
        original_http_proxy = os.environ.get("HTTP_PROXY")
        
        try:
            # 临时清除代理环境变量，确保 litellm 不使用代理
            os.environ.pop("HTTPS_PROXY", None)
            os.environ.pop("HTTP_PROXY", None)
            logger.debug("🔧 临时禁用代理（确保直接连接）")
            yield
        finally:
            # 恢复原始代理设置
            if original_https_proxy is not None:
                os.environ["HTTPS_PROXY"] = original_https_proxy
            if original_http_proxy is not None:
                os.environ["HTTP_PROXY"] = original_http_proxy
            logger.debug("🔧 已恢复原始代理设置")

    async def call_api(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.1,
        response_format: Optional[Dict[str, str]] = None,
        timeout: int = 120,
        max_retries: int = 3,
        retry_delay: int = 2,
        extra_params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        调用魔搭社区API

        Args:
            messages: 消息列表，格式: [{"role": "system", "content": "..."}, ...]
            temperature: 温度参数，控制输出的随机性
            response_format: 响应格式，如 {"type": "json_object"}
            timeout: 超时时间（秒）
            max_retries: 最大重试次数
            retry_delay: 重试延迟（秒）
            extra_params: 额外的请求参数

        Returns:
            API响应内容（已解析的JSON），如果失败返回None
        """
        if not self.is_configured():
            logger.error("❌ API未配置，无法调用")
            return None

        from litellm import acompletion

        model_candidates = self._get_model_candidates()

        # 使用禁用代理的上下文管理器，确保 litellm 不使用代理
        with self._disable_proxy():
            # 三层重试机制：
            # 1. 外层：遍历多个 API Key（失效时切换）
            # 2. 中层：遍历多个模型（限流时切换）
            # 3. 内层：对同一模型做 max_retries 次重试（连接错误时重试）
            last_error: Optional[Exception] = None
            
            for api_key_idx, api_key in enumerate(self.api_keys):
                logger.info(
                    f"🔑 尝试 API Key {api_key_idx + 1}/{len(self.api_keys)} "
                    f"({api_key[:8]}...{api_key[-4:] if len(api_key) > 12 else '****'})"
                )
                
                for model_idx, model_id in enumerate(model_candidates):
                    current_retry_delay = retry_delay
                    logger.info(
                        f"🔄 尝试模型 {model_id} (序号 {model_idx + 1}/{len(model_candidates)})"
                    )

                    request_params: Dict[str, Any] = {
                        "model": "gpt-3.5-turbo",  # litellm/openai 兼容名
                        "api_key": api_key,  # 使用当前循环的 API Key
                        "api_base": self.api_base,
                        "messages": messages,
                        "temperature": temperature,
                        "timeout": timeout,
                        "extra_body": {"model": model_id},  # 通过extra_body传递实际模型名
                    }

                    if response_format:
                        request_params["response_format"] = response_format
                    if extra_params:
                        request_params["extra_body"].update(extra_params)

                    for attempt in range(max_retries):
                        try:
                            logger.info(
                                f"🔄 API Key {api_key_idx + 1} | 模型 {model_id} | "
                                f"第 {attempt + 1}/{max_retries} 次调用..."
                            )

                            response = await acompletion(**request_params)

                            usage = getattr(response, "usage", None)
                            usage_dict = None
                            if usage:
                                try:
                                    usage_dict = (
                                        usage if isinstance(usage, dict) else usage.__dict__
                                    )
                                except Exception:
                                    usage_dict = {"raw": str(usage)}

                            content = response.choices[0].message.content

                            if response_format and response_format.get("type") == "json_object":
                                try:
                                    result = json.loads(content)
                                    if usage_dict:
                                        result["_usage"] = usage_dict
                                    logger.info(
                                        f"✅ API调用成功！API Key {api_key_idx + 1} | 模型 {model_id}"
                                    )
                                    return result
                                except json.JSONDecodeError as e:
                                    logger.error(f"⚠️  JSON解析失败: {e}")
                                    logger.debug(f"响应内容: {content[:500]}")
                                    last_error = e
                                    if attempt < max_retries - 1:
                                        await asyncio.sleep(current_retry_delay)
                                        current_retry_delay *= 2
                                    continue
                            else:
                                result: Dict[str, Any] = {"content": content}
                                if usage_dict:
                                    result["_usage"] = usage_dict
                                logger.info(
                                    f"✅ API调用成功！API Key {api_key_idx + 1} | 模型 {model_id}"
                                )
                                return result

                        except Exception as e:  # noqa: BLE001
                            error_msg = str(e)
                            last_error = e
                            is_rate_limit = any(
                                k in error_msg
                                for k in ["Rate limit", "rate_limit", "429", "RateLimitError"]
                            )
                            is_auth_error = any(
                                k in error_msg.lower()
                                for k in [
                                    "401",
                                    "403",
                                    "unauthorized",
                                    "authentication",
                                    "invalid api key",
                                    "invalid api_key",
                                    "api key",
                                    "authentication failed",
                                    "invalid authentication",
                                ]
                            )
                            is_conn = any(
                                k in error_msg
                                for k in ["Connection", "timeout", "InternalServerError"]
                            )

                            logger.error(
                                f"⚠️  API Key {api_key_idx + 1} | 模型 {model_id} | "
                                f"第 {attempt + 1}/{max_retries} 次调用失败: {error_msg}"
                            )

                            if is_auth_error:
                                # API Key 失效，切换到下一个 API Key
                                logger.warning(
                                    f"🔑 检测到 API Key {api_key_idx + 1} 认证失败，切换到下一个 API Key"
                                )
                                break  # 跳出模型循环，进入下一个 API Key
                            
                            if is_rate_limit:
                                # 限流，切换下一个模型（但继续用当前 API Key）
                                logger.warning("检测到限流，切换下一个模型重试")
                                break
                            
                            if is_conn and attempt < max_retries - 1:
                                logger.info(
                                    f"⏳ 连接/超时，等待 {current_retry_delay} 秒后重试..."
                                )
                                await asyncio.sleep(current_retry_delay)
                                current_retry_delay *= 2
                                continue
                            
                            # 其他错误或到达重试上限：切换下一个模型
                            logger.error(f"❌ 模型 {model_id} 调用失败，切换下一个模型")
                            break

            logger.error(
                f"❌ 所有 API Key 和模型均调用失败，最后错误: {last_error}"
            )
            return None


_default_client: Optional[ModelScopeClient] = None


def get_default_client() -> ModelScopeClient:
    """获取默认的ModelScope客户端实例（单例模式）"""
    global _default_client
    if _default_client is None:
        _default_client = ModelScopeClient()
    return _default_client


def create_client(
    api_token: Optional[str] = None,
    api_keys: Optional[List[str]] = None,
    api_base: Optional[str] = None,
    model_name: Optional[str] = None,
) -> ModelScopeClient:
    """创建新的ModelScope客户端实例"""
    return ModelScopeClient(
        api_token=api_token, api_keys=api_keys, api_base=api_base, model_name=model_name
    )

