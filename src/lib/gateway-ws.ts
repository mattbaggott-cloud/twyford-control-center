/**
 * Gateway WebSocket Connection Manager
 * Connects to the OpenClaw Gateway for real-time chat messaging.
 *
 * Protocol: Request/Response pattern with event push.
 *
 * Request:  {"type": "req", "id": "<uuid>", "method": "<method>", "params": {...}}
 * Response: {"type": "res", "id": "<uuid>", "ok": true, "payload": {...}}
 *       or: {"type": "res", "id": "<uuid>", "ok": false, "error": {"code": "...", "message": "..."}}
 * Event:    {"type": "event", "event": "<name>", "payload": {...}, "seq": <number>}
 *
 * Connect handshake:
 *   1. Wait up to 750ms for connect.challenge event
 *   2. Send connect request (with nonce if challenge received)
 *   3. On success, load chat history
 *
 * Chat:
 *   - chat.history: {sessionKey, limit} → {messages: [...]}
 *   - chat.send: {sessionKey, message, deliver} → ok
 *   - Responses arrive as "chat" events with state: "delta" | "final" | "error"
 */

function uuid() {
  return crypto.randomUUID();
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  agent?: string;
}

type MessageHandler = (message: ChatMessage) => void;
type StatusHandler = (status: "connecting" | "connected" | "disconnected" | "error") => void;
type StreamHandler = (chunk: { content: string; messageId: string }) => void;
type NotificationHandler = (sessionKey: string, message: ChatMessage, sessionLabel: string) => void;

interface GatewayWSOptions {
  url: string;
  token: string;
  sessionKey?: string;
  onMessage?: MessageHandler;
  onStatus?: StatusHandler;
  onStream?: StreamHandler;
  onHistory?: (messages: ChatMessage[]) => void;
  onNotification?: NotificationHandler;
}

export class GatewayWS {
  private ws: WebSocket | null = null;
  private options: GatewayWSOptions;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private intentionalClose = false;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStreamedLength = 0; // Track streamed content length to deduplicate deltas
  private lastRunId = ""; // Track current run to reset dedup on new messages
  private activeSessionKey = "main"; // Track which session is currently active

  constructor(options: GatewayWSOptions) {
    this.options = options;
  }

  get sessionKey(): string {
    return this.options.sessionKey || "main";
  }

  /**
   * Switch the active session without disconnecting the WebSocket.
   * Updates the internal session key and loads history for the new session.
   */
  async switchSession(sessionKey: string): Promise<ChatMessage[]> {
    this.options.sessionKey = sessionKey;
    this.activeSessionKey = sessionKey;
    return this.loadHistoryForSession(sessionKey);
  }

  connect() {
    this.intentionalClose = false;
    this.connectSent = false;
    this.options.onStatus?.("connecting");

    try {
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        // Wait 750ms for challenge, then send connect anyway
        this.connectTimer = setTimeout(() => {
          this.sendConnect();
        }, 750);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleFrame(data);
        } catch {
          // ignore non-JSON
        }
      };

      this.ws.onclose = () => {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        if (!this.intentionalClose) {
          this.options.onStatus?.("disconnected");
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.options.onStatus?.("error");
      };
    } catch {
      this.options.onStatus?.("error");
      this.scheduleReconnect();
    }
  }

  private handleFrame(data: any) {
    if (data.type === "event") {
      // Challenge
      if (data.event === "connect.challenge") {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        this.sendConnect(data.payload?.nonce);
        return;
      }
      // Chat event
      if (data.event === "chat") {
        this.handleChatEvent(data.payload);
        return;
      }
      return;
    }

    if (data.type === "res") {
      const pending = this.pending.get(data.id);
      if (pending) {
        this.pending.delete(data.id);
        if (data.ok) {
          pending.resolve(data.payload);
        } else {
          pending.reject(new Error(data.error?.message || "request failed"));
        }
      }
      return;
    }
  }

  private handleChatEvent(payload: any) {
    if (!payload) return;
    const state = payload.state;

    if (state === "delta") {
      const runId = payload.runId || "";
      // Reset dedup tracking when a new run starts
      if (runId !== this.lastRunId) {
        this.lastRunId = runId;
        this.lastStreamedLength = 0;
      }

      // Extract full accumulated text from the delta
      const msg = payload.message;
      let fullText = "";
      if (msg && Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((c: any) => c.type === "text" && typeof c.text === "string")
          .map((c: any) => c.text);
        fullText = textParts.join("");
      } else {
        fullText = this.extractText(msg) || "";
      }

      // Only emit the NEW content (what we haven't streamed yet)
      if (fullText.length > this.lastStreamedLength) {
        const newContent = fullText.slice(this.lastStreamedLength);
        this.lastStreamedLength = fullText.length;
        this.options.onStream?.({ content: newContent, messageId: runId });
      }
    } else if (state === "final") {
      // Reset stream tracking
      this.lastStreamedLength = 0;
      this.lastRunId = "";

      const msg = this.parseAssistantMessage(payload.message);
      if (msg && msg.content.trim().length > 0) {
        this.options.onMessage?.(msg);
      }
    } else if (state === "error") {
      // Could notify error
    }
  }

  private extractText(message: any): string | null {
    if (!message) return null;
    if (typeof message.text === "string") return message.text;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      // ONLY extract text blocks, skip tool_use, tool_result, thinking, etc.
      const textParts = message.content
        .filter((c: any) => c.type === "text" && typeof c.text === "string")
        .map((c: any) => c.text);
      return textParts.length > 0 ? textParts.join("\n") : null;
    }
    return null;
  }

  private parseAssistantMessage(message: any): ChatMessage | null {
    if (!message) return null;
    const text = this.extractText(message);
    if (!text) return null;
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: text,
      timestamp: new Date().toISOString(),
      agent: message.agent || message.name,
    };
  }

  private async sendConnect(nonce?: string) {
    if (this.connectSent) return;
    this.connectSent = true;

    try {
      await this.request("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          version: "1.0",
          platform: navigator?.platform || "web",
          mode: "webchat",
        },
        role: "operator",
        scopes: ["operator.admin"],
        auth: { token: this.options.token },
        caps: ["tool-events"],
      });

      this.activeSessionKey = this.options.sessionKey || "main";
      this.options.onStatus?.("connected");
      // Load chat history
      this.loadHistory();
    } catch (err) {
      this.options.onStatus?.("error");
      this.ws?.close();
    }
  }

  private async loadHistory() {
    try {
      const messages = await this.loadHistoryForSession(this.options.sessionKey || "main");
      this.options.onHistory?.(messages);
    } catch {
      // History load failed — not fatal
    }
  }

  /**
   * Load chat history for a specific session key.
   * Returns parsed messages array. Used by both initial load and switchSession.
   */
  async loadHistoryForSession(sessionKey: string): Promise<ChatMessage[]> {
    const result = await this.request("chat.history", {
      sessionKey,
      limit: 200,
    });
    return (Array.isArray(result?.messages) ? result.messages : [])
      .filter((m: any) => {
        if (m.role === "system") return false;
        if (m.role !== "user" && m.role !== "assistant") return false;
        const text = this.extractText(m);
        if (!text || text.trim().length === 0) return false;
        if (/^\s*NO_REPLY\s*$/.test(text)) return false;
        if (text.includes("<<<")) return false;
        if (text.includes("OPENCLAW_INTERNAL") || text.includes("UNTRUSTED_CHILD")) return false;
        return true;
      })
      .map((m: any) => this.parseChatMessage(m));
  }

  private parseChatMessage(m: any): ChatMessage {
    return {
      id: m.id || crypto.randomUUID(),
      role: m.role || "assistant",
      content: this.extractText(m) || "",
      timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
      agent: m.agent || m.name,
    };
  }

  async sendMessage(text: string) {
    return this.sendMessageToSession(text, this.options.sessionKey || "main");
  }

  /**
   * Send a message to a specific session key (for @mention routing).
   */
  async sendMessageToSession(text: string, sessionKey: string) {
    try {
      await this.request("chat.send", {
        sessionKey,
        message: text,
        deliver: false,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err) {
      console.error("[GatewayWS] send failed:", err);
      throw err;
    }
  }

  request(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("not connected"));
        return;
      }
      const id = uuid();
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ type: "req", id, method, params }));
      // Timeout after 30s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("request timeout"));
        }
      }, 30000);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.options.onStatus?.("error");
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.pending.forEach((p) => p.reject(new Error("disconnected")));
    this.pending.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.options.onStatus?.("disconnected");
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.connectSent;
  }
}
