import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { createArtistInvite, createInviteSchema, InviteError } from '@/lib/artist-invites';

// POST /api/admin/community/invites - make a single-use artist invite (admins only).
// The code is in this response only; it can't be read back later.
export async function POST(request: NextRequest) {
  return withAdminApi(request, async req => {
    try {
      const input = createInviteSchema.parse(await req.json());
      const invite = await createArtistInvite(input, req.user.id);
      return NextResponse.json({ data: invite }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request data', details: error.errors },
          { status: 400 }
        );
      }
      if (error instanceof InviteError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error('Error creating artist invite:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }
  });
}
