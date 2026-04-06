"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatSidebar, AgentDM } from "@/components/chat/ChatSidebar";
import { MessageThread } from "@/components/chat/MessageThread";
import { ComposeBar } from "@/components/chat/ComposeBar";
import { MessageBubbleProps } from "@/components/chat/MessageBubble";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { CreateChannelDialog } from "@/components/chat/CreateChannelDialog";
import { ChannelSettingsDialog } from "@/components/chat/ChannelSettingsDialog";
import { CanvasPanel } from "@/components/chat/CanvasPanel";
import { ChannelThreadList, groupMessagesIntoThreads } from "@/components/chat/ChannelThreadList";
import { ChannelThreadDetail } from "@/components/chat/ChannelThreadDetail";
import { GatewayWS, ChatMessage } from "@/lib/gateway-ws";
import { Wifi, WifiOff } from "lucide-react";
import type { Channel, ChannelSidebarItem } from "@/types/channel";
import { channelSessionKey, isChannelSession, channelIdFromSession } from "@/types/channel";

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

/**
 * Parse @mentions in a message to determine which agent to route to.
 * Returns the session key of the mentioned agent, or null for default routing.
 */
function parseMentionRouting(text: string): string | null {
  const mentionPattern = /@(\w+)/gi;
  const mentions = text.match(mentionPattern);
  if (!mentions) return null;

  for (const mention of mentions) {
    const name = mention.slice(1).toLowerCase();
    const agent = AGENTS.find((a) => a.name.toLowerCase() === name);
    if (agent) return agent.sessionKey;
  }
  return null;
}

export default function ChatPage() {
  const [activeSessionKey, setActiveSessionKey] = useState<string>("main");
  const [messages, setMessages] = useState<MessageBubbleProps[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, boolean>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Channel state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadIndex, setActiveThreadIndex] = useState<number | null>(null);

  // Message cache: Map<sessionKey, MessageBubbleProps[]>
  const messageCacheRef = useRef<Map<string, MessageBubbleProps[]>>(new Map());
  const gatewayRef = useRef<GatewayWS | null>(null);
  const activeSessionRef = useRef<string>("main");
  const activeThreadIndexRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    activeSessionRef.current = activeSessionKey;
  }, [activeSessionKey]);

  useEffect(() => {
    activeThreadIndexRef.current = activeThreadIndex;
  }, [activeThreadIndex]);

  const activeAgent = getAgentBySessionKey(activeSessionKey);
  const isChannelActive = isChannelSession(activeSessionKey);
  const activeChannel = isChannelActive
    ? channels.find((c) => channelSessionKey(c.id) === activeSessionKey)
    : null;

  // Build AgentDM list for sidebar
  const agentDMs: AgentDM[] = AGENTS.map((a) => ({
    ...a,
    online: agentStatuses[a.id] ?? true,
    unreadCount: unreadCounts[a.sessionKey] ?? 0,
  }));

  // Build channel sidebar items
  const channelSidebarItems: ChannelSidebarItem[] = channels
    .filter((c) => !c.archived)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      memberCount: c.members.length,
      pinned: c.pinned,
      sessionKey: channelSessionKey(c.id),
      unreadCount: unreadCounts[channelSessionKey(c.id)] ?? 0,
    }));

  // Fetch A2A threads
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions/threads?limit=50");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    fetchThreads();
    // Refresh threads periodically (every 10s fallback)
    const interval = setInterval(fetchThreads, 10000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

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
          statuses["woods"] = true;
          setAgentStatuses(statuses);
        }
      } catch {
        // Non-fatal
      }
    }
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const isInThread = isChannelSession(activeSessionRef.current) && activeThreadIndexRef.current !== null;
      const userMsg: MessageBubbleProps = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        isThreadReply: isInThread,
      };
      setMessages((prev) => {
        const updated = [...prev, userMsg];
        messageCacheRef.current.set(activeSessionRef.current, updated);
        return updated;
      });

      if (gatewayRef.current) {
        try {
          // @mention routing: if in a channel and user mentions an agent, route to that agent
          const mentionTarget = parseMentionRouting(text);
          if (mentionTarget && isChannelSession(activeSessionRef.current)) {
            await gatewayRef.current.sendMessageToSession(text, mentionTarget);
          } else {
            await gatewayRef.current.sendMessage(text);
          }
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

  const handleSelectSession = useCallback(
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

      // Reset thread view and canvas when switching sessions
      setActiveThreadIndex(null);
      if (!isChannelSession(sessionKey)) {
        setShowCanvas(false);
      }

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
          // For channels, agent name comes from the message itself
          const fallbackName = isChannelSession(sessionKey)
            ? "Woods"
            : getAgentBySessionKey(sessionKey).name;
          const bubbles = freshMessages.map((msg) => chatMessageToBubble(msg, fallbackName));
          setMessages(bubbles);
          messageCacheRef.current.set(sessionKey, bubbles);
        } catch (err) {
          console.error("[Chat] Failed to switch session:", err);
        }
      }
    },
    [messages]
  );

  const handleChannelCreated = useCallback(
    async (channel: Channel) => {
      await fetchChannels();
      // Switch to the new channel
      handleSelectSession(channelSessionKey(channel.id));
    },
    [fetchChannels, handleSelectSession]
  );

  const handleChannelUpdated = useCallback(
    async () => {
      await fetchChannels();
    },
    [fetchChannels]
  );

  const handleChannelArchived = useCallback(
    async () => {
      await fetchChannels();
      // Switch to #general if the active channel was archived
      handleSelectSession(channelSessionKey("general"));
    },
    [fetchChannels, handleSelectSession]
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
        const agentName = isChannelSession(activeSessionRef.current)
          ? "Woods"
          : getAgentBySessionKey(activeSessionRef.current).name;
        const bubbles = history.map((msg) => chatMessageToBubble(msg, agentName));
        setMessages(bubbles);
        messageCacheRef.current.set(activeSessionRef.current, bubbles);
      },
      onMessage: (msg) => {
        // Refresh threads when a new message arrives — catches A2A delegations
        fetchThreads();

        const activeAgentName = isChannelSession(activeSessionRef.current)
          ? "Woods"
          : getAgentBySessionKey(activeSessionRef.current).name;
        const bubble = chatMessageToBubble(msg, activeAgentName);
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
            const agentName = isChannelSession(activeSessionRef.current)
              ? "Woods"
              : getAgentBySessionKey(activeSessionRef.current).name;
            updated = [
              ...prev,
              {
                role: "assistant" as const,
                content: chunk.content,
                timestamp: new Date().toISOString(),
                agent: agentName,
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

  // Compose placeholder
  const composePlaceholder = isDisconnected
    ? "Reconnecting to gateway…"
    : isChannelActive && activeThreadIndex !== null
    ? `Reply in thread… (use @Ford or @Woods to direct)`
    : isChannelActive && activeChannel
    ? `Start a new thread in ${activeChannel.name}…`
    : `Message ${activeAgent.name}…`;

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
        channels={channelSidebarItems}
        activeSessionKey={activeSessionKey}
        onSelectAgent={handleSelectSession}
        onSelectChannel={handleSelectSession}
        onCreateChannel={() => setShowCreateChannel(true)}
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
        {/* Header — channel or agent */}
        {isChannelActive && activeChannel ? (
          <ChannelHeader
            channel={activeChannel}
            connectionStatus={connectionStatus}
            onOpenSettings={() => setShowChannelSettings(true)}
            onToggleCanvas={() => setShowCanvas(!showCanvas)}
            canvasOpen={showCanvas}
          />
        ) : (
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
        )}

        {/* Messages — threaded view for channels, flat for DMs */}
        {isChannelActive && activeThreadIndex === null ? (
          <ChannelThreadList
            threads={groupMessagesIntoThreads(messages)}
            onSelectThread={(idx) => setActiveThreadIndex(idx)}
          />
        ) : isChannelActive && activeThreadIndex !== null ? (
          (() => {
            const channelThreads = groupMessagesIntoThreads(messages);
            const activeThread = channelThreads[activeThreadIndex];
            if (!activeThread) return null;
            return (
              <ChannelThreadDetail
                parentMessage={activeThread.parentMessage}
                replies={activeThread.replies}
                onBack={() => setActiveThreadIndex(null)}
                a2aThreads={threads}
              />
            );
          })()
        ) : (
          <MessageThread
            messages={messages}
            isLoading={connectionStatus === "connecting"}
            threads={threads}
          />
        )}

        {/* Compose */}
        <ComposeBar
          onSend={handleSend}
          disabled={isDisconnected}
          placeholder={composePlaceholder}
        />
      </div>

      {/* Canvas Panel */}
      {isChannelActive && activeChannel && (
        <CanvasPanel
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          open={showCanvas}
          onClose={() => setShowCanvas(false)}
        />
      )}

      {/* Dialogs */}
      <CreateChannelDialog
        open={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreated={handleChannelCreated}
        availableAgents={AGENTS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji }))}
      />

      {showChannelSettings && activeChannel && (
        <ChannelSettingsDialog
          open={showChannelSettings}
          channel={activeChannel}
          onClose={() => setShowChannelSettings(false)}
          onUpdated={handleChannelUpdated}
          onArchived={handleChannelArchived}
          availableAgents={AGENTS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji }))}
        />
      )}
    </div>
  );
}
