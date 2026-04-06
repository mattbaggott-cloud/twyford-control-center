import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";

interface ThreadMessage {
  from: string;
  to: string;
  message: string;
  reply: string | null;
  status: string;
  timestamp: string;
  toolCallId: string;
}

interface Thread {
  id: string;
  sessionId: string;
  fromAgent: { id: string; name: string; emoji: string };
  toAgent: { id: string; name: string; emoji: string };
  messages: ThreadMessage[];
  startedAt: string;
  lastActivityAt: string;
  taskSummary: string;
}

const AGENT_META: Record<string, { name: string; emoji: string }> = {
  main: { name: "Woods", emoji: "🦞" },
  ford: { name: "Ford", emoji: "👨🏻‍💻" },
};

/**
 * Parse a session JSONL file for sessions_send tool calls and their replies.
 * Returns threads: groups of send/reply exchanges.
 */
function parseSessionForThreads(
  agentId: string,
  sessionId: string,
  filePath: string
): Thread[] {
  const threads: Thread[] = [];
  let lines: string[];

  try {
    const raw = readFileSync(filePath, "utf-8");
    lines = raw.split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }

  // Collect all sessions_send calls and their tool results
  const sendCalls: {
    toolCallId: string;
    timestamp: string;
    target: string;
    message: string;
    messageIdx: number;
  }[] = [];

  const toolResults: Map<string, { status: string; reply: string | null; timestamp: string }> =
    new Map();

  for (let i = 0; i < lines.length; i++) {
    try {
      const data = JSON.parse(lines[i]);
      if (data.type !== "message") continue;

      const msg = data.message;
      const content = msg?.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (!block || typeof block !== "object") continue;

        // sessions_send tool call
        if (block.name === "sessions_send" && block.arguments) {
          sendCalls.push({
            toolCallId: block.id || "",
            timestamp: data.timestamp || "",
            target: block.arguments.sessionKey || "",
            message: block.arguments.message || "",
            messageIdx: i,
          });
        }

        // Tool result (response)
        if (block.type === "toolResult" || block.type === "tool_result") {
          const text = typeof block.text === "string" ? block.text :
            typeof block.content === "string" ? block.content : "";
          try {
            const parsed = JSON.parse(text);
            const resultId = block.tool_use_id || block.toolUseId || "";
            toolResults.set(resultId, {
              status: parsed.status || "unknown",
              reply: parsed.reply || null,
              timestamp: data.timestamp || "",
            });
          } catch {
            // Not JSON, skip
          }
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  // Match send calls with their results and group into threads
  // A thread is a group of send/reply exchanges to the same target within a session
  const threadsByTarget: Map<string, ThreadMessage[]> = new Map();

  for (const send of sendCalls) {
    const result = toolResults.get(send.toolCallId);
    const threadMsg: ThreadMessage = {
      from: agentId,
      to: send.target,
      message: send.message,
      reply: result?.reply || null,
      status: result?.status || "pending",
      timestamp: send.timestamp,
      toolCallId: send.toolCallId,
    };

    const key = send.target;
    if (!threadsByTarget.has(key)) {
      threadsByTarget.set(key, []);
    }
    threadsByTarget.get(key)!.push(threadMsg);
  }

  // Convert grouped messages into Thread objects
  for (const [target, messages] of threadsByTarget) {
    // Extract target agent id from session key (e.g., "agent:ford:main" -> "ford")
    const targetAgentId = target.split(":")[1] || target;
    const fromMeta = AGENT_META[agentId] || { name: agentId, emoji: "🤖" };
    const toMeta = AGENT_META[targetAgentId] || { name: targetAgentId, emoji: "🤖" };

    // Only include threads with actual successful exchanges
    const successfulMessages = messages.filter(
      (m) => m.status === "ok" && m.reply
    );
    if (successfulMessages.length === 0) continue;

    threads.push({
      id: `${sessionId}-${targetAgentId}`,
      sessionId,
      fromAgent: { id: agentId, ...fromMeta },
      toAgent: { id: targetAgentId, ...toMeta },
      messages: successfulMessages,
      startedAt: successfulMessages[0].timestamp,
      lastActivityAt: successfulMessages[successfulMessages.length - 1].timestamp,
      taskSummary: successfulMessages[0].message.split("\n")[0].slice(0, 100),
    });
  }

  return threads;
}

// GET /api/sessions/threads — list all A2A threads
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId"); // Optional filter
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  try {
    const allThreads: Thread[] = [];

    // Scan all agent session directories
    const agentsDir = join(OPENCLAW_DIR, "agents");
    let agentDirs: string[];

    try {
      agentDirs = readdirSync(agentsDir).filter((d) => {
        if (agentId && d !== agentId) return false;
        try {
          readdirSync(join(agentsDir, d, "sessions"));
          return true;
        } catch {
          return false;
        }
      });
    } catch {
      return NextResponse.json({ threads: [] });
    }

    for (const agent of agentDirs) {
      const sessionsDir = join(agentsDir, agent, "sessions");
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));

      for (const file of files) {
        const sessionId = file.replace(".jsonl", "");
        const filePath = join(sessionsDir, file);
        const threads = parseSessionForThreads(agent, sessionId, filePath);
        allThreads.push(...threads);
      }
    }

    // Sort by most recent activity
    allThreads.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime()
    );

    return NextResponse.json({
      threads: allThreads.slice(0, limit),
      total: allThreads.length,
    });
  } catch (error) {
    console.error("Error reading threads:", error);
    return NextResponse.json(
      { error: "Failed to read threads" },
      { status: 500 }
    );
  }
}
