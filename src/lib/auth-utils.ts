import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Validation schemas
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  role: z.enum(['ARTIST', 'FAN']),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  socialLinks: z.record(z.string().url('Invalid URL')).optional(),
});

// Server-side authentication helpers
export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  return await retryDatabaseOperation(async () => {
    const user = await prisma.users.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        artists: true,
      },
    });

    return user;
  });
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  return user;
}

export async function requireRole(role: 'ARTIST' | 'FAN') {
  const user = await requireAuth();

  if (user.role !== role) {
    throw new Error(`${role} role required`);
  }

  return user;
}

export async function requireArtistRole() {
  return await requireRole('ARTIST');
}

export async function requireFanRole() {
  return await requireRole('FAN');
}

// Check if user has artist role
export async function isArtist(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'ARTIST';
}

// Check if user has fan role
export async function isFan(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'FAN';
}

// Get user with role validation
export async function getUserWithRole(expectedRole?: 'ARTIST' | 'FAN') {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  if (expectedRole && user.role !== expectedRole) {
    return null;
  }

  return user;
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Retry utility for database operations
const retryDatabaseOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a prepared statement conflict
      if (error instanceof Error && error.message.includes('prepared statement') && error.message.includes('already exists')) {
        console.warn(`Database prepared statement conflict (attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
          continue;
        }
      }
      
      // For non-retry-able errors or final attempt, throw immediately
      throw error;
    }
  }
  
  throw lastError!;
};

// User creation utilities
export async function createUser(data: z.infer<typeof signUpSchema>) {
  const validatedData = signUpSchema.parse(data);

  return await retryDatabaseOperation(async () => {
    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user in a transaction to ensure consistency
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: {
          id: randomUUID(),
          email: validatedData.email,
          password: hashedPassword,
          displayName: validatedData.displayName,
          role: validatedData.role,
          updatedAt: new Date(),
        },
      });

      // Create artist profile if role is ARTIST
      if (validatedData.role === 'ARTIST') {
        await tx.artists.create({
          data: {
            id: randomUUID(),
            userId: newUser.id,
            updatedAt: new Date(),
          },
        });
      }

      return newUser;
    });

    return user;
  });
}

// Profile update utilities
export async function updateUserProfile(userId: string, data: z.infer<typeof updateProfileSchema>) {
  const validatedData = updateProfileSchema.parse(data);

  return await prisma.users.update({
    where: { id: userId },
    data: validatedData,
  });
}
