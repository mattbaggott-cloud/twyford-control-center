"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Pencil, Trash2, CornerUpLeft } from "lucide-react";
import { MessageReactions, ReactionsData } from "./MessageReactions";

export interface MessageBubbleProps {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string; // ISO string
  agent?: string;
  isStreaming?: boolean;
  isThreadReply?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  replyTo?: {
    messageId: string;
    sender: string;
    preview: string;
  };
  // Callbacks (optional — only present when passed from parent)
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onReply?: (id: string, sender: string, preview: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  reactions?: ReactionsData;
  sessionKey?: string;
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
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
      title="Copy code"
    >
      {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function HoverActions({
  isUser,
  onEdit,
  onDelete,
  onReply,
}: {
  isUser: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
}) {
  return (
    <div
      className="message-hover-actions"
      style={{
        position: "absolute",
        top: "-8px",
        right: isUser ? "auto" : "-8px",
        left: isUser ? "-8px" : "auto",
        display: "flex",
        gap: "4px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "3px 5px",
        zIndex: 10,
        opacity: 0,
        transition: "opacity 150ms ease",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {onReply && (
        <button
          onClick={onReply}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Reply"
        >
          <CornerUpLeft style={{ width: 13, height: 13 }} />
        </button>
      )}
      {isUser && onEdit && (
        <button
          onClick={onEdit}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Edit message"
        >
          <Pencil style={{ width: 13, height: 13 }} />
        </button>
      )}
      {isUser && onDelete && (
        <button
          onClick={onDelete}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: "4px", display: "flex", alignItems: "center" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--negative)"; e.currentTarget.style.backgroundColor = "var(--negative-soft)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          title="Delete message"
        >
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      )}
    </div>
  );
}

export function MessageBubble({
  id,
  role,
  content,
  timestamp,
  agent,
  isStreaming,
  isDeleted,
  isEdited,
  replyTo,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onScrollToMessage,
  reactions,
  sessionKey,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  if (role === "system") {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
          {content}
        </span>
      </div>
    );
  }

  const isUser = role === "user";
  const avatar = agent ? AGENT_AVATARS[agent] : undefined;
  const messageId = id || `${timestamp}-${role}`;

  const handleEditSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== content && onEdit && id) {
      onEdit(id, trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === "Escape") {
      setEditText(content);
      setIsEditing(false);
    }
  };

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

      {/* Bubble + reactions */}
      <div
        style={{ maxWidth: "75%", minWidth: "60px", position: "relative" }}
        onMouseEnter={(e) => {
          const actions = e.currentTarget.querySelector(".message-hover-actions") as HTMLElement;
          if (actions) actions.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          const actions = e.currentTarget.querySelector(".message-hover-actions") as HTMLElement;
          if (actions) actions.style.opacity = "0";
        }}
      >
        {/* Hover actions */}
        {!isDeleted && (
          <HoverActions
            isUser={isUser}
            onEdit={isUser && onEdit ? () => { setEditText(content); setIsEditing(true); setTimeout(() => editRef.current?.focus(), 50); } : undefined}
            onDelete={isUser && onDelete ? () => setShowDeleteConfirm(true) : undefined}
            onReply={onReply ? () => onReply(messageId, isUser ? "Matt" : (agent || "Agent"), content.slice(0, 60)) : undefined}
          />
        )}

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
          {isEdited && !isDeleted && (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" }}>
              (edited)
            </span>
          )}
          {isStreaming && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", animation: "pulse 1.5s ease-in-out infinite" }}>
              typing…
            </span>
          )}
        </div>

        {/* Reply quote */}
        {replyTo && (
          <div
            onClick={() => onScrollToMessage && replyTo.messageId && onScrollToMessage(replyTo.messageId)}
            style={{
              borderLeft: "3px solid var(--accent)",
              paddingLeft: "8px",
              marginBottom: "6px",
              cursor: onScrollToMessage ? "pointer" : "default",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", fontFamily: "var(--font-heading)" }}>
              ↩ {replyTo.sender}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {replyTo.preview}
            </div>
          </div>
        )}

        {/* Message content */}
        {isDeleted ? (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              fontSize: "13px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            [message deleted]
          </div>
        ) : isEditing ? (
          <div>
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              style={{
                width: "100%",
                minHeight: "80px",
                padding: "10px 14px",
                borderRadius: "10px",
                backgroundColor: "var(--surface)",
                border: "1px solid var(--accent)",
                color: "var(--text-primary)",
                fontSize: "14px",
                fontFamily: "var(--font-body)",
                lineHeight: "1.5",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "6px", marginTop: "4px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setEditText(content); setIsEditing(false); }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--accent)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : showDeleteConfirm ? (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              backgroundColor: "var(--negative-soft)",
              border: "1px solid var(--negative)",
              fontSize: "13px",
              color: "var(--text-primary)",
            }}
          >
            <div style={{ marginBottom: "8px" }}>Delete this message?</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => {
                  if (onDelete && id) onDelete(id);
                  setShowDeleteConfirm(false);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "var(--negative)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
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
        )}

        {/* Reactions */}
        {!isDeleted && !isEditing && reactions && onReact && (
          <MessageReactions
            messageId={messageId}
            sessionKey={sessionKey || ""}
            reactions={reactions}
            onReact={onReact}
          />
        )}
      </div>
    </div>
  );
}
