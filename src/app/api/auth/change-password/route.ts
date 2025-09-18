import { NextRequest, NextResponse } from 'next/server';
import { withApi } from '@/lib/api-auth';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"]
});

export async function POST(request: NextRequest) {
  return withApi(request, async (req) => {
    try {
      const body = await request.json();
      const validatedData = passwordChangeSchema.parse(body);

      const { currentPassword, newPassword } = validatedData;

      // Get user from database with current password
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          password: true
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Check if user has a password (might be OAuth user)
      if (!user.password) {
        return NextResponse.json(
          { error: 'Password change not available for OAuth accounts' },
          { status: 400 }
        );
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      // Check if new password is different from current
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return NextResponse.json(
          { error: 'New password must be different from current password' },
          { status: 400 }
        );
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in database
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          password: hashedNewPassword,
          updatedAt: new Date()
        }
      });

      logger.info('Password changed successfully', {
        userId: req.user.id
      });

      return NextResponse.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid input',
            details: error.errors
          },
          { status: 400 }
        );
      }

      logger.error('Password change error', { userId: req.user?.id }, error as Error);
      return NextResponse.json(
        { error: 'Failed to change password' },
        { status: 500 }
      );
    }
  });
}