import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { CommunityError, createCommunity, createCommunitySchema } from '@/lib/community';

// POST /api/admin/community - create a community (admins only)
export async function POST(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const input = createCommunitySchema.parse(await req.json());
      const community = await createCommunity(input);
      return NextResponse.json({ data: community }, { status: 201 });
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
      console.error('Error creating community:', error);
      return NextResponse.json({ error: 'Failed to create community' }, { status: 500 });
    }
  });
}
