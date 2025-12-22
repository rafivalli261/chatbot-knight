from __future__ import annotations
import os

from .settings import settings
from pathlib import Path
from vllm import AsyncLLMEngine, AsyncEngineArgs, SamplingParams

class VLLMEngine:
    def __init__(self):
        # 📁 Local cache directory inside your project
        cache_dir = Path("./hf_cache").resolve()
        cache_dir.mkdir(parents=True, exist_ok=True)

        # ✅ Set Hugging Face cache locations
        os.environ["HF_HOME"] = str(cache_dir)
        os.environ["HUGGINGFACE_HUB_CACHE"] = str(cache_dir / "hub")
        os.environ["TRANSFORMERS_CACHE"] = str(cache_dir / "transformers")

        engine_args = AsyncEngineArgs(
            model=settings.llm_model,
            # tensor_parallel_size=...
            # gpu_memory_utilization=...
        )

        self.engine = AsyncLLMEngine.from_engine_args(engine_args)

    def sampling_params(self) -> SamplingParams:
        return SamplingParams(
            max_tokens=settings.max_new_tokens,
            temperature=settings.temperature,
            top_p=settings.top_p,
        )
