import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GDPRComplianceService } from '@/lib/legal-compliance';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { categories, source = 'BANNER' } = body;

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json({ error: 'categories array required' }, { status: 400 });
    }

    const ip = request.ip || request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const validTypes = ['COOKIES', 'MARKETING', 'ANALYTICS', 'FUNCTIONAL', 'NECESSARY'] as const;
    const consentIds: string[] = [];

    for (const category of validTypes) {
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

    return NextResponse.json({ success: true, consentIds });
  } catch (error) {
    console.error('Consent recording error:', error);
    return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const consents = await GDPRComplianceService.getUserConsents(session.user.id);
    return NextResponse.json({ consents });
  } catch (error) {
    console.error('Get consents error:', error);
    return NextResponse.json({ error: 'Failed to get consents' }, { status: 500 });
  }
}
