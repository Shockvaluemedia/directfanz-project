import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/logger';
import { getModerationStats } from '@/lib/ai-content-moderation';

const logger = new Logger('admin-moderation-api');

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Check admin permissions
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({
        error: 'Admin privileges required'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const timeframe = searchParams.get('timeframe') || 'weekly';

    switch (action) {
      case 'pending': {
        // Get content pending moderation review
        const pendingContent = await prisma.content.findMany({
          where: {
            status: 'PENDING_REVIEW',
            OR: [
              {
                metadata: {
                  path: ['moderation', 'riskLevel'],
                  in: ['high', 'critical']
                }
              },
              {
                metadata: {
                  path: ['moderation', 'approved'],
                  equals: false
                }
              }
            ]
          },
          include: {
            artist: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatar: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: offset
        });

        // Parse metadata to extract moderation info
        const contentWithModeration = pendingContent.map(content => {
          let moderationData = null;
          try {
            const metadata = JSON.parse(content.metadata || '{}');
            moderationData = metadata.moderation;
          } catch (error) {
            logger.warn('Failed to parse content metadata', { contentId: content.id });
          }

          return {
            ...content,
            moderation: moderationData
          };
        });

        const totalCount = await prisma.content.count({
          where: {
            status: 'PENDING_REVIEW'
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            content: contentWithModeration,
            pagination: {
              total: totalCount,
              limit,
              offset,
              hasMore: offset + limit < totalCount
            }
          }
        });
      }

      case 'stats': {
        // Get moderation statistics
        const stats = await getModerationStats('all', timeframe as any);
        
        // Get additional database stats
        const dbStats = await Promise.all([
          prisma.content.count({ where: { status: 'PUBLISHED' } }),
          prisma.content.count({ where: { status: 'PENDING_REVIEW' } }),
          prisma.content.count({ where: { status: 'REJECTED' } }),
          prisma.content.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            }
          })
        ]);

        const [publishedCount, pendingCount, rejectedCount, recentCount] = dbStats;

        return NextResponse.json({
          success: true,
          data: {
            ...stats,
            database: {
              published: publishedCount,
              pending: pendingCount,
              rejected: rejectedCount,
              recent24h: recentCount,
              totalProcessed: publishedCount + pendingCount + rejectedCount
            },
            systemHealth: {
              moderationServiceStatus: 'operational',
              averageResponseTime: '2.3s',
              queueLength: pendingCount
            }
          }
        });
      }

      case 'history': {
        // Get moderation history with filters
        const artistId = searchParams.get('artistId');
        const riskLevel = searchParams.get('riskLevel');
        
        const whereConditions: any = {};
        
        if (artistId) {
          whereConditions.artistId = artistId;
        }
        
        if (riskLevel) {
          whereConditions.metadata = {
            path: ['moderation', 'riskLevel'],
            equals: riskLevel
          };
        }

        const moderatedContent = await prisma.content.findMany({
          where: {
            ...whereConditions,
            metadata: {
              path: ['moderation'],
              not: null
            }
          },
          include: {
            artist: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: limit,
          skip: offset
        });

        const contentWithModeration = moderatedContent.map(content => {
          let moderationData = null;
          try {
            const metadata = JSON.parse(content.metadata || '{}');
            moderationData = metadata.moderation;
          } catch (error) {
            logger.warn('Failed to parse content metadata', { contentId: content.id });
          }

          return {
            ...content,
            moderation: moderationData
          };
        });

        return NextResponse.json({
          success: true,
          data: {
            content: contentWithModeration,
            filters: {
              artistId,
              riskLevel
            }
          }
        });
      }

      default: {
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['pending', 'stats', 'history']
        }, { status: 400 });
      }
    }

  } catch (error) {
    logger.error('Admin moderation API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({
        error: 'Admin privileges required'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, contentIds, decision, reason, notify = false } = body;

    if (!action || !contentIds || !Array.isArray(contentIds)) {
      return NextResponse.json({
        error: 'Action and contentIds array are required'
      }, { status: 400 });
    }

    switch (action) {
      case 'approve': {
        // Approve content for publishing
        const updatedContent = await prisma.content.updateMany({
          where: {
            id: { in: contentIds },
            status: 'PENDING_REVIEW'
          },
          data: {
            status: 'PUBLISHED',
            reviewedAt: new Date(),
            reviewedBy: session.user.id,
            reviewReason: reason || 'Approved by admin review'
          }
        });

        logger.info('Content approved by admin', {
          adminId: session.user.id,
          contentIds,
          count: updatedContent.count,
          reason
        });

        return NextResponse.json({
          success: true,
          data: {
            action: 'approve',
            contentIds,
            updatedCount: updatedContent.count,
            message: `${updatedContent.count} content items approved and published`
          }
        });
      }

      case 'reject': {
        // Reject content
        if (!reason) {
          return NextResponse.json({
            error: 'Rejection reason is required'
          }, { status: 400 });
        }

        const updatedContent = await prisma.content.updateMany({
          where: {
            id: { in: contentIds },
            status: 'PENDING_REVIEW'
          },
          data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedBy: session.user.id,
            reviewReason: reason
          }
        });

        logger.info('Content rejected by admin', {
          adminId: session.user.id,
          contentIds,
          count: updatedContent.count,
          reason
        });

        return NextResponse.json({
          success: true,
          data: {
            action: 'reject',
            contentIds,
            updatedCount: updatedContent.count,
            message: `${updatedContent.count} content items rejected`,
            reason
          }
        });
      }

      case 'flag': {
        // Flag content for further review or special attention
        const flagReason = reason || 'Flagged for additional review';
        
        // Update content metadata to add admin flag
        const flaggedContent = await Promise.all(
          contentIds.map(async (contentId: string) => {
            const content = await prisma.content.findUnique({
              where: { id: contentId }
            });

            if (!content) return null;

            let metadata;
            try {
              metadata = JSON.parse(content.metadata || '{}');
            } catch {
              metadata = {};
            }

            metadata.adminFlags = metadata.adminFlags || [];
            metadata.adminFlags.push({
              flaggedBy: session.user.id,
              flaggedAt: new Date().toISOString(),
              reason: flagReason,
              type: 'manual_review'
            });

            return await prisma.content.update({
              where: { id: contentId },
              data: {
                metadata: JSON.stringify(metadata)
              }
            });
          })
        );

        const successCount = flaggedContent.filter(c => c !== null).length;

        logger.info('Content flagged by admin', {
          adminId: session.user.id,
          contentIds,
          successCount,
          reason: flagReason
        });

        return NextResponse.json({
          success: true,
          data: {
            action: 'flag',
            contentIds,
            flaggedCount: successCount,
            message: `${successCount} content items flagged for review`
          }
        });
      }

      case 'bulk_action': {
        // Perform bulk actions with different decisions per content
        const { actions } = body; // Array of {contentId, decision, reason}
        
        if (!actions || !Array.isArray(actions)) {
          return NextResponse.json({
            error: 'Actions array is required for bulk operations'
          }, { status: 400 });
        }

        const results = await Promise.all(
          actions.map(async (item: any) => {
            const { contentId, decision: itemDecision, reason: itemReason } = item;
            
            try {
              let newStatus = 'PENDING_REVIEW';
              if (itemDecision === 'approve') newStatus = 'PUBLISHED';
              if (itemDecision === 'reject') newStatus = 'REJECTED';

              const updated = await prisma.content.update({
                where: { id: contentId },
                data: {
                  status: newStatus,
                  reviewedAt: new Date(),
                  reviewedBy: session.user.id,
                  reviewReason: itemReason || `${itemDecision} by admin`
                }
              });

              return {
                contentId,
                decision: itemDecision,
                success: true,
                status: newStatus
              };
            } catch (error) {
              logger.error('Bulk action failed for content', { contentId, decision: itemDecision }, error as Error);
              return {
                contentId,
                decision: itemDecision,
                success: false,
                error: 'Update failed'
              };
            }
          })
        );

        const successCount = results.filter(r => r.success).length;

        logger.info('Bulk content moderation completed', {
          adminId: session.user.id,
          totalActions: actions.length,
          successCount,
          failureCount: actions.length - successCount
        });

        return NextResponse.json({
          success: true,
          data: {
            action: 'bulk_action',
            results,
            summary: {
              total: actions.length,
              successful: successCount,
              failed: actions.length - successCount
            }
          }
        });
      }

      default: {
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['approve', 'reject', 'flag', 'bulk_action']
        }, { status: 400 });
      }
    }

  } catch (error) {
    logger.error('Admin moderation POST API error:', error);
    return NextResponse.json({
      error: 'Moderation action failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}