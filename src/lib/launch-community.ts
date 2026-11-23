import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createArtistInvite, DEFAULT_INVITE_DAYS } from '@/lib/artist-invites';
import { CommunityError, createCommunitySchema } from '@/lib/community';
import { inviteSignupUrl } from '@/lib/invite-link';

/**
 * Launch setup for the first community: the owner's own artists, with Nahvee
 * headlining and Never More next (owner's order, Nov 2026).
 *
 * An admin runs it (POST /api/admin/community/setup). It is safe to run again:
 * the community is created once, a slot whose artist has joined is left alone,
 * and a slot with an open invite keeps it unless the admin asks for a fresh
 * one. Only the lineup's names and places live in code. Emails, the
 * community's name and every account come from the admin at run time.
 */
export const LAUNCH_LINEUP: ReadonlyArray<{ label: string; featuredRank: number }> = [
  { label: 'Nahvee', featuredRank: 1 },
  { label: 'Never More', featuredRank: 2 },
];

const lineupLabel = z.string().trim().min(1).max(80);

export const launchSetupSchema = createCommunitySchema
  .extend({
    /** Optional email lock per slot: the invite then only works for it. */
    artists: z
      .array(
        z
          .object({
            label: lineupLabel,
            email: z.string().trim().toLowerCase().email().nullish(),
          })
          .strict()
      )
      .max(LAUNCH_LINEUP.length)
      .optional(),
    /** Slots whose open invite should be replaced with a fresh code. */
    reissue: z.array(lineupLabel).max(LAUNCH_LINEUP.length).optional(),
    expiresInDays: z.number().int().min(1).max(90).optional(),
  })
  .strict();

export type LaunchSetupInput = z.infer<typeof launchSetupSchema>;

export type LaunchSlotStatus = 'joined' | 'invite_pending' | 'invite_created' | 'not_invited';

export interface LaunchSlot {
  label: string;
  featuredRank: number;
  status: LaunchSlotStatus;
  /** The artist's user id once they have joined. */
  artistUserId?: string;
  invite?: {
    id: string;
    email: string | null;
    expiresAt: Date;
    /** Only when this run made the invite; it can't be read back later. */
    code?: string;
    signupUrl?: string;
  };
}

export interface LaunchSetupResult {
  community: { id: string; slug: string; name: string; created: boolean };
  slots: LaunchSlot[];
}

function slotFor(label: string) {
  const key = label.trim().toLowerCase();
  const slot = LAUNCH_LINEUP.find(entry => entry.label.toLowerCase() === key);
  if (!slot) {
    throw new CommunityError(
      `"${label}" is not in the launch lineup (${LAUNCH_LINEUP.map(s => s.label).join(', ')})`,
      400
    );
  }
  return slot;
}

async function findOrCreateCommunity(input: LaunchSetupInput) {
  const existing = await prisma.communities.findUnique({ where: { slug: input.slug } });
  if (existing) return { community: existing, created: false };

  try {
    const community = await prisma.communities.create({
      data: {
        id: crypto.randomUUID(),
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
      },
    });
    return { community, created: true };
  } catch (error) {
    // Another run created it a moment ago.
    if ((error as { code?: string })?.code === 'P2002') {
      const community = await prisma.communities.findUnique({ where: { slug: input.slug } });
      if (community) return { community, created: false };
    }
    throw error;
  }
}

async function readSlots(communityId: string, now: Date) {
  const [artists, openInvites] = await Promise.all([
    prisma.artists.findMany({
      where: {
        communityId,
        featuredRank: { in: LAUNCH_LINEUP.map(slot => slot.featuredRank) },
      },
      select: { userId: true, featuredRank: true },
    }),
    prisma.artist_invites.findMany({
      where: {
        communityId,
        label: { in: LAUNCH_LINEUP.map(slot => slot.label) },
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, email: true, expiresAt: true },
    }),
  ]);

  return LAUNCH_LINEUP.map(slot => ({
    slot,
    artist: artists.find(artist => artist.featuredRank === slot.featuredRank) ?? null,
    openInvite: openInvites.find(invite => invite.label === slot.label) ?? null,
  }));
}

/**
 * Admin: create the launch community if needed and make sure every lineup
 * slot has either a joined artist or a live single-use invite.
 */
export async function setupLaunchCommunity(
  input: LaunchSetupInput,
  adminUserId: string,
  options: { now?: Date; appUrl?: string } = {}
): Promise<LaunchSetupResult> {
  const now = options.now ?? new Date();
  const appUrl = options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL;

  const emails = new Map<string, string | null>();
  for (const entry of input.artists ?? []) {
    emails.set(slotFor(entry.label).label, entry.email ?? null);
  }
  const reissue = new Set((input.reissue ?? []).map(label => slotFor(label).label));

  const { community, created } = await findOrCreateCommunity(input);
  const slots: LaunchSlot[] = [];

  for (const { slot, artist, openInvite } of await readSlots(community.id, now)) {
    if (artist) {
      slots.push({ ...slot, status: 'joined', artistUserId: artist.userId });
      continue;
    }

    if (openInvite && !reissue.has(slot.label)) {
      slots.push({
        ...slot,
        status: 'invite_pending',
        invite: { id: openInvite.id, email: openInvite.email, expiresAt: openInvite.expiresAt },
      });
      continue;
    }

    if (openInvite) {
      // Replace it: the old code stops working now.
      await prisma.artist_invites.updateMany({
        where: { communityId: community.id, label: slot.label, usedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
    }

    const invite = await createArtistInvite(
      {
        communityId: community.id,
        email: emails.get(slot.label) ?? openInvite?.email ?? null,
        expiresInDays: input.expiresInDays ?? DEFAULT_INVITE_DAYS,
        label: slot.label,
        featuredRank: slot.featuredRank,
      },
      adminUserId,
      now
    );
    slots.push({
      ...slot,
      status: 'invite_created',
      invite: {
        id: invite.id,
        email: invite.email,
        expiresAt: invite.expiresAt,
        code: invite.code,
        signupUrl: inviteSignupUrl(invite.code, appUrl),
      },
    });
  }

  return {
    community: { id: community.id, slug: community.slug, name: community.name, created },
    slots,
  };
}

/** Admin: where the launch setup stands, without changing anything. */
export async function getLaunchSetupStatus(
  slug: string,
  now: Date = new Date()
): Promise<LaunchSetupResult | null> {
  const community = await prisma.communities.findUnique({ where: { slug } });
  if (!community) return null;

  const slots: LaunchSlot[] = (await readSlots(community.id, now)).map(
    ({ slot, artist, openInvite }) => {
      if (artist) return { ...slot, status: 'joined', artistUserId: artist.userId };
      if (openInvite) {
        return {
          ...slot,
          status: 'invite_pending',
          invite: { id: openInvite.id, email: openInvite.email, expiresAt: openInvite.expiresAt },
        };
      }
      return { ...slot, status: 'not_invited' };
    }
  );

  return {
    community: { id: community.id, slug: community.slug, name: community.name, created: false },
    slots,
  };
}
