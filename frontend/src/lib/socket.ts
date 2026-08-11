import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

class SocketClient {
  private socket: Socket | null = null;

  connect() {
    const token = localStorage.getItem('accessToken') || '';
    if (!this.socket || !this.socket.connected) {
      if (this.socket) {
        this.socket.disconnect();
      }

      this.socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        autoConnect: true,
        auth: { token }
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected:', this.socket?.id);
      });

      this.socket.on('connect_error', (err) => {
        console.error('[Socket] Connection Error:', err.message);
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
      });
    }
    return this.socket;
  }

  getSocket() {
    const currentToken = localStorage.getItem('accessToken') || '';
    if (!this.socket || !this.socket.connected || (this.socket.auth as any)?.token !== currentToken) {
      return this.connect();
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();
