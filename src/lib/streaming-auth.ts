import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import crypto from 'crypto';
import { UserRole } from '@/types/database';
import { AuthenticatedRequest, withApiAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Streaming-specific permissions
export const STREAMING_PERMISSIONS = {
  // Artist streaming permissions
  'artist:stream:create': 'Create live streams',
  'artist:stream:start': 'Start live streams',
  'artist:stream:stop': 'Stop live streams',
  'artist:stream:delete': 'Delete streams',
  'artist:stream:settings': 'Modify stream settings',
  'artist:stream:analytics': 'View stream analytics',
  
  // Fan streaming permissions
  'fan:stream:view': 'View live streams',
  'fan:stream:chat': 'Participate in stream chat',
  'fan:stream:subscribe': 'Subscribe to stream notifications',
  
  // VOD permissions
  'artist:vod:create': 'Create VOD content',
  'artist:vod:manage': 'Manage VOD content',
  'fan:vod:view': 'View VOD content',
} as const;

export type StreamingPermission = keyof typeof STREAMING_PERMISSIONS;

// Extended RBAC permissions for streaming
export const STREAMING_ROLE_PERMISSIONS = {
  ARTIST: [
    'artist:stream:create',
    'artist:stream:start',
    'artist:stream:stop',
    'artist:stream:delete',
    'artist:stream:settings',
    'artist:stream:analytics',
    'artist:vod:create',
    'artist:vod:manage',
    'fan:stream:view', // Artists can also view streams
    'fan:vod:view', // Artists can also view VOD
  ],
  FAN: [
    'fan:stream:view',
    'fan:stream:chat',
    'fan:stream:subscribe',
    'fan:vod:view',
  ],
} as const;

// Check if a role has streaming permission
export function hasStreamingPermission(role: UserRole, permission: StreamingPermission): boolean {
  const rolePermissions = STREAMING_ROLE_PERMISSIONS[role as keyof typeof STREAMING_ROLE_PERMISSIONS];
  if (!rolePermissions) return false;
  return (rolePermissions as readonly string[]).includes(permission);
}

// Stream access control interface
export interface StreamAccessRequest {
  streamId: string;
  userId: string;
  userRole: UserRole;
  action: 'view' | 'create' | 'manage' | 'chat';
}

// Check if user can access a specific stream
export async function checkStreamAccess(request: StreamAccessRequest): Promise<boolean> {
  const { streamId, userId, userRole, action } = request;

  try {
    // Define required permissions for each action
    const actionPermissions: Record<string, StreamingPermission[]> = {
      view: ['fan:stream:view'],
      create: ['artist:stream:create'],
      manage: ['artist:stream:start', 'artist:stream:stop', 'artist:stream:settings'],
      chat: ['fan:stream:chat'],
    };

    const requiredPermissions = actionPermissions[action];
    if (!requiredPermissions) {
      return false;
    }

    // Check if user has any of the required permissions
    const hasAnyPermission = requiredPermissions.some(permission => 
      hasStreamingPermission(userRole, permission)
    );

    if (!hasAnyPermission) {
      return false;
    }

    // Additional checks for specific actions
    if (action === 'create' || action === 'manage') {
      // Only artists can create/manage streams
      if (userRole !== UserRole.ARTIST) {
        return false;
      }

      // Verify stream ownership in database
      if (streamId) {
        const stream = await prisma.live_streams.findUnique({
          where: { id: streamId },
        });
        if (!stream || stream.artistId !== userId) {
          return false;
        }
      }
    }

    if (action === 'view') {
      // Check subscription/tier access for private streams
      const stream = await prisma.live_streams.findUnique({
        where: { id: streamId },
      });
      if (!stream) {
        return false;
      }
      // Public streams are accessible to anyone with the view permission
      if (!stream.isPublic) {
        // Stream owner always has access
        if (stream.artistId === userId) {
          return true;
        }
        // Parse tier IDs from the stream and check for active subscription
        const tierIds: string[] = stream.tierIds ? JSON.parse(stream.tierIds) : [];
        if (tierIds.length > 0) {
          const activeSubscription = await prisma.subscriptions.findFirst({
            where: {
              fanId: userId,
              tierId: { in: tierIds },
              status: 'ACTIVE',
            },
          });
          if (!activeSubscription) {
            return false;
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Stream access check error:', error);
    return false;
  }
}

// Middleware for streaming endpoints
export async function withStreamingAuth<T = any>(
  request: NextRequest,
  requiredPermissions: StreamingPermission[],
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withApiAuth(request, async req => {
    // Check if user has required streaming permissions
    const hasRequiredPermissions = requiredPermissions.every(permission =>
      hasStreamingPermission(req.user.role, permission)
    );

    if (!hasRequiredPermissions) {
      return NextResponse.json(
        {
          error: 'Insufficient streaming permissions',
          details: 'Required streaming permissions not met',
        },
        { status: 403 }
      ) as NextResponse<T>;
    }

    return await handler(req);
  });
}

// Artist streaming middleware
export async function withArtistStreaming<T = any>(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withStreamingAuth(request, ['artist:stream:create'], handler);
}

// Fan streaming middleware
export async function withFanStreaming<T = any>(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withStreamingAuth(request, ['fan:stream:view'], handler);
}

// Stream management middleware (for stream owners)
export async function withStreamManagement<T = any>(
  request: NextRequest,
  handler: (req: AuthenticatedRequest & { streamId: string }) => Promise<NextResponse<T>>
): Promise<NextResponse<T>> {
  return withStreamingAuth(request, ['artist:stream:settings'], async req => {
    // Extract stream ID from URL or request body
    const url = new URL(request.url);
    const streamId = url.pathname.split('/').pop() || '';

    if (!streamId) {
      return NextResponse.json(
        { error: 'Stream ID required' },
        { status: 400 }
      ) as NextResponse<T>;
    }

    // Verify stream ownership
    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
    });
    if (!stream || stream.artistId !== req.user.id) {
      return NextResponse.json(
        { error: 'You do not own this stream' },
        { status: 403 }
      ) as NextResponse<T>;
    }

    const extendedReq = req as AuthenticatedRequest & { streamId: string };
    extendedReq.streamId = streamId;

    return await handler(extendedReq);
  });
}

// Generate signed URLs for MediaStore access
export async function generateStreamAccessUrl(
  streamId: string,
  userId: string,
  userRole: UserRole,
  expirationMinutes: number = 60
): Promise<string | null> {
  try {
    // Check if user can access the stream
    const canAccess = await checkStreamAccess({
      streamId,
      userId,
      userRole,
      action: 'view'
    });

    if (!canAccess) {
      return null;
    }

    // Generate MediaStore signed URL
    const mediaStoreEndpoint = process.env.MEDIASTORE_ENDPOINT;
    if (!mediaStoreEndpoint) {
      throw new Error('MediaStore endpoint not configured');
    }

    // Generate a signed URL with HMAC signature and expiration.
    // Fail closed if no signing secret is configured — an empty HMAC key would
    // make stream signatures forgeable and bypass access control.
    const streamUrl = `${mediaStoreEndpoint}/live/${streamId}/index.m3u8`;
    const signingSecret = process.env.STREAM_URL_SIGNING_SECRET || process.env.NEXTAUTH_SECRET;
    if (!signingSecret) {
      throw new Error('Stream URL signing secret is not configured');
    }
    const expiresAt = Math.floor(Date.now() / 1000) + expirationMinutes * 60;
    const payload = `${streamId}:${userId}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', signingSecret)
      .update(payload)
      .digest('hex');

    const signedUrl = `${streamUrl}?userId=${encodeURIComponent(userId)}&expires=${expiresAt}&signature=${signature}`;

    return signedUrl;
  } catch (error) {
    console.error('Error generating stream access URL:', error);
    return null;
  }
}

// Validate stream key format
export async function validateStreamKey(
  streamKey: string,
  userId: string
): Promise<boolean> {
  try {
    // Basic format validation
    if (!streamKey || streamKey.length < 10) {
      return false;
    }

    // Check if stream key format is valid (should be UUID-like)
    const streamKeyRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!streamKeyRegex.test(streamKey)) {
      return false;
    }

    // Validate stream key belongs to the user in the database
    const stream = await prisma.live_streams.findFirst({
      where: {
        streamKey,
        artistId: userId,
      },
    });

    return !!stream;
  } catch (error) {
    console.error('Stream key validation error:', error);
    return false;
  }
}

// Stream session management
export interface StreamSession {
  streamId: string;
  userId: string;
  streamKey: string;
  mediaLiveChannelId: string;
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped';
  startedAt?: Date;
  endedAt?: Date;
  viewerCount: number;
}

// Create a new stream session
export async function createStreamSession(
  userId: string,
  streamTitle: string,
  streamDescription?: string
): Promise<StreamSession | null> {
  try {
    const streamKey = crypto.randomUUID();

    // Create the stream record in the database
    const dbStream = await prisma.live_streams.create({
      data: {
        id: crypto.randomUUID(),
        artistId: userId,
        title: streamTitle,
        description: streamDescription || null,
        streamKey,
        status: 'SCHEDULED',
        tierIds: '',
        isPublic: false,
        updatedAt: new Date(),
      },
    });

    const session: StreamSession = {
      streamId: dbStream.id,
      userId,
      streamKey: dbStream.streamKey,
      mediaLiveChannelId: process.env.MEDIALIVE_CHANNEL_ID || '',
      status: 'idle',
      viewerCount: 0,
    };

    return session;
  } catch (error) {
    console.error('Error creating stream session:', error);
    return null;
  }
}

// Update stream session status
export async function updateStreamStatus(
  streamId: string,
  status: StreamSession['status']
): Promise<boolean> {
  try {
    // Map session status to database status and set appropriate timestamps
    const statusMap: Record<StreamSession['status'], string> = {
      idle: 'SCHEDULED',
      starting: 'SCHEDULED',
      running: 'LIVE',
      stopping: 'ENDED',
      stopped: 'ENDED',
    };

    const updateData: Record<string, any> = {
      status: statusMap[status] || status,
    };

    if (status === 'running') {
      updateData.startedAt = new Date();
    }
    if (status === 'stopped' || status === 'stopping') {
      updateData.endedAt = new Date();
    }

    await prisma.live_streams.update({
      where: { id: streamId },
      data: updateData,
    });

    console.log(`Updated stream ${streamId} status to ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating stream status:', error);
    return false;
  }
}

// Get active streams for a user
export async function getUserActiveStreams(userId: string): Promise<StreamSession[]> {
  try {
    const activeStreams = await prisma.live_streams.findMany({
      where: {
        artistId: userId,
        status: { in: ['LIVE', 'SCHEDULED'] },
      },
    });

    return activeStreams.map((stream: any) => ({
      streamId: stream.id,
      userId: stream.artistId,
      streamKey: stream.streamKey,
      mediaLiveChannelId: process.env.MEDIALIVE_CHANNEL_ID || '',
      status: stream.status === 'LIVE' ? 'running' as const : 'idle' as const,
      startedAt: stream.startedAt || undefined,
      endedAt: stream.endedAt || undefined,
      viewerCount: stream.totalViewers || 0,
    }));
  } catch (error) {
    console.error('Error getting user active streams:', error);
    return [];
  }
}

// Stream analytics and metrics
export interface StreamMetrics {
  streamId: string;
  viewerCount: number;
  peakViewers: number;
  totalViews: number;
  duration: number; // in seconds
  chatMessages: number;
  likes: number;
}

// Get stream metrics
export async function getStreamMetrics(streamId: string): Promise<StreamMetrics | null> {
  try {
    const stream = await prisma.live_streams.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      return null;
    }

    const chatMessages = await prisma.stream_chat_messages.count({
      where: { streamId },
    });

    // Calculate duration in seconds from startedAt to endedAt (or now if still live)
    let duration = 0;
    if (stream.startedAt) {
      const endTime = stream.endedAt || new Date();
      duration = Math.floor((endTime.getTime() - stream.startedAt.getTime()) / 1000);
    }

    return {
      streamId,
      viewerCount: stream.totalViewers || 0,
      peakViewers: stream.peakViewers || 0,
      totalViews: stream.totalViewers || 0,
      duration,
      chatMessages,
      likes: 0,
    };
  } catch (error) {
    console.error('Error getting stream metrics:', error);
    return null;
  }
}