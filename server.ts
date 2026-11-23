// Must load first: sets up the Node globals (AsyncLocalStorage) that Next's
// server modules expect, before the chat code pulls any of them in.
import 'next/dist/server/node-environment';
import { createServer } from 'node:http';
import next from 'next';
import { parse } from 'node:url';
import { basename } from 'node:path';
import { initializeSocket } from './src/lib/socket-server';
import { logger } from './src/lib/logger';

/**
 * Production server: Next.js and the Socket.IO chat on one port.
 *
 * Built by `npm run build:server` into dist/server.cjs and started with
 * `npm run start:server`. Settings come from the environment (on AWS, ECS
 * injects them from Secrets Manager and Terraform); nothing is fetched here.
 */
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || (dev ? 'localhost' : '0.0.0.0');
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

  // Graceful shutdown handling for ECS
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    httpServer.close(() => {
      logger.info('HTTP server closed');
      io.close(() => {
        logger.info('Socket.IO server closed');
        process.exit(0);
      });
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return { httpServer, io, nextApp };
}

// Start server if this file is run directly
// Start when run directly (tsx server.ts, or node dist/server.cjs).
if (/^server\.(ts|js|cjs|mjs)$/.test(basename(process.argv[1] ?? ''))) {
  createCustomServer()
    .then(({ httpServer }) => {
      httpServer.listen(port, hostname, () => {
        logger.info(`🚀 Server ready on http://${hostname}:${port}`);
        logger.info('📡 WebSocket server active');
      });
    })
    .catch(err => {
      logger.error('Failed to start server', {}, err);
      process.exit(1);
    });
}
