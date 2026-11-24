import { NextRequest } from 'next/server';
import { withAdminApi } from '@/lib/api-auth';
import { respondWithReleaseReport } from '@/lib/release-report-route';

// GET /api/admin/reports/releases - per-release report across every artist
export async function GET(request: NextRequest) {
  return withAdminApi(request, async () => respondWithReleaseReport(request, null));
}
