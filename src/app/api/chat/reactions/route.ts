import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { OPENCLAW_WORKSPACE } from "@/lib/paths";

function getReactionsPath(sessionKey: string): string {
  // DMs: session keys like "main" or "agent:ford:main"
  // Channels: session keys like "channel:general"
  if (sessionKey.startsWith("channel:")) {
    const channelName = sessionKey.replace("channel:", "");
    return path.join(OPENCLAW_WORKSPACE, "channels", channelName, "reactions.json");
  }

  // Map session key to agent id
  const agentId =
    sessionKey === "main"
      ? "woods"
      : sessionKey.startsWith("agent:")
      ? sessionKey.split(":")[1]
      : sessionKey;

  return path.join(OPENCLAW_WORKSPACE, "dms", agentId, "reactions.json");
}

type ReactionsFile = Record<string, Record<string, string[]>>;

async function readReactions(filePath: string): Promise<ReactionsFile> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeReactions(filePath: string, data: ReactionsFile): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionKey = searchParams.get("sessionKey") || "";
  if (!sessionKey) return NextResponse.json({ reactions: {} });

  const filePath = getReactionsPath(sessionKey);
  const reactions = await readReactions(filePath);
  return NextResponse.json({ reactions });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionKey, messageId, emoji, userId = "matt" } = body;

    if (!sessionKey || !messageId || !emoji) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const filePath = getReactionsPath(sessionKey);
    const reactions = await readReactions(filePath);

    if (!reactions[messageId]) reactions[messageId] = {};
    if (!reactions[messageId][emoji]) reactions[messageId][emoji] = [];

    const users = reactions[messageId][emoji];
    const existingIdx = users.indexOf(userId);

    if (existingIdx >= 0) {
      // Toggle off
      users.splice(existingIdx, 1);
      if (users.length === 0) {
        delete reactions[messageId][emoji];
        if (Object.keys(reactions[messageId]).length === 0) {
          delete reactions[messageId];
        }
      }
    } else {
      // Add reaction
      users.push(userId);
    }

    await writeReactions(filePath, reactions);
    return NextResponse.json({ reactions });
  } catch (err) {
    console.error("[reactions] Error:", err);
    return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 });
  }
}
