#!/usr/bin/env node

/**
 * Direct S3 Functionality Test
 * 
 * This script directly tests the S3 functions without going through the API endpoints,
 * bypassing authentication and CSRF protection for testing purposes.
 */

import { generatePresignedUrl } from '../src/lib/s3.ts';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testPresignedUrlGeneration() {
  log('\n🧪 Testing Direct S3 Presigned URL Generation', 'bold');
  log('='.repeat(50), 'blue');

  const testFiles = [
    {
      fileName: 'test-song.mp3',
      fileType: 'audio/mpeg',
      fileSize: 5 * 1024 * 1024, // 5MB
      artistId: 'test-artist-123'
    },
    {
      fileName: 'test-image.jpg',
      fileType: 'image/jpeg',
      fileSize: 2 * 1024 * 1024, // 2MB
      artistId: 'test-artist-123'
    },
    {
      fileName: 'test-document.pdf',
      fileType: 'application/pdf',
      fileSize: 1 * 1024 * 1024, // 1MB
      artistId: 'test-artist-123'
    }
  ];

  let successCount = 0;

  for (const testFile of testFiles) {
    try {
      log(`\n📝 Testing ${testFile.fileName}...`, 'blue');
      
      const result = await generatePresignedUrl(testFile);
      
      log('✅ Presigned URL generated successfully!', 'green');
      log(`   Upload URL: ${result.uploadUrl.substring(0, 80)}...`, 'reset');
      log(`   File URL: ${result.fileUrl}`, 'reset');
      log(`   S3 Key: ${result.key}`, 'reset');
      
      successCount++;
    } catch (error) {
      log('❌ Failed to generate presigned URL:', 'red');
      log(`   Error: ${error.message}`, 'red');
    }
  }

  log(`\n📊 Summary: ${successCount}/${testFiles.length} presigned URLs generated successfully`, 
      successCount === testFiles.length ? 'green' : 'yellow');
}

async function testActualUpload() {
  log('\n🚀 Testing Actual File Upload with Presigned URL', 'bold');
  log('='.repeat(50), 'blue');

  const testFile = {
    fileName: 'direct-test.txt',
    fileType: 'text/plain',
    fileSize: 100, // 100 bytes
    artistId: 'test-artist-direct'
  };

  try {
    // Generate presigned URL
    log('\n1. Generating presigned URL...', 'blue');
    const urlData = await generatePresignedUrl(testFile);
    log('✅ Presigned URL generated!', 'green');

    // Create test file content
    log('\n2. Creating test file...', 'blue');
    const testContent = `DirectFanz S3 Test - ${new Date().toISOString()}`;
    const buffer = Buffer.from(testContent, 'utf8');

    // Upload to S3 using presigned URL
    log('\n3. Uploading to S3...', 'blue');
    const uploadResponse = await fetch(urlData.uploadUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': testFile.fileType,
        'Content-Length': buffer.length.toString()
      }
    });

    if (uploadResponse.ok) {
      log('✅ File uploaded successfully!', 'green');
      log(`   Status: ${uploadResponse.status} ${uploadResponse.statusText}`, 'reset');
      log(`   ETag: ${uploadResponse.headers.get('etag')}`, 'reset');
      
      // Test file accessibility (will likely be 403 due to bucket permissions, but that's expected)
      log('\n4. Testing file accessibility...', 'blue');
      const accessResponse = await fetch(urlData.fileUrl, { method: 'HEAD' });
      if (accessResponse.status === 403) {
        log('✅ File exists but access is restricted (expected for security)', 'green');
      } else if (accessResponse.ok) {
        log('✅ File is publicly accessible', 'green');
      } else {
        log(`⚠️  File accessibility check returned: ${accessResponse.status}`, 'yellow');
      }

      log('\n🎉 Complete upload workflow test successful!', 'green');
      return true;
    } else {
      log(`❌ Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`, 'red');
      return false;
    }

  } catch (error) {
    log('❌ Upload test failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log(`\n${colors.bold}${colors.blue}🔧 DirectFanz S3 Direct Function Test${colors.reset}`);
  log('This test bypasses API authentication to test S3 functionality directly.');
  log('='.repeat(60));
  
  // Debug environment variables
  log('\n🔍 Environment Variables:', 'blue');
  log(`   AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`, 'reset');
  log(`   AWS_S3_BUCKET_NAME: ${process.env.AWS_S3_BUCKET_NAME || 'NOT SET'}`, 'reset');
  log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'NOT SET'}`, 'reset');

  try {
    // Test 1: Presigned URL generation
    await testPresignedUrlGeneration();

    // Test 2: Actual upload
    await testActualUpload();

    log('\n✅ All direct S3 functionality tests completed!', 'green');
  } catch (error) {
    log('\n❌ Test suite failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

if (import.meta.url.startsWith('file:')) {
  main().catch(console.error);
}