import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import FacebookProvider from "next-auth/providers/facebook"
import bcrypt from "bcryptjs"
import { db } from "./db"

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.users.findUnique({
          where: {
            email: credentials.email,
          },
          include: {
            artists: true,
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatar,
          role: user.role,
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60, // 2 hours for better security
    updateAge: 15 * 60, // Update every 15 minutes
  },
  // Use NextAuth's secure cookie defaults
  // (no custom cookie overrides in development)
  callbacks: {
    async redirect({ url, baseUrl }) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || baseUrl
      try {
        const target = new URL(url, appUrl)
        const normalizedBase = new URL(appUrl)
        // Force host/port to appUrl
        target.host = normalizedBase.host
        target.protocol = normalizedBase.protocol
        return target.toString()
      } catch {
        return appUrl
      }
    },
    async jwt({ token, user }) {
      if (user) {
        const u: any = user
        token.id = u.id
        token.role = u.role
        token.name = u.name || u.displayName || token.name
        token.email = u.email || token.email
        token.picture = u.image || u.avatar || token.picture
      }
      return token
    },
    async session({ session, token }) {
      if (token && session?.user) {
        (session.user as any).id = (token as any).id as string
        ;(session.user as any).role = (token as any).role as string
        session.user.name = (token as any).name || session.user.name
        session.user.email = (token as any).email || session.user.email
        session.user.image = (token as any).picture || session.user.image
      }
      return session
    },
    async signIn({ user, account }) {
      // For OAuth providers, create user profile if it doesn't exist
      if (account?.provider !== "credentials" && user.email) {
        const existingUser = await db.users.findUnique({
          where: { email: user.email },
        })
        if (!existingUser) {
          await db.users.create({
            data: {
              email: user.email,
              displayName: user.name || user.email.split("@")[0],
              avatar: user.image,
              role: "FAN",
              emailVerified: new Date(),
            },
          })
        }
      }
      return true
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

// Securely store OAuth tokens in encrypted database storage
async function storeOAuthTokens(userId: string, account: any) {
  try {
    // Encrypt tokens before storing
    const encryptedAccessToken = await encryptToken(account.access_token)
    const encryptedRefreshToken = account.refresh_token ? 
      await encryptToken(account.refresh_token) : null
    
    // Store in database with expiration
    await db.oauth_tokens.upsert({
      where: {
        userId_provider: {
          userId,
          provider: account.provider
        }
      },
      update: {
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        updatedAt: new Date()
      },
      create: {
        userId,
        provider: account.provider,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null
      }
    })
  } catch (error) {
    console.error('Error storing OAuth tokens:', error)
  }
}

// Token encryption utility
async function encryptToken(token: string): Promise<string> {
  const crypto = await import('crypto')
  const algorithm = 'aes-256-cbc' // Use CBC instead of GCM for broader compatibility
  const secretKey = crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY!).digest()
  
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(algorithm, secretKey)
  
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return `${iv.toString('hex')}:${encrypted}`
}

// Token decryption utility
async function decryptToken(encryptedToken: string): Promise<string> {
  const crypto = await import('crypto')
  const algorithm = 'aes-256-cbc' // Use CBC instead of GCM for broader compatibility
  const secretKey = crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY!).digest()
  
  const [ivHex, encrypted] = encryptedToken.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  
  const decipher = crypto.createDecipher(algorithm, secretKey)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
