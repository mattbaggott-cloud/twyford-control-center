"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileText, Cpu } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

interface DiaryEntry {
  date: string;
  content: string;
  sizeBytes: number;
  estimatedTokens: number;
}

interface ProjectStatus {
  project: string;
  content: string;
}

interface DiaryData {
  agentId: string;
  entries: DiaryEntry[];
  projectStatus: ProjectStatus | null;
  totalEntries: number;
  totalTokens: number;
}

interface DiaryPanelProps {
  agentId: string;
  agentName: string;
  agentColor: string;
}

export function DiaryPanel({ agentId, agentName, agentColor }: DiaryPanelProps) {
  const [data, setData] = useState<DiaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    setSelectedIndex(0);
    fetch(`/api/agents/diary?agentId=${agentId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-sm" style={{ color: "var(--text-muted)" }}>
          Loading diary...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const entry = data.entries[selectedIndex];

  return (
    <div className="space-y-4">
      {/* Project Status Card */}
      {data.projectStatus && (
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: "var(--background)",
            border: `1px solid ${agentColor}40`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4" style={{ color: agentColor }} />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: agentColor }}
            >
              {data.projectStatus.project.replace(/-/g, " ")}
            </span>
          </div>
          <pre
            className="text-xs whitespace-pre-wrap"
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.6,
            }}
          >
            {data.projectStatus.content}
          </pre>
        </div>
      )}

      {/* Token Budget Summary */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3"
        style={{
          backgroundColor: "var(--background)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Total diary tokens
          </span>
        </div>
        <span
          className="text-xs font-mono font-semibold"
          style={{
            color: data.totalTokens > 8000 ? "var(--error)" : "var(--success)",
          }}
        >
          ~{data.totalTokens.toLocaleString()} tokens across {data.totalEntries} entries
        </span>
      </div>

      {/* Diary Entries */}
      {data.entries.length === 0 ? (
        <div
          className="text-center py-8 rounded-lg"
          style={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
          }}
        >
          <BookOpen
            className="w-8 h-8 mx-auto mb-2"
            style={{ color: "var(--text-muted)" }}
          />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No diary entries yet
          </p>
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Date Navigator */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <button
              onClick={() => setSelectedIndex(Math.min(selectedIndex + 1, data.entries.length - 1))}
              disabled={selectedIndex >= data.entries.length - 1}
              className="p-1 rounded transition-colors"
              style={{
                color: selectedIndex >= data.entries.length - 1 ? "var(--text-muted)" : "var(--text-primary)",
                cursor: selectedIndex >= data.entries.length - 1 ? "default" : "pointer",
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {entry?.date || "—"}
              </span>
              {entry && (
                <span
                  className="text-xs ml-2 font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  ~{entry.estimatedTokens} tokens
                </span>
              )}
            </div>

            <button
              onClick={() => setSelectedIndex(Math.max(selectedIndex - 1, 0))}
              disabled={selectedIndex <= 0}
              className="p-1 rounded transition-colors"
              style={{
                color: selectedIndex <= 0 ? "var(--text-muted)" : "var(--text-primary)",
                cursor: selectedIndex <= 0 ? "default" : "pointer",
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Entry Content */}
          {entry && (
            <div className="p-4 max-h-[500px] overflow-y-auto">
              <MarkdownPreview content={entry.content} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
