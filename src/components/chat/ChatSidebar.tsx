"use client";

import { MessageSquare } from "lucide-react";

interface ChatSidebarProps {
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
}

export function ChatSidebar({ connectionStatus }: ChatSidebarProps) {
  const statusColors: Record<string, string> = {
    connecting: "var(--warning)",
    connected: "var(--positive)",
    disconnected: "var(--text-muted)",
    error: "var(--negative)",
  };

  const statusLabels: Record<string, string> = {
    connecting: "Connecting…",
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Connection Error",
  };

  return (
    <div
      style={{
        width: "240px",
        minWidth: "240px",
        height: "100%",
        backgroundColor: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-heading)",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <MessageSquare style={{ width: 16, height: 16, color: "var(--accent)" }} />
          Messages
        </h2>
      </div>

      {/* Connection status */}
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: statusColors[connectionStatus],
            boxShadow: connectionStatus === "connected"
              ? `0 0 6px ${statusColors[connectionStatus]}`
              : undefined,
          }}
        />
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          {statusLabels[connectionStatus]}
        </span>
      </div>

      {/* Direct Messages section */}
      <div style={{ padding: "12px 0", flex: 1 }}>
        <div
          style={{
            padding: "0 16px 8px",
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: "var(--font-heading)",
          }}
        >
          Direct Messages
        </div>

        {/* Woods DM — active */}
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "var(--accent-soft)",
            borderLeft: "3px solid var(--accent)",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #3fb950",
              backgroundColor: "var(--surface)",
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            🦞
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Woods
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Chief of Staff
            </div>
          </div>
        </div>

        {/* Ford DM — placeholder */}
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #FF3B30",
              backgroundColor: "var(--surface)",
              fontSize: "14px",
              flexShrink: 0,
            }}
          >
            👨🏻‍💻
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
              Ford
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Full Stack Engineer
            </div>
          </div>
        </div>
      </div>

      {/* Channels placeholder */}
      <div
        style={{
          padding: "12px 0",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            padding: "0 16px 8px",
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: "var(--font-heading)",
          }}
        >
          Channels
        </div>
        <div
          style={{
            padding: "8px 16px",
            fontSize: "12px",
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          Coming in Sprint 3
        </div>
      </div>
    </div>
  );
}
