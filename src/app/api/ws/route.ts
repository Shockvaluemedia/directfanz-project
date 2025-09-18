import { NextRequest } from 'next/server';

interface SSEMessage {
  type: string;
  data?: any;
  contentId?: string;
  userId?: string;
}

// Store active SSE connections
const connections = new Map<string, ReadableStreamDefaultController>();
const contentSubscriptions = new Map<string, Set<string>>();

export async function GET(request: NextRequest) {
  // Handle Server-Sent Events connection
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return new Response('User ID required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Store connection
      const clientId = `${userId}_${Date.now()}`;
      connections.set(clientId, controller);
      
      // Send initial connection message
      const message = `data: ${JSON.stringify({
        type: 'connected',
        data: { message: 'SSE connection established', clientId }
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(message));
      
      // Handle connection cleanup
      const cleanup = () => {
        connections.delete(clientId);
        contentSubscriptions.forEach((subscribers, contentId) => {
          subscribers.delete(clientId);
          if (subscribers.size === 0) {
            contentSubscriptions.delete(contentId);
          }
        });
      };
      
      // Store cleanup function
      (controller as any).cleanup = cleanup;
    },
    cancel() {
      // Cleanup when connection is closed
      if ((this as any).cleanup) {
        (this as any).cleanup();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

// Handle subscription and broadcasting via POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, contentId, data, userId } = body;
    
    switch (type) {
      case 'subscribe_content':
        // Subscribe to content updates
        if (userId && contentId) {
          const clientId = Array.from(connections.keys()).find(id => id.startsWith(userId));
          if (clientId) {
            if (!contentSubscriptions.has(contentId)) {
              contentSubscriptions.set(contentId, new Set());
            }
            contentSubscriptions.get(contentId)?.add(clientId);
          }
        }
        break;
        
      case 'unsubscribe_content':
        // Unsubscribe from content updates
        if (userId && contentId) {
          const clientId = Array.from(connections.keys()).find(id => id.startsWith(userId));
          if (clientId) {
            contentSubscriptions.get(contentId)?.delete(clientId);
          }
        }
        break;
        
      case 'new_comment':
      case 'comment_updated':
      case 'comment_deleted':
      case 'content_liked':
        // Broadcast to subscribed clients
        if (contentId) {
          broadcastToContent(contentId, { type, data });
        }
        break;
        
      case 'notification':
        // Send notification to specific user
        if (userId) {
          broadcastToUser(userId, { type, data });
        }
        break;
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('SSE POST error:', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper functions for SSE broadcasting
function broadcastToContent(contentId: string, message: any, excludeClientId?: string) {
  const subscribers = contentSubscriptions.get(contentId);
  if (!subscribers) return;

  subscribers.forEach(clientId => {
    if (excludeClientId && clientId === excludeClientId) return;
    
    const controller = connections.get(clientId);
    if (controller) {
      try {
        const sseMessage = `data: ${JSON.stringify(message)}\n\n`;
        controller.enqueue(new TextEncoder().encode(sseMessage));
      } catch (error) {
        console.error('Error sending SSE message to client:', error);
        // Remove dead connection
        connections.delete(clientId);
        subscribers.delete(clientId);
      }
    }
  });
}

function broadcastToUser(userId: string, message: any) {
  const clientId = Array.from(connections.keys()).find(id => id.startsWith(userId));
  if (!clientId) return;
  
  const controller = connections.get(clientId);
  if (controller) {
    try {
      const sseMessage = `data: ${JSON.stringify(message)}\n\n`;
      controller.enqueue(new TextEncoder().encode(sseMessage));
    } catch (error) {
      console.error('Error sending SSE message to user:', error);
      connections.delete(clientId);
    }
  }
}

function broadcastToAll(message: any, excludeClientId?: string) {
  connections.forEach((controller, clientId) => {
    if (excludeClientId && clientId === excludeClientId) return;
    
    try {
      const sseMessage = `data: ${JSON.stringify(message)}\n\n`;
      controller.enqueue(new TextEncoder().encode(sseMessage));
    } catch (error) {
      console.error('Error broadcasting SSE message:', error);
      connections.delete(clientId);
    }
  });
}

