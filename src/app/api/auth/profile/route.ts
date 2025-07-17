import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, updateUserProfile, updateProfileSchema } from "@/lib/auth-utils"
import { z } from "zod"

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({
        error: "Authentication required",
      }, { status: 401 })
    }

    // Return user profile without password
    const { password, ...userProfile } = user
    
    return NextResponse.json({
      user: userProfile,
    })
    
  } catch (error) {
    console.error("Profile fetch error:", error)
    
    return NextResponse.json({
      error: "Internal server error",
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({
        error: "Authentication required",
      }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate input
    const validatedData = updateProfileSchema.parse(body)
    
    // Update user profile
    const updatedUser = await updateUserProfile(user.id, validatedData)
    
    // Return updated user data (without password)
    const { password, ...userProfile } = updatedUser
    
    return NextResponse.json({
      message: "Profile updated successfully",
      user: userProfile,
    })
    
  } catch (error) {
    console.error("Profile update error:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "Validation error",
        details: error.errors,
      }, { status: 400 })
    }
    
    if (error instanceof Error) {
      return NextResponse.json({
        error: error.message,
      }, { status: 400 })
    }
    
    return NextResponse.json({
      error: "Internal server error",
    }, { status: 500 })
  }
}