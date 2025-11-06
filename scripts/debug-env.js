#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

console.log('=== Environment Debug ===');
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME);
console.log('AWS_ACCESS_KEY_ID present:', !!process.env.AWS_ACCESS_KEY_ID);

// Test if we can import the S3 lib
try {
  const s3Module = await import('../src/lib/s3.ts');
  console.log('S3 lib imported successfully');
  console.log('SUPPORTED_FILE_TYPES:', Object.keys(s3Module.SUPPORTED_FILE_TYPES));
  
  // Try to generate a presigned URL
  const testRequest = {
    fileName: 'debug-test.mp3',
    fileType: 'audio/mpeg',
    fileSize: 1024,
    artistId: 'debug-test-artist',
  };
  
  console.log('\n=== Testing S3 Function ===');
  const result = await s3Module.generatePresignedUrl(testRequest);
  console.log('✅ Presigned URL generated successfully!');
  console.log('Upload URL:', result.uploadUrl.substring(0, 80) + '...');
  console.log('File URL:', result.fileUrl);
  console.log('Key:', result.key);
} catch (error) {
  console.log('❌ S3 test failed:', error.message);
  console.log('Error details:', error);
}