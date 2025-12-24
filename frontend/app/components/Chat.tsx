"use client";

import React, { useMemo, useRef, useState } from "react";

type Source = { source?: string; chunk_index?: number; distance?: number };

type ChatMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources?: Source[]; ms?: number };

export default function Chat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const t0Ref = useRef<number>(0);

  // GANTI ke URL backend kamu.
  // Contoh runpod:
  // "https://qw0gq45mfv33c0-8000.proxy.runpod.net"
  const backendUrl = useMemo(() => "http://localhost:8000", []);

  const stop = () => {
    esRef.current?.close();
    esRef.current = null;
    setIsStreaming(false);
  };

  const send = () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    // push user msg
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "" }]);
    setInput("");
    setIsStreaming(true);

    // start timer
    t0Ref.current = performance.now();

    // close previous stream if any
    esRef.current?.close();

    const url = `${backendUrl}/chat/stream-get?message=${encodeURIComponent(text)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("sources", (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data);
      const sources: Source[] = payload.sources ?? [];

      setMessages((prev) => {
        const copy = [...prev];
        // last message should be assistant placeholder
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        if (last && last.role === "assistant") {
          copy[lastIdx] = { ...last, sources };
        }
        return copy;
      });
    });

    es.addEventListener("token", (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data);
      const chunk = payload.text ?? "";
      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        if (last && last.role === "assistant") {
          copy[lastIdx] = { ...last, text: chunk };
        }
        return copy;
      });
    });

    es.addEventListener("done", () => {
      const ms = Math.round(performance.now() - t0Ref.current)/1000;
      es.close();
      esRef.current = null;
      setIsStreaming(false);

      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        if (last && last.role === "assistant") {
          copy[lastIdx] = { ...last, ms };
        }
        return copy;
      });
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;
      setIsStreaming(false);

      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        const last = copy[lastIdx];
        if (last && last.role === "assistant" && !last.text) {
          copy[lastIdx] = {
            ...last,
            text:
              "⚠️ Stream error (CORS/proxy). Pastikan FastAPI mengizinkan origin frontend dan SSE tidak dibuffer.",
          };
        }
        return copy;
      });
    });
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <div style={styles.brand}>RAG Chatbot</div>
        <div style={styles.sub}>
          {isStreaming ? "Thinking…" : "Ready"} · Backend: {backendUrl}
        </div>
      </div>

      <div style={styles.chat}>
        {messages.length === 0 ? (
          <div style={styles.empty}>
            Tulis pertanyaan tentang PDF kamu. Sources dan streaming akan muncul di sini.
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                ...styles.row,
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  ...(m.role === "user" ? styles.userBubble : styles.assistantBubble),
                }}
              >
                <div style={styles.text}>{m.text}</div>

                {m.role === "assistant" && (
                  <div style={styles.meta}>
                    {typeof m.ms === "number" ? <span>{m.ms} s</span> : isStreaming ? <span>streaming…</span> : null}
                  </div>
                )}

                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <details style={styles.sources}>
                    <summary style={styles.sourcesSummary}>Sources ({m.sources.length})</summary>
                    <div style={styles.sourcesBox}>
                      {m.sources.map((s, idx) => (
                        <div key={idx} style={styles.sourceItem}>
                          <div style={styles.sourceTop}>
                            <span style={styles.sourceName}>{s.source ?? "unknown"}</span>
                            <span style={styles.sourceSmall}>
                              chunk {s.chunk_index ?? "?"} · dist{" "}
                              {typeof s.distance === "number" ? s.distance.toFixed(4) : "?"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={styles.composer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask something… (Enter untuk kirim, Shift+Enter untuk baris baru)"
          style={styles.input}
          rows={2}
          disabled={false}
        />
        <div style={styles.actions}>
          <button onClick={send} disabled={!input.trim() || isStreaming} style={styles.btnPrimary}>
            Send
          </button>
          <button onClick={stop} disabled={!isStreaming} style={styles.btnGhost}>
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: "100vh",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    background: "#0b0f17",
    color: "#e7eaf0",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(11,15,23,0.7)",
    backdropFilter: "blur(10px)",
  },
  brand: { fontSize: 14, fontWeight: 700, letterSpacing: 0.2 },
  sub: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  chat: {
    padding: "18px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    maxWidth: 720,
    margin: "80px auto 0",
    padding: 18,
    border: "1px dashed rgba(255,255,255,0.18)",
    borderRadius: 14,
    opacity: 0.8,
    lineHeight: 1.5,
  },
  row: { display: "flex" },
  bubble: {
    maxWidth: 820,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  userBubble: { background: "rgba(84, 121, 255, 0.18)" },
  assistantBubble: { background: "rgba(255,255,255,0.06)" },
  text: { whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 14 },
  meta: { marginTop: 8, fontSize: 12, opacity: 0.65 },
  sources: { marginTop: 10 },
  sourcesSummary: { cursor: "pointer", fontSize: 12, opacity: 0.85 },
  sourcesBox: {
    marginTop: 10,
    borderRadius: 12,
    padding: 10,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: 8,
  },
  sourceItem: { padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.05)" },
  sourceTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
  sourceName: { fontSize: 12, fontWeight: 700 },
  sourceSmall: { fontSize: 12, opacity: 0.7 },
  composer: {
    padding: "14px 18px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(11,15,23,0.7)",
    backdropFilter: "blur(10px)",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "end",
  },
  input: {
    width: "100%",
    resize: "none",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e7eaf0",
    outline: "none",
    fontSize: 14,
    lineHeight: 1.4,
  },
  actions: { display: "flex", gap: 10 },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(84, 121, 255, 0.35)",
    color: "#e7eaf0",
    cursor: "pointer",
    fontWeight: 700,
  },
  btnGhost: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#e7eaf0",
    cursor: "pointer",
    fontWeight: 700,
    opacity: 0.9,
  },
};
