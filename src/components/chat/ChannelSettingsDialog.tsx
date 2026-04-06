"use client";

import { useState } from "react";
import { X, Settings, Trash2, Pin, PinOff } from "lucide-react";
import type { Channel } from "@/types/channel";

interface ChannelSettingsDialogProps {
  open: boolean;
  channel: Channel;
  onClose: () => void;
  onUpdated: (channel: Channel) => void;
  onArchived: () => void;
  availableAgents: { id: string; name: string; emoji: string }[];
}

export function ChannelSettingsDialog({
  open,
  channel,
  onClose,
  onUpdated,
  onArchived,
  availableAgents,
}: ChannelSettingsDialogProps) {
  const [name, setName] = useState(channel.name.replace("#", ""));
  const [description, setDescription] = useState(channel.description);
  const [pinned, setPinned] = useState(channel.pinned);
  const [members, setMembers] = useState<string[]>(channel.members);
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/channels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: channel.id,
          name: name.trim(),
          description: description.trim(),
          pinned,
          members,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdated(data.channel);
        onClose();
      }
    } catch {
      // Error handling
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      const res = await fetch("/api/channels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: channel.id }),
      });
      if (res.ok) {
        onArchived();
        onClose();
      }
    } catch {
      // Error handling
    }
  };

  const toggleMember = (id: string) => {
    setMembers((prev) =>
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
          maxHeight: "80vh",
          overflowY: "auto",
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
            <Settings style={{ width: 18, height: 18, color: "var(--accent)" }} />
            Channel Settings
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

        {/* General Section */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            General
          </div>

          {/* Name */}
          <div style={{ marginBottom: "12px" }}>
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
                onChange={(e) => setName(e.target.value)}
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
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "6px",
              }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

          {/* Pin Toggle */}
          <button
            onClick={() => setPinned(!pinned)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              backgroundColor: pinned ? "var(--accent-soft)" : "var(--background)",
              color: pinned ? "var(--accent)" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {pinned ? (
              <PinOff style={{ width: 14, height: 14 }} />
            ) : (
              <Pin style={{ width: 14, height: 14 }} />
            )}
            {pinned ? "Unpin channel" : "Pin channel"}
          </button>
        </div>

        {/* Members Section */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "12px",
            }}
          >
            Members
          </div>
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
                  backgroundColor: members.includes(agent.id)
                    ? "var(--accent-soft)"
                    : "var(--background)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={members.includes(agent.id)}
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

        {/* Danger Zone */}
        <div
          style={{
            padding: "16px",
            borderRadius: "8px",
            border: "1px solid var(--negative)",
            backgroundColor: "var(--negative-soft)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--negative)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "8px",
            }}
          >
            Danger Zone
          </div>
          {!confirmArchive ? (
            <button
              onClick={() => setConfirmArchive(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--negative)",
                backgroundColor: "transparent",
                color: "var(--negative)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
              Archive Channel
            </button>
          ) : (
            <div>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--negative)",
                  marginBottom: "8px",
                  marginTop: 0,
                }}
              >
                Are you sure? The channel will be hidden but messages are preserved.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleArchive}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "var(--negative)",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Yes, archive it
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
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
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
