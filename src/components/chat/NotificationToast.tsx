"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export interface ToastNotification {
  id: string;
  sessionKey: string;
  sessionLabel: string;
  sender: string;
  preview: string;
  timestamp: number;
}

interface NotificationToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
  onNavigate: (sessionKey: string) => void;
}

function SingleToast({
  toast,
  onDismiss,
  onNavigate,
}: {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onNavigate: (sessionKey: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 4s
    const t2 = setTimeout(() => onDismiss(toast.id), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [toast.id, onDismiss]);

  const handleClick = () => {
    onNavigate(toast.sessionKey);
    onDismiss(toast.id);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "12px 14px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        cursor: "pointer",
        minWidth: "280px",
        maxWidth: "340px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: "transform 250ms ease, opacity 250ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--accent)",
            fontFamily: "var(--font-heading)",
            marginBottom: "2px",
          }}
        >
          {toast.sender}{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            in {toast.sessionLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {toast.preview}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          padding: "2px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

export function NotificationToast({ toasts, onDismiss, onNavigate }: NotificationToastProps) {
  // Max 3 toasts at once
  const visible = toasts.slice(-3);

  return (
    <div
      style={{
        position: "fixed",
        top: "60px",
        right: "16px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: toasts.length > 0 ? "auto" : "none",
      }}
    >
      {visible.map((toast) => (
        <SingleToast
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

/**
 * Hook to play a subtle chime via Web Audio API.
 */
export function useNotificationSound() {
  const enabledRef = useRef<boolean>(false);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      enabledRef.current = localStorage.getItem("notif-sound") === "true";
    }
  }, []);

  const playChime = () => {
    if (!enabledRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio not supported
    }
  };

  const setEnabled = (val: boolean) => {
    enabledRef.current = val;
    if (typeof window !== "undefined") {
      localStorage.setItem("notif-sound", val ? "true" : "false");
    }
  };

  const isEnabled = () => enabledRef.current;

  return { playChime, setEnabled, isEnabled };
}

/**
 * Request desktop notification permission and show a notification.
 */
export function showDesktopNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (document.visibilityState !== "hidden") return; // only when app is in background

  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    });
  }
}
