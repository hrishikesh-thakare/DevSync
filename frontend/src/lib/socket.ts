import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

/**
 * Wraps the socket.io client so room membership survives a reconnect.
 *
 * The server puts every socket into `user:<id>` and its `workspace:<id>` rooms
 * itself, on connect, from the database. `project:` and `channel:` rooms are
 * different: they are joined on client request, because they need an access
 * check the server only runs when asked.
 *
 * That asymmetry was a real bug. Pages emit `join_room` from a mount effect
 * (`ProjectLayout`, `ChannelPage`), and socket.io reconnects transparently —
 * new socket id on the server, so its rooms are gone, while the effect that
 * would rejoin them does not re-run because the component never unmounted. The
 * symptom: close a laptop, reopen it, and the UI looks connected while board
 * updates and new messages silently stop arriving, until you navigate away and
 * back.
 *
 * So the set of wanted rooms is tracked here and replayed on every `connect`.
 * `join`/`leave` are reference-counted because two components can legitimately
 * want the same room at once — unmounting one must not evict the other.
 */
class SocketClient {
  private socket: Socket | null = null;
  /** Room id → how many callers currently want it. */
  private rooms = new Map<string, number>();

  private attach(socket: Socket) {
    socket.on('connect', () => {
      // Runs on the first connect *and* on every reconnect, which is the whole
      // point: a reconnect is a new server-side socket with no rooms.
      for (const room of this.rooms.keys()) {
        socket.emit('join_room', room);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    // The server emits this when it refuses a join. Without a listener the
    // refusal was invisible and the page waited forever for events that were
    // never coming.
    socket.on('room_join_denied', ({ roomId }: { roomId: string }) => {
      console.warn('[Socket] Join denied for room:', roomId);
      this.rooms.delete(roomId);
    });
  }

  connect() {
    const token = localStorage.getItem('accessToken') || '';

    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        autoConnect: true,
        auth: { token },
      });
      this.attach(this.socket);
      return this.socket;
    }

    // Same socket, refreshed credentials. Updating `auth` in place and letting
    // socket.io reconnect keeps every listener bound by the pages intact —
    // tearing the socket down instead would silently orphan them.
    this.socket.auth = { token };
    if (!this.socket.connected) this.socket.connect();
    return this.socket;
  }

  getSocket() {
    const currentToken = localStorage.getItem('accessToken') || '';
    const socketToken = (this.socket?.auth as { token?: string } | undefined)?.token;

    if (!this.socket || socketToken !== currentToken) {
      return this.connect();
    }
    if (!this.socket.connected) this.socket.connect();
    return this.socket;
  }

  /**
   * Register interest in a room and join it. Returns a function that releases
   * that interest — call it from the effect's cleanup.
   */
  joinRoom(room: string): () => void {
    const next = (this.rooms.get(room) ?? 0) + 1;
    this.rooms.set(room, next);

    const socket = this.getSocket();
    // Only emit on the first claim; the reconnect handler replays the rest.
    if (next === 1 && socket.connected) socket.emit('join_room', room);

    return () => this.leaveRoom(room);
  }

  private leaveRoom(room: string) {
    const remaining = (this.rooms.get(room) ?? 1) - 1;

    if (remaining > 0) {
      this.rooms.set(room, remaining);
      return;
    }

    this.rooms.delete(room);
    if (this.socket?.connected) this.socket.emit('leave_room', room);
  }

  disconnect() {
    this.rooms.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();
