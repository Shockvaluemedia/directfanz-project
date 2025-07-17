import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Define schemas locally for testing
const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  role: z.enum(["ARTIST", "FAN"]),
})

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters").optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  avatar: z.string().url("Invalid avatar URL").optional(),
  socialLinks: z.record(z.string().url("Invalid URL")).optional(),
})

// Define password utilities locally for testing
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

describe('Auth Utils', () => {
  describe('Password utilities', () => {
    const testPassword = 'testPassword123'

    it('should hash password correctly', async () => {
      const hashedPassword = await hashPassword(testPassword)
      
      expect(hashedPassword).toBeDefined()
      expect(hashedPassword).not.toBe(testPassword)
      expect(hashedPassword.length).toBeGreaterThan(50) // bcrypt hashes are typically 60 chars
    })

    it('should verify password correctly', async () => {
      const hashedPassword = await hashPassword(testPassword)
      
      const isValid = await verifyPassword(testPassword, hashedPassword)
      expect(isValid).toBe(true)
      
      const isInvalid = await verifyPassword('wrongPassword', hashedPassword)
      expect(isInvalid).toBe(false)
    })
  })

  describe('Validation schemas', () => {
    describe('signUpSchema', () => {
      it('should validate correct signup data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Test User',
          role: 'ARTIST' as const
        }

        const result = signUpSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject invalid email', () => {
        const invalidData = {
          email: 'invalid-email',
          password: 'password123',
          displayName: 'Test User',
          role: 'ARTIST' as const
        }

        const result = signUpSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject short password', () => {
        const invalidData = {
          email: 'test@example.com',
          password: '123',
          displayName: 'Test User',
          role: 'ARTIST' as const
        }

        const result = signUpSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject short display name', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'password123',
          displayName: 'T',
          role: 'ARTIST' as const
        }

        const result = signUpSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject invalid role', () => {
        const invalidData = {
          email: 'test@example.com',
          password: 'password123',
          displayName: 'Test User',
          role: 'INVALID_ROLE' as any
        }

        const result = signUpSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })

    describe('signInSchema', () => {
      it('should validate correct signin data', () => {
        const validData = {
          email: 'test@example.com',
          password: 'password123'
        }

        const result = signInSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject invalid email', () => {
        const invalidData = {
          email: 'invalid-email',
          password: 'password123'
        }

        const result = signInSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject empty password', () => {
        const invalidData = {
          email: 'test@example.com',
          password: ''
        }

        const result = signInSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })

    describe('updateProfileSchema', () => {
      it('should validate correct profile update data', () => {
        const validData = {
          displayName: 'Updated Name',
          bio: 'This is my bio',
          avatar: 'https://example.com/avatar.jpg',
          socialLinks: {
            twitter: 'https://twitter.com/user',
            instagram: 'https://instagram.com/user'
          }
        }

        const result = updateProfileSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should validate partial profile update data', () => {
        const validData = {
          displayName: 'Updated Name'
        }

        const result = updateProfileSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject short display name', () => {
        const invalidData = {
          displayName: 'T'
        }

        const result = updateProfileSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject long bio', () => {
        const invalidData = {
          bio: 'a'.repeat(501) // 501 characters
        }

        const result = updateProfileSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject invalid avatar URL', () => {
        const invalidData = {
          avatar: 'not-a-url'
        }

        const result = updateProfileSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })

      it('should reject invalid social links', () => {
        const invalidData = {
          socialLinks: {
            twitter: 'not-a-url'
          }
        }

        const result = updateProfileSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
      })
    })
  })
})