import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withArtistApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { announcementSchema, FanListError, sendAnnouncement } from '@/lib/fan-list';

// GET /api/artist/fan-list/announcements - announcements the artist has sent
export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const announcements = await prisma.fan_list_announcements.findMany({
        where: { artistId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ success: true, data: announcements });
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch announcements' },
        { status: 500 }
      );
    }
  });
}

// POST /api/artist/fan-list/announcements - email the artist's fan list
export async function POST(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const input = announcementSchema.parse(await request.json());
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const result = await sendAnnouncement(req.user.id, input, baseUrl);
      return NextResponse.json({ success: true, data: result }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof FanListError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.status }
        );
      }
      console.error('Error sending announcement:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send announcement' },
        { status: 500 }
      );
    }
  });
}
