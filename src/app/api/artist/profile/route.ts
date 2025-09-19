import { NextRequest, NextResponse } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const artist = await prisma.users.findUnique({
        where: { id: req.user.id },
        include: {
          artists: true,
          tiers: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              content: true,
              tiers: true,
            },
          },
        },
      });

      if (!artist) {
        return NextResponse.json({ error: 'Artist profile not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: artist.id,
          email: artist.email,
          displayName: artist.displayName,
          bio: artist.bio,
          avatar: artist.avatar,
          socialLinks: artist.socialLinks,
          artists: artist.artists,
          tiers: artist.tiers,
          stats: {
            totalContent: artist._count.content,
            totalTiers: artist._count.tiers,
            totalSubscribers: artist.artists?.totalSubscribers || 0,
            totalEarnings: artist.artists?.totalEarnings || 0,
          },
        },
      });
    } catch (error) {
      console.error('Artist profile fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch artist profile' }, { status: 500 });
    }
  });
}

export async function PUT(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const body = await request.json();
      const { displayName, bio, avatar, socialLinks } = body;

      const updatedArtist = await prisma.users.update({
        where: { id: req.user.id },
        data: {
          displayName,
          bio,
          avatar,
          socialLinks,
        },
        include: {
          artists: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Artist profile updated successfully',
        data: updatedArtist,
      });
    } catch (error) {
      console.error('Artist profile update error:', error);
      return NextResponse.json({ error: 'Failed to update artist profile' }, { status: 500 });
    }
  });
}
