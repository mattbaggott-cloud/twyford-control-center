"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageThread } from "@/components/chat/MessageThread";
import { ComposeBar } from "@/components/chat/ComposeBar";
import { MessageBubbleProps } from "@/components/chat/MessageBubble";
import { GatewayWS, ChatMessage } from "@/lib/gateway-ws";
import { Wifi, WifiOff } from "lucide-react";

// Gateway WebSocket configuration
const WS_URL = "ws://127.0.0.1:18789";
// Token is exposed via NEXT_PUBLIC_ prefix for client-side access
const WS_TOKEN = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || "";

function chatMessageToBubble(msg: ChatMessage): MessageBubbleProps {
  return {
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
    agent: msg.role === "assistant" ? (msg.agent || "Woods") : undefined,
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageBubbleProps[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");
  const gatewayRef = useRef<GatewayWS | null>(null);

  const handleSend = useCallback(async (text: string) => {
    // Add user message to UI immediately
    const userMsg: MessageBubbleProps = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Send via WebSocket
    if (gatewayRef.current) {
      try {
        await gatewayRef.current.sendMessage(text);
      } catch (err) {
        console.error("[Chat] Failed to send message:", err);
        // Add error indicator to UI
        setMessages((prev) => [
          ...prev,
          {
            role: "system" as const,
            content: "Failed to send message. Check your connection.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }
  }, []);

  useEffect(() => {
    if (!WS_TOKEN) {
      console.warn("[Chat] No gateway token configured. Set NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN in .env.local");
      setConnectionStatus("error");
      return;
    }

    const gw = new GatewayWS({
      url: WS_URL,
      token: WS_TOKEN,
      onStatus: (status) => {
        setConnectionStatus(status);
      },
      onHistory: (history) => {
        const bubbles = history.map(chatMessageToBubble);
        setMessages(bubbles);
      },
      onMessage: (msg) => {
        const bubble = chatMessageToBubble(msg);
        setMessages((prev) => {
          // Replace streaming bubble if one exists, otherwise append
          const streamIdx = prev.findIndex((m) => m.role === "assistant" && m.isStreaming);
          if (streamIdx >= 0) {
            const updated = [...prev];
            updated[streamIdx] = { ...bubble, isStreaming: false };
            return updated;
          }
          return [...prev, bubble];
        });
      },
      onStream: (chunk) => {
        // Handle streaming: append to last assistant message or create new one
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk.content,
            };
            return updated;
          }
          // New streaming message
          return [
            ...prev,
            {
              role: "assistant" as const,
              content: chunk.content,
              timestamp: new Date().toISOString(),
              agent: "Woods",
              isStreaming: true,
            },
          ];
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

  const isDisconnected = connectionStatus === "disconnected" || connectionStatus === "error";

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 48px - 32px)", // account for TopBar + StatusBar
        margin: "-24px", // counteract dashboard layout padding
        overflow: "hidden",
      }}
    >
      {/* Chat Sidebar */}
      <ChatSidebar connectionStatus={connectionStatus} />

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
        {/* Channel Header */}
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
                border: "2px solid #3fb950",
                backgroundColor: "var(--surface)",
                fontSize: "16px",
              }}
            >
              🦞
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
                Woods
              </h1>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Chief of Staff • OpenClaw Agent
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
            {connectionStatus === "connecting" ? "Connecting…" : 
             connectionStatus === "connected" ? "Live" :
             connectionStatus === "error" ? "Error" : "Offline"}
          </div>
        </div>

        {/* Messages */}
        <MessageThread
          messages={messages}
          isLoading={connectionStatus === "connecting"}
        />

        {/* Compose */}
        <ComposeBar
          onSend={handleSend}
          disabled={isDisconnected}
          placeholder={
            isDisconnected
              ? "Reconnecting to gateway…"
              : "Message Woods…"
          }
        />
      </div>
    </div>
  );
}
