"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface ComposeBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ComposeBar({ onSend, disabled, placeholder }: ComposeBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  };

  return (
    <div
      style={{
        padding: "12px 20px 16px",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "10px",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "8px 12px",
          transition: "border-color 150ms ease",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={placeholder || "Type a message…"}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            color: "var(--text-primary)",
            fontSize: "14px",
            fontFamily: "var(--font-body)",
            lineHeight: "1.5",
            maxHeight: "160px",
            padding: "4px 0",
          }}
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            cursor: text.trim() && !disabled ? "pointer" : "default",
            backgroundColor: text.trim() && !disabled ? "var(--accent)" : "var(--surface-hover)",
            color: text.trim() && !disabled ? "white" : "var(--text-muted)",
            transition: "all 150ms ease",
            flexShrink: 0,
          }}
          title="Send (Enter)"
        >
          <Send style={{ width: 18, height: 18 }} />
        </button>
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          marginTop: "6px",
          textAlign: "center",
        }}
      >
        <kbd style={{ 
          padding: "1px 4px", 
          borderRadius: "3px", 
          backgroundColor: "var(--surface)", 
          border: "1px solid var(--border)",
          fontSize: "10px",
        }}>Enter</kbd> to send · <kbd style={{ 
          padding: "1px 4px", 
          borderRadius: "3px", 
          backgroundColor: "var(--surface)", 
          border: "1px solid var(--border)",
          fontSize: "10px",
        }}>Shift+Enter</kbd> for new line
      </div>
    </div>
  );
}
