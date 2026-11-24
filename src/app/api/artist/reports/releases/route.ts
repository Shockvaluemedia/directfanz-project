import { NextRequest } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { respondWithReleaseReport } from '@/lib/release-report-route';

// GET /api/artist/reports/releases - the signed-in artist's per-release report
export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => respondWithReleaseReport(request, req.user.id));
}
