import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
// OAuth providers removed - add back when credentials are configured
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// Environment variable validation
if (!process.env.NEXTAUTH_SECRET) {
  console.error('❌ NEXTAUTH_SECRET is not set!');
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
}

console.log('🔧 NextAuth Configuration Loading...');
console.log('🔧 NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET');
console.log('🔧 DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔐 AUTHORIZE FUNCTION CALLED');
        console.log('📧 Email:', credentials?.email);
        console.log('🔑 Password length:', credentials?.password?.length);
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          console.log('🔍 Looking up user in database...');
          console.log('🗃️ DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
          const user = await prisma.users.findUnique({
            where: {
              email: credentials.email,
            },
          });

          console.log('👤 User found:', !!user, 'Has password:', !!user?.password);

          if (!user || !user.password) {
            console.log('❌ User not found or no password');
            return null;
          }

          console.log('🔐 Comparing passwords...');
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          console.log(
            '🔐 NextAuth: Password validation for',
            credentials.email,
            ':',
            isPasswordValid
          );

          if (!isPasswordValid) {
            console.log('❌ Password validation failed');
            return null;
          }

          const result = {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatar,
            role: user.role,
          };
          
          console.log('✅ Authorization successful, returning user:', result);
          return result;
        } catch (error) {
          console.error('🔐 NextAuth: Error during authorization:', error);
          return null;
        }
      },
    }),
    // OAuth providers removed - add back when credentials are configured
  ],
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Only secure in production
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Only secure in production
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Only secure in production
      },
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60, // 2 hours for better security
    updateAge: 15 * 60, // Update every 15 minutes
  },
  jwt: {
    maxAge: 2 * 60 * 60, // Match session maxAge
    // Enhanced JWT encoding with security context
    encode: async ({ token, secret }) => {
      const jwt = await import('jsonwebtoken');
      const crypto = await import('crypto');

      return jwt.sign(
        {
          ...token,
          // Add security context
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
          jti: crypto.randomUUID(), // JWT ID for revocation support
          iss: process.env.NEXTAUTH_URL || 'directfanz',
          aud: 'directfanz-platform',
        },
        secret,
        {
          algorithm: 'HS256',
        }
      );
    },
    decode: async ({ token, secret }) => {
      const jwt = await import('jsonwebtoken');

      try {
        return jwt.verify(token!, secret, {
          algorithms: ['HS256'],
          issuer: process.env.NEXTAUTH_URL || 'directfanz',
          audience: 'directfanz-platform',
        }) as any;
      } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
      }
    },
  },
  // Use NextAuth's secure cookie defaults
  // (no custom cookie overrides in development)
  callbacks: {
    async redirect({ url, baseUrl }) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || baseUrl;
      
      // Handle static generation where URLs might not be available
      if (!appUrl || appUrl === '') {
        return url.startsWith('/') ? url : '/';
      }
      
      try {
        const target = new URL(url, appUrl);
        const normalizedBase = new URL(appUrl);
        // Force host/port to appUrl
        target.host = normalizedBase.host;
        target.protocol = normalizedBase.protocol;
        return target.toString();
      } catch (error) {
        console.warn('URL construction failed during static generation:', { url, appUrl, error });
        // Return safe fallback
        return url.startsWith('/') ? url : appUrl || '/';
      }
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (user) {
        const u: any = user;
        token.id = u.id;
        token.role = u.role;
        token.name = u.name || u.displayName || token.name;
        token.email = u.email || token.email;
        token.picture = u.image || u.avatar || token.picture;

        // Add security context for session validation
        token.lastActivity = Date.now();
        token.sessionStart = Date.now();
      }

      // Update last activity on token refresh
      if (trigger === 'update') {
        token.lastActivity = Date.now();
      }

      // Check for suspicious activity (optional - can be enhanced later)
      if (token.lastActivity) {
        const timeSinceLastActivity = Date.now() - (token.lastActivity as number);
        if (timeSinceLastActivity > 4 * 60 * 60 * 1000) {
          // 4 hours
          console.warn('Suspicious: Long inactive session detected', {
            userId: token.id,
            timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000 / 60),
          });
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session?.user) {
        (session.user as any).id = (token as any).id as string;
        (session.user as any).role = (token as any).role as string;
        session.user.name = (token as any).name || session.user.name;
        session.user.email = (token as any).email || session.user.email;
        session.user.image = (token as any).picture || session.user.image;
      }
      return session;
    },
    async signIn({ user, account }) {
      // For OAuth providers, create user profile if it doesn't exist
      if (account?.provider !== 'credentials' && user.email) {
        const existingUser = await prisma.users.findUnique({
          where: { email: user.email },
        });
        if (!existingUser) {
          await prisma.users.create({
            data: {
              email: user.email,
              displayName: user.name || user.email.split('@')[0],
              avatar: user.image,
              role: 'FAN',
              emailVerified: new Date(),
            },
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

// Securely store OAuth tokens in encrypted database storage
async function storeOAuthTokens(userId: string, account: any) {
  try {
    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptToken(account.access_token);
    const encryptedRefreshToken = account.refresh_token
      ? await encryptToken(account.refresh_token)
      : null;

    // Store in database with expiration
    await prisma.oauth_tokens.upsert({
      where: {
        userId_provider: {
          userId,
          provider: account.provider,
        },
      },
      update: {
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider: account.provider,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
      },
    });
  } catch (error) {
    console.error('Error storing OAuth tokens:', error);
  }
}

// Token encryption utility - SECURE IMPLEMENTATION
async function encryptToken(token: string): Promise<string> {
  const crypto = await import('crypto');
  const algorithm = 'aes-256-gcm'; // Use GCM for authenticated encryption

  // Ensure we have the encryption key
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for token encryption');
  }

  const secretKey = crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16); // 128-bit IV for GCM

  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag(); // Get authentication tag for GCM

  // Return format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Token decryption utility - SECURE IMPLEMENTATION
async function decryptToken(encryptedToken: string): Promise<string> {
  const crypto = await import('crypto');
  const algorithm = 'aes-256-gcm';

  // Ensure we have the encryption key
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for token decryption');
  }

  const secretKey = crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY).digest();

  try {
    const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag); // Set authentication tag for verification

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Log security event but don't expose details
    console.error('Token decryption failed - possible tampering detected');
    throw new Error('Invalid or tampered token');
  }
}
