import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/lib/fan-list';

// The unsubscribe link in every fan list email. No sign-in needed; the token
// identifies one fan on one artist's list.
//
// GET shows a confirm button instead of unsubscribing straight away, because
// mail scanners open links in emails. POST unsubscribes; mail apps call it
// directly for one-click unsubscribe (List-Unsubscribe-Post, RFC 8058).

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>` +
      `<body style="font-family: sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem;">` +
      `${body}</body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  if (!token) {
    return page('Unsubscribe', '<p>This unsubscribe link is not valid.</p>', 400);
  }

  return page(
    'Unsubscribe',
    `<h1 style="font-size: 1.25rem;">Leave this fan list?</h1>` +
      `<form method="post" action="/api/fan-list/unsubscribe?token=${encodeURIComponent(token)}">` +
      `<button type="submit">Unsubscribe</button></form>`
  );
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';

  try {
    const result = await unsubscribeByToken(token);
    if (!result) {
      return page('Unsubscribe', '<p>This unsubscribe link is not valid.</p>', 404);
    }
    return page(
      'Unsubscribed',
      `<p>You won't get any more emails from ${escapeHtml(result.artistName)}'s fan list.</p>`
    );
  } catch (error) {
    console.error('Fan list unsubscribe error:', error);
    return page('Unsubscribe', '<p>Something went wrong. Please try again.</p>', 500);
  }
}
