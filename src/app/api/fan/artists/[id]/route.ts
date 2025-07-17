import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user and verify they are a fan
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || user.role !== 'FAN') {
      return NextResponse.json(
        { error: 'Only fans can view artist profiles' },
        { status: 403 }
      );
    }

    // Get artist details with tiers and content
    const artist = await prisma.user.findUnique({
      where: { 
        id: params.id,
        role: 'ARTIST',
      },
      select: {
        id: true,
        displayName: true,
        bio: true,
        avatar: true,
        socialLinks: true,
        createdAt: true,
        artistProfile: {
          select: {
            totalSubscribers: true,
            isStripeOnboarded: true,
          },
        },
        tiers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            minimumPrice: true,
            subscriberCount: true,
          },
          orderBy: { minimumPrice: 'asc' },
        },
        content: {
          where: { isPublic: true },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            fileUrl: true,
            thumbnailUrl: true,
            createdAt: true,
            tags: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10, // Show latest 10 public content items
        },
      },
    });

    if (!artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    if (!artist.artistProfile?.isStripeOnboarded) {
      return NextResponse.json(
        { error: 'Artist is not accepting subscriptions yet' },
        { status: 400 }
      );
    }

    // Check if fan has any existing subscriptions to this artist
    const existingSubscriptions = await prisma.subscription.findMany({
      where: {
        fanId: user.id,
        artistId: artist.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        tierId: true,
        amount: true,
        status: true,
        currentPeriodEnd: true,
        tier: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      artist,
      existingSubscriptions,
    });
  } catch (error) {
    console.error('Get artist error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artist' },
      { status: 500 }
    );
  }
}