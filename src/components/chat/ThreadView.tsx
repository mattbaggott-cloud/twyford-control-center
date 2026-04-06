"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

interface ThreadMessage {
  from: string;
  to: string;
  message: string;
  reply: string | null;
  status: string;
  timestamp: string;
}

interface ThreadData {
  id: string;
  fromAgent: { id: string; name: string; emoji: string };
  toAgent: { id: string; name: string; emoji: string };
  messages: ThreadMessage[];
  taskSummary: string;
}

interface ThreadViewProps {
  thread: ThreadData;
}

export function ThreadView({ thread }: ThreadViewProps) {
  const [expanded, setExpanded] = useState(false);

  const messageCount = thread.messages.length;
  const repliesCount = thread.messages.filter((m) => m.reply).length;

  return (
    <div
      style={{
        marginTop: "8px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        overflow: "hidden",
      }}
    >
      {/* Thread indicator — click to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: "12px",
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {expanded ? (
          <ChevronDown style={{ width: 14, height: 14, flexShrink: 0 }} />
        ) : (
          <ChevronRight style={{ width: 14, height: 14, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: "14px" }}>
          {thread.fromAgent.emoji}
        </span>
        <span style={{ color: "var(--text-muted)" }}>↔</span>
        <span style={{ fontSize: "14px" }}>
          {thread.toAgent.emoji}
        </span>
        <MessageSquare style={{ width: 12, height: 12, color: "var(--text-muted)" }} />
        <span style={{ fontWeight: 500 }}>
          {repliesCount} {repliesCount === 1 ? "exchange" : "exchanges"}
        </span>
        <span style={{ color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          — {thread.taskSummary}
        </span>
      </button>

      {/* Expanded thread content */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "4px 0",
          }}
        >
          {thread.messages.map((msg, idx) => (
            <div key={idx} style={{ padding: "8px 16px" }}>
              {/* Woods' message to Ford */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>
                  {thread.fromAgent.emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      marginBottom: "2px",
                    }}
                  >
                    {thread.fromAgent.name}
                    <span
                      style={{
                        fontWeight: 400,
                        marginLeft: "6px",
                        fontSize: "10px",
                      }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <MarkdownPreview content={msg.message} />
                  </div>
                </div>
              </div>

              {/* Ford's reply */}
              {msg.reply && (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginLeft: "22px",
                    paddingLeft: "12px",
                    borderLeft: "2px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "2px" }}>
                    {thread.toAgent.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        marginBottom: "2px",
                      }}
                    >
                      {thread.toAgent.name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      <MarkdownPreview content={msg.reply} />
                    </div>
                  </div>
                </div>
              )}

              {/* Divider between exchanges */}
              {idx < thread.messages.length - 1 && (
                <div
                  style={{
                    borderBottom: "1px solid var(--border)",
                    margin: "8px 0 4px 0",
                    opacity: 0.5,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
