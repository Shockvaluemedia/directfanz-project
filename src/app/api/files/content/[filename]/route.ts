import { NextRequest } from 'next/server';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkContentAccess } from '@/lib/content-access';
import { mimeFromExtension, proxyMedia, resolveMediaSource } from '@/lib/media-proxy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Serves files written by the local (dev) uploader. A file that backs gated
 * content gets the same access check as /api/content/[id]/stream, so the raw
 * path is not a way around the paywall; everything else (public content,
 * thumbnails, avatars) is served cacheably as before.
 */
async function serve(request: NextRequest, filename: string, head: boolean): Promise<Response> {
  try {
    const name = path.basename(filename);
    const source = resolveMediaSource(`/api/files/content/${name}`);
    if (!source) {
      return new Response('File not found', { status: 404 });
    }

    const owner = await prisma.content.findFirst({
      where: { fileUrl: { endsWith: `/api/files/content/${name}` } },
      select: { id: true, visibility: true },
    });

    const gated = Boolean(owner && owner.visibility !== 'PUBLIC');
    if (gated) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return new Response('Authentication required', { status: 401 });
      }
      const access = await checkContentAccess(session.user.id as string, owner!.id);
      if (!access.hasAccess) {
        return new Response('Access denied', { status: 403 });
      }
    }

    return await proxyMedia(request, source, {
      contentType: mimeFromExtension(name),
      disposition: 'inline',
      head,
      cacheControl: gated ? 'private, no-store' : 'public, max-age=31536000, immutable',
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ filename: string }> }) {
  const { filename } = await props.params;
  return serve(request, filename, false);
}

export async function HEAD(request: NextRequest, props: { params: Promise<{ filename: string }> }) {
  const { filename } = await props.params;
  return serve(request, filename, true);
}
