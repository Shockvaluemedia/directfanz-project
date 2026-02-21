// @ts-nocheck
import { NextRequest } from 'next/server';
import { withStreamingAccess } from '@/middleware/content-access';
import { prisma } from '@/lib/prisma';

// Stream content with access control
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withStreamingAccess(request, params.id, async () => {
    try {
      const content = await prisma.content.findUnique({
        where: { id: params.id },
        select: {
          fileUrl: true,
          type: true,
          format: true,
          fileSize: true,
          title: true,
        },
      });

      if (!content) {
        return new Response('Content not found', { status: 404 });
      }

      // Vercel Blob URLs are directly accessible — redirect to the blob URL
      return Response.redirect(content.fileUrl, 302);
    } catch (error) {
      console.error('Content streaming error:', error);
      return new Response('Streaming failed', { status: 500 });
    }
  });
}
