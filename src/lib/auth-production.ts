import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { getDatabaseClient } from './database-production';
import bcrypt from 'bcryptjs';

interface ProductionAuthConfig {
  domain: string;
  secureCookies: boolean;
  sessionMaxAge: number;
  csrfProtection: boolean;
}

export class ProductionAuthManager {
  private config: ProductionAuthConfig;
  private dbClient = getDatabaseClient();

  constructor() {
    this.config = {
      domain: process.env.NEXTAUTH_URL || 'https://directfanz.io',
      secureCookies: process.env.NODE_ENV === 'production',
      sessionMaxAge: 30 * 24 * 60 * 60, // 30 days
      csrfProtection: true,
    };

    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    if (!process.env.NEXTAUTH_SECRET) {
      throw new Error('NEXTAUTH_SECRET environment variable is required');
    }

    if (process.env.NEXTAUTH_SECRET.length < 32) {
      throw new Error('NEXTAUTH_SECRET must be at least 32 characters long');
    }

    if (!process.env.NEXTAUTH_URL) {
      throw new Error('NEXTAUTH_URL environment variable is required');
    }

    // Validate production domain
    if (process.env.NODE_ENV === 'production') {
      const url = new URL(process.env.NEXTAUTH_URL);
      if (url.protocol !== 'https:') {
        throw new Error('NEXTAUTH_URL must use HTTPS in production');
      }
      
      if (!url.hostname.includes('directfanz.io')) {
        console.warn('Warning: Production URL does not use directfanz.io domain');
      }
    }
  }

  getNextAuthConfig(): NextAuthOptions {
    return {
      adapter: PrismaAdapter(this.dbClient.client),
      
      providers: [
        CredentialsProvider({
          name: 'credentials',
          credentials: {
            email: { label: 'Email', type: 'email' },
            password: { label: 'Password', type: 'password' },
          },
          async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) {
              return null;
            }

            try {
              const user = await this.dbClient.client.user.findUnique({
                where: { email: credentials.email },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  password: true,
                  role: true,
                  emailVerified: true,
                  isActive: true,
                },
              });

              if (!user || !user.password) {
                return null;
              }

              // Check if user is active
              if (!user.isActive) {
                throw new Error('Account is deactivated');
              }

              // Verify password
              const isValidPassword = await bcrypt.compare(credentials.password, user.password);
              if (!isValidPassword) {
                return null;
              }

              // Check email verification for production
              if (process.env.NODE_ENV === 'production' && !user.emailVerified) {
                throw new Error('Email not verified');
              }

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            } catch (error) {
              console.error('Authentication error:', error);
              return null;
            }
          },
        }),

        // Google OAuth (if configured)
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
          ? [
              GoogleProvider({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                authorization: {
                  params: {
                    prompt: 'consent',
                    access_type: 'offline',
                    response_type: 'code',
                  },
                },
              }),
            ]
          : []),
      ],

      session: {
        strategy: 'jwt',
        maxAge: this.config.sessionMaxAge,
        updateAge: 24 * 60 * 60, // Update session every 24 hours
      },

      jwt: {
        maxAge: this.config.sessionMaxAge,
        // Use secure signing algorithm
        secret: process.env.NEXTAUTH_SECRET,
      },

      cookies: {
        sessionToken: {
          name: `${this.config.secureCookies ? '__Secure-' : ''}next-auth.session-token`,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: this.config.secureCookies,
            domain: this.config.secureCookies ? '.directfanz.io' : undefined,
          },
        },
        callbackUrl: {
          name: `${this.config.secureCookies ? '__Secure-' : ''}next-auth.callback-url`,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: this.config.secureCookies,
            domain: this.config.secureCookies ? '.directfanz.io' : undefined,
          },
        },
        csrfToken: {
          name: `${this.config.secureCookies ? '__Host-' : ''}next-auth.csrf-token`,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: this.config.secureCookies,
          },
        },
      },

      pages: {
        signIn: '/auth/signin',
        signUp: '/auth/signup',
        error: '/auth/error',
        verifyRequest: '/auth/verify-request',
        newUser: '/onboarding',
      },

      callbacks: {
        async jwt({ token, user, account }) {
          // Initial sign in
          if (account && user) {
            token.accessToken = account.access_token;
            token.role = user.role;
            token.userId = user.id;
          }

          // Return previous token if the access token has not expired yet
          return token;
        },

        async session({ session, token }) {
          // Send properties to the client
          if (token) {
            session.user.id = token.userId as string;
            session.user.role = token.role as string;
            session.accessToken = token.accessToken as string;
          }

          return session;
        },

        async signIn({ user, account, profile, email, credentials }) {
          // Additional security checks
          if (account?.provider === 'google') {
            // Verify Google account
            if (!profile?.email_verified) {
              return false;
            }
          }

          // Rate limiting check (implement with Redis)
          const rateLimitKey = `signin_attempts:${user.email}`;
          // Implementation would check Redis for rate limiting

          return true;
        },

        async redirect({ url, baseUrl }) {
          // Allows relative callback URLs
          if (url.startsWith('/')) return `${baseUrl}${url}`;
          
          // Allows callback URLs on the same origin
          if (new URL(url).origin === baseUrl) return url;
          
          return baseUrl;
        },
      },

      events: {
        async signIn({ user, account, profile, isNewUser }) {
          console.log(`User signed in: ${user.email} via ${account?.provider}`);
          
          // Log security event
          await this.logSecurityEvent('signin', {
            userId: user.id,
            email: user.email,
            provider: account?.provider,
            isNewUser,
            timestamp: new Date(),
          });
        },

        async signOut({ session, token }) {
          console.log(`User signed out: ${session?.user?.email}`);
          
          // Log security event
          await this.logSecurityEvent('signout', {
            userId: token?.userId,
            email: session?.user?.email,
            timestamp: new Date(),
          });
        },

        async createUser({ user }) {
          console.log(`New user created: ${user.email}`);
          
          // Log security event
          await this.logSecurityEvent('user_created', {
            userId: user.id,
            email: user.email,
            timestamp: new Date(),
          });
        },
      },

      debug: process.env.NODE_ENV === 'development',
      
      // Security settings
      useSecureCookies: this.config.secureCookies,
      
      // CSRF protection
      ...(this.config.csrfProtection && {
        csrf: {
          sameSite: 'lax',
        },
      }),
    };
  }

  private async logSecurityEvent(event: string, data: any): Promise<void> {
    try {
      await this.dbClient.client.auditLog.create({
        data: {
          event,
          data: JSON.stringify(data),
          timestamp: new Date(),
          ipAddress: data.ipAddress || 'unknown',
          userAgent: data.userAgent || 'unknown',
        },
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Password security utilities
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // High security for production
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Session security utilities
  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      await this.dbClient.client.session.deleteMany({
        where: { userId },
      });
    } catch (error) {
      console.error('Failed to invalidate user sessions:', error);
    }
  }

  // Rate limiting utilities
  async checkRateLimit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): Promise<boolean> {
    // Implementation would use Redis for rate limiting
    // This is a placeholder for the actual implementation
    return true;
  }

  // Security headers middleware
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': this.getCSPHeader(),
    };
  }

  private getCSPHeader(): string {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com https://*.amazonaws.com",
      "frame-src https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ];

    return csp.join('; ');
  }
}

// Singleton instance
let authManagerInstance: ProductionAuthManager | null = null;

export function getAuthManager(): ProductionAuthManager {
  if (!authManagerInstance) {
    authManagerInstance = new ProductionAuthManager();
  }
  return authManagerInstance;
}

// Export NextAuth configuration
export const authOptions: NextAuthOptions = getAuthManager().getNextAuthConfig();

export default ProductionAuthManager;