"use client";

import { ArrowLeft } from "lucide-react";
import { MessageBubble, MessageBubbleProps } from "./MessageBubble";
import { ThreadView } from "./ThreadView";
import { useRef, useEffect } from "react";

interface ThreadData {
  id: string;
  fromAgent: { id: string; name: string; emoji: string };
  toAgent: { id: string; name: string; emoji: string };
  messages: {
    from: string;
    to: string;
    message: string;
    reply: string | null;
    status: string;
    timestamp: string;
  }[];
  startedAt: string;
  lastActivityAt: string;
  taskSummary: string;
}

interface ChannelThreadDetailProps {
  parentMessage: MessageBubbleProps;
  replies: MessageBubbleProps[];
  onBack: () => void;
  a2aThreads?: ThreadData[];
}

export function ChannelThreadDetail({
  parentMessage,
  replies,
  onBack,
  a2aThreads = [],
}: ChannelThreadDetailProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  // Match A2A threads to replies by timestamp
  const usedThreadIds = new Set<string>();
  function findA2AThread(msg: MessageBubbleProps): ThreadData | null {
    if (msg.role !== "assistant" || !a2aThreads.length) return null;
    const msgTime = new Date(msg.timestamp).getTime();
    const WINDOW_MS = 2 * 60 * 1000;
    for (const thread of a2aThreads) {
      if (usedThreadIds.has(thread.id)) continue;
      const threadTime = new Date(thread.startedAt).getTime();
      if (Math.abs(threadTime - msgTime) <= WINDOW_MS) {
        usedThreadIds.add(thread.id);
        return thread;
      }
    }
    return null;
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Thread header with back button */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          backgroundColor: "var(--surface)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "6px",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Thread
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "400px",
            }}
          >
            {parentMessage.content.slice(0, 80)}
            {parentMessage.content.length > 80 ? "…" : ""}
          </div>
        </div>
      </div>

      {/* Thread messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Parent message */}
        <MessageBubble {...parentMessage} />

        {/* Thread separator */}
        {replies.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 0",
            }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
          </div>
        )}

        {/* Replies with A2A threads */}
        {replies.map((msg, idx) => {
          const a2aThread = findA2AThread(msg);
          return (
            <div key={`${msg.timestamp}-${idx}`}>
              <MessageBubble {...msg} />
              {a2aThread && <ThreadView thread={a2aThread} />}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
