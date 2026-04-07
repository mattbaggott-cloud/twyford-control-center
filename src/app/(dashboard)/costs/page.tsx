"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, MessageSquare, Zap, Bot } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface AgentCost {
  agent: string;
  agentId: string;
  emoji: string;
  cost: number;
  tokens: number;
  messages: number;
  avgPerMsg: number;
}

interface ModelCost {
  model: string;
  cost: number;
  tokens: number;
  messages: number;
}

interface SessionCost {
  agentId: string;
  sessionId: string;
  model: string;
  messages: number;
  tokens: number;
  cost: number;
  avgPerMsg: number;
  lastActivity: string;
}

interface CostData {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
  projected: number;
  budget: number;
  avgCostPerMessage: number;
  totalMessages: number;
  byAgent: AgentCost[];
  byModel: ModelCost[];
  daily: Array<{ date: string; cost: number; input: number; output: number }>;
  sessions: SessionCost[];
}

const COLORS = ["#3fb950", "#FF3B30", "#60A5FA", "#F59E0B", "#A78BFA", "#34D399", "#F472B6"];

const AGENT_COLORS: Record<string, string> = {
  main: "#3fb950",
  ford: "#FF3B30",
};

function safePct(a: number, b: number): string {
  if (!b || !isFinite(a / b)) return "—";
  return `${((a / b) * 100).toFixed(1)}%`;
}

function safeChange(current: number, previous: number): { value: string; positive: boolean } | null {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (!isFinite(change)) return null;
  return { value: `${Math.abs(change).toFixed(1)}%`, positive: change <= 0 };
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function CostsPage() {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    fetchCostData();
    const interval = setInterval(fetchCostData, 30000);
    return () => clearInterval(interval);
  }, [timeframe]);

  const fetchCostData = async () => {
    try {
      const res = await fetch(`/api/costs?timeframe=${timeframe}`);
      if (res.ok) {
        setCostData(await res.json());
      }
    } catch {
      console.error("Failed to fetch cost data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--accent)" }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading cost data...</p>
        </div>
      </div>
    );
  }

  if (!costData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <DollarSign className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-secondary)" }}>Failed to load cost data</p>
        </div>
      </div>
    );
  }

  const budgetPercent = costData.budget > 0 ? (costData.thisMonth / costData.budget) * 100 : 0;
  const budgetColor = budgetPercent < 60 ? "var(--success)" : budgetPercent < 85 ? "var(--warning)" : "var(--error)";
  const todayChange = safeChange(costData.today, costData.yesterday);
  const monthChange = safeChange(costData.thisMonth, costData.lastMonth);

  // Budget target check
  const TARGET_PER_MSG = 0.25;
  const isUnderBudget = costData.avgCostPerMessage <= TARGET_PER_MSG;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}
          >
            Costs & Analytics
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Live token usage and cost tracking across all agents
          </p>
        </div>
        <div className="flex gap-2 p-1 rounded-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          {(["7d", "30d", "90d"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: timeframe === tf ? "var(--accent)" : "transparent",
                color: timeframe === tf ? "white" : "var(--text-secondary)",
              }}
            >
              {tf === "7d" ? "7 days" : tf === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Today */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Today</span>
            {todayChange && (
              <div className="flex items-center gap-1">
                {todayChange.positive ? (
                  <TrendingDown className="w-3 h-3" style={{ color: "var(--success)" }} />
                ) : (
                  <TrendingUp className="w-3 h-3" style={{ color: "var(--error)" }} />
                )}
                <span className="text-xs font-medium" style={{ color: todayChange.positive ? "var(--success)" : "var(--error)" }}>
                  {todayChange.value}
                </span>
              </div>
            )}
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            ${costData.today.toFixed(2)}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            vs ${costData.yesterday.toFixed(2)} yesterday
          </p>
        </div>

        {/* This Month */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>This Month</span>
            {monthChange && (
              <div className="flex items-center gap-1">
                {monthChange.positive ? (
                  <TrendingDown className="w-3 h-3" style={{ color: "var(--success)" }} />
                ) : (
                  <TrendingUp className="w-3 h-3" style={{ color: "var(--error)" }} />
                )}
                <span className="text-xs font-medium" style={{ color: monthChange.positive ? "var(--success)" : "var(--error)" }}>
                  {monthChange.value}
                </span>
              </div>
            )}
          </div>
          <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            ${costData.thisMonth.toFixed(2)}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            vs ${costData.lastMonth.toFixed(2)} last month
          </p>
        </div>

        {/* Projected */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Projected (EOM)</span>
          <div className="text-2xl font-bold mt-2" style={{ color: "var(--warning)" }}>
            ${costData.projected.toFixed(2)}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Based on current pace</p>
        </div>

        {/* Avg Cost Per Message */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Avg / Message</span>
            <MessageSquare className="w-4 h-4" style={{ color: isUnderBudget ? "var(--success)" : "var(--error)" }} />
          </div>
          <div className="text-2xl font-bold" style={{ color: isUnderBudget ? "var(--success)" : "var(--error)" }}>
            ${costData.avgCostPerMessage.toFixed(4)}
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Target: ${TARGET_PER_MSG.toFixed(2)} | {costData.totalMessages.toLocaleString()} msgs
          </p>
        </div>

        {/* Budget */}
        <div className="p-5 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Budget</span>
            {budgetPercent > 80 && <AlertTriangle className="w-4 h-4" style={{ color: "var(--error)" }} />}
          </div>
          <div className="text-2xl font-bold" style={{ color: budgetColor }}>
            {budgetPercent.toFixed(0)}%
          </div>
          <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
            <div className="h-full transition-all duration-500" style={{ width: `${Math.min(budgetPercent, 100)}%`, backgroundColor: budgetColor }} />
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            ${costData.thisMonth.toFixed(2)} / ${costData.budget.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend */}
        <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Daily Cost Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={costData.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
              <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", borderRadius: "8px" }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
              />
              <Line type="monotone" dataKey="cost" stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 4 }} name="Cost ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Agent */}
        <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Cost by Agent</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costData.byAgent}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="agent" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
              <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", borderRadius: "8px" }}
                formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
              />
              <Bar dataKey="cost" name="Cost ($)">
                {costData.byAgent.map((entry) => (
                  <Cell key={entry.agentId} fill={AGENT_COLORS[entry.agentId] || COLORS[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Model */}
        <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Cost by Model</h3>
          {costData.byModel.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie data={costData.byModel} dataKey="cost" nameKey="model" cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                  label={(entry) => `${entry.model.split("-").slice(-2).join("-")}: $${entry.cost.toFixed(2)}`}>
                  {costData.byModel.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", borderRadius: "8px" }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]} />
              </RePieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px]" style={{ color: "var(--text-muted)" }}>No model data</div>
          )}
        </div>

        {/* Token Usage */}
        <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Token Usage (Daily)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costData.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: "12px" }} />
              <YAxis stroke="var(--text-muted)" style={{ fontSize: "12px" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)", borderRadius: "8px" }}
                formatter={(value: number) => [value.toLocaleString(), ""]} />
              <Legend />
              <Bar dataKey="input" stackId="a" fill="#60A5FA" name="Input Tokens" />
              <Bar dataKey="output" stackId="a" fill="#F59E0B" name="Output Tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Detail Table */}
      <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          <Bot className="inline-block w-5 h-5 mr-2 mb-1" />
          Agent Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Agent</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Messages</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tokens</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Total Cost</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Avg/Msg</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {costData.byAgent.map((agent) => {
                const totalCost = costData.byAgent.reduce((s, a) => s + a.cost, 0);
                return (
                  <tr key={agent.agentId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "18px" }}>{agent.emoji}</span>
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{agent.agent}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                      {agent.messages.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                      {agent.tokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                      ${agent.cost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: agent.avgPerMsg <= TARGET_PER_MSG ? "var(--success)" : "var(--error)" }}>
                      ${agent.avgPerMsg.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: "var(--text-secondary)" }}>
                      {safePct(agent.cost, totalCost)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Detail Table */}
      <div className="p-6 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          <Zap className="inline-block w-5 h-5 mr-2 mb-1" />
          Recent Sessions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Agent</th>
                <th className="text-left py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Model</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Messages</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tokens</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Cost</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Avg/Msg</th>
                <th className="text-right py-3 px-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {costData.sessions.map((session) => {
                const meta = { main: { name: "Woods", emoji: "🦞" }, ford: { name: "Ford", emoji: "👨🏻‍💻" } }[session.agentId] || { name: session.agentId, emoji: "🤖" };
                const shortModel = session.model.split("-").slice(-2).join("-");
                return (
                  <tr key={`${session.agentId}-${session.sessionId}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span>{meta.emoji}</span>
                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>{meta.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
                        {shortModel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                      {session.messages}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                      {session.tokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      ${session.cost.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm" style={{ color: session.avgPerMsg <= TARGET_PER_MSG ? "var(--success)" : "var(--error)" }}>
                      ${session.avgPerMsg.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatRelative(session.lastActivity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
