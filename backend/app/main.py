from __future__ import annotations
import json
import uuid
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from .schemas import ChatRequest
from .rag import RAG
from .vllm_engine import VLLMEngine

app = FastAPI(title="RAG Chatbot (FastAPI + vLLM + Chroma + SSE)")

# Adjust origins for your Next.js dev/prod domains
# allow_origins=[
        # "http://localhost:3000",
        # "http://localhost:6379",],
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag = RAG()
llm = VLLMEngine()

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    prompt, hits = rag.build_prompt(req.message)
    prompt = llm.build_chat_prompt(prompt)

    request_id = str(uuid.uuid4())
    sampling = llm.sampling_params()

    async def event_generator():
        # Send retrieval metadata first (optional, but useful for UI/debug)
        yield {
            "event": "sources",
            "data": json.dumps({
                "request_id": request_id,
                "sources": [
                    {
                        "source": h["meta"].get("source"),
                        "chunk_index": h["meta"].get("chunk_index"),
                        "distance": h["distance"],
                    }
                    for h in hits
                ],
            })
        }

        # Stream tokens from vLLM
        try:
            async for out in llm.engine.generate(prompt, sampling, request_id=request_id):
                # out.outputs[0].text is cumulative; to stream deltas, compute diff
                text = out.outputs[0].text
                yield {"event": "token", "data": json.dumps({"text": text})}

            yield {"event": "done", "data": json.dumps({"request_id": request_id})}
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"message": str(e)})}

    return EventSourceResponse(
        event_generator(),
        headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # important for nginx/proxy buffering
    })

@app.get("/chat/stream-get")
async def chat_stream_get(message: str = Query(..., min_length=1)):
    req = ChatRequest(message=message)
    return await chat_stream(req)
