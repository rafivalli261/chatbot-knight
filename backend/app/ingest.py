from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import pymupdf
import hashlib

from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings as ChromaSettings

from .settings import settings

@dataclass
class Chunk:
    doc_id: str
    chunk_id: str
    text: str
    metadata: dict

def _hash_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

def load_pdf_text(pdf_path: Path) -> str:
    doc = pymupdf.open(pdf_path)
    pages = []
    for i in range(len(doc)):
        pages.append(doc[i].get_text("text"))
    return "\n".join(pages).strip()

def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    # Simple character-based chunking (robust + fast).
    # You can replace with token-based chunking if you want.
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + chunk_size, n)
        chunks.append(text[start:end])
        if end == n:
            break
        start = max(0, end - overlap)
    return [c.strip() for c in chunks if c.strip()]

def build_chunks_from_folder(pdf_dir: Path) -> list[Chunk]:
    all_chunks: list[Chunk] = []
    for pdf_path in sorted(pdf_dir.glob("*.pdf")):
        raw = load_pdf_text(pdf_path)
        doc_id = pdf_path.stem
        parts = chunk_text(raw, settings.chunk_size, settings.chunk_overlap)
        for idx, part in enumerate(parts):
            chunk_id = f"{doc_id}-{idx}-{_hash_text(part)}"
            all_chunks.append(
                Chunk(
                    doc_id=doc_id,
                    chunk_id=chunk_id,
                    text=part,
                    metadata={
                        "source": str(pdf_path.name),
                        "doc_id": doc_id,
                        "chunk_index": idx,
                    },
                )
            )
    return all_chunks

def ingest():
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(
        path=str(settings.chroma_dir),
        settings=ChromaSettings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection(name=settings.chroma_collection)

    embedder = SentenceTransformer(settings.embedding_model)

    chunks = build_chunks_from_folder(settings.pdf_dir)
    if not chunks:
        print(f"No PDFs found in: {settings.pdf_dir.resolve()}")
        return

    ids = [c.chunk_id for c in chunks]
    texts = [c.text for c in chunks]
    metas = [c.metadata for c in chunks]

    vectors = embedder.encode(texts, batch_size=32, show_progress_bar=True).tolist()

    # Upsert-like behavior: delete existing ids then add.
    # (Chroma may support upsert depending on version/config; this is safe.)
    try:
        collection.delete(ids=ids)
    except Exception:
        pass

    collection.add(ids=ids, documents=texts, metadatas=metas, embeddings=vectors)
    print(f"Ingested {len(chunks)} chunks into Chroma collection '{settings.chroma_collection}'.")

if __name__ == "__main__":
    ingest()
