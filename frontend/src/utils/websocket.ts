export interface WebSocketOptions {
  url: string;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: string;
}

export type WebSocketMessage = string | ArrayBuffer | Blob | ArrayBufferView;

export interface WebSocketHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

type ResolvedWebSocketOptions = Required<Omit<WebSocketOptions, 'protocols'>> & Pick<WebSocketOptions, 'protocols'>;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: ResolvedWebSocketOptions;
  private handlers: WebSocketHandlers;
  private reconnectAttempts: number = 0;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private isManualClose: boolean = false;

  constructor(options: WebSocketOptions, handlers: WebSocketHandlers = {}) {
    this.options = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      heartbeatMessage: 'ping',
      ...options,
    };
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.isManualClose = false;
    this.ws = new WebSocket(this.options.url, this.options.protocols);

    this.ws.onopen = (event) => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.handlers.onOpen?.(event);
    };

    this.ws.onmessage = (event) => {
      if (event.data === 'pong') {
        return;
      }
      this.handlers.onMessage?.(event);
    };

    this.ws.onerror = (event) => {
      this.handlers.onError?.(event);
    };

    this.ws.onclose = (event) => {
      this.stopHeartbeat();
      this.handlers.onClose?.(event);
      
      if (!this.isManualClose && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else if (!this.isManualClose) {
        this.handlers.onReconnectFailed?.();
      }
    };
  }

  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      this.ws.send(message);
      return true;
    } catch {
      return false;
    }
  }

  sendJson(data: unknown): boolean {
    return this.send(JSON.stringify(data));
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    if (this.options.heartbeatInterval <= 0) {
      return;
    }

    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(this.options.heartbeatMessage);
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnect();
    
    this.reconnectAttempts++;
    this.handlers.onReconnect?.(this.reconnectAttempts);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.options.reconnectInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export function createWebSocketClient(
  options: WebSocketOptions,
  handlers?: WebSocketHandlers
): WebSocketClient {
  return new WebSocketClient(options, handlers);
}

export function connectWebSocket(
  url: string,
  handlers?: WebSocketHandlers,
  options?: Omit<WebSocketOptions, 'url'>
): WebSocketClient {
  const client = new WebSocketClient({ url, ...options }, handlers);
  client.connect();
  return client;
}
