import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple test endpoint to debug streaming API issues
export async function GET(request: NextRequest) {
  try {
    // Test basic database connection
    const streamCount = await prisma.live_streams.count();
    
    // Test simple query
    const streams = await prisma.live_streams.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        isPublic: true,
        artistId: true,
      }
    });

    return NextResponse.json({
      success: true,
      debug: {
        totalStreams: streamCount,
        sampleStreams: streams,
        databaseConnected: true
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error?.constructor?.name,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      }
    });
  }
}