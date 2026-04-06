"use client";

import { useState } from "react";
import { X, Hash } from "lucide-react";
import type { Channel } from "@/types/channel";

interface CreateChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
  availableAgents: { id: string; name: string; emoji: string }[];
}

export function CreateChannelDialog({
  open,
  onClose,
  onCreated,
  availableAgents,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    availableAgents.map((a) => a.id)
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Channel name must be at least 2 characters");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim(),
          members: selectedMembers,
        }),
      });

      if (res.status === 409) {
        setError("A channel with that name already exists");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError("Failed to create channel");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      setName("");
      setDescription("");
      setSelectedMembers(availableAgents.map((a) => a.id));
      onCreated(data.channel);
      onClose();
    } catch {
      setError("Failed to create channel");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          width: "420px",
          maxWidth: "90vw",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Hash style={{ width: 18, height: 18, color: "var(--accent)" }} />
            Create Channel
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "4px",
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Channel Name
          </label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              #
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g. design-reviews"
              style={{
                width: "100%",
                padding: "10px 12px 10px 24px",
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "6px",
            }}
          >
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this channel about?"
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "14px",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Members */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "8px",
            }}
          >
            Invite Agents
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {availableAgents.map((agent) => (
              <label
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: selectedMembers.includes(agent.id)
                    ? "var(--accent-soft)"
                    : "var(--background)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(agent.id)}
                  onChange={() => toggleMember(agent.id)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <span style={{ fontSize: "16px" }}>{agent.emoji}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {agent.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: "var(--negative-soft)",
              color: "var(--negative)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: submitting || !name.trim() ? "default" : "pointer",
              opacity: submitting || !name.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? "Creating…" : "Create Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
