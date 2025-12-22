from __future__ import annotations
from vllm import AsyncLLMEngine, AsyncEngineArgs, SamplingParams

from .settings import settings

class VLLMEngine:
    def __init__(self):
        engine_args = AsyncEngineArgs(
            model=settings.llm_model,
            # Consider: tensor_parallel_size, gpu_memory_utilization, max_model_len, etc.
        )
        self.engine = AsyncLLMEngine.from_engine_args(engine_args)

    def sampling_params(self) -> SamplingParams:
        return SamplingParams(
            max_tokens=settings.max_new_tokens,
            temperature=settings.temperature,
            top_p=settings.top_p,
        )
