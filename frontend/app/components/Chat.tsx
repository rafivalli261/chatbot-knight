"use client";

import React, { useMemo, useRef, useState } from "react";

type Source = { source?: string; chunk_index?: number; distance?: number };

export default function Chat() {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000",
    []
  );
  
  const esRef = useRef<EventSource | null>(null);

  const startChat = async () => {
    setAnswer("");
    setSources([]);
    setIsStreaming(true);

    // SSE with POST is not supported by native EventSource.
    // Workaround: create an SSE GET endpoint, OR use fetch + ReadableStream.
    // Since you requested SSE + AsyncLLMEngine, simplest is to expose a GET stream:
    // We'll do a small trick: use a GET endpoint with query param.
    // If you prefer POST, tell me and I'll switch to fetch-stream.
    const url = `${backendUrl}/chat/stream-get?message=${encodeURIComponent(message)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("sources", (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data);
      setSources(payload.sources ?? []);
    });

    es.addEventListener("token", (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data);
      setAnswer(payload.text ?? "");
    });

    es.addEventListener("done", () => {
      es.close();
      setIsStreaming(false);
    });

    es.addEventListener("error", () => {
      es.close();
      setIsStreaming(false);
    });
  };

  const stop = () => {
    esRef.current?.close();
    setIsStreaming(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>RAG Chatbot</h1>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask something from your PDFs..."
          style={{ flex: 1, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <button
          onClick={startChat}
          disabled={!message || isStreaming}
          style={{ padding: "12px 16px", borderRadius: 8, cursor: "pointer" }}
        >
          Send
        </button>
        <button
          onClick={stop}
          disabled={!isStreaming}
          style={{ padding: "12px 16px", borderRadius: 8, cursor: "pointer" }}
        >
          Stop
        </button>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 8, minHeight: 160 }}>
        <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>
      </div>

      {sources.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Sources</h2>
          <ul>
            {sources.map((s, i) => (
              <li key={i}>
                {s.source} (chunk {s.chunk_index}) — dist: {s.distance?.toFixed?.(4) ?? s.distance}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
