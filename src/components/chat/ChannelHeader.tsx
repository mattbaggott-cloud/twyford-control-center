"use client";

import { Hash, Users, Settings, Wifi, WifiOff, FileText, Menu } from "lucide-react";
import type { Channel } from "@/types/channel";

interface ChannelHeaderProps {
  channel: Channel;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  onOpenSettings: () => void;
  onToggleCanvas: () => void;
  canvasOpen: boolean;
  onMobileMenu?: () => void;
}

export function ChannelHeader({
  channel,
  connectionStatus,
  onOpenSettings,
  onToggleCanvas,
  canvasOpen,
  onMobileMenu,
}: ChannelHeaderProps) {
  const isDisconnected =
    connectionStatus === "disconnected" || connectionStatus === "error";

  return (
    <div
      style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Mobile hamburger */}
        {onMobileMenu && (
          <button
            onClick={onMobileMenu}
            className="mobile-hamburger"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
              borderRadius: "4px",
              display: "none",
              alignItems: "center",
            }}
          >
            <Menu style={{ width: 20, height: 20 }} />
          </button>
        )}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--accent-soft)",
            border: "1px solid var(--border)",
          }}
        >
          <Hash style={{ width: 16, height: 16, color: "var(--accent)" }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              margin: 0,
            }}
          >
            {channel.name}
          </h1>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {channel.description && (
              <>
                <span>{channel.description}</span>
                <span>•</span>
              </>
            )}
            <Users style={{ width: 11, height: 11 }} />
            <span>{channel.members.length} members</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Canvas toggle */}
        <button
          onClick={onToggleCanvas}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "6px",
            color: canvasOpen ? "var(--accent)" : "var(--text-muted)",
            backgroundColor: canvasOpen ? "var(--accent-soft)" : "transparent",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            if (!canvasOpen) {
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!canvasOpen) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }
          }}
          title="Toggle canvas"
        >
          <FileText style={{ width: 16, height: 16 }} />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "6px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          title="Channel settings"
        >
          <Settings style={{ width: 16, height: 16 }} />
        </button>

        {/* Connection indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "6px",
            backgroundColor: isDisconnected
              ? "var(--negative-soft)"
              : "var(--positive-soft)",
            fontSize: "12px",
            color: isDisconnected ? "var(--negative)" : "var(--positive)",
          }}
        >
          {isDisconnected ? (
            <WifiOff style={{ width: 14, height: 14 }} />
          ) : (
            <Wifi style={{ width: 14, height: 14 }} />
          )}
          {connectionStatus === "connecting"
            ? "Connecting…"
            : connectionStatus === "connected"
            ? "Live"
            : connectionStatus === "error"
            ? "Error"
            : "Offline"}
        </div>
      </div>
    </div>
  );
}
