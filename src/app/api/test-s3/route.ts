import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'directfanz-content-dbrooks';

export async function GET() {
  try {
    console.log('=== S3 Configuration Test ===');
    console.log('Region:', process.env.AWS_REGION);
    console.log('Bucket:', BUCKET_NAME);
    console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID?.substring(0, 10) + '...');
    
    // Test 1: Try to list buckets (this will fail, but show us the error)
    try {
      console.log('Testing ListBuckets...');
      const listCommand = new ListBucketsCommand({});
      await s3Client.send(listCommand);
      console.log('ListBuckets: SUCCESS');
    } catch (listError) {
      console.log('ListBuckets error (expected):', (listError as Error).message);
    }

    // Test 2: Try to upload a small test file
    console.log('Testing PutObject...');
    const testContent = `DirectFanz S3 test - ${new Date().toISOString()}`;
    const testKey = `test/api-test-${Date.now()}.txt`;
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    const result = await s3Client.send(putCommand);
    console.log('PutObject: SUCCESS', result);

    return NextResponse.json({
      success: true,
      message: 'S3 upload test successful!',
      details: {
        bucket: BUCKET_NAME,
        region: process.env.AWS_REGION,
        testKey,
        etag: result.ETag,
      }
    });

  } catch (error) {
    console.error('S3 test error:', error);
    
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      errorCode: (error as any).Code,
      errorName: (error as any).name,
      details: {
        bucket: BUCKET_NAME,
        region: process.env.AWS_REGION,
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      }
    }, { status: 500 });
  }
}