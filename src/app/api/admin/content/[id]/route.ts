import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminApi } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  adminContentSelect,
  formatAdminContentItem,
  isAdminInDatabase,
  parseContentMetadata,
  PREVIOUS_VISIBILITY_KEY,
} from '@/lib/admin-moderation';

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(1000).optional(),
});

// PATCH /api/admin/content/[id] - approve or reject an item from the moderation queue
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return withAdminApi(request, async req => {
    try {
      if (!(await isAdminInDatabase(req.user.id))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json().catch(() => null);
      const parsed = reviewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.errors },
          { status: 400 }
        );
      }

      const existing = await prisma.content.findUnique({
        where: { id },
        select: { id: true, status: true, visibility: true, metadata: true },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      const { status: decision, reason } = parsed.data;
      const now = new Date();
      const newStatus = decision === 'APPROVED' ? 'PUBLISHED' : 'REJECTED';
      const metadata = parseContentMetadata(existing.metadata);
      let metadataChanged = false;

      const data: Record<string, unknown> = {
        status: newStatus,
        reviewedAt: now,
        reviewedBy: req.user.id,
        reviewReason:
          reason ||
          (decision === 'APPROVED' ? 'Approved by admin review' : 'Rejected by admin review'),
        updatedAt: now,
      };

      if (decision === 'REJECTED') {
        // Fan queries filter on visibility rather than status, so a rejection
        // has to hide the item for real. Remember what it was for approval.
        if (existing.visibility !== 'PRIVATE') {
          metadata[PREVIOUS_VISIBILITY_KEY] = existing.visibility;
          metadataChanged = true;
          data.visibility = 'PRIVATE';
        }
      } else if (typeof metadata[PREVIOUS_VISIBILITY_KEY] === 'string') {
        data.visibility = metadata[PREVIOUS_VISIBILITY_KEY];
        delete metadata[PREVIOUS_VISIBILITY_KEY];
        metadataChanged = true;
      }
      if (metadataChanged) {
        data.metadata = JSON.stringify(metadata);
      }

      const updated = await prisma.content.update({
        where: { id },
        data,
        select: adminContentSelect,
      });

      // Best-effort audit row: the table's column casing has drifted in some
      // environments, so a failure here must never undo the review itself.
      try {
        await prisma.moderation_logs.create({
          data: {
            contentId: id,
            userId: req.user.id,
            status: newStatus,
            result: JSON.stringify({
              action: decision,
              previousStatus: existing.status,
              newStatus,
              reason: data.reviewReason,
              source: 'admin',
            }),
          },
        });
      } catch (auditError) {
        logger.warn('Moderation log write failed', {
          contentId: id,
          error: (auditError as Error)?.message,
        });
      }

      logger.securityEvent('admin_content_reviewed', 'medium', {
        adminUserId: req.user.id,
        contentId: id,
        action: decision,
        previousStatus: existing.status,
        newStatus,
      });

      return NextResponse.json({ success: true, content: formatAdminContentItem(updated) });
    } catch (error) {
      logger.error(
        'Admin content review error',
        { adminUserId: req.user?.id, contentId: id },
        error as Error
      );
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
    }
  });
}
