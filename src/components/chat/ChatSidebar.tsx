"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Hash, Plus, Pin, Menu, X, Bell, BellOff } from "lucide-react";
import type { ChannelSidebarItem } from "@/types/channel";

export interface AgentDM {
  id: string;
  name: string;
  emoji: string;
  color: string;
  subtitle: string;
  sessionKey: string;
  online: boolean;
  unreadCount: number;
}

interface ChatSidebarProps {
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  agents: AgentDM[];
  channels: ChannelSidebarItem[];
  activeSessionKey: string;
  onSelectAgent: (sessionKey: string) => void;
  onSelectChannel: (sessionKey: string) => void;
  onCreateChannel: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  // Mobile: controlled drawer
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function ChatSidebar({
  connectionStatus,
  agents,
  channels,
  activeSessionKey,
  onSelectAgent,
  onSelectChannel,
  onCreateChannel,
  soundEnabled,
  onToggleSound,
  mobileOpen,
  onMobileClose,
}: ChatSidebarProps) {
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

  const sortedChannels = [...channels].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const handleSelectAgent = (sessionKey: string) => {
    onSelectAgent(sessionKey);
    onMobileClose?.();
  };

  const handleSelectChannel = (sessionKey: string) => {
    onSelectChannel(sessionKey);
    onMobileClose?.();
  };

  const sidebarContent = (
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {onToggleSound && (
            <button
              onClick={onToggleSound}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                color: soundEnabled ? "var(--accent)" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
            >
              {soundEnabled ? (
                <Bell style={{ width: 14, height: 14 }} />
              ) : (
                <BellOff style={{ width: 14, height: 14 }} />
              )}
            </button>
          )}
          {/* Mobile close */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
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
            boxShadow: connectionStatus === "connected" ? `0 0 6px ${statusColors[connectionStatus]}` : undefined,
          }}
        />
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          {statusLabels[connectionStatus]}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Channels section */}
        <div style={{ padding: "12px 0" }}>
          <div
            style={{
              padding: "0 16px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: "var(--font-heading)",
              }}
            >
              Channels
            </span>
            <button
              onClick={onCreateChannel}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
                borderRadius: "4px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
              title="Create channel"
            >
              <Plus style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {sortedChannels.map((channel) => {
            const isActive = channel.sessionKey === activeSessionKey;
            return (
              <div
                key={channel.id}
                onClick={() => handleSelectChannel(channel.sessionKey)}
                style={{
                  padding: "6px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backgroundColor: isActive ? "var(--accent-soft)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Hash style={{ width: 14, height: 14, color: isActive ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {channel.name.replace("#", "")}
                </span>
                {channel.pinned && <Pin style={{ width: 10, height: 10, color: "var(--text-muted)", flexShrink: 0 }} />}
                {channel.unreadCount > 0 && (
                  <div
                    style={{
                      minWidth: "16px",
                      height: "16px",
                      borderRadius: "8px",
                      backgroundColor: "#FF3B30",
                      color: "white",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Direct Messages section */}
        <div style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
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

          {agents.map((agent) => {
            const isActive = agent.sessionKey === activeSessionKey;
            return (
              <div
                key={agent.id}
                onClick={() => handleSelectAgent(agent.sessionKey)}
                style={{
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: isActive ? "var(--accent-soft)" : "transparent",
                  borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `2px solid ${agent.color}`,
                      backgroundColor: "var(--surface)",
                      fontSize: "14px",
                    }}
                  >
                    {agent.emoji}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-1px",
                      right: "-1px",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: agent.online ? "#3fb950" : "#484f58",
                      border: "2px solid var(--surface)",
                      boxShadow: agent.online ? "0 0 4px #3fb950" : undefined,
                    }}
                  />
                  {agent.unreadCount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-6px",
                        minWidth: "16px",
                        height: "16px",
                        borderRadius: "8px",
                        backgroundColor: "#FF3B30",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                        lineHeight: 1,
                      }}
                    >
                      {agent.unreadCount > 99 ? "99+" : agent.unreadCount}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "13px", fontWeight: isActive ? 600 : 500, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {agent.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {agent.subtitle}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <div className="chat-sidebar-desktop">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onMobileClose?.(); }}
        >
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              position: "absolute",
              inset: 0,
            }}
            onClick={onMobileClose}
          />
          <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
