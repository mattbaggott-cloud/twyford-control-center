/**
 * Gateway WebSocket Connection Manager
 * Connects to the OpenClaw Gateway for real-time chat messaging.
 * 
 * Protocol (from webchat.md):
 * - chat.history: fetch conversation history
 * - chat.send: send a message
 * - Gateway pushes new messages via WebSocket events
 * 
 * Auth: connect message sent after WebSocket opens
 *   { type: "connect", params: { auth: { token } } }
 *   Gateway responds with connect confirmation before history is requested
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string; // ISO string
  agent?: string; // agent name if assistant
}

type MessageHandler = (message: ChatMessage) => void;
type StatusHandler = (status: "connecting" | "connected" | "disconnected" | "error") => void;
type StreamHandler = (chunk: { content: string; messageId: string }) => void;

interface GatewayWSOptions {
  url: string;
  token: string;
  onMessage?: MessageHandler;
  onStatus?: StatusHandler;
  onStream?: StreamHandler;
  onHistory?: (messages: ChatMessage[]) => void;
}

export class GatewayWS {
  private ws: WebSocket | null = null;
  private options: GatewayWSOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private intentionalClose = false;

  constructor(options: GatewayWSOptions) {
    this.options = options;
  }

  connect() {
    this.intentionalClose = false;
    this.options.onStatus?.("connecting");

    try {
      // Connect to plain URL — auth is done via connect message, not query param
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        // Send auth via connect message; history is requested after connect confirmation
        this.send({
          type: "connect",
          params: {
            auth: {
              token: this.options.token,
            },
          },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {
          // Non-JSON message, ignore
        }
      };

      this.ws.onclose = () => {
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

  private handleMessage(data: Record<string, unknown>) {
    const type = data.type as string;

    // Connect confirmation — gateway accepted auth
    if (type === "connect.ok" || type === "connected" || (data.ok === true && !type)) {
      this.options.onStatus?.("connected");
      this.requestHistory();
      return;
    }

    if (type === "chat.history" || type === "chat.history.response") {
      // History response — array of messages
      const messages = (data.messages || data.history || []) as Array<Record<string, unknown>>;
      const parsed = messages.map((m) => this.parseMessage(m));
      this.options.onHistory?.(parsed);
    } else if (type === "chat.message" || type === "chat.response" || type === "message") {
      // New message from gateway
      const msg = this.parseMessage(data);
      this.options.onMessage?.(msg);
    } else if (type === "chat.stream" || type === "stream") {
      // Streaming chunk
      this.options.onStream?.({
        content: (data.content || data.text || data.chunk || "") as string,
        messageId: (data.id || data.messageId || "") as string,
      });
    } else if (type === "error") {
      console.error("[GatewayWS] Error from gateway:", data.message || data.error);
    }
    // Other message types are ignored for now
  }

  private parseMessage(data: Record<string, unknown>): ChatMessage {
    return {
      id: (data.id || data.messageId || crypto.randomUUID()) as string,
      role: (data.role as ChatMessage["role"]) || "assistant",
      content: (data.content || data.text || data.message || "") as string,
      timestamp: (data.timestamp || data.ts || new Date().toISOString()) as string,
      agent: (data.agent || data.name) as string | undefined,
    };
  }

  requestHistory() {
    this.send({ type: "chat.history" });
  }

  sendMessage(text: string) {
    this.send({ type: "chat.send", message: text });
  }

  private send(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.options.onStatus?.("error");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.options.onStatus?.("disconnected");
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
