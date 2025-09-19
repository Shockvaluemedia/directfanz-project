import { z } from 'zod';
import { UserRole, ContentType, SubscriptionStatus } from '@/lib/types/enums';

// Authentication validation schemas
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be less than 50 characters'),
  role: z.enum(['ARTIST', 'FAN']).optional().default('FAN'),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// User validation schemas
export const userProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long'),
  bio: z.string().max(500, 'Bio too long').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  socialLinks: z.record(z.string().url('Invalid social link URL')).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.nativeEnum(UserRole),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long'),
  bio: z.string().max(500, 'Bio too long').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  socialLinks: z.record(z.string().url('Invalid social link URL')).optional(),
});

// Tier validation schemas
export const createTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(100, 'Tier name too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  minimumPrice: z
    .number()
    .min(1, 'Minimum price must be at least $1')
    .max(1000, 'Maximum price is $1000'),
});

export const updateTierSchema = createTierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Content validation schemas
export const createContentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  type: z.nativeEnum(ContentType),
  fileUrl: z.string().url('Invalid file URL'),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional(),
  isPublic: z.boolean().default(false),
  fileSize: z.number().min(1, 'File size must be greater than 0'),
  duration: z.number().min(0, 'Duration cannot be negative').optional(),
  format: z.string().min(1, 'Format is required'),
  tags: z.array(z.string().min(1, 'Tag cannot be empty')).max(10, 'Maximum 10 tags allowed'),
  tierIds: z.array(z.string().cuid('Invalid tier ID')),
});

export const updateContentSchema = createContentSchema.partial();

// Subscription validation schemas
export const createSubscriptionSchema = z.object({
  tierId: z.string().cuid('Invalid tier ID'),
  amount: z.number().min(1, 'Amount must be at least $1').max(1000, 'Maximum amount is $1000'),
});

export const updateSubscriptionSchema = z.object({
  amount: z
    .number()
    .min(1, 'Amount must be at least $1')
    .max(1000, 'Maximum amount is $1000')
    .optional(),
});

// Comment validation schemas
export const createCommentSchema = z.object({
  contentId: z.string().cuid('Invalid content ID'),
  text: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long'),
});

export const updateCommentSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long'),
});

// Search and filter validation schemas
export const artistSearchSchema = z.object({
  genre: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  sortBy: z.enum(['name', 'subscribers', 'created', 'earnings']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const contentSearchSchema = z.object({
  type: z.nativeEnum(ContentType).optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  sortBy: z.enum(['title', 'created', 'updated']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Stripe validation schemas
export const stripeCheckoutSchema = z.object({
  tierId: z.string().cuid('Invalid tier ID'),
  amount: z.number().min(1, 'Amount must be at least $1').max(1000, 'Maximum amount is $1000'),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
});

// File upload validation schemas
export const fileUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z
    .number()
    .min(1, 'File size must be greater than 0')
    .max(100 * 1024 * 1024, 'File size cannot exceed 100MB'),
  fileType: z.string().min(1, 'File type is required'),
  contentType: z.nativeEnum(ContentType),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Export type inference helpers
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateTierInput = z.infer<typeof createTierSchema>;
export type UpdateTierInput = z.infer<typeof updateTierSchema>;
export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ArtistSearchInput = z.infer<typeof artistSearchSchema>;
export type ContentSearchInput = z.infer<typeof contentSearchSchema>;
export type StripeCheckoutInput = z.infer<typeof stripeCheckoutSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
