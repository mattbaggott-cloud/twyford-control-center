"use client";

import { X } from "lucide-react";

export interface ReplyTarget {
  messageId: string;
  sender: string;
  preview: string;
}

interface ReplyBarProps {
  replyTo: ReplyTarget | null;
  onCancel: () => void;
}

export function ReplyBar({ replyTo, onCancel }: ReplyBarProps) {
  if (!replyTo) return null;

  return (
    <div
      style={{
        padding: "8px 16px",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <div
          style={{
            width: "3px",
            height: "32px",
            backgroundColor: "var(--accent)",
            borderRadius: "2px",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--accent)",
              fontFamily: "var(--font-heading)",
            }}
          >
            ↩ Replying to {replyTo.sender}
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
      </div>
      <button
        onClick={onCancel}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
        title="Cancel reply"
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
