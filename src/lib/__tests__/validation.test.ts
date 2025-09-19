import { signUpSchema, signInSchema } from '../auth-utils';

describe('Validation Schemas', () => {
  describe('signUpSchema', () => {
    it('should validate correct signup data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        role: 'FAN' as const,
      };

      const result = signUpSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
        displayName: 'Test User',
        role: 'FAN' as const,
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '123',
        displayName: 'Test User',
        role: 'FAN' as const,
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short display name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'T',
        role: 'FAN' as const,
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid role', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        role: 'INVALID' as any,
      };

      const result = signUpSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('signInSchema', () => {
    it('should validate correct signin data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = signInSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'password123',
      };

      const result = signInSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = signInSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
