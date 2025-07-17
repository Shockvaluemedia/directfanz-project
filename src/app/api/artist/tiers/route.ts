import { NextRequest, NextResponse } from "next/server"
import { withArtistApi } from "@/lib/api-auth"
import { getTiersByArtistId, createTier } from "@/lib/database"
import { createTierSchema } from "@/lib/validations"
import { z } from "zod"

// GET /api/artist/tiers - Get all tiers for the authenticated artist
export async function GET(request: NextRequest) {
  return withArtistApi(request, async (req) => {
    try {
      const tiers = await getTiersByArtistId(req.user.id)
      
      return NextResponse.json({
        success: true,
        data: tiers
      })
    } catch (error) {
      console.error("Error fetching artist tiers:", error)
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to fetch tiers" 
        },
        { status: 500 }
      )
    }
  })
}

// POST /api/artist/tiers - Create a new tier
export async function POST(request: NextRequest) {
  return withArtistApi(request, async (req) => {
    try {
      const body = await request.json()
      
      // Validate request body
      const validatedData = createTierSchema.parse(body)
      
      // Check if artist already has a tier with the same name
      const existingTiers = await getTiersByArtistId(req.user.id)
      const duplicateName = existingTiers.find(
        tier => tier.name.toLowerCase() === validatedData.name.toLowerCase()
      )
      
      if (duplicateName) {
        return NextResponse.json(
          {
            success: false,
            error: "A tier with this name already exists"
          },
          { status: 400 }
        )
      }
      
      // Create the tier
      const newTier = await createTier({
        artistId: req.user.id,
        ...validatedData
      })
      
      return NextResponse.json({
        success: true,
        data: newTier
      }, { status: 201 })
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: "Validation failed",
            details: error.errors
          },
          { status: 400 }
        )
      }
      
      console.error("Error creating tier:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create tier"
        },
        { status: 500 }
      )
    }
  })
}