"use client";

import { useRef, useEffect } from "react";
import { MessageBubble, MessageBubbleProps } from "./MessageBubble";
import { ThreadView } from "./ThreadView";
import { ReactionsData } from "./MessageReactions";

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
  reactions?: ReactionsData;
  sessionKey?: string;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onReply?: (id: string, sender: string, preview: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  messageRefs?: React.MutableRefObject<Map<string, HTMLDivElement>>;
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

function findThreadForMessage(
  msg: MessageBubbleProps,
  threads: ThreadData[],
  usedThreadIds: Set<string>
): ThreadData | null {
  if (msg.role !== "assistant" || !threads.length) return null;
  const msgTime = new Date(msg.timestamp).getTime();
  const WINDOW_MS = 2 * 60 * 1000;
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

export function MessageThread({
  messages,
  isLoading,
  threads = [],
  reactions,
  sessionKey,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onScrollToMessage,
  messageRefs,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for edit-last-message event from keyboard shortcut
  useEffect(() => {
    function handleEditLast() {
      // Find last user message and trigger its edit
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user" && !m.isDeleted);
      if (lastUserMsg && lastUserMsg.id && onEdit) {
        // Signal to the bubble — we fire a custom event on the message element
        const el = messageRefs?.current.get(lastUserMsg.id);
        if (el) {
          const editBtn = el.querySelector<HTMLButtonElement>('[title="Edit message"]');
          editBtn?.click();
        }
      }
    }
    document.addEventListener("edit-last-message", handleEditLast);
    return () => document.removeEventListener("edit-last-message", handleEditLast);
  }, [messages, onEdit, messageRefs]);

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
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🦞</div>
            <div>Connecting to gateway…</div>
          </div>
        </div>
      )}

      {!isLoading && messages.length === 0 && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>💬</div>
            <div>No messages yet. Send one below.</div>
          </div>
        </div>
      )}

      {Array.from(dateGroups.entries()).map(([dateLabel, msgs]) => (
        <div key={dateLabel}>
          {/* Date separator */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 0 8px" }}>
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

          {msgs.map((msg, idx) => {
            const matchedThread = findThreadForMessage(msg, threads, usedThreadIds);
            const msgId = msg.id || `${msg.timestamp}-${idx}`;
            return (
              <div
                key={msgId}
                ref={(el) => {
                  if (el && messageRefs && msg.id) {
                    messageRefs.current.set(msg.id, el);
                  }
                }}
                style={{ transition: "background-color 500ms ease" }}
              >
                <MessageBubble
                  {...msg}
                  reactions={reactions}
                  sessionKey={sessionKey}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReply={onReply}
                  onReact={onReact}
                  onScrollToMessage={onScrollToMessage}
                />
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
