import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Only artists can upload content' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('✅ UPLOAD TEST: File received:', file.name, 'Size:', file.size);

    // ALWAYS return success for testing (no actual upload)
    return NextResponse.json({
      success: true,
      message: 'Upload test successful! File details logged.',
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        testNote: 'This is a working test response - no actual file upload occurred'
      },
    });
    
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
