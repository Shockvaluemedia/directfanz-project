import { NextRequest } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-response';

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword'],
  });

export async function POST(request: NextRequest) {
  return withApi(request, async req => {
    try {
      const body = await request.json();
      const validatedData = passwordChangeSchema.parse(body);

      const { currentPassword, newPassword } = validatedData;

      // Get user from database with current password
      const user = await prisma.users.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          password: true,
        },
      });

      if (!user) {
        return apiError('NOT_FOUND', 'User not found');
      }

      // Check if user has a password (might be OAuth user)
      if (!user.password) {
        return apiError('BAD_REQUEST', 'Password change not available for OAuth accounts');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return apiError('BAD_REQUEST', 'Current password is incorrect');
      }

      // Check if new password is different from current
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return apiError('BAD_REQUEST', 'New password must be different from current password');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await prisma.users.update({
        where: { id: req.user.id },
        data: {
          password: hashedNewPassword,
          updatedAt: new Date(),
        },
      });

      logger.info('Password changed successfully', {
        userId: req.user.id,
      });

      return apiSuccess({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiError('BAD_REQUEST', 'Invalid input', error.errors);
      }

      logger.error('Password change error', { userId: req.user?.id }, error as Error);
      return apiError('INTERNAL_ERROR', 'Failed to change password');
    }
  });
}
