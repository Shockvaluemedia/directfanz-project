import { Server } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/auth';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Store active connections
const streamConnections = new Map<string, Set<string>>();
const userSockets = new Map<string, string>();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = await verifyJWT(token);
      socket.userId = payload.sub;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected`);
    userSockets.set(socket.userId, socket.id);

    // Join stream room
    socket.on('join_stream', async (data) => {
      const { streamId } = data;
      
      try {
        const stream = await prisma.liveStream.findUnique({
          where: { id: streamId },
          include: { streamer: true }
        });

        if (!stream) {
          socket.emit('error', { message: 'Stream not found' });
          return;
        }

        socket.join(`stream_${streamId}`);
        
        // Add to stream connections
        if (!streamConnections.has(streamId)) {
          streamConnections.set(streamId, new Set());
        }
        streamConnections.get(streamId)!.add(socket.userId);

        // Create viewer record
        await prisma.streamViewer.upsert({
          where: {
            streamId_userId: {
              streamId,
              userId: socket.userId
            }
          },
          update: { joinedAt: new Date() },
          create: {
            streamId,
            userId: socket.userId,
            joinedAt: new Date()
          }
        });

        // Broadcast viewer count update
        const viewerCount = streamConnections.get(streamId)?.size || 0;
        io.to(`stream_${streamId}`).emit('viewer_count_updated', { 
          streamId, 
          count: viewerCount 
        });

        socket.emit('stream_joined', { 
          streamId, 
          stream,
          viewerCount 
        });

      } catch (error) {
        console.error('Join stream error:', error);
        socket.emit('error', { message: 'Failed to join stream' });
      }
    });

    // Leave stream room
    socket.on('leave_stream', async (data) => {
      const { streamId } = data;
      
      socket.leave(`stream_${streamId}`);
      streamConnections.get(streamId)?.delete(socket.userId);

      // Update viewer count
      const viewerCount = streamConnections.get(streamId)?.size || 0;
      io.to(`stream_${streamId}`).emit('viewer_count_updated', { 
        streamId, 
        count: viewerCount 
      });
    });

    // Handle chat messages
    socket.on('stream_chat', async (data) => {
      const { streamId, message } = data;

      try {
        const user = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { userName: true, displayName: true, avatar: true }
        });

        const chatMessage = await prisma.streamChatMessage.create({
          data: {
            streamId,
            userId: socket.userId,
            content: message,
            type: 'MESSAGE'
          }
        });

        const messageData = {
          id: chatMessage.id,
          content: message,
          type: 'MESSAGE',
          createdAt: chatMessage.createdAt,
          user: {
            id: socket.userId,
            userName: user?.userName,
            displayName: user?.displayName,
            avatar: user?.avatar
          }
        };

        io.to(`stream_${streamId}`).emit('stream_chat_message', messageData);

      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle donations
    socket.on('stream_donation', async (data) => {
      const { streamId, amount, message } = data;

      try {
        const user = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { userName: true, displayName: true, avatar: true }
        });

        // Create donation record
        const donation = await prisma.streamDonation.create({
          data: {
            streamId,
            donorId: socket.userId,
            amount: parseFloat(amount),
            message: message || null
          }
        });

        // Create chat message for donation
        const chatMessage = await prisma.streamChatMessage.create({
          data: {
            streamId,
            userId: socket.userId,
            content: `Donated $${amount}${message ? `: ${message}` : ''}`,
            type: 'DONATION',
            metadata: { donationId: donation.id, amount }
          }
        });

        const donationData = {
          id: donation.id,
          amount: donation.amount,
          message: donation.message,
          createdAt: donation.createdAt,
          donor: {
            id: socket.userId,
            userName: user?.userName,
            displayName: user?.displayName,
            avatar: user?.avatar
          }
        };

        const chatData = {
          id: chatMessage.id,
          content: chatMessage.content,
          type: 'DONATION',
          createdAt: chatMessage.createdAt,
          metadata: { amount: donation.amount },
          user: {
            id: socket.userId,
            userName: user?.userName,
            displayName: user?.displayName,
            avatar: user?.avatar
          }
        };

        io.to(`stream_${streamId}`).emit('stream_donation', donationData);
        io.to(`stream_${streamId}`).emit('stream_chat_message', chatData);

      } catch (error) {
        console.error('Donation error:', error);
        socket.emit('error', { message: 'Failed to process donation' });
      }
    });

    // Handle likes
    socket.on('stream_like', async (data) => {
      const { streamId } = data;

      try {
        await prisma.streamLike.upsert({
          where: {
            streamId_userId: {
              streamId,
              userId: socket.userId
            }
          },
          update: {},
          create: {
            streamId,
            userId: socket.userId
          }
        });

        const likeCount = await prisma.streamLike.count({
          where: { streamId }
        });

        io.to(`stream_${streamId}`).emit('stream_like_updated', { 
          streamId, 
          count: likeCount 
        });

      } catch (error) {
        console.error('Like error:', error);
        socket.emit('error', { message: 'Failed to like stream' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
      userSockets.delete(socket.userId);

      // Remove from all stream connections
      streamConnections.forEach((viewers, streamId) => {
        if (viewers.has(socket.userId)) {
          viewers.delete(socket.userId);
          
          // Update viewer count
          const viewerCount = viewers.size;
          io.to(`stream_${streamId}`).emit('viewer_count_updated', { 
            streamId, 
            count: viewerCount 
          });
        }
      });
    });
  });

  const port = process.env.WS_PORT || 3001;
  server.listen(port, () => {
    console.log(`WebSocket server running on port ${port}`);
  });
});

declare module 'socket.io' {
  interface Socket {
    userId: string;
  }
}