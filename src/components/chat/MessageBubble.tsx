"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

export interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string; // ISO string
  agent?: string;
  isStreaming?: boolean;
}

const AGENT_AVATARS: Record<string, { emoji: string; color: string }> = {
  Woods: { emoji: "🦞", color: "#3fb950" },
  Ford: { emoji: "👨🏻‍💻", color: "#FF3B30" },
};

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: "absolute",
        top: "8px",
        right: "8px",
        padding: "4px 8px",
        borderRadius: "4px",
        backgroundColor: "var(--surface-hover)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        transition: "all 150ms ease",
        opacity: 0.7,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "0.7";
      }}
      title="Copy code"
    >
      {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function MessageBubble({ role, content, timestamp, agent, isStreaming }: MessageBubbleProps) {
  if (role === "system") {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          {content}
        </span>
      </div>
    );
  }

  const isUser = role === "user";
  const avatar = agent ? AGENT_AVATARS[agent] : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: "10px",
        padding: "4px 0",
        maxWidth: "100%",
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `2px solid ${avatar?.color || "var(--text-muted)"}`,
            backgroundColor: "var(--surface)",
            fontSize: "18px",
            marginTop: "2px",
          }}
        >
          {avatar?.emoji || "🤖"}
        </div>
      )}

      {isUser && (
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "2px solid #f0c040",
            backgroundColor: "var(--surface)",
            fontSize: "14px",
            fontWeight: 700,
            color: "#f0c040",
            fontFamily: "var(--font-heading)",
            marginTop: "2px",
          }}
        >
          M
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: "75%",
          minWidth: "60px",
        }}
      >
        {/* Agent name + timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
            flexDirection: isUser ? "row-reverse" : "row",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: isUser ? "#f0c040" : avatar?.color || "var(--text-secondary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {isUser ? "Matt" : agent || "Agent"}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {formatTime(timestamp)}
          </span>
          {isStreaming && (
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              typing…
            </span>
          )}
        </div>

        {/* Message content */}
        <div
          className="message-content"
          style={{
            padding: "10px 14px",
            borderRadius: "12px",
            borderTopLeftRadius: isUser ? "12px" : "4px",
            borderTopRightRadius: isUser ? "4px" : "12px",
            backgroundColor: isUser ? "rgba(240, 192, 64, 0.1)" : "var(--card)",
            border: `1px solid ${isUser ? "rgba(240, 192, 64, 0.15)" : "var(--border)"}`,
            fontSize: "14px",
            lineHeight: "1.6",
            color: "var(--text-primary)",
            wordBreak: "break-word",
          }}
        >
          <ReactMarkdown
            components={{
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className || "");
                const codeString = String(children).replace(/\n$/, "");
                
                if (match) {
                  return (
                    <div style={{ position: "relative", margin: "8px 0" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 12px",
                          backgroundColor: "var(--surface)",
                          borderRadius: "8px 8px 0 0",
                          border: "1px solid var(--border)",
                          borderBottom: "none",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                          }}
                        >
                          {match[1]}
                        </span>
                      </div>
                      <CopyButton text={codeString} />
                      <SyntaxHighlighter
                        style={oneDark as Record<string, React.CSSProperties>}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: "0 0 8px 8px",
                          border: "1px solid var(--border)",
                          borderTop: "none",
                          fontSize: "13px",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  );
                }

                // Inline code
                return (
                  <code
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "var(--surface-hover)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "13px",
                      color: "var(--accent)",
                    }}
                  >
                    {children}
                  </code>
                );
              },
              a({ children, ...props }) {
                return (
                  <a
                    style={{ color: "var(--info)", textDecoration: "underline" }}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
              p({ children }) {
                return <p style={{ margin: "4px 0" }}>{children}</p>;
              },
              ul({ children }) {
                return (
                  <ul style={{ margin: "4px 0", paddingLeft: "20px", listStyleType: "disc" }}>
                    {children}
                  </ul>
                );
              },
              ol({ children }) {
                return (
                  <ol style={{ margin: "4px 0", paddingLeft: "20px", listStyleType: "decimal" }}>
                    {children}
                  </ol>
                );
              },
              blockquote({ children }) {
                return (
                  <blockquote
                    style={{
                      borderLeft: "3px solid var(--accent)",
                      paddingLeft: "12px",
                      margin: "8px 0",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {children}
                  </blockquote>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
