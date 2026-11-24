import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { CommunityError } from '@/lib/community';
import {
  getLaunchSetupStatus,
  launchSetupSchema,
  setupLaunchCommunity,
} from '@/lib/launch-community';

export const dynamic = 'force-dynamic';

// GET /api/admin/community/setup?slug=... - where the launch lineup stands
// (admins only). Shows no invite codes.
export async function GET(request: NextRequest) {
  return withAdminApi(request, async req => {
    const slug = req.nextUrl.searchParams.get('slug') ?? process.env.COMMUNITY_SLUG;
    if (!slug) {
      return NextResponse.json({ error: 'Pass ?slug= or set COMMUNITY_SLUG' }, { status: 400 });
    }
    const status = await getLaunchSetupStatus(slug);
    if (!status) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    return NextResponse.json({ data: status });
  });
}

// POST /api/admin/community/setup - create the launch community and an invite
// for each lineup slot (Nahvee 1, Never More 2) that has none (admins only).
// Safe to repeat. New invite codes are in this response only.
export async function POST(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const input = launchSetupSchema.parse(await req.json());
      const result = await setupLaunchCommunity(input, req.user.id);
      return NextResponse.json(
        { data: result },
        { status: result.community.created ? 201 : 200, headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof CommunityError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error('Launch community setup failed:', error);
      return NextResponse.json({ error: 'Launch setup failed' }, { status: 500 });
    }
  });
}
