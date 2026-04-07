import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const DEFAULT_BUDGET = 100.0;

const AGENT_META: Record<string, { name: string; emoji: string }> = {
  main: { name: "Woods", emoji: "🦞" },
  ford: { name: "Ford", emoji: "👨🏻‍💻" },
};

interface UsageRecord {
  agentId: string;
  sessionId: string;
  model: string;
  timestamp: number;
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  purpose: string;
}

function classifyPurpose(userText: string): string {
  if (!userText) return "unknown";
  if (userText.includes("HEARTBEAT")) return "heartbeat";
  if (userText.includes("new session was started")) return "session-start";
  if (userText.includes("telegram")) return "telegram";
  if (userText.includes("discord")) return "discord";
  if (userText.includes("imessage") || userText.includes("iMessage")) return "imessage";
  if (userText.includes("openclaw-control-ui")) return "control-ui";
  if (userText.includes("cron") || userText.includes("scheduled")) return "cron";
  return "user-message";
}

// Parse all session JSONL files for usage data.
// Scans all agent session directories for JSONL files.
function parseAllUsage(daysBack: number): UsageRecord[] {
  const records: UsageRecord[] = [];
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const agentsDir = join(OPENCLAW_DIR, "agents");

  let agentDirs: string[];
  try {
    agentDirs = readdirSync(agentsDir).filter((d) => {
      const sessDir = join(agentsDir, d, "sessions");
      return existsSync(sessDir);
    });
  } catch {
    return [];
  }

  for (const agentId of agentDirs) {
    const sessionsDir = join(agentsDir, agentId, "sessions");
    let files: string[];
    try {
      files = readdirSync(sessionsDir).filter((f) => f.includes(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = file.replace(/\.jsonl.*$/, "");
      const filePath = join(sessionsDir, file);

      let content: string;
      try {
        content = readFileSync(filePath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      let lastUserText = "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.type !== "message") continue;

          const msg = data.message;
          if (!msg) continue;

          // Track user messages for purpose classification
          if (msg.role === "user") {
            const c = msg.content;
            if (typeof c === "string") {
              lastUserText = c.slice(0, 300);
            } else if (Array.isArray(c) && c.length > 0 && c[0].text) {
              lastUserText = c[0].text.slice(0, 300);
            }
            continue;
          }

          if (msg.role !== "assistant") continue;

          const usage = msg.usage;
          if (!usage || !usage.cost) continue;

          // Skip internal OpenClaw messages (no real API cost)
          const model = msg.model || "unknown";
          if (model === "delivery-mirror" || model === "gateway-injected") continue;

          const ts = data.timestamp
            ? new Date(data.timestamp).getTime()
            : msg.timestamp || 0;

          if (ts < cutoff) continue;

          const dateStr = new Date(ts).toISOString().split("T")[0];

          records.push({
            agentId,
            sessionId,
            model,
            timestamp: ts,
            date: dateStr,
            input: usage.input || 0,
            output: usage.output || 0,
            cacheRead: usage.cacheRead || 0,
            cacheWrite: usage.cacheWrite || 0,
            totalTokens: usage.totalTokens || 0,
            cost: usage.cost.total || 0,
            purpose: classifyPurpose(lastUserText),
          });
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }

  return records;
}

function getAgentMeta(agentId: string) {
  return AGENT_META[agentId] || { name: agentId, emoji: "🤖" };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;
  const logPage = parseInt(searchParams.get("logPage") || "1", 10);
  const logLimit = Math.min(parseInt(searchParams.get("logLimit") || "100", 10), 500);

  try {
    const records = parseAllUsage(days);

    // Date boundaries
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split("T")[0];
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    // KPI aggregations
    const today = records.filter((r) => r.date === todayStr).reduce((s, r) => s + r.cost, 0);
    const yesterday = records.filter((r) => r.date === yesterdayStr).reduce((s, r) => s + r.cost, 0);
    const thisMonth = records.filter((r) => r.date.startsWith(thisMonthStart)).reduce((s, r) => s + r.cost, 0);
    const lastMonthTotal = records.filter((r) => r.date.startsWith(lastMonthStart)).reduce((s, r) => s + r.cost, 0);

    // Projected EOM: (thisMonth / daysElapsed) * daysInMonth
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = dayOfMonth > 0 ? (thisMonth / dayOfMonth) * daysInMonth : 0;

    // Total messages and avg cost
    const totalMessages = records.length;
    const totalCost = records.reduce((s, r) => s + r.cost, 0);
    const avgCostPerMessage = totalMessages > 0 ? totalCost / totalMessages : 0;

    // By agent
    const agentMap = new Map<string, { cost: number; tokens: number; messages: number }>();
    for (const r of records) {
      const existing = agentMap.get(r.agentId) || { cost: 0, tokens: 0, messages: 0 };
      existing.cost += r.cost;
      existing.tokens += r.totalTokens;
      existing.messages += 1;
      agentMap.set(r.agentId, existing);
    }
    const byAgent = Array.from(agentMap.entries()).map(([agentId, data]) => {
      const meta = getAgentMeta(agentId);
      return {
        agent: meta.name,
        agentId,
        emoji: meta.emoji,
        cost: Math.round(data.cost * 10000) / 10000,
        tokens: data.tokens,
        messages: data.messages,
        avgPerMsg: data.messages > 0 ? Math.round((data.cost / data.messages) * 10000) / 10000 : 0,
      };
    }).sort((a, b) => b.cost - a.cost);

    // By model
    const modelMap = new Map<string, { cost: number; tokens: number; messages: number }>();
    for (const r of records) {
      const existing = modelMap.get(r.model) || { cost: 0, tokens: 0, messages: 0 };
      existing.cost += r.cost;
      existing.tokens += r.totalTokens;
      existing.messages += 1;
      modelMap.set(r.model, existing);
    }
    const byModel = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      cost: Math.round(data.cost * 10000) / 10000,
      tokens: data.tokens,
      messages: data.messages,
    })).sort((a, b) => b.cost - a.cost);

    // Daily
    const dailyMap = new Map<string, { cost: number; input: number; output: number }>();
    for (const r of records) {
      const existing = dailyMap.get(r.date) || { cost: 0, input: 0, output: 0 };
      existing.cost += r.cost;
      existing.input += r.input + r.cacheRead;
      existing.output += r.output;
      dailyMap.set(r.date, existing);
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date: date.slice(5), // MM-DD format
        cost: Math.round(data.cost * 100) / 100,
        input: data.input,
        output: data.output,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Per-session breakdown
    const sessionMap = new Map<string, { agentId: string; model: string; messages: number; tokens: number; cost: number; lastActivity: number }>();
    for (const r of records) {
      const key = `${r.agentId}:${r.sessionId}`;
      const existing = sessionMap.get(key) || { agentId: r.agentId, model: r.model, messages: 0, tokens: 0, cost: 0, lastActivity: 0 };
      existing.messages += 1;
      existing.tokens += r.totalTokens;
      existing.cost += r.cost;
      if (r.timestamp > existing.lastActivity) {
        existing.lastActivity = r.timestamp;
        existing.model = r.model; // Use most recent model
      }
      sessionMap.set(key, existing);
    }
    const sessions = Array.from(sessionMap.entries())
      .map(([key, data]) => ({
        agentId: data.agentId,
        sessionId: key.split(":").slice(1).join(":"),
        model: data.model,
        messages: data.messages,
        tokens: data.tokens,
        cost: Math.round(data.cost * 10000) / 10000,
        avgPerMsg: data.messages > 0 ? Math.round((data.cost / data.messages) * 10000) / 10000 : 0,
        lastActivity: new Date(data.lastActivity).toISOString(),
      }))
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, 50);

    // API Call Log — paginated, sorted newest first
    const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp);
    const logStart = (logPage - 1) * logLimit;
    const logSlice = sortedRecords.slice(logStart, logStart + logLimit);
    const logs = logSlice.map((r) => ({
      timestamp: new Date(r.timestamp).toISOString(),
      agent: getAgentMeta(r.agentId).name,
      agentId: r.agentId,
      agentEmoji: getAgentMeta(r.agentId).emoji,
      model: r.model,
      inputTokens: r.input,
      outputTokens: r.output,
      cacheRead: r.cacheRead,
      cacheWrite: r.cacheWrite,
      totalTokens: r.totalTokens,
      cost: Math.round(r.cost * 100000) / 100000,
      purpose: r.purpose,
      sessionId: r.sessionId,
    }));

    return NextResponse.json({
      today: Math.round(today * 100) / 100,
      yesterday: Math.round(yesterday * 100) / 100,
      thisMonth: Math.round(thisMonth * 100) / 100,
      lastMonth: Math.round(lastMonthTotal * 100) / 100,
      projected: Math.round(projected * 100) / 100,
      budget: DEFAULT_BUDGET,
      avgCostPerMessage: Math.round(avgCostPerMessage * 10000) / 10000,
      totalMessages,
      byAgent,
      byModel,
      daily,
      sessions,
      logs,
      logTotal: records.length,
      logPage,
      logLimit,
    });
  } catch (error) {
    console.error("Error fetching cost data:", error);
    return NextResponse.json({
      today: 0, yesterday: 0, thisMonth: 0, lastMonth: 0,
      projected: 0, budget: DEFAULT_BUDGET, avgCostPerMessage: 0,
      totalMessages: 0, byAgent: [], byModel: [], daily: [], sessions: [],
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, budget: body.budget });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
