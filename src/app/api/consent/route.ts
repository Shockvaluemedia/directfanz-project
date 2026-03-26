import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GDPRComplianceService } from '@/lib/legal-compliance';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

const consentPostSchema = z.object({
  categories: z
    .array(z.string().min(1))
    .min(1, 'At least one consent category is required'),
  source: z
    .enum(['BANNER', 'SETTINGS', 'REGISTRATION', 'API'])
    .optional()
    .default('BANNER'),
});

const VALID_CONSENT_TYPES = ['COOKIES', 'MARKETING', 'ANALYTICS', 'FUNCTIONAL', 'NECESSARY'] as const;

// POST /api/consent - Record user consent preferences
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized. You must be logged in to manage consent.');
    }

    const body = await request.json();
    const parsed = consentPostSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('BAD_REQUEST', 'Validation failed');
    }

    const { categories, source } = parsed.data;

    const ip = request.ip || request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const consentIds: string[] = [];

    for (const category of VALID_CONSENT_TYPES) {
      const granted = categories.includes(category.toLowerCase()) || category === 'NECESSARY';
      const consentId = await GDPRComplianceService.recordConsent(
        session.user.id,
        category,
        granted,
        source,
        ip,
        userAgent
      );
      consentIds.push(consentId);
    }

    return apiSuccess({ consentIds,
      message: 'Consent preferences have been recorded successfully.' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiError('BAD_REQUEST', 'Invalid JSON in request body');
    }
    logger.error('Consent recording error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'An internal error occurred while recording consent');
  }
}

// GET /api/consent - Retrieve current consent records for the authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized. You must be logged in to view consent records.');
    }

    const consents = await GDPRComplianceService.getUserConsents(session.user.id);

    // Build a summary of current consent status per category
    const consentSummary: Record<string, boolean> = {};
    for (const category of VALID_CONSENT_TYPES) {
      const hasConsent = await GDPRComplianceService.hasConsent(session.user.id, category);
      consentSummary[category] = hasConsent;
    }

    return apiSuccess({ consents,
      summary: consentSummary });
  } catch (error) {
    logger.error('Get consents error', {}, error as Error);
    return apiError('INTERNAL_ERROR', 'An internal error occurred while retrieving consent records');
  }
}
