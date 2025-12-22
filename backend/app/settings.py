from pydantic import BaseModel
from pathlib import Path

class Settings(BaseModel):
    # Data paths
    pdf_dir: Path = Path("data/knowledge_pdfs")
    chroma_dir: Path = Path("data/chroma")
    chroma_collection: str = "knowledge"

    # Embeddings
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Retrieval
    top_k: int = 5
    chunk_size: int = 900
    chunk_overlap: int = 150

    # vLLM model (example)
    llm_model: str = "Qwen/Qwen3-Omni-30B-A3B-Instruct"
    max_new_tokens: int = 512
    temperature: float = 0.2
    top_p: float = 0.9

settings = Settings()
