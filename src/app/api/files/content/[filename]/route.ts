import { NextRequest } from 'next/server';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { withStreamingAccess } from '@/middleware/content-access';
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

    // Any content row may reference this file (content creation accepts an
    // arbitrary fileUrl), so the file is gated if ANY referencing row is.
    const references =
      (await prisma.content.findMany({
        where: { fileUrl: { endsWith: `/api/files/content/${name}` } },
        select: { id: true, visibility: true },
      })) ?? [];
    const gatedRow = references.find(row => row.visibility !== 'PUBLIC');

    const serveFile = () =>
      proxyMedia(request, source, {
        contentType: mimeFromExtension(name),
        disposition: 'inline',
        head,
        cacheControl: gatedRow ? 'private, no-store' : 'public, max-age=31536000, immutable',
      });

    return gatedRow ? withStreamingAccess(request, gatedRow.id, serveFile) : serveFile();
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
