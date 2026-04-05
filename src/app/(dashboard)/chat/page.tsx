"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatSidebar, AgentDM } from "@/components/chat/ChatSidebar";
import { MessageThread } from "@/components/chat/MessageThread";
import { ComposeBar } from "@/components/chat/ComposeBar";
import { MessageBubbleProps } from "@/components/chat/MessageBubble";
import { GatewayWS, ChatMessage } from "@/lib/gateway-ws";
import { Wifi, WifiOff } from "lucide-react";

// Gateway WebSocket configuration
const WS_URL = "ws://127.0.0.1:18789";
const WS_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || "";

// Agent definitions
const AGENTS: { id: string; name: string; emoji: string; color: string; subtitle: string; sessionKey: string }[] = [
  { id: "woods", name: "Woods", emoji: "🦞", color: "#3fb950", subtitle: "Chief of Staff", sessionKey: "main" },
  { id: "ford", name: "Ford", emoji: "👨🏻‍💻", color: "#FF3B30", subtitle: "Full Stack Engineer", sessionKey: "agent:ford:main" },
];

function chatMessageToBubble(msg: ChatMessage, fallbackAgent?: string): MessageBubbleProps {
  return {
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    agent: msg.role === "assistant" ? (msg.agent || fallbackAgent) : undefined,
  };
}

function getAgentBySessionKey(sessionKey: string) {
  return AGENTS.find((a) => a.sessionKey === sessionKey) || AGENTS[0];
}

export default function ChatPage() {
  const [activeSessionKey, setActiveSessionKey] = useState<string>("main");
  const [messages, setMessages] = useState<MessageBubbleProps[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, boolean>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Message cache: Map<sessionKey, MessageBubbleProps[]>
  const messageCacheRef = useRef<Map<string, MessageBubbleProps[]>>(new Map());
  const gatewayRef = useRef<GatewayWS | null>(null);
  const activeSessionRef = useRef<string>("main");

  // Keep ref in sync with state
  useEffect(() => {
    activeSessionRef.current = activeSessionKey;
  }, [activeSessionKey]);

  const activeAgent = getAgentBySessionKey(activeSessionKey);

  // Build AgentDM list for sidebar
  const agentDMs: AgentDM[] = AGENTS.map((a) => ({
    ...a,
    online: agentStatuses[a.id] ?? true, // default to online for Woods
    unreadCount: unreadCounts[a.sessionKey] ?? 0,
  }));

  // Poll agent statuses
  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          const statuses: Record<string, boolean> = {};
          if (Array.isArray(data.agents)) {
            for (const agent of data.agents) {
              const match = AGENTS.find(
                (a) => a.id === agent.id || a.name.toLowerCase() === agent.name?.toLowerCase()
              );
              if (match) {
                statuses[match.id] = agent.online ?? agent.status === "online";
              }
            }
          }
          // Woods (main agent) is always "online" if gateway is connected
          statuses["woods"] = true;
          setAgentStatuses(statuses);
        }
      } catch {
        // Non-fatal — keep existing statuses
      }
    }
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: MessageBubbleProps = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        messageCacheRef.current.set(activeSessionRef.current, updated);
        return updated;
      });

      if (gatewayRef.current) {
        try {
          await gatewayRef.current.sendMessage(text);
        } catch (err) {
          console.error("[Chat] Failed to send message:", err);
          setMessages((prev) => {
            const updated = [
              ...prev,
              {
                role: "system" as const,
                content: "Failed to send message. Check your connection.",
                timestamp: new Date().toISOString(),
              },
            ];
            messageCacheRef.current.set(activeSessionRef.current, updated);
            return updated;
          });
        }
      }
    },
    []
  );

  const handleSelectAgent = useCallback(
    async (sessionKey: string) => {
      if (sessionKey === activeSessionRef.current) return;

      // Save current messages to cache
      messageCacheRef.current.set(activeSessionRef.current, messages);

      // Clear unread for the session we're switching to
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[sessionKey];
        return updated;
      });

      // Update active session
      setActiveSessionKey(sessionKey);
      activeSessionRef.current = sessionKey;

      // Show cached messages immediately if available
      const cached = messageCacheRef.current.get(sessionKey);
      if (cached) {
        setMessages(cached);
      } else {
        setMessages([]);
      }

      // Switch session on gateway and load fresh history
      if (gatewayRef.current) {
        try {
          const freshMessages = await gatewayRef.current.switchSession(sessionKey);
          const switchedAgentName = getAgentBySessionKey(sessionKey).name;
          const bubbles = freshMessages.map((msg) => chatMessageToBubble(msg, switchedAgentName));
          setMessages(bubbles);
          messageCacheRef.current.set(sessionKey, bubbles);
        } catch (err) {
          console.error("[Chat] Failed to switch session:", err);
          // Keep cached messages if load fails
        }
      }
    },
    [messages]
  );

  useEffect(() => {
    if (!WS_TOKEN) {
      console.warn(
        "[Chat] No gateway token configured. Set NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN in .env.local"
      );
      setConnectionStatus("error");
      return;
    }

    const gw = new GatewayWS({
      url: WS_URL,
      token: WS_TOKEN,
      sessionKey: "main",
      onStatus: (status) => {
        setConnectionStatus(status);
      },
      onHistory: (history) => {
        const agentName = getAgentBySessionKey(activeSessionRef.current).name;
        const bubbles = history.map((msg) => chatMessageToBubble(msg, agentName));
        setMessages(bubbles);
        messageCacheRef.current.set(activeSessionRef.current, bubbles);
      },
      onMessage: (msg) => {
        const activeAgentName = getAgentBySessionKey(activeSessionRef.current).name;
        const bubble = chatMessageToBubble(msg, activeAgentName);
        // If the message is for the active session, show it
        // Otherwise, increment unread count
        // Since gateway sends events for the current session context,
        // messages received are for the active session
        setMessages((prev) => {
          const streamIdx = prev.findIndex(
            (m) => m.role === "assistant" && m.isStreaming
          );
          let updated: MessageBubbleProps[];
          if (streamIdx >= 0) {
            updated = [...prev];
            updated[streamIdx] = { ...bubble, isStreaming: false };
          } else {
            updated = [...prev, { ...bubble, isStreaming: false }];
          }
          messageCacheRef.current.set(activeSessionRef.current, updated);
          return updated;
        });
      },
      onStream: (chunk) => {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const last = lastIdx >= 0 ? prev[lastIdx] : null;
          let updated: MessageBubbleProps[];
          if (last && last.role === "assistant" && last.isStreaming) {
            updated = [...prev];
            updated[lastIdx] = {
              ...last,
              content: last.content + chunk.content,
            };
          } else {
            const agent = getAgentBySessionKey(activeSessionRef.current);
            updated = [
              ...prev,
              {
                role: "assistant" as const,
                content: chunk.content,
                timestamp: new Date().toISOString(),
                agent: agent.name,
                isStreaming: true,
              },
            ];
          }
          messageCacheRef.current.set(activeSessionRef.current, updated);
          return updated;
        });
      },
    });

    gatewayRef.current = gw;
    gw.connect();

    return () => {
      gw.disconnect();
      gatewayRef.current = null;
    };
  }, []);

  const isDisconnected =
    connectionStatus === "disconnected" || connectionStatus === "error";

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 48px - 32px)",
        margin: "-24px",
        overflow: "hidden",
      }}
    >
      {/* Chat Sidebar */}
      <ChatSidebar
        connectionStatus={connectionStatus}
        agents={agentDMs}
        activeSessionKey={activeSessionKey}
        onSelectAgent={handleSelectAgent}
      />

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          backgroundColor: "var(--bg)",
        }}
      >
        {/* Channel Header — dynamic per active agent */}
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
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${activeAgent.color}`,
                backgroundColor: "var(--surface)",
                fontSize: "16px",
              }}
            >
              {activeAgent.emoji}
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
                {activeAgent.name}
              </h1>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {activeAgent.subtitle} • OpenClaw Agent
              </div>
            </div>
          </div>

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

        {/* Messages */}
        <MessageThread
          messages={messages}
          isLoading={connectionStatus === "connecting"}
        />

        {/* Compose — dynamic placeholder */}
        <ComposeBar
          onSend={handleSend}
          disabled={isDisconnected}
          placeholder={
            isDisconnected
              ? "Reconnecting to gateway…"
              : `Message ${activeAgent.name}…`
          }
        />
      </div>
    </div>
  );
}
