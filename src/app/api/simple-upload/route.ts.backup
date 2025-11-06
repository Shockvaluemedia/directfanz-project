import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FileUploader } from '@/lib/upload';

export async function POST(request: NextRequest) {
  try {
    // Use getServerSession instead of getToken
    const session = await getServerSession(authOptions);

    console.log('Session from getServerSession:', session ? 'Found' : 'Not found');
    console.log('User role:', session?.user?.role);

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.user.role !== 'ARTIST') {
      return NextResponse.json({ error: 'Only artists can upload content' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('Starting upload for file:', file.name, 'Size:', file.size);

    // Upload file to S3
    const uploadResult = await FileUploader.uploadFile(file, session.user.id);

    console.log('Upload successful:', uploadResult);

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully!',
      data: {
        fileUrl: uploadResult.fileUrl,
        thumbnailUrl: uploadResult.thumbnailUrl,
        fileSize: uploadResult.fileSize,
        duration: uploadResult.duration,
        format: uploadResult.format,
      },
    });
  } catch (error) {
    console.error('Simple upload error:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}