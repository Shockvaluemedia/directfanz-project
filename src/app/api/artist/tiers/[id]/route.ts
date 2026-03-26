import { NextRequest } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { updateTier, deleteTier, getTiersByArtistId } from '@/lib/database';
import { updateTierSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/artist/tiers/[id] - Get a specific tier
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withArtistApi(request, async req => {
    try {
      const tier = await prisma.tiers.findFirst({
        where: {
          id: params.id,
          artistId: req.user.id,
        },
      });

      if (!tier) {
        return apiError('NOT_FOUND', 'Tier not found');
      }

      return apiSuccess({
          ...tier,
          minimumPrice: Number(tier.minimumPrice),
        });
    } catch (error) {
      logger.error('Error fetching tier', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to fetch tier');
    }
  });
}

// PUT /api/artist/tiers/[id] - Update a tier
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withArtistApi(request, async req => {
    try {
      const body = await request.json();

      // Validate request body
      const validatedData = updateTierSchema.parse(body);

      // Check if tier exists and belongs to the artist
      const existingTier = await prisma.tiers.findFirst({
        where: {
          id: params.id,
          artistId: req.user.id,
        },
      });

      if (!existingTier) {
        return apiError('NOT_FOUND', 'Tier not found');
      }

      // Check for duplicate name if name is being updated
      if (validatedData.name && validatedData.name !== existingTier.name) {
        const existingTiers = await getTiersByArtistId(req.user.id);
        const duplicateName = existingTiers.find(
          tier =>
            tier.id !== params.id && tier.name.toLowerCase() === validatedData.name!.toLowerCase()
        );

        if (duplicateName) {
          return apiError('BAD_REQUEST', 'A tier with this name already exists');
        }
      }

      // Update the tier
      const updatedTier = await updateTier(params.id, validatedData);

      return apiSuccess(updatedTier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError('BAD_REQUEST', 'Validation failed');
      }

      logger.error('Error updating tier', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to update tier');
    }
  });
}

// DELETE /api/artist/tiers/[id] - Delete a tier
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withArtistApi(request, async req => {
    try {
      // Check if tier exists and belongs to the artist
      const existingTier = await prisma.tiers.findFirst({
        where: {
          id: params.id,
          artistId: req.user.id,
        },
      });

      if (!existingTier) {
        return apiError('NOT_FOUND', 'Tier not found');
      }

      // Attempt to delete the tier (this will throw an error if there are active subscriptions)
      await deleteTier(params.id);

      return apiSuccess({ message: 'Tier deleted successfully' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('active subscriptions')) {
        return apiError('BAD_REQUEST', 'Cannot delete tier with active subscriptions');
      }

      logger.error('Error deleting tier', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to delete tier');
    }
  });
}
