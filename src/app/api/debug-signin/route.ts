import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== DEBUG SIGNIN REQUEST ===');
    console.log('Method:', request.method);
    console.log('URL:', request.url);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const contentType = request.headers.get('content-type');
    console.log('Content-Type:', contentType);

    let body;
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      console.log('Form Data:', body);
    } else if (contentType?.includes('application/json')) {
      body = await request.json();
      console.log('JSON Data:', body);
    } else {
      const text = await request.text();
      console.log('Raw Body:', text);
      body = text;
    }

    return NextResponse.json({
      success: true,
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    });
  } catch (error) {
    console.error('Debug signin error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
