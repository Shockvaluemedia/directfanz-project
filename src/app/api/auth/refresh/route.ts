import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Secure server-side OAuth token refresh
export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { provider } = await request.json()
    
    if (!provider || !['google', 'facebook'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // Get stored encrypted tokens
    const oAuthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider
        }
      }
    })

    if (!oAuthToken || !oAuthToken.encryptedRefreshToken) {
      return NextResponse.json({ error: 'No refresh token found' }, { status: 404 })
    }

    // Decrypt refresh token
    const refreshToken = await decryptToken(oAuthToken.encryptedRefreshToken)
    
    // Refresh access token based on provider
    const refreshedTokens = await refreshOAuthToken(provider, refreshToken)
    
    if (!refreshedTokens) {
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 400 })
    }

    // Encrypt and store new tokens
    const encryptedAccessToken = await encryptToken(refreshedTokens.access_token)
    const encryptedNewRefreshToken = refreshedTokens.refresh_token 
      ? await encryptToken(refreshedTokens.refresh_token) 
      : oAuthToken.encryptedRefreshToken

    await prisma.oAuthToken.update({
      where: { id: oAuthToken.id },
      data: {
        encryptedAccessToken,
        encryptedRefreshToken: encryptedNewRefreshToken,
        expiresAt: refreshedTokens.expires_in 
          ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
          : null,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true,
      expiresIn: refreshedTokens.expires_in 
    })

  } catch (error) {
    console.error('OAuth refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Provider-specific token refresh logic
async function refreshOAuthToken(provider: string, refreshToken: string) {
  try {
    let refreshUrl: string
    let clientId: string
    let clientSecret: string

    switch (provider) {
      case 'google':
        refreshUrl = 'https://oauth2.googleapis.com/token'
        clientId = process.env.GOOGLE_CLIENT_ID!
        clientSecret = process.env.GOOGLE_CLIENT_SECRET!
        break
      case 'facebook':
        refreshUrl = 'https://graph.facebook.com/v18.0/oauth/access_token'
        clientId = process.env.FACEBOOK_CLIENT_ID!
        clientSecret = process.env.FACEBOOK_CLIENT_SECRET!
        break
      default:
        throw new Error('Unsupported provider')
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })

    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

// Token encryption utility (same as in auth.ts)
async function encryptToken(token: string): Promise<string> {
  const algorithm = 'aes-256-cbc'
  const secretKey = crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY!).digest()
  
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(algorithm, secretKey)
  
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return `${iv.toString('hex')}:${encrypted}`
}

// Token decryption utility (same as in auth.ts)
async function decryptToken(encryptedToken: string): Promise<string> {
  const algorithm = 'aes-256-cbc'
  const secretKey = crypto.createHash('sha256').update(process.env.TOKEN_ENCRYPTION_KEY!).digest()
  
  const [ivHex, encrypted] = encryptedToken.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  
  const decipher = crypto.createDecipher(algorithm, secretKey)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}
