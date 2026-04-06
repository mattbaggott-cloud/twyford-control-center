"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";

export interface SearchResult {
  sessionKey: string;
  sessionLabel: string;
  messageId: string;
  sender: string;
  timestamp: string;
  preview: string;
}

interface MessageSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (sessionKey: string, messageId: string) => void;
  searchLocal: (query: string) => SearchResult[];
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          backgroundColor: "rgba(255,59,48,0.25)",
          color: "var(--accent)",
          borderRadius: "2px",
          padding: "0 1px",
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function MessageSearch({ open, onClose, onNavigate, searchLocal }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Local search first
      const local = searchLocal(q);
      setResults(local);

      // API fallback
      try {
        const res = await fetch(`/api/chat/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          const apiResults: SearchResult[] = data.results || [];
          // Merge: prefer local, dedupe by messageId
          const seen = new Set(local.map((r) => r.messageId));
          const merged = [...local, ...apiResults.filter((r) => !seen.has(r.messageId))];
          setResults(merged);
        }
      } catch {
        // Keep local results
      }

      setLoading(false);
    },
    [searchLocal]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, runSearch]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "80px",
        backgroundColor: "rgba(0,0,0,0.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "560px",
          maxWidth: "90vw",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {loading ? (
            <Loader2
              style={{
                width: 18,
                height: 18,
                color: "var(--text-muted)",
                flexShrink: 0,
                animation: "spin 1s linear infinite",
              }}
            />
          ) : (
            <Search style={{ width: 18, height: 18, color: "var(--text-muted)", flexShrink: 0 }} />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "15px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "2px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "420px", overflowY: "auto" }}>
          {!query.trim() && (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              Type to search across all messages
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              No messages found for &ldquo;{query}&rdquo;
            </div>
          )}

          {results.map((result) => (
            <button
              key={result.messageId}
              onClick={() => {
                onNavigate(result.sessionKey, result.messageId);
                onClose();
              }}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--border)",
                padding: "12px 16px",
                cursor: "pointer",
                textAlign: "left",
                display: "block",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--accent)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {result.sender}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {result.sessionLabel} · {formatTime(result.timestamp)}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                {highlight(result.preview, query)}
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: "16px",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <span>
            <kbd
              style={{
                padding: "1px 5px",
                borderRadius: "3px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: "10px",
              }}
            >
              Enter
            </kbd>{" "}
            to select
          </span>
          <span>
            <kbd
              style={{
                padding: "1px 5px",
                borderRadius: "3px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: "10px",
              }}
            >
              Esc
            </kbd>{" "}
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
