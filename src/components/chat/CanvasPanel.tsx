"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, BookOpen, Save, Edit3, Eye } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

interface CanvasPanelProps {
  channelId: string;
  channelName: string;
  open: boolean;
  onClose: () => void;
}

type TabType = "canvas" | "knowledge";
type ViewMode = "edit" | "preview";

export function CanvasPanel({
  channelId,
  channelName,
  open,
  onClose,
}: CanvasPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("canvas");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [canvasContent, setCanvasContent] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentContent = activeTab === "canvas" ? canvasContent : knowledgeContent;
  const hasUnsavedChanges = activeTab === "canvas" && canvasContent !== savedContent;

  const fetchContent = useCallback(async (type: TabType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/canvas?channelId=${channelId}&type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (type === "canvas") {
          setCanvasContent(data.content || "");
          setSavedContent(data.content || "");
        } else {
          setKnowledgeContent(data.content || "");
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // Load content when panel opens or channel changes
  useEffect(() => {
    if (open) {
      fetchContent("canvas");
      fetchContent("knowledge");
    }
  }, [open, channelId, fetchContent]);

  const handleSave = async () => {
    if (!hasUnsavedChanges || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/channels/canvas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          content: canvasContent,
          type: "canvas",
        }),
      });
      if (res.ok) {
        setSavedContent(canvasContent);
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  // Cmd+S to save
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, canvasContent, savedContent, saving]);

  if (!open) return null;

  return (
    <div
      style={{
        width: "400px",
        minWidth: "400px",
        height: "100%",
        borderLeft: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "var(--font-heading)",
            margin: 0,
          }}
        >
          {channelName}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Tab switcher */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[
          { id: "canvas" as TabType, label: "Canvas", icon: FileText },
          { id: "knowledge" as TabType, label: "Knowledge", icon: BookOpen },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id);
              if (id === "knowledge") setViewMode("preview");
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px",
              background: "none",
              border: "none",
              borderBottomStyle: "solid",
              borderBottomWidth: "2px",
              borderBottomColor: activeTab === id ? "var(--accent)" : "transparent",
              color: activeTab === id ? "var(--accent)" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 150ms ease",
            }}
          >
            <Icon style={{ width: 14, height: 14 }} />
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar (canvas only) */}
      {activeTab === "canvas" && (
        <div
          style={{
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => setViewMode("edit")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: viewMode === "edit" ? "var(--accent-soft)" : "transparent",
                color: viewMode === "edit" ? "var(--accent)" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Edit3 style={{ width: 12, height: 12 }} />
              Edit
            </button>
            <button
              onClick={() => setViewMode("preview")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: viewMode === "preview" ? "var(--accent-soft)" : "transparent",
                color: viewMode === "preview" ? "var(--accent)" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Eye style={{ width: 12, height: 12 }} />
              Preview
            </button>
          </div>

          {hasUnsavedChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "white",
                fontSize: "11px",
                fontWeight: 600,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              <Save style={{ width: 12, height: 12 }} />
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            Loading…
          </div>
        ) : currentContent === "" && viewMode === "preview" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "8px",
              padding: "32px",
            }}
          >
            {activeTab === "canvas" ? (
              <>
                <FileText style={{ width: 32, height: 32, color: "var(--text-muted)" }} />
                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", margin: 0 }}>
                  No canvas yet. Click Edit to add project context, plans, or notes for this channel.
                </p>
                <button
                  onClick={() => setViewMode("edit")}
                  style={{
                    marginTop: "8px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--accent)",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Start Writing
                </button>
              </>
            ) : (
              <>
                <BookOpen style={{ width: 32, height: 32, color: "var(--text-muted)" }} />
                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", margin: 0 }}>
                  No knowledge accumulated yet. Key decisions and context from conversations will appear here.
                </p>
              </>
            )}
          </div>
        ) : viewMode === "edit" && activeTab === "canvas" ? (
          <textarea
            value={canvasContent}
            onChange={(e) => setCanvasContent(e.target.value)}
            placeholder="# Channel Canvas\n\nAdd project context, plans, ideas, and notes here.\n\nAgents will read this when responding in this channel."
            style={{
              width: "100%",
              height: "100%",
              padding: "16px",
              backgroundColor: "var(--background)",
              border: "none",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.6,
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Tab") {
                e.preventDefault();
                const target = e.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const newVal = canvasContent.substring(0, start) + "  " + canvasContent.substring(end);
                setCanvasContent(newVal);
                setTimeout(() => {
                  target.selectionStart = target.selectionEnd = start + 2;
                }, 0);
              }
            }}
          />
        ) : (
          <div style={{ padding: "16px" }}>
            <MarkdownPreview content={currentContent} />
          </div>
        )}
      </div>

      {/* Footer info */}
      {activeTab === "canvas" && hasUnsavedChanges && (
        <div
          style={{
            padding: "6px 16px",
            borderTop: "1px solid var(--border)",
            fontSize: "11px",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          Unsaved changes • Cmd+S to save
        </div>
      )}
    </div>
  );
}
