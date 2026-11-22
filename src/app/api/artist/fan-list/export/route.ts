import { NextRequest, NextResponse } from 'next/server';
import { withArtistApi } from '@/lib/api-auth';
import { exportFanListCsv } from '@/lib/fan-list';

// GET /api/artist/fan-list/export - the signed-in artist's subscribed fans as CSV
export async function GET(request: NextRequest) {
  return withArtistApi(request, async req => {
    try {
      const csv = await exportFanListCsv(req.user.id);
      const date = new Date().toISOString().slice(0, 10);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="fan-list-${date}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      console.error('Error exporting fan list:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to export fan list' },
        { status: 500 }
      );
    }
  });
}
