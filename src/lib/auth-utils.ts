import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

// Validation schemas
export const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  role: z.enum(["ARTIST", "FAN"]),
})

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  avatar: z.string().url("Invalid avatar URL").optional(),
  socialLinks: z.record(z.string().url("Invalid URL")).optional(),
})

// Server-side authentication helpers
export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      artistProfile: true,
    },
  })

  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error("Authentication required")
  }
  
  return user
}

export async function requireRole(role: "ARTIST" | "FAN") {
  const user = await requireAuth()
  
  if (user.role !== role) {
    throw new Error(`${role} role required`)
  }
  
  return user
}

export async function requireArtistRole() {
  return await requireRole("ARTIST")
}

export async function requireFanRole() {
  return await requireRole("FAN")
}

// Check if user has artist role
export async function isArtist(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === "ARTIST"
}

// Check if user has fan role
export async function isFan(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === "FAN"
}

// Get user with role validation
export async function getUserWithRole(expectedRole?: "ARTIST" | "FAN") {
  const user = await getCurrentUser()
  
  if (!user) {
    return null
  }
  
  if (expectedRole && user.role !== expectedRole) {
    return null
  }
  
  return user
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

// User creation utilities
export async function createUser(data: z.infer<typeof signUpSchema>) {
  const validatedData = signUpSchema.parse(data)
  
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: validatedData.email },
  })
  
  if (existingUser) {
    throw new Error("User already exists with this email")
  }
  
  // Hash password
  const hashedPassword = await hashPassword(validatedData.password)
  
  // Create user
  const user = await prisma.user.create({
    data: {
      email: validatedData.email,
      password: hashedPassword,
      displayName: validatedData.displayName,
      role: validatedData.role,
    },
  })
  
  // Create artist profile if role is ARTIST
  if (validatedData.role === "ARTIST") {
    await prisma.artist.create({
      data: {
        userId: user.id,
      },
    })
  }
  
  return user
}

// Profile update utilities
export async function updateUserProfile(userId: string, data: z.infer<typeof updateProfileSchema>) {
  const validatedData = updateProfileSchema.parse(data)
  
  return await prisma.user.update({
    where: { id: userId },
    data: validatedData,
  })
}