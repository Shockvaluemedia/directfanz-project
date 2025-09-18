import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { registerSchema, type RegisterInput } from '@/lib/validations'
import { apiHandler, apiSuccess, apiError, parseAndValidate } from '@/lib/api-utils'

export const POST = apiHandler(async (request: NextRequest) => {
  // Parse and validate request body
  const body = await parseAndValidate(request, registerSchema)
  const { email, password, displayName, role = 'FAN' } = body as RegisterInput

  // Check if user already exists
  const existingUser = await db.users.findUnique({
    where: { email }
  })

  if (existingUser) {
    return apiError('A user with this email already exists', 400)
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  try {
    // Create user
    const user = await db.users.create({
      data: {
        email,
        password: hashedPassword,
        displayName,
        role: role as 'ARTIST' | 'FAN',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // If user is an artist, create artist profile
    if (role === 'ARTIST') {
      await db.artists.create({
        data: {
          userId: user.id,
          isStripeOnboarded: false,
          totalEarnings: 0,
          totalSubscribers: 0
        }
      })
    }

    // Return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt
    }

    return apiSuccess(userData, 'User registered successfully')

  } catch (error) {
    console.error('Registration error:', error)
    return apiError('Failed to create user account', 500)
  }
})

export const OPTIONS = apiHandler(async () => {
  return apiSuccess(null, 'OK')
})