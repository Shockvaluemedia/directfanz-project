import { NextRequest, NextResponse } from 'next/server';
import { DropError } from '@/lib/drops';
import {
  loadReleaseReport,
  parseFixedMonthlyCents,
  releaseReportToCsv,
} from '@/lib/release-report';

/**
 * Shared GET handler for the release report. ?fixedMonthly=<dollars> shares a
 * monthly fixed cost across releases; ?format=csv downloads a spreadsheet.
 */
export async function respondWithReleaseReport(
  request: NextRequest,
  artistId: string | null
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const fixedMonthlyCents = parseFixedMonthlyCents(url.searchParams.get('fixedMonthly'));
    const report = await loadReleaseReport(artistId, { fixedMonthlyCents });

    if (url.searchParams.get('format') === 'csv') {
      return new NextResponse(releaseReportToCsv(report), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="release-report.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      { success: true, data: report },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof DropError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Error building release report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build release report' },
      { status: 500 }
    );
  }
}
