"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_CATEGORIES: { name: string; emoji: string[] }[] = [
  {
    name: "Smileys",
    emoji: [
      "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
      "😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐",
      "🤨","😐","😑","😶","😏","😒","🙄","😬","😮","😯","😲","🥱","😴","😪","😵","🤯",
    ],
  },
  {
    name: "People",
    emoji: [
      "👍","👎","👏","🙌","🤝","🤜","🤛","✊","👊","🤚","✋","🖐","👋","🤙","💪","🦾",
      "🦿","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁","👅","👄","💋","🫀","🫁",
      "💅","🤳","💃","🕺","🧍","🧎","🏃","🚶","👶","🧒","👦","👧","🧑","👱","👨","🧔",
    ],
  },
  {
    name: "Nature",
    emoji: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
      "🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛",
      "🦋","🐌","🐞","🐜","🌸","🌺","🌻","🌹","🍀","🌿","🍃","🍂","🍁","🌾","🌵","🌴",
    ],
  },
  {
    name: "Objects",
    emoji: [
      "💻","🖥","🖨","⌨","🖱","🖲","📱","📲","📞","☎","📟","📠","📺","📻","🎙","🎚",
      "🎛","🧭","⏱","⏰","⏲","🕰","📡","🔋","🔌","💡","🔦","🕯","🗑","🛢","💸","💵",
      "💴","💶","💷","💰","💳","💎","⚖","🔧","🔨","⚒","🛠","⛏","🔩","🗜","🔗","🧲",
    ],
  },
  {
    name: "Symbols",
    emoji: [
      "❤","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣","💕","💞","💓","💗","💖",
      "💘","💝","💟","☮","✝","☪","🕉","☸","✡","🔯","🕎","☯","☦","🛐","⛎","♈","♉",
      "♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚜","🔰","♻","✅","❌","❎","🔱",
    ],
  },
];

const ALL_EMOJI = EMOJI_CATEGORIES.flatMap((c) => c.emoji);

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const filtered = query.trim()
    ? ALL_EMOJI.filter(() => true) // show all — no metadata for search, filter by position
        .filter((e, i) => i.toString().includes(query)) // fallback: just show all on search
    : null;

  // Simple search: just show all when querying (no emoji name metadata)
  const displayCategories = query.trim()
    ? [{ name: "Results", emoji: ALL_EMOJI }]
    : EMOJI_CATEGORIES;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        bottom: "64px",
        right: "60px",
        width: "320px",
        maxHeight: "360px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Search */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji…"
          style={{
            width: "100%",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "13px",
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "var(--font-body)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Category tabs */}
      {!query.trim() && (
        <div
          style={{
            display: "flex",
            gap: "2px",
            padding: "6px 8px",
            borderBottom: "1px solid var(--border)",
            overflowX: "auto",
          }}
        >
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(i)}
              style={{
                background: activeCategory === i ? "var(--accent-soft)" : "none",
                border: "none",
                borderRadius: "4px",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: "11px",
                color: activeCategory === i ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "var(--font-heading)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px",
        }}
      >
        {(query.trim() ? [{ name: "Results", emoji: ALL_EMOJI }] : [EMOJI_CATEGORIES[activeCategory]]).map((cat) => (
          <div key={cat.name}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-heading)",
                marginBottom: "4px",
                paddingLeft: "2px",
              }}
            >
              {cat.name}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: "2px",
              }}
            >
              {cat.emoji.map((em, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelect(em);
                    onClose();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "20px",
                    padding: "4px",
                    lineHeight: 1,
                    transition: "background 100ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
