import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Invite-only artist sign-up. An admin makes a single-use invite for a
 * community; the code is shown once and only its hash is kept. Sign-up uses
 * it inside the same transaction that creates the artist.
 */

export class InviteError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'InviteError';
  }
}

export const DEFAULT_INVITE_DAYS = 14;
const INVITE_CODE_BYTES = 18;

/**
 * Artist sign-up is invite-only unless ARTIST_SIGNUP=open (for local
 * development). Fans can always sign up.
 */
export function artistSignupIsOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ARTIST_SIGNUP === 'open';
}

export function hashInviteCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

export const createInviteSchema = z
  .object({
    communityId: z.string().min(1),
    email: z.string().trim().toLowerCase().email().nullish(),
    expiresInDays: z.number().int().min(1).max(90).optional(),
    /** The lineup slot, as the admin names it (for example the artist's name). */
    label: z.string().trim().min(1).max(80).nullish(),
    /** Home-page place the artist takes on joining; 1 headlines. */
    featuredRank: z.number().int().min(1).max(10_000).nullish(),
  })
  .strict();

/**
 * Create a single-use artist invite. The code is returned once and only its
 * hash is stored. An invite with an email only works for that email.
 */
export async function createArtistInvite(
  input: z.infer<typeof createInviteSchema>,
  createdBy: string,
  now: Date = new Date()
) {
  const community = await prisma.communities.findUnique({
    where: { id: input.communityId },
    select: { id: true },
  });
  if (!community) throw new InviteError('Community not found', 404);

  const code = crypto.randomBytes(INVITE_CODE_BYTES).toString('base64url');
  const expiresAt = new Date(
    now.getTime() + (input.expiresInDays ?? DEFAULT_INVITE_DAYS) * 24 * 60 * 60 * 1000
  );
  const invite = await prisma.artist_invites.create({
    data: {
      id: crypto.randomUUID(),
      communityId: community.id,
      codeHash: hashInviteCode(code),
      email: input.email ?? null,
      label: input.label ?? null,
      featuredRank: input.featuredRank ?? null,
      createdBy,
      expiresAt,
    },
    select: {
      id: true,
      communityId: true,
      email: true,
      label: true,
      featuredRank: true,
      expiresAt: true,
    },
  });
  return { ...invite, code };
}

type InviteTx = Pick<typeof prisma, 'artist_invites'>;

export interface RedeemedInvite {
  communityId: string;
  /** Home-page place the invite gives the new artist, if it names one. */
  featuredRank: number | null;
}

/**
 * Use an invite for a new artist account, inside the sign-up transaction.
 * Returns the community the artist joins and their place in it. Claimed with
 * a conditional update, so two sign-ups can't share one code.
 */
export async function redeemArtistInvite(
  tx: InviteTx,
  code: string | undefined | null,
  email: string,
  userId: string,
  now: Date = new Date()
): Promise<RedeemedInvite> {
  if (!code) throw new InviteError('Artist sign-up is by invite only', 403);

  const invite = await tx.artist_invites.findUnique({
    where: { codeHash: hashInviteCode(code) },
    select: {
      id: true,
      communityId: true,
      email: true,
      featuredRank: true,
      expiresAt: true,
      usedAt: true,
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt <= now) {
    throw new InviteError('This invite is not valid', 403);
  }
  if (invite.email && invite.email !== email.trim().toLowerCase()) {
    throw new InviteError('This invite is for another email address', 403);
  }

  const claimed = await tx.artist_invites.updateMany({
    where: { id: invite.id, usedAt: null },
    data: { usedAt: now, usedByUserId: userId },
  });
  if (claimed.count !== 1) {
    throw new InviteError('This invite is not valid', 403);
  }
  return { communityId: invite.communityId, featuredRank: invite.featuredRank ?? null };
}
