"use client";

import { MessageSquare, ChevronRight } from "lucide-react";
import { MessageBubbleProps } from "./MessageBubble";

interface ThreadSummary {
  id: number;
  parentMessage: MessageBubbleProps;
  replies: MessageBubbleProps[];
  lastReplyAt: string;
  hasAgentActivity: boolean;
}

interface ChannelThreadListProps {
  threads: ThreadSummary[];
  onSelectThread: (threadIndex: number) => void;
  ownerName?: string;
}

const AGENT_AVATARS: Record<string, { emoji: string; color: string }> = {
  Woods: { emoji: "🦞", color: "#3fb950" },
  Ford: { emoji: "👨🏻‍💻", color: "#FF3B30" },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatRelative(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Groups linear messages into threads.
 * Each user message starts a new thread. All subsequent messages
 * (assistant, system) belong to that thread until the next user message.
 */
export function groupMessagesIntoThreads(
  messages: MessageBubbleProps[]
): ThreadSummary[] {
  const threads: ThreadSummary[] = [];
  let currentThread: ThreadSummary | null = null;

  for (const msg of messages) {
    if (msg.role === "user" && !msg.isThreadReply) {
      // Start a new thread (only for top-level user messages, not replies)
      if (currentThread) threads.push(currentThread);
      currentThread = {
        id: threads.length,
        parentMessage: msg,
        replies: [],
        lastReplyAt: msg.timestamp,
        hasAgentActivity: false,
      };
    } else if (currentThread) {
      // Add to current thread (replies, assistant messages, system messages)
      currentThread.replies.push(msg);
      currentThread.lastReplyAt = msg.timestamp;
      if (msg.role === "assistant") {
        currentThread.hasAgentActivity = true;
      }
    }
  }
  if (currentThread) threads.push(currentThread);

  return threads;
}

export function ChannelThreadList({
  threads,
  onSelectThread,
  ownerName = process.env.NEXT_PUBLIC_OWNER_USERNAME || "You",
}: ChannelThreadListProps) {
  if (threads.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: "14px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>💬</div>
          <div>No threads yet. Send a message to start one.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {threads.map((thread) => {
        // Collect unique agent emojis in this thread
        const agentEmojis = new Set<string>();
        for (const reply of thread.replies) {
          if (reply.agent && AGENT_AVATARS[reply.agent]) {
            agentEmojis.add(AGENT_AVATARS[reply.agent].emoji);
          }
        }

        // Last reply preview
        const lastReply = thread.replies[thread.replies.length - 1];
        const lastReplyPreview = lastReply
          ? `${lastReply.agent || "System"}: ${lastReply.content.slice(0, 80)}${lastReply.content.length > 80 ? "…" : ""}`
          : null;

        return (
          <div
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* User message (thread starter) */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              {/* Matt avatar */}
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(240, 192, 64, 0.15)",
                  border: "2px solid #f0c040",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#f0c040",
                  flexShrink: 0,
                }}
              >
                M
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + time */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {ownerName}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {formatTime(thread.parentMessage.timestamp)}
                  </span>
                </div>

                {/* Message content */}
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {thread.parentMessage.content}
                </div>
              </div>

              <ChevronRight
                style={{
                  width: 16,
                  height: 16,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  marginTop: "4px",
                }}
              />
            </div>

            {/* Thread footer — reply count + agents + last activity */}
            {thread.replies.length > 0 && (
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {/* Agent avatars */}
                <div style={{ display: "flex", gap: "2px" }}>
                  {Array.from(agentEmojis).map((emoji, i) => (
                    <span key={i} style={{ fontSize: "14px" }}>
                      {emoji}
                    </span>
                  ))}
                </div>

                {/* Reply count */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--accent)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  <MessageSquare style={{ width: 12, height: 12 }} />
                  {thread.replies.length}{" "}
                  {thread.replies.length === 1 ? "reply" : "replies"}
                </div>

                {/* Last activity */}
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "auto" }}>
                  {formatRelative(thread.lastReplyAt)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
