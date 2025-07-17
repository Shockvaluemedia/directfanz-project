import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkContentAccess, generateAccessToken } from '@/lib/content-access'
import { prisma } from '@/lib/prisma'

// Generate access token for content
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const contentId = params.id

    // Check if user has access to this content
    const accessResult = await checkContentAccess(session.user.id, contentId)
    
    if (!accessResult.hasAccess) {
      const errorMessages = {
        'not_found': 'Content not found',
        'no_subscription': 'Subscription required to access this content',
        'invalid_tier': 'Your subscription tier does not include this content'
      }

      return NextResponse.json(
        { 
          error: errorMessages[accessResult.reason as keyof typeof errorMessages] || 'Access denied',
          reason: accessResult.reason
        },
        { status: 403 }
      )
    }

    // Generate access token
    const accessToken = generateAccessToken(session.user.id, contentId)

    // Get content metadata for response
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        type: true,
        fileSize: true,
        duration: true,
        format: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        accessToken,
        content,
        expiresIn: 3600, // 1 hour
        accessReason: accessResult.reason
      }
    })

  } catch (error) {
    console.error('Access token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate access token' },
      { status: 500 }
    )
  }
}

// Check content access without generating token
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const contentId = params.id

    // Check if user has access to this content
    const accessResult = await checkContentAccess(session.user.id, contentId)

    // Get content metadata
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        title: true,
        type: true,
        isPublic: true,
        tiers: {
          select: {
            id: true,
            name: true,
            minimumPrice: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        hasAccess: accessResult.hasAccess,
        reason: accessResult.reason,
        content,
        subscription: accessResult.subscription
      }
    })

  } catch (error) {
    console.error('Content access check error:', error)
    return NextResponse.json(
      { error: 'Failed to check content access' },
      { status: 500 }
    )
  }
}