import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserAccessibleContent, getContentAccessSummary } from '@/lib/content-access'
import { UserRole } from '@/types/database'

// Get accessible content for a specific artist
export async function GET(
  request: NextRequest,
  { params }: { params: { artistId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') || undefined
    const summary = searchParams.get('summary') === 'true'

    // If summary is requested, return access summary
    if (summary) {
      const accessSummary = await getContentAccessSummary(
        session.user.id,
        params.artistId
      )

      return NextResponse.json({
        success: true,
        data: accessSummary
      })
    }

    // Get accessible content
    const result = await getUserAccessibleContent(
      session.user.id,
      params.artistId,
      { page, limit, type }
    )

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Fan content access error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accessible content' },
      { status: 500 }
    )
  }
}