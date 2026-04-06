"use client";

import { useRef, useEffect } from "react";
import { MessageBubble, MessageBubbleProps } from "./MessageBubble";
import { ThreadView } from "./ThreadView";

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

interface MessageThreadProps {
  messages: MessageBubbleProps[];
  isLoading?: boolean;
  threads?: ThreadData[];
}

function formatDateGroup(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function groupMessagesByDate(messages: MessageBubbleProps[]): Map<string, MessageBubbleProps[]> {
  const groups = new Map<string, MessageBubbleProps[]>();
  for (const msg of messages) {
    const dateKey = formatDateGroup(msg.timestamp);
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(msg);
  }
  return groups;
}

/**
 * Find the thread that matches an assistant message by timestamp proximity.
 * A thread is linked to a message if the thread started within 2 minutes
 * of the message timestamp.
 */
function findThreadForMessage(
  msg: MessageBubbleProps,
  threads: ThreadData[],
  usedThreadIds: Set<string>
): ThreadData | null {
  if (msg.role !== "assistant" || !threads.length) return null;

  const msgTime = new Date(msg.timestamp).getTime();
  const WINDOW_MS = 2 * 60 * 1000; // 2 minutes

  for (const thread of threads) {
    if (usedThreadIds.has(thread.id)) continue;
    const threadTime = new Date(thread.startedAt).getTime();
    if (Math.abs(threadTime - msgTime) <= WINDOW_MS) {
      usedThreadIds.add(thread.id);
      return thread;
    }
  }
  return null;
}

export function MessageThread({ messages, isLoading, threads = [] }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const dateGroups = groupMessagesByDate(messages);
  const usedThreadIds = new Set<string>();

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {isLoading && messages.length === 0 && (
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
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🦞</div>
            <div>Connecting to gateway…</div>
          </div>
        </div>
      )}

      {!isLoading && messages.length === 0 && (
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
            <div>No messages yet. Send one below.</div>
          </div>
        </div>
      )}

      {Array.from(dateGroups.entries()).map(([dateLabel, msgs]) => (
        <div key={dateLabel}>
          {/* Date separator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "16px 0 8px",
            }}
          >
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-heading)",
              }}
            >
              {dateLabel}
            </span>
            <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
          </div>

          {/* Messages in group */}
          {msgs.map((msg, idx) => {
            const matchedThread = findThreadForMessage(msg, threads, usedThreadIds);
            return (
              <div key={`${msg.timestamp}-${idx}`}>
                <MessageBubble {...msg} />
                {matchedThread && <ThreadView thread={matchedThread} />}
              </div>
            );
          })}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
