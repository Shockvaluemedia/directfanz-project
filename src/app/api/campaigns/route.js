export function GET() {
  return new Response(JSON.stringify({
    success: true,
    campaigns: [],
    total: 0,
  }), { headers: { 'Content-Type': 'application/json' } });
}
