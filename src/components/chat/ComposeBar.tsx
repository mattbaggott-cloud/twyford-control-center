"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, Smile } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { FilePickerButton } from "./FileUpload";

interface ComposeBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onEditLast?: () => void; // triggered by ↑ when compose is empty
  onFileAttach?: (files: FileList) => void;
}

export function ComposeBar({ onSend, disabled, placeholder, onEditLast, onFileAttach }: ComposeBarProps) {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // ↑ when compose is empty — trigger edit-last
    if (e.key === "ArrowUp" && !text.trim() && onEditLast) {
      e.preventDefault();
      onEditLast();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  };

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    // Restore cursor after emoji
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 0);
  }, [text]);

  return (
    <div
      style={{
        padding: "12px 20px 16px",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--bg)",
        position: "relative",
      }}
    >
      {/* Emoji picker (rendered above compose) */}
      {showEmoji && (
        <EmojiPicker
          onSelect={insertEmoji}
          onClose={() => setShowEmoji(false)}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "6px",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "8px 12px",
          transition: "border-color 150ms ease",
          // min touch target
          minHeight: "44px",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        {/* File attach */}
        {onFileAttach && (
          <FilePickerButton onFiles={onFileAttach} />
        )}

        {/* Textarea */}
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
            minHeight: "28px",
          }}
        />

        {/* Emoji button */}
        <button
          onClick={() => setShowEmoji((v) => !v)}
          disabled={disabled}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            padding: "6px",
            borderRadius: "6px",
            color: showEmoji ? "var(--accent)" : "var(--text-muted)",
            backgroundColor: showEmoji ? "var(--accent-soft)" : "transparent",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            transition: "all 150ms",
          }}
          onMouseEnter={(e) => {
            if (!showEmoji && !disabled) {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (!showEmoji) {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          title="Emoji picker"
        >
          <Smile style={{ width: 18, height: 18 }} />
        </button>

        {/* Send button */}
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
        <kbd style={{ padding: "1px 4px", borderRadius: "3px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", fontSize: "10px" }}>Enter</kbd>
        {" "}to send ·{" "}
        <kbd style={{ padding: "1px 4px", borderRadius: "3px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", fontSize: "10px" }}>Shift+Enter</kbd>
        {" "}for new line ·{" "}
        <kbd style={{ padding: "1px 4px", borderRadius: "3px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", fontSize: "10px" }}>⌘K</kbd>
        {" "}search ·{" "}
        <kbd style={{ padding: "1px 4px", borderRadius: "3px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", fontSize: "10px" }}>↑</kbd>
        {" "}edit last
      </div>
    </div>
  );
}
