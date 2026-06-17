import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import type { AlertData } from '../types';

interface WebSocketMessage {
  type: 'alert' | 'status' | 'data';
  payload: unknown;
}

interface AlertMessage {
  id: string;
  measurementId: string;
  level: 'warning' | 'danger';
  message: string;
  threshold: number;
  actualValue: number;
  crossSectionPosition: number;
  pointCloudPhase: string;
}

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  readyState: number;
  reconnectAttempts: number;
  lastMessage: unknown | null;
  connect: () => void;
  disconnect: () => void;
  send: (data: unknown) => boolean;
  sendJson: (data: unknown) => boolean;
}

export function useWebSocket(
  url: string = 'ws://localhost:8080/ws',
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { addAlert } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const {
    autoConnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
  } = options;

  const parseAlertMessage = useCallback((data: AlertMessage): AlertData => {
    return {
      id: data.id,
      measurement_id: data.measurementId,
      level: data.level,
      message: data.message,
      threshold: data.threshold,
      actual_value: data.actualValue,
      acknowledged: false,
      created_at: new Date().toISOString(),
      cross_section_position: data.crossSectionPosition,
      point_cloud_phase: data.pointCloudPhase,
    };
  }, []);

  const handleOpen = useCallback((event: Event) => {
    setIsConnected(true);
    setReadyState(WebSocket.OPEN);
    setReconnectAttempts(0);
    onOpen?.(event);
  }, [onOpen]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);
      setLastMessage(data);

      if (data.type === 'alert') {
        const alertMessage = data.payload as AlertMessage;
        const alert = parseAlertMessage(alertMessage);
        addAlert(alert);
      }

      onMessage?.(event);
    } catch {
      setLastMessage(event.data);
    }
  }, [addAlert, parseAlertMessage, onMessage]);

  const handleError = useCallback((event: Event) => {
    setIsConnected(false);
    onError?.(event);
  }, [onError]);

  const handleClose = useCallback((event: CloseEvent) => {
    setIsConnected(false);
    setReadyState(WebSocket.CLOSED);
    onClose?.(event);

    if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts) {
      const attempt = reconnectAttempts + 1;
      setReconnectAttempts(attempt);
      onReconnect?.(attempt);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);
    } else if (reconnectAttempts >= maxReconnectAttempts) {
      onReconnectFailed?.();
    }
  }, [reconnectAttempts, maxReconnectAttempts, reconnectInterval, onClose, onReconnect, onReconnectFailed]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    shouldReconnectRef.current = true;
    setReadyState(WebSocket.CONNECTING);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = handleOpen;
      ws.onmessage = handleMessage;
      ws.onerror = handleError;
      ws.onclose = handleClose;
    } catch (error) {
      setReadyState(WebSocket.CLOSED);
      handleError(error as Event);
    }
  }, [url, handleOpen, handleMessage, handleError, handleClose]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setReadyState(WebSocket.CLOSED);
  }, []);

  const send = useCallback((data: unknown): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        wsRef.current.send(message);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const sendJson = useCallback((data: unknown): boolean => {
    return send(JSON.stringify(data));
  }, [send]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    readyState,
    reconnectAttempts,
    lastMessage,
    connect,
    disconnect,
    send,
    sendJson,
  };
}
