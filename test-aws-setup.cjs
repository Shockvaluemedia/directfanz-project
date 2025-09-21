#!/usr/bin/env node

const { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('🧪 Testing AWS S3 Setup for DirectFanz...\n');

// Check environment variables
const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY', 
  'AWS_REGION',
  'AWS_S3_BUCKET_NAME'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing environment variables:');
  missingEnvVars.forEach(envVar => {
    console.error(`   - ${envVar}`);
  });
  console.error('\nPlease add these to your .env.local file and try again.');
  process.exit(1);
}

console.log('✅ Environment variables found:');
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  const displayValue = envVar.includes('SECRET') 
    ? '*'.repeat(value.length) 
    : value;
  console.log(`   - ${envVar}: ${displayValue}`);
});
console.log();

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

async function testAWSConnection() {
  try {
    console.log('🔗 Testing AWS S3 connection...');
    
    // Test 1: List buckets (verify credentials)
    console.log('   1. Testing credentials...');
    const listCommand = new ListBucketsCommand({});
    const listResult = await s3Client.send(listCommand);
    const bucketExists = listResult.Buckets.some(bucket => bucket.Name === BUCKET_NAME);
    
    if (bucketExists) {
      console.log('   ✅ Credentials valid and bucket found');
    } else {
      console.log('   ⚠️  Credentials valid but bucket not found in list');
      console.log('   📝 Available buckets:', listResult.Buckets.map(b => b.Name).join(', '));
    }

    // Test 2: Upload a test file
    console.log('   2. Testing file upload...');
    const testContent = `DirectFanz AWS Test - ${new Date().toISOString()}`;
    const testKey = `test/${Date.now()}-test-file.txt`;
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });
    
    await s3Client.send(putCommand);
    console.log('   ✅ Test file uploaded successfully');

    // Test 3: Read the test file back
    console.log('   3. Testing file download...');
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    
    const getResult = await s3Client.send(getCommand);
    const downloadedContent = await streamToString(getResult.Body);
    
    if (downloadedContent === testContent) {
      console.log('   ✅ Test file downloaded successfully');
    } else {
      console.log('   ❌ Downloaded content doesn\'t match uploaded content');
    }

    // Test 4: Check file metadata
    console.log('   4. Testing file metadata...');
    const headCommand = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    
    const headResult = await s3Client.send(headCommand);
    console.log('   ✅ File metadata retrieved');
    console.log(`      - Size: ${headResult.ContentLength} bytes`);
    console.log(`      - Type: ${headResult.ContentType}`);
    console.log(`      - Last Modified: ${headResult.LastModified}`);

    // Test 5: Generate file URL
    console.log('   5. Generating file URL...');
    const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
    const baseUrl = cdnDomain 
      ? `https://${cdnDomain}`
      : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    
    const fileUrl = `${baseUrl}/${testKey}`;
    console.log(`   ✅ File URL: ${fileUrl}`);

    // Cleanup: Delete test file
    console.log('   6. Cleaning up test file...');
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    
    await s3Client.send(deleteCommand);
    console.log('   ✅ Test file deleted');

    console.log('\n🎉 AWS S3 Setup Test PASSED!');
    console.log('\nYour DirectFanz platform is now configured to use AWS S3 for file storage.');
    console.log('\n📊 Configuration Summary:');
    console.log(`   - Bucket: ${BUCKET_NAME}`);
    console.log(`   - Region: ${process.env.AWS_REGION}`);
    console.log(`   - CDN: ${cdnDomain ? `✅ ${cdnDomain}` : '❌ Not configured (optional)'}`);
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. npm run dev');
    console.log('   2. Login as an artist');
    console.log('   3. Go to http://localhost:3000/upload');
    console.log('   4. Upload your music and videos!');

  } catch (error) {
    console.error('\n❌ AWS S3 Setup Test FAILED!');
    console.error('\n🔍 Error Details:');
    console.error(`   - Error: ${error.message}`);
    console.error(`   - Code: ${error.Code || 'Unknown'}`);
    
    if (error.Code === 'NoSuchBucket') {
      console.error('\n💡 Solution:');
      console.error('   1. Double-check your bucket name in .env.local');
      console.error('   2. Make sure the bucket exists in the correct region');
      console.error('   3. Verify you have access to the bucket');
    } else if (error.Code === 'AccessDenied') {
      console.error('\n💡 Solution:');
      console.error('   1. Check your IAM policy includes the correct permissions');
      console.error('   2. Verify the bucket name in your IAM policy matches exactly');
      console.error('   3. Ensure your credentials have the right permissions');
    } else if (error.Code === 'InvalidAccessKeyId') {
      console.error('\n💡 Solution:');
      console.error('   1. Double-check your AWS_ACCESS_KEY_ID in .env.local');
      console.error('   2. Make sure there are no extra spaces or characters');
      console.error('   3. Verify the access key is active in AWS IAM');
    } else if (error.Code === 'SignatureDoesNotMatch') {
      console.error('\n💡 Solution:');
      console.error('   1. Double-check your AWS_SECRET_ACCESS_KEY in .env.local');
      console.error('   2. Make sure there are no extra spaces or characters');
      console.error('   3. Verify the secret key matches the access key');
    }
    
    console.error('\n📖 For detailed setup instructions, see: AWS_SETUP_GUIDE.md');
    process.exit(1);
  }
}

// Helper function to convert stream to string
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Run the test
testAWSConnection();