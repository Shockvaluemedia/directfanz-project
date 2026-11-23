import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { MAX_PART_LINKS_PER_REQUEST } from '@/lib/upload-policy';
import { signUploadParts, StorageNotConfiguredError, UploadRejectedError } from '@/lib/storage/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const signPartsSchema = z.object({
  key: z.string().min(1).max(1024),
  fileType: z.string().min(1).max(100),
  uploadId: z.string().min(1).max(1024),
  partNumbers: z.array(z.number().int().positive()).min(1).max(MAX_PART_LINKS_PER_REQUEST),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * Re-signs part links for a large upload that is still going (long videos can
 * take longer to send than one link lives). The caller must own the upload.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }

  const parsed = signPartsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', 'Invalid request data', 400);
  }

  try {
    const parts = await signUploadParts({
      userId: session.user.id,
      isArtist: session.user.role === 'ARTIST',
      ...parsed.data,
    });
    return NextResponse.json({ success: true, data: { parts } });
  } catch (error) {
    if (error instanceof UploadRejectedError) {
      const code = error.status === 403 ? 'FORBIDDEN' : error.status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR';
      return errorResponse(code, error.message, error.status);
    }
    if (error instanceof StorageNotConfiguredError) {
      return errorResponse('STORAGE_NOT_CONFIGURED', 'Storage is not configured', 503);
    }
    logger.error('Failed to sign upload parts', { userId: session.user.id }, error as Error);
    return errorResponse('INTERNAL_SERVER_ERROR', 'Could not sign upload parts', 500);
  }
}
