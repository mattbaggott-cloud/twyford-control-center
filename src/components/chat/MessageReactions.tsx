"use client";

import { useState, useRef, useEffect } from "react";

const REACTION_EMOJI = ["👍","👎","❤️","😂","😮","😢","🔥","🎉","✅","❌","🤔","👀","🙌","💯","🚀","⚡"];

export interface ReactionsData {
  [messageId: string]: {
    [emoji: string]: string[]; // emoji → list of user ids who reacted
  };
}

interface MessageReactionsProps {
  messageId: string;
  sessionKey: string;
  currentUser?: string;
  reactions: ReactionsData;
  onReact: (messageId: string, emoji: string) => void;
}

function ReactionPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "100%",
        right: 0,
        marginBottom: "4px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "6px",
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: "2px",
        zIndex: 100,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {REACTION_EMOJI.map((em) => (
        <button
          key={em}
          onClick={() => { onSelect(em); onClose(); }}
          style={{
            background: "none",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "18px",
            padding: "3px",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          {em}
        </button>
      ))}
    </div>
  );
}

export function MessageReactions({
  messageId,
  sessionKey,
  currentUser = "matt",
  reactions,
  onReact,
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const msgReactions = reactions[messageId] || {};
  const hasReactions = Object.keys(msgReactions).length > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginTop: hasReactions ? "4px" : 0 }}>
      {/* Existing reaction chips */}
      {Object.entries(msgReactions).map(([emoji, users]) => {
        const hasReacted = users.includes(currentUser);
        return (
          <button
            key={emoji}
            onClick={() => onReact(messageId, emoji)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              padding: "2px 7px",
              borderRadius: "12px",
              border: `1px solid ${hasReacted ? "var(--accent)" : "var(--border)"}`,
              backgroundColor: hasReacted ? "var(--accent-soft)" : "var(--surface)",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
              transition: "all 100ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = hasReacted ? "var(--accent)" : "var(--border)"; }}
          >
            <span>{emoji}</span>
            <span style={{ fontSize: "11px" }}>{users.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowPicker((v) => !v)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "2px 7px",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "2px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          title="Add reaction"
        >
          +
        </button>
        {showPicker && (
          <ReactionPicker
            onSelect={(emoji) => onReact(messageId, emoji)}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
