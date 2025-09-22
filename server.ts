import { createServer } from 'node:http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { parse } from 'node:url';
import { initializeSocket } from './src/lib/socket-server.ts';
import { logger } from './src/lib/logger.js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Prepare Next.js app
const nextApp = next({ dev, hostname, port });
const nextHandler = nextApp.getRequestHandler();

export default async function createCustomServer() {
  await nextApp.prepare();

  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await nextHandler(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO server with messaging system
  const io = initializeSocket(httpServer);

  // Global error handling for Socket.IO
  io.engine.on('connection_error', err => {
    logger.error('Socket.IO connection error', {
      req: err.req,
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  return { httpServer, io, nextApp };
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createCustomServer()
    .then(({ httpServer }) => {
      httpServer.listen(port, () => {
        logger.info(`🚀 Server ready on http://${hostname}:${port}`);
        logger.info('📡 WebSocket and WebRTC signaling server active');
      });
    })
    .catch(err => {
      logger.error('Failed to start server', {}, err);
      process.exit(1);
    });
}
