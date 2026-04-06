"use client";

import { useRef, useState, DragEvent } from "react";
import { Paperclip, X, FileText, Image } from "lucide-react";

export interface AttachedFile {
  file: File;
  preview?: string; // data URL for images
}

interface FileUploadProps {
  attachments: AttachedFile[];
  onAttach: (files: AttachedFile[]) => void;
  onRemove: (index: number) => void;
}

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/markdown",
];
const MAX_SIZE_MB = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string) {
  return type.startsWith("image/");
}

export function useFileAttachments() {
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    const toAdd: AttachedFile[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) continue;
      const attached: AttachedFile = { file };
      if (isImageType(file.type)) {
        attached.preview = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      }
      toAdd.push(attached);
    }
    setAttachments((prev) => [...prev, ...toAdd]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = () => setAttachments([]);

  return { attachments, addFiles, removeAttachment, clearAttachments, isDragOver, setIsDragOver };
}

export function FileAttachmentStrip({
  attachments,
  onRemove,
}: {
  attachments: AttachedFile[];
  onRemove: (i: number) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        padding: "8px 16px",
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        overflowX: "auto",
        flexWrap: "wrap",
      }}
    >
      {attachments.map((att, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 8px",
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            maxWidth: "160px",
          }}
        >
          {att.preview ? (
            <img
              src={att.preview}
              alt={att.file.name}
              style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }}
            />
          ) : (
            <div
              style={{
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--surface)",
                borderRadius: "4px",
                color: "var(--accent)",
              }}
            >
              <FileText style={{ width: 20, height: 20 }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {att.file.name}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {formatBytes(att.file.size)}
            </div>
          </div>
          <button
            onClick={() => onRemove(i)}
            style={{
              position: "absolute",
              top: "-6px",
              right: "-6px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "var(--negative)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              padding: 0,
            }}
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function FilePickerButton({ onFiles }: { onFiles: (files: FileList) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_TYPES.join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) {
            onFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px",
          borderRadius: "6px",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.backgroundColor = "transparent"; }}
        title="Attach file"
      >
        <Paperclip style={{ width: 18, height: 18 }} />
      </button>
    </>
  );
}

export function DragOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(13,17,23,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        border: "2px dashed var(--accent)",
        borderRadius: "8px",
        pointerEvents: "none",
      }}
    >
      <div style={{ textAlign: "center", color: "var(--accent)" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>📎</div>
        <div style={{ fontSize: "16px", fontWeight: 600, fontFamily: "var(--font-heading)" }}>
          Drop to attach
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          Images, PDFs, text files up to 10MB
        </div>
      </div>
    </div>
  );
}
