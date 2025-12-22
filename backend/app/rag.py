from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings as ChromaSettings

from .settings import settings

class RAG:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=str(settings.chroma_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(settings.chroma_collection)
        self.embedder = SentenceTransformer(settings.embedding_model)

    def retrieve(self, query: str, top_k: int | None = None) -> list[dict]:
        k = top_k or settings.top_k
        qvec = self.embedder.encode([query]).tolist()[0]
        res = self.collection.query(
            query_embeddings=[qvec],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )
        items = []
        for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
            items.append({"text": doc, "meta": meta, "distance": dist})
        return items

    def build_context_block(self, hits: list[dict]) -> str:
        # Keep it compact to avoid drowning the LLM.
        parts = []
        for i, h in enumerate(hits, 1):
            src = h["meta"].get("source", "unknown")
            idx = h["meta"].get("chunk_index", "?")
            parts.append(f"[{i}] Source: {src} (chunk {idx})\n{h['text']}")
        return "\n\n---\n\n".join(parts)

    def build_prompt(self, user_query: str) -> tuple[str, list[dict]]:
        hits = self.retrieve(user_query)
        context = self.build_context_block(hits)
        prompt = f"""You are a helpful assistant. Answer using the provided context.
        If the answer is not in the context, say you don't know and ask for a clarifying detail.

        CONTEXT:
        {context}

        USER QUESTION:
        {user_query}

        ANSWER:
        """
        return prompt, hits
