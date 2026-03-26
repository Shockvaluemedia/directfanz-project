import { NextRequest } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { getTiersByArtistId, createTier } from '@/lib/database';
import { createTierSchema } from '@/lib/validations';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiCreated, apiError } from '@/lib/api-response';

// GET /api/artist/tiers - Get all tiers for the authenticated artist
export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const tiers = await getTiersByArtistId(req.user.id);

      return apiSuccess(tiers);
    } catch (error) {
      logger.error('Error fetching artist tiers', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to fetch tiers');
    }
  });
}

// POST /api/artist/tiers - Create a new tier
export async function POST(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const body = await request.json();

      // Validate request body
      const validatedData = createTierSchema.parse(body);

      // Check if artist already has a tier with the same name
      const existingTiers = await getTiersByArtistId(req.user.id);
      const duplicateName = existingTiers.find(
        tier => tier.name.toLowerCase() === validatedData.name.toLowerCase()
      );

      if (duplicateName) {
        return apiError('BAD_REQUEST', 'A tier with this name already exists');
      }

      // Create the tier
      const newTier = await createTier({
        artistId: req.user.id,
        name: validatedData.name,
        description: validatedData.description,
        minimumPrice: validatedData.minimumPrice,
      });

      return apiCreated(newTier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError('BAD_REQUEST', 'Validation failed');
      }

      logger.error('Error creating tier', {}, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to create tier');
    }
  });
}
