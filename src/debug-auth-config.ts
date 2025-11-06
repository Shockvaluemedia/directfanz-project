import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const debugAuthOptions: NextAuthOptions = {
  debug: true, // Enable debug mode
  logger: {
    error: (code, ...message) => {
      console.error('🚨 NextAuth Error:', code, ...message);
    },
    warn: (code, ...message) => {
      console.warn('⚠️ NextAuth Warning:', code, ...message);
    },
    debug: (code, ...message) => {
      console.log('🔍 NextAuth Debug:', code, ...message);
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔐 AUTHORIZE CALLED with:', { 
          email: credentials?.email, 
          passwordLength: credentials?.password?.length 
        });

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          console.log('🔍 Looking up user in database...');
          const user = await prisma.users.findUnique({
            where: {
              email: credentials.email,
            },
          });

          console.log('👤 User lookup result:', { 
            found: !!user, 
            email: user?.email, 
            hasPassword: !!user?.password,
            role: user?.role 
          });

          if (!user || !user.password) {
            console.log('❌ User not found or no password');
            return null;
          }

          console.log('🔑 Comparing passwords...');
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          console.log('✅ Password comparison result:', isPasswordValid);

          if (!isPasswordValid) {
            console.log('❌ Password invalid');
            return null;
          }

          const result = {
            id: user.id,
            email: user.email,
            name: user.displayName,
            image: user.avatar,
            role: user.role,
          };
          console.log('✅ Authorization successful, returning:', result);
          return result;
        } catch (error) {
          console.error('🚨 Authorization error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('🎫 JWT callback called with:', { token: !!token, user: !!user });
      if (user) {
        const u: any = user;
        token.id = u.id;
        token.role = u.role;
        console.log('🎫 JWT token updated:', { id: token.id, role: token.role });
      }
      return token;
    },
    async session({ session, token }) {
      console.log('📋 Session callback called with:', { session: !!session, token: !!token });
      if (token && session?.user) {
        (session.user as any).id = (token as any).id as string;
        (session.user as any).role = (token as any).role as string;
        console.log('📋 Session updated:', { id: (session.user as any).id, role: (session.user as any).role });
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};