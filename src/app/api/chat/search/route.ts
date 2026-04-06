import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = "ws://127.0.0.1:18789";
const GATEWAY_HTTP = "http://127.0.0.1:18789";
const WS_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";

const SESSION_LABELS: Record<string, string> = {
  main: "Woods",
  "agent:ford:main": "Ford",
};

interface RawMessage {
  id?: string;
  role?: string;
  content?: string | { type: string; text?: string }[];
  timestamp?: number;
  agent?: string;
}

function extractText(msg: RawMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => (c as any).text)
      .join(" ");
  }
  return "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const sessionKey = searchParams.get("sessionKey") || "";

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const sessionKeys = sessionKey ? [sessionKey] : Object.keys(SESSION_LABELS);
  const results: {
    sessionKey: string;
    sessionLabel: string;
    messageId: string;
    sender: string;
    timestamp: string;
    preview: string;
  }[] = [];

  for (const sk of sessionKeys) {
    try {
      // Use the gateway HTTP API to get chat history
      const res = await fetch(`${GATEWAY_HTTP}/api/chat/history?sessionKey=${encodeURIComponent(sk)}&limit=200`, {
        headers: { Authorization: `Bearer ${WS_TOKEN}` },
      });

      let messages: RawMessage[] = [];

      if (res.ok) {
        const data = await res.json();
        messages = data.messages || [];
      }

      const qLower = q.toLowerCase();

      for (const msg of messages) {
        if (msg.role !== "user" && msg.role !== "assistant") continue;
        const text = extractText(msg);
        if (!text || !text.toLowerCase().includes(qLower)) continue;

        const preview = text.length > 120 ? text.slice(0, 120) + "…" : text;
        results.push({
          sessionKey: sk,
          sessionLabel: SESSION_LABELS[sk] || sk,
          messageId: msg.id || `${sk}-${msg.timestamp}`,
          sender: msg.role === "user" ? "Matt" : (msg.agent || SESSION_LABELS[sk] || "Agent"),
          timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
          preview,
        });
      }
    } catch {
      // Skip sessions that fail
    }
  }

  return NextResponse.json({ results });
}
