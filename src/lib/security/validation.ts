import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function validateRequest(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (token) {
      return {
        isValid: true,
        user: {
          id: token.id as string,
          email: token.email as string,
          role: token.role as string,
        },
      };
    }

    return { isValid: false, user: null };
  } catch {
    return { isValid: false, user: null };
  }
}
