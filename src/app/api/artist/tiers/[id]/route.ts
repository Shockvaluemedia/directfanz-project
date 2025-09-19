import { NextRequest, NextResponse } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { updateTier, deleteTier, getTiersByArtistId } from '@/lib/database';
import { updateTierSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

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
        return NextResponse.json(
          {
            success: false,
            error: 'Tier not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          ...tier,
          minimumPrice: Number(tier.minimumPrice),
        },
      });
    } catch (error) {
      console.error('Error fetching tier:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch tier',
        },
        { status: 500 }
      );
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
        return NextResponse.json(
          {
            success: false,
            error: 'Tier not found',
          },
          { status: 404 }
        );
      }

      // Check for duplicate name if name is being updated
      if (validatedData.name && validatedData.name !== existingTier.name) {
        const existingTiers = await getTiersByArtistId(req.user.id);
        const duplicateName = existingTiers.find(
          tier =>
            tier.id !== params.id && tier.name.toLowerCase() === validatedData.name!.toLowerCase()
        );

        if (duplicateName) {
          return NextResponse.json(
            {
              success: false,
              error: 'A tier with this name already exists',
            },
            { status: 400 }
          );
        }
      }

      // Update the tier
      const updatedTier = await updateTier(params.id, validatedData);

      return NextResponse.json({
        success: true,
        data: updatedTier,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: error.errors,
          },
          { status: 400 }
        );
      }

      console.error('Error updating tier:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update tier',
        },
        { status: 500 }
      );
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
        return NextResponse.json(
          {
            success: false,
            error: 'Tier not found',
          },
          { status: 404 }
        );
      }

      // Attempt to delete the tier (this will throw an error if there are active subscriptions)
      await deleteTier(params.id);

      return NextResponse.json({
        success: true,
        message: 'Tier deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('active subscriptions')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot delete tier with active subscriptions',
          },
          { status: 400 }
        );
      }

      console.error('Error deleting tier:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete tier',
        },
        { status: 500 }
      );
    }
  });
}
