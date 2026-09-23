import { prisma } from '@/lib/prisma';

/**
 * Helpers shared by the /api/admin/content routes.
 *
 * The admin UI speaks PENDING | APPROVED | REJECTED; the database stores
 * PUBLISHED (the default) | PENDING_REVIEW | UNDER_REVIEW | REJECTED, so the
 * routes translate in both directions. Fan-facing queries filter on
 * `visibility`, not `status`, so a rejection also flips the item to PRIVATE and
 * stashes the previous value in the content's metadata JSON for approval to
 * restore.
 */

export type AdminContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const PENDING_DB_STATUSES = ['PENDING_REVIEW', 'UNDER_REVIEW'];

export function dbStatusesForUiStatus(status: AdminContentStatus): string[] {
  switch (status) {
    case 'PENDING':
      return PENDING_DB_STATUSES;
    case 'APPROVED':
      return ['PUBLISHED'];
    case 'REJECTED':
      return ['REJECTED'];
  }
}

export function toUiContentStatus(dbStatus: string): AdminContentStatus {
  if (dbStatus === 'PUBLISHED') return 'APPROVED';
  if (PENDING_DB_STATUSES.includes(dbStatus)) return 'PENDING';
  return 'REJECTED';
}

/** Key under which a rejection stashes the content's previous visibility. */
export const PREVIOUS_VISIBILITY_KEY = 'adminPreviousVisibility';

export function parseContentMetadata(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** The columns the admin content pages need; both routes select exactly these. */
export const adminContentSelect = {
  id: true,
  title: true,
  type: true,
  status: true,
  createdAt: true,
  thumbnailUrl: true,
  reviewReason: true,
  users: { select: { displayName: true, email: true } },
} as const;

export interface AdminContentRow {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: Date | string;
  thumbnailUrl: string | null;
  reviewReason: string | null;
  users: { displayName: string; email: string };
}

export function formatAdminContentItem(row: AdminContentRow) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    artistName: row.users.displayName,
    artistEmail: row.users.email,
    status: toUiContentStatus(row.status),
    createdAt: new Date(row.createdAt).toISOString(),
    previewUrl: row.thumbnailUrl ?? undefined,
    reason: row.reviewReason ?? undefined,
  };
}

/**
 * The session role comes from a JWT that can be up to two hours stale, so
 * moderation writes re-check the database before acting.
 */
export async function isAdminInDatabase(userId: string): Promise<boolean> {
  const actor = await prisma.users.findUnique({ where: { id: userId }, select: { role: true } });
  return actor?.role === 'ADMIN';
}
