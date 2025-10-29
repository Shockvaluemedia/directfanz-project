import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocket } from '../socket-server';
import { logger } from '../logger';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Prepare Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let server: any = null;
let socketServer: any = null;

export async function initializeStreamingServer() {
  if (server) {
    logger.info('Streaming server already initialized');
    return { server, socketServer };
  }

  try {
    await app.prepare();
    
    // Create HTTP server
    server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    // Initialize Socket.IO with the HTTP server
    socketServer = initializeSocket(server);

    // Handle server startup
    server.listen(port, (err?: any) => {
      if (err) throw err;
      logger.info(`> Ready on http://${hostname}:${port}`);
      logger.info('> WebSocket server initialized for streaming');
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down streaming server...');
      server.close(() => {
        logger.info('Streaming server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down streaming server...');
      server.close(() => {
        logger.info('Streaming server closed');
        process.exit(0);
      });
    });

    return { server, socketServer };
    
  } catch (error) {
    logger.error('Failed to initialize streaming server', error);
    throw error;
  }
}

// For development - automatically start server if this file is run directly
if (require.main === module) {
  initializeStreamingServer().catch(console.error);
}

export { server, socketServer };