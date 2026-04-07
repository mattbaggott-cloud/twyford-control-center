"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Menu } from "lucide-react";
import { ChatSidebar, AgentDM } from "@/components/chat/ChatSidebar";
import { MessageThread } from "@/components/chat/MessageThread";
import { ComposeBar } from "@/components/chat/ComposeBar";
import { MessageBubble, MessageBubbleProps } from "@/components/chat/MessageBubble";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { CreateChannelDialog } from "@/components/chat/CreateChannelDialog";
import { ChannelSettingsDialog } from "@/components/chat/ChannelSettingsDialog";
import { CanvasPanel } from "@/components/chat/CanvasPanel";
import { ChannelThreadList, groupMessagesIntoThreads } from "@/components/chat/ChannelThreadList";
import { ChannelThreadDetail } from "@/components/chat/ChannelThreadDetail";
import { NotificationToast, ToastNotification, useNotificationSound, showDesktopNotification } from "@/components/chat/NotificationToast";
import { MessageSearch, SearchResult } from "@/components/chat/MessageSearch";
import { ReplyBar, ReplyTarget } from "@/components/chat/ReplyBar";
import { FileAttachmentStrip, DragOverlay, useFileAttachments } from "@/components/chat/FileUpload";
import { ReactionsData } from "@/components/chat/MessageReactions";
import { GatewayWS, ChatMessage } from "@/lib/gateway-ws";
import { Wifi, WifiOff } from "lucide-react";
import type { Channel, ChannelSidebarItem } from "@/types/channel";
import { channelSessionKey, isChannelSession, channelIdFromSession } from "@/types/channel";

const WS_URL = "ws://127.0.0.1:18789";
const WS_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || "";

const AGENTS: { id: string; name: string; emoji: string; color: string; subtitle: string; sessionKey: string }[] = [
  { id: "woods", name: "Woods", emoji: "🦞", color: "#3fb950", subtitle: "Chief of Staff", sessionKey: "main" },
  { id: "ford", name: "Ford", emoji: "👨🏻‍💻", color: "#FF3B30", subtitle: "Full Stack Engineer", sessionKey: "agent:ford:main" },
];

function chatMessageToBubble(msg: ChatMessage, fallbackAgent?: string): MessageBubbleProps {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    agent: msg.role === "assistant" ? (msg.agent || fallbackAgent) : undefined,
  };
}

function getAgentBySessionKey(sessionKey: string) {
  return AGENTS.find((a) => a.sessionKey === sessionKey) || AGENTS[0];
}

function getSessionLabel(sessionKey: string, channels: Channel[]): string {
  if (isChannelSession(sessionKey)) {
    const id = channelIdFromSession(sessionKey);
    const ch = channels.find((c) => c.id === id);
    return ch ? `#${ch.name}` : sessionKey;
  }
  return getAgentBySessionKey(sessionKey).name;
}

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
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [agentStatuses, setAgentStatuses] = useState<Record<string, boolean>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Channel state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [showCanvas, setShowCanvas] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadIndex, setActiveThreadIndex] = useState<number | null>(null);

  // Sprint 6 state
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [reactions, setReactions] = useState<ReactionsData>({});
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const { playChime, setEnabled: setSoundEnabledPref, isEnabled: getSoundEnabled } = useNotificationSound();

  // File attachments
  const { attachments, addFiles, removeAttachment, clearAttachments, isDragOver, setIsDragOver } = useFileAttachments();

  const messageCacheRef = useRef<Map<string, MessageBubbleProps[]>>(new Map());
  const gatewayRef = useRef<GatewayWS | null>(null);
  const activeSessionRef = useRef<string>("main");
  const activeThreadIndexRef = useRef<number | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const composeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { activeSessionRef.current = activeSessionKey; }, [activeSessionKey]);
  useEffect(() => { activeThreadIndexRef.current = activeThreadIndex; }, [activeThreadIndex]);

  // Load sound preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSoundEnabled(localStorage.getItem("notif-sound") === "true");
    }
  }, []);

  // Load reactions for active session
  useEffect(() => {
    async function loadReactions() {
      try {
        const res = await fetch(`/api/chat/reactions?sessionKey=${encodeURIComponent(activeSessionKey)}`);
        if (res.ok) {
          const data = await res.json();
          setReactions(data.reactions || {});
        }
      } catch { /* non-fatal */ }
    }
    loadReactions();
  }, [activeSessionKey]);

  const activeAgent = getAgentBySessionKey(activeSessionKey);
  const isChannelActive = isChannelSession(activeSessionKey);
  const activeChannel = isChannelActive ? channels.find((c) => channelSessionKey(c.id) === activeSessionKey) : null;

  const agentDMs: AgentDM[] = AGENTS.map((a) => ({
    ...a,
    online: agentStatuses[a.id] ?? true,
    unreadCount: unreadCounts[a.sessionKey] ?? 0,
  }));

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

  // Global keyboard shortcuts
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+K — search
      if (cmdKey && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }

      // Cmd+N — focus compose
      if (cmdKey && e.key === "n") {
        e.preventDefault();
        const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
        textarea?.focus();
        return;
      }

      // Escape — close modals
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileSidebarOpen(false);
      }
    }

    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Drag-and-drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles, setIsDragOver]);

  // Send message with optional file attachments
  const handleSend = useCallback(async (text: string) => {
    let messageText = text;

    // Handle reply prefix
    if (replyTo) {
      messageText = `[reply to: ${replyTo.sender}: ${replyTo.preview}]\n${text}`;
      setReplyTo(null);
    }

    // Upload files if any
    if (attachments.length > 0) {
      try {
        const formData = new FormData();
        formData.append("sessionKey", activeSessionRef.current);
        for (const att of attachments) {
          formData.append("file", att.file);
        }
        const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          const fileParts = (data.files as { url: string; filename: string; type: string }[]).map((f) => {
            if (f.type.startsWith("image/")) {
              return `![${f.filename}](${f.url})`;
            }
            return `[${f.filename}](${f.url})`;
          });
          messageText = fileParts.join("\n") + (messageText ? "\n" + messageText : "");
        }
      } catch { /* non-fatal, still send the text */ }
      clearAttachments();
    }

    const isInThread = isChannelSession(activeSessionRef.current) && activeThreadIndexRef.current !== null;
    const userMsg: MessageBubbleProps = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
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
        const mentionTarget = parseMentionRouting(text);
        if (mentionTarget && isChannelSession(activeSessionRef.current)) {
          await gatewayRef.current.sendMessageToSession(messageText, mentionTarget);
        } else {
          await gatewayRef.current.sendMessage(messageText);
        }
      } catch (err) {
        console.error("[Chat] Failed to send message:", err);
        setMessages((prev) => {
          const updated = [...prev, { role: "system" as const, content: "Failed to send message.", timestamp: new Date().toISOString() }];
          messageCacheRef.current.set(activeSessionRef.current, updated);
          return updated;
        });
      }
    }
  }, [replyTo, attachments, clearAttachments]);

  // Edit last user message
  const handleEditLast = useCallback(() => {
    // Find last user message and trigger inline edit
    // We signal this via a custom event that MessageThread picks up
    const event = new CustomEvent("edit-last-message");
    document.dispatchEvent(event);
  }, []);

  const handleEditMessage = useCallback(async (id: string, newContent: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, content: newContent, isEdited: true }
          : m
      )
    );
    // Send as a new message with [edited] prefix
    if (gatewayRef.current) {
      try {
        await gatewayRef.current.sendMessage(`[edited] ${newContent}`);
      } catch { /* non-fatal */ }
    }
  }, []);

  const handleDeleteMessage = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, isDeleted: true, content: "[message deleted]" } : m
      )
    );
  }, []);

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      const res = await fetch("/api/chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: activeSessionRef.current, messageId, emoji, userId: "matt" }),
      });
      if (res.ok) {
        const data = await res.json();
        setReactions(data.reactions || {});
      }
    } catch { /* non-fatal */ }
  }, []);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight
      el.style.backgroundColor = "rgba(255,59,48,0.15)";
      setTimeout(() => { el.style.backgroundColor = ""; }, 1500);
    }
  }, []);

  const handleSelectSession = useCallback(async (sessionKey: string) => {
    if (sessionKey === activeSessionRef.current) return;

    messageCacheRef.current.set(activeSessionRef.current, messages);

    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[sessionKey];
      return updated;
    });

    setActiveSessionKey(sessionKey);
    activeSessionRef.current = sessionKey;
    setActiveThreadIndex(null);
    setReplyTo(null);
    if (!isChannelSession(sessionKey)) setShowCanvas(false);

    const cached = messageCacheRef.current.get(sessionKey);
    if (cached) setMessages(cached);
    else setMessages([]);

    if (gatewayRef.current) {
      try {
        const freshMessages = await gatewayRef.current.switchSession(sessionKey);
        const fallbackName = isChannelSession(sessionKey) ? "Woods" : getAgentBySessionKey(sessionKey).name;
        const bubbles = freshMessages.map((msg) => chatMessageToBubble(msg, fallbackName));
        setMessages(bubbles);
        messageCacheRef.current.set(sessionKey, bubbles);
      } catch (err) {
        console.error("[Chat] Failed to switch session:", err);
      }
    }
  }, [messages]);

  // Local search across cached messages
  const searchLocal = useCallback((query: string): SearchResult[] => {
    const results: SearchResult[] = [];
    const qLower = query.toLowerCase();

    for (const [sessionKey, msgs] of messageCacheRef.current.entries()) {
      const label = getSessionLabel(sessionKey, channels);
      for (const msg of msgs) {
        if (msg.role === "system" || msg.isDeleted) continue;
        if (!msg.content.toLowerCase().includes(qLower)) continue;
        results.push({
          sessionKey,
          sessionLabel: label,
          messageId: msg.id || msg.timestamp,
          sender: msg.role === "user" ? "Matt" : (msg.agent || label),
          timestamp: msg.timestamp,
          preview: msg.content.slice(0, 120),
        });
      }
    }
    return results.slice(0, 20);
  }, [channels]);

  const handleSearchNavigate = useCallback((sessionKey: string, messageId: string) => {
    handleSelectSession(sessionKey).then(() => {
      setTimeout(() => handleScrollToMessage(messageId), 300);
    });
  }, [handleSelectSession, handleScrollToMessage]);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions/threads?limit=50");
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 10000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          const statuses: Record<string, boolean> = {};
          if (Array.isArray(data.agents)) {
            for (const agent of data.agents) {
              const match = AGENTS.find((a) => a.id === agent.id || a.name.toLowerCase() === agent.name?.toLowerCase());
              if (match) statuses[match.id] = agent.online ?? agent.status === "online";
            }
          }
          statuses["woods"] = true;
          setAgentStatuses(statuses);
        }
      } catch { /* non-fatal */ }
    }
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!WS_TOKEN) {
      setConnectionStatus("error");
      return;
    }

    const gw = new GatewayWS({
      url: WS_URL,
      token: WS_TOKEN,
      sessionKey: "main",
      onStatus: (status) => setConnectionStatus(status),
      onHistory: (history) => {
        const agentName = isChannelSession(activeSessionRef.current) ? "Woods" : getAgentBySessionKey(activeSessionRef.current).name;
        const bubbles = history.map((msg) => chatMessageToBubble(msg, agentName));
        setMessages(bubbles);
        messageCacheRef.current.set(activeSessionRef.current, bubbles);
      },
      onMessage: (msg) => {
        // Filter internal protocol markers from real-time messages
        const trimmed = msg.content.trim();
        if (/^(NO_REPLY|REPLY_SKIP|ANNOUNCE_SKIP|HEARTBEAT_OK)$/.test(trimmed)) return;
        if (/Agent-to-agent announce/i.test(trimmed)) return;

        fetchThreads();
        const activeAgentName = isChannelSession(activeSessionRef.current) ? "Woods" : getAgentBySessionKey(activeSessionRef.current).name;
        const bubble = chatMessageToBubble(msg, activeAgentName);

        setMessages((prev) => {
          const streamIdx = prev.findIndex((m) => m.role === "assistant" && m.isStreaming);
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
            updated[lastIdx] = { ...last, content: last.content + chunk.content };
          } else {
            const agentName = isChannelSession(activeSessionRef.current) ? "Woods" : getAgentBySessionKey(activeSessionRef.current).name;
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
      onNotification: (sessionKey, msg, sessionLabel) => {
        // New message in a non-active session — show toast + desktop notif
        const preview = msg.content.slice(0, 80);
        const sender = msg.role === "user" ? "Matt" : (msg.agent || sessionLabel);
        const toastId = `${Date.now()}-${Math.random()}`;

        setToasts((prev) => [
          ...prev,
          {
            id: toastId,
            sessionKey,
            sessionLabel: sessionLabel || sessionKey,
            sender,
            preview,
            timestamp: Date.now(),
          },
        ]);

        // Increment unread
        setUnreadCounts((prev) => ({
          ...prev,
          [sessionKey]: (prev[sessionKey] || 0) + 1,
        }));

        // Sound
        playChime();

        // Desktop notification
        showDesktopNotification(`${sender} in ${sessionLabel}`, preview);
      },
    });

    gatewayRef.current = gw;
    gw.connect();

    return () => {
      gw.disconnect();
      gatewayRef.current = null;
    };
  }, []);

  const handleChannelCreated = useCallback(async (channel: Channel) => {
    await fetchChannels();
    handleSelectSession(channelSessionKey(channel.id));
  }, [fetchChannels, handleSelectSession]);

  const handleChannelUpdated = useCallback(async () => { await fetchChannels(); }, [fetchChannels]);

  const handleChannelArchived = useCallback(async () => {
    await fetchChannels();
    handleSelectSession(channelSessionKey("general"));
  }, [fetchChannels, handleSelectSession]);

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    setSoundEnabledPref(newVal);
  };

  const isDisconnected = connectionStatus === "disconnected" || connectionStatus === "error";

  const composePlaceholder = isDisconnected
    ? "Reconnecting to gateway…"
    : isChannelActive && activeThreadIndex !== null
    ? `Reply in thread… (use @Ford or @Woods to direct)`
    : isChannelActive && activeChannel
    ? `Start a new thread in ${activeChannel.name}…`
    : `Message ${activeAgent.name}…`;

  return (
    <div
      style={{ display: "flex", height: "calc(100vh - 48px - 32px)", margin: "-24px", overflow: "hidden", position: "relative" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <DragOverlay visible={isDragOver} />

      {/* Toast notifications */}
      <NotificationToast
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onNavigate={handleSelectSession}
      />

      {/* Search modal */}
      <MessageSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleSearchNavigate}
        searchLocal={searchLocal}
      />

      {/* Sidebar — desktop always visible, mobile via drawer */}
      <div className="chat-sidebar-desktop-wrapper" style={{ height: "100%" }}>
        <ChatSidebar
          connectionStatus={connectionStatus}
          agents={agentDMs}
          channels={channelSidebarItems}
          activeSessionKey={activeSessionKey}
          onSelectAgent={handleSelectSession}
          onSelectChannel={handleSelectSession}
          onCreateChannel={() => setShowCreateChannel(true)}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Chat Area */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, backgroundColor: "var(--bg)" }}
      >
        {/* Header */}
        {isChannelActive && activeChannel ? (
          <ChannelHeader
            channel={activeChannel}
            connectionStatus={connectionStatus}
            onOpenSettings={() => setShowChannelSettings(true)}
            onToggleCanvas={() => setShowCanvas(!showCanvas)}
            canvasOpen={showCanvas}
            onMobileMenu={() => setMobileSidebarOpen(true)}
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
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
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
                backgroundColor: isDisconnected ? "var(--negative-soft)" : "var(--positive-soft)",
                fontSize: "12px",
                color: isDisconnected ? "var(--negative)" : "var(--positive)",
              }}
            >
              {isDisconnected ? (
                <WifiOff style={{ width: 14, height: 14 }} />
              ) : (
                <Wifi style={{ width: 14, height: 14 }} />
              )}
              {connectionStatus === "connecting" ? "Connecting…" : connectionStatus === "connected" ? "Live" : connectionStatus === "error" ? "Error" : "Offline"}
            </div>
          </div>
        )}

        {/* Messages */}
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
                reactions={reactions}
                sessionKey={activeSessionKey}
                onReact={handleReact}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onReply={(id, sender, preview) => setReplyTo({ messageId: id, sender, preview })}
              />
            );
          })()
        ) : (
          <MessageThread
            messages={messages}
            isLoading={connectionStatus === "connecting"}
            threads={threads}
            reactions={reactions}
            sessionKey={activeSessionKey}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            onReply={(id, sender, preview) => setReplyTo({ messageId: id, sender, preview })}
            onReact={handleReact}
            onScrollToMessage={handleScrollToMessage}
            messageRefs={messageRefs}
          />
        )}

        {/* Reply bar */}
        <ReplyBar replyTo={replyTo} onCancel={() => setReplyTo(null)} />

        {/* File attachment strip */}
        <FileAttachmentStrip attachments={attachments} onRemove={removeAttachment} />

        {/* Compose */}
        <ComposeBar
          onSend={handleSend}
          disabled={isDisconnected}
          placeholder={composePlaceholder}
          onEditLast={handleEditLast}
          onFileAttach={addFiles}
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

      {/* Mobile + global CSS */}
      <style>{`
        @media (max-width: 768px) {
          .chat-sidebar-desktop-wrapper { display: none; }
          .chat-sidebar-desktop { display: none; }
          .mobile-hamburger { display: flex !important; }
          .message-content { font-size: 13px !important; }
        }
        @media (min-width: 769px) {
          .mobile-hamburger { display: none !important; }
        }
        .message-hover-actions { opacity: 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
