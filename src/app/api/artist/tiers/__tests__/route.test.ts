import { createTierSchema, updateTierSchema } from '@/lib/validations'

describe('Tier API Business Logic', () => {
  describe('Tier Validation', () => {
    describe('createTierSchema', () => {
      it('should validate valid tier data', () => {
        const validData = {
          name: 'Premium',
          description: 'Premium tier with exclusive content',
          minimumPrice: 10
        }

        const result = createTierSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should reject empty name', () => {
        const invalidData = {
          name: '',
          description: 'Description',
          minimumPrice: 10
        }

        const result = createTierSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Tier name is required')
        }
      })

      it('should reject name that is too long', () => {
        const invalidData = {
          name: 'a'.repeat(101),
          description: 'Description',
          minimumPrice: 10
        }

        const result = createTierSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Tier name too long')
        }
      })

      it('should reject empty description', () => {
        const invalidData = {
          name: 'Premium',
          description: '',
          minimumPrice: 10
        }

        const result = createTierSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Description is required')
        }
      })

      it('should reject description that is too long', () => {
        const invalidData = {
          name: 'Premium',
          description: 'a'.repeat(501),
          minimumPrice: 10
        }

        const result = createTierSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Description too long')
        }
      })

      it('should reject minimum price below $1', () => {
        const invalidData = {
          name: 'Premium',
          description: 'Description',
          minimumPrice: 0.5
        }

        const result = createTierSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Minimum price must be at least $1')
        }
      })

      it('should reject minimum price above $1000', () => {
        const invalidData = {
          name: 'Premium',
          description: 'Description',
          minimumPrice: 1001
        }

        const result = createTierSchema.safeParse(invalidData)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('Maximum price is $1000')
        }
      })
    })

    describe('updateTierSchema', () => {
      it('should validate partial updates', () => {
        const validData = {
          name: 'Updated Premium'
        }

        const result = updateTierSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should validate isActive field', () => {
        const validData = {
          isActive: false
        }

        const result = updateTierSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })

      it('should allow empty updates', () => {
        const validData = {}

        const result = updateTierSchema.safeParse(validData)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Business Rules', () => {
    it('should enforce tier naming conventions', () => {
      const tierNames = ['Basic', 'Premium', 'VIP', 'Exclusive']
      
      tierNames.forEach(name => {
        const data = {
          name,
          description: `${name} tier`,
          minimumPrice: 10
        }
        
        const result = createTierSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('should enforce reasonable price ranges', () => {
      const validPrices = [1, 5, 10, 25, 50, 100, 500, 1000]
      
      validPrices.forEach(price => {
        const data = {
          name: 'Test Tier',
          description: 'Test description',
          minimumPrice: price
        }
        
        const result = createTierSchema.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid price ranges', () => {
      const invalidPrices = [0, -1, 1001, 2000]
      
      invalidPrices.forEach(price => {
        const data = {
          name: 'Test Tier',
          description: 'Test description',
          minimumPrice: price
        }
        
        const result = createTierSchema.safeParse(data)
        expect(result.success).toBe(false)
      })
    })
  })
})