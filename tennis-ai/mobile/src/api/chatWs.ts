import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {ChatWsEvent} from '../types/chat';

const SERVER_HOST = 'localhost:8000';

function wsBase(): string {
  if (__DEV__) {
    const host = Platform.OS === 'android' ? '10.0.2.2:8000' : 'localhost:8000';
    return `ws://${host}/api/v1`;
  }
  return `ws://${SERVER_HOST}/api/v1`;
}

type Listener = (event: ChatWsEvent) => void;

export class ChatWebSocketClient {
  private socket: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private reconnectDelay = 1000;

  async connect() {
    this.intentionallyClosed = false;
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return;
    const url = `${wsBase()}/chat/ws?token=${encodeURIComponent(token)}`;
    try {
      this.socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket.onopen = () => {
      this.reconnectDelay = 1000;
    };
    this.socket.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data) as ChatWsEvent;
        this.listeners.forEach(l => l(data));
      } catch {}
    };
    this.socket.onclose = () => {
      this.socket = null;
      if (!this.intentionallyClosed) this.scheduleReconnect();
    };
    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const chatWs = new ChatWebSocketClient();
