import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole } from '@/types/database';
import { AuthenticatedRequest, withApiAuth } from '@/lib/api-auth';
import { hasPermission, Permission } from '@/lib/rbac';

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

      // TODO: Add database check to verify stream ownership
      // For now, we'll assume the artist owns the stream if they have the permission
    }

    if (action === 'view') {
      // TODO: Add subscription/tier checks for private streams
      // For now, we'll allow viewing if user has the permission
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

    // TODO: Verify stream ownership
    // For now, we'll trust that the authenticated artist owns the stream

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

    // For now, return the direct URL
    // In production, this would generate a signed URL with expiration
    const streamUrl = `${mediaStoreEndpoint}/live/${streamId}/index.m3u8`;
    
    // TODO: Implement actual signed URL generation with AWS SDK
    // This would involve creating a signed URL with expiration time
    
    return streamUrl;
  } catch (error) {
    console.error('Error generating stream access URL:', error);
    return null;
  }
}

// Validate stream key for MediaLive input
export async function validateStreamKey(
  streamKey: string,
  userId: string
): Promise<boolean> {
  try {
    // TODO: Implement stream key validation
    // This would check if the stream key belongs to the user
    // and is valid for starting a stream
    
    // For now, we'll do basic validation
    if (!streamKey || streamKey.length < 10) {
      return false;
    }

    // Check if stream key format is valid (should be UUID-like)
    const streamKeyRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!streamKeyRegex.test(streamKey)) {
      return false;
    }

    return true;
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
    // TODO: Implement database operations to create stream session
    // This would create a new stream record in the database
    
    const streamId = crypto.randomUUID();
    const streamKey = crypto.randomUUID();
    
    const session: StreamSession = {
      streamId,
      userId,
      streamKey,
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
    // TODO: Implement database update for stream status
    console.log(`Updating stream ${streamId} status to ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating stream status:', error);
    return false;
  }
}

// Get active streams for a user
export async function getUserActiveStreams(userId: string): Promise<StreamSession[]> {
  try {
    // TODO: Implement database query for user's active streams
    return [];
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
    // TODO: Implement metrics collection from CloudWatch and database
    return {
      streamId,
      viewerCount: 0,
      peakViewers: 0,
      totalViews: 0,
      duration: 0,
      chatMessages: 0,
      likes: 0,
    };
  } catch (error) {
    console.error('Error getting stream metrics:', error);
    return null;
  }
}