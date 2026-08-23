import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { users } from '../db/schema/auth.js';
import { channels, channelMembers } from '../db/schema/channels.js';
import { projects, projectMembers } from '../db/schema/projects.js';
import { workspaceMembers } from '../db/schema/workspaces.js';
import { and, eq } from 'drizzle-orm';

/**
 * Mirrors requireChannelAccess for socket room subscriptions.
 * A user may join a channel room only if they would also be allowed
 * to fetch its messages via the REST API.
 */
const canAccessChannel = async (userId: string, channelId: string): Promise<boolean> => {
  try {
    const [channel] = await db
      .select({
        workspaceId: channels.workspaceId,
        projectId: channels.projectId,
        type: channels.type,
      })
      .from(channels)
      .where(eq(channels.channelId, channelId))
      .limit(1);

    if (!channel || !channel.workspaceId) return false;

    const [membership] = await db
      .select({ role: workspaceMembers.role, state: workspaceMembers.state })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, channel.workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership || membership.state !== 'active') return false;

    if (channel.projectId) {
      // Workspace owners/admins get implicit access to all project channels
      if (membership.role === 'owner' || membership.role === 'admin') return true;

      const [pMember] = await db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, channel.projectId),
            eq(projectMembers.userId, userId)
          )
        )
        .limit(1);

      return Boolean(pMember);
    }

    // Public workspace channels are accessible to all workspace members
    if (channel.type === 'public') return true;

    // Private channels and DMs require explicit channel membership
    const [cMember] = await db
      .select({ id: channelMembers.id })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, channelId),
          eq(channelMembers.userId, userId)
        )
      )
      .limit(1);

    return Boolean(cMember);
  } catch (err) {
    console.error('canAccessChannel error:', err);
    return false;
  }
};

let io: Server;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  });

  // Authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string };
      
      const [user] = await db
        .select({ userId: users.userId, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.userId, decoded.userId))
        .limit(1);

      if (!user || user.deletedAt) {
        return next(new Error('Authentication error: User not found or deactivated'));
      }

      // Attach user ID to socket
      socket.data.userId = user.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`🔌 User connected: ${userId} (Socket: ${socket.id})`);

    // Join personal user room (for direct notifications)
    socket.join(`user:${userId}`);

    // Join a room per active workspace membership. These are joined server-side
    // from the database, never on client request, so a socket can only ever be
    // in rooms its user actually belongs to. Presence updates are addressed to
    // these rooms instead of being broadcast to every connected socket.
    void (async () => {
      try {
        const memberships = await db
          .select({ workspaceId: workspaceMembers.workspaceId })
          .from(workspaceMembers)
          .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.state, 'active')));

        for (const m of memberships) {
          if (m.workspaceId) socket.join(`workspace:${m.workspaceId}`);
        }
      } catch (err) {
        console.error('Failed to join workspace rooms:', err);
      }
    })();

    // Join workspace/project/channel rooms
    socket.on('join_room', async (roomId: string) => {
      if (typeof roomId !== 'string') return;

      if (roomId.startsWith('channel:')) {
        const channelId = roomId.slice('channel:'.length);
        const allowed = await canAccessChannel(userId, channelId);

        if (!allowed) {
          console.log(`Socket ${socket.id} denied join of channel room ${roomId}`);
          socket.emit('room_join_denied', { roomId });
          return;
        }
      } else if (roomId.startsWith('project:')) {
        const projectId = roomId.slice('project:'.length);
        
        // Simple access check for projects: user must have a role in the project
        // or be a workspace admin/owner.
        const [project] = await db.select({ workspaceId: projects.workspaceId }).from(projects).where(eq(projects.projectId, projectId)).limit(1);
        if (!project) return;
        
        const [membership] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, project.workspaceId!), eq(workspaceMembers.userId, userId), eq(workspaceMembers.state, 'active'))).limit(1);
        
        if (!membership) return;
        
        if (membership.role !== 'owner' && membership.role !== 'admin') {
           const [pMember] = await db.select().from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).limit(1);
           if (!pMember) {
              console.log(`Socket ${socket.id} denied join of project room ${roomId}`);
              socket.emit('room_join_denied', { roomId });
              return;
           }
        }
      } else {
        console.log(`Socket ${socket.id} denied join of invalid room ${roomId}`);
        return;
      }

      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);
    });

    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
      console.log(`Socket ${socket.id} left room ${roomId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${userId} (Socket: ${socket.id})`);
    });
  });

  return io;
};

/**
 * Announces a presence/status change to the people who can actually see it.
 *
 * This used to be a bare `io.emit`, which reached every connected socket on the
 * server — so a status message like "at the doctor" was delivered to users who
 * shared no workspace with its author. Addressing the author's workspace rooms
 * keeps the update inside the tenancy boundary the rest of the API enforces.
 */
export const broadcastPresence = async (
  userId: string,
  presence: string,
  statusText: string,
): Promise<void> => {
  try {
    const memberships = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.state, 'active')));

    const payload = { userId, presence, statusText };
    const server = getIO();

    for (const m of memberships) {
      if (m.workspaceId) server.to(`workspace:${m.workspaceId}`).emit('user_presence_updated', payload);
    }
  } catch (err) {
    console.error('broadcastPresence error:', err);
  }
};

// Helper function to get the io instance from anywhere in the backend
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
};
