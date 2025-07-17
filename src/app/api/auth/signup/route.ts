import { NextRequest, NextResponse } from "next/server"
import { createUser, signUpSchema } from "@/lib/auth-utils"
import { z } from "zod"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = signUpSchema.parse(body)
    
    // Create user
    const user = await createUser(validatedData)
    
    // Return user data (without password)
    const { password, ...userWithoutPassword } = user
    
    return NextResponse.json({
      message: "User created successfully",
      user: userWithoutPassword,
    }, { status: 201 })
    
  } catch (error) {
    console.error("Signup error:", error)
    
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