#!/usr/bin/env node

/**
 * S3 Upload Test Script
 * 
 * This script tests the complete S3 upload workflow:
 * 1. Tests S3 connectivity
 * 2. Generates presigned URLs
 * 3. Uploads test files
 * 4. Verifies uploads
 * 5. Cleans up test files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Using built-in fetch in Node.js 18+

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3000';

// Test configuration
const TEST_FILES = [
  {
    name: 'test-audio.mp3',
    type: 'audio/mpeg',
    size: 1024 * 50, // 50KB
    category: 'AUDIO'
  },
  {
    name: 'test-image.jpg',
    type: 'image/jpeg', 
    size: 1024 * 100, // 100KB
    category: 'IMAGE'
  },
  {
    name: 'test-document.pdf',
    type: 'application/pdf',
    size: 1024 * 200, // 200KB
    category: 'DOCUMENT'
  }
];

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

function createTestFile(fileName, size) {
  const testDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const filePath = path.join(testDir, fileName);
  const content = Buffer.alloc(size, 'A'); // Create file filled with 'A's
  fs.writeFileSync(filePath, content);
  return filePath;
}

async function testS3Connectivity() {
  log('\n🔍 Testing S3 Connectivity...', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/test-s3`);
    const data = await response.json();
    
    if (data.success) {
      log('✅ S3 connectivity test passed!', 'green');
      return true;
    } else {
      log('❌ S3 connectivity test failed:', 'red');
      log(`   Error: ${data.error}`, 'red');
      
      if (data.errorCode === 'InvalidAccessKeyId') {
        log('   💡 Please update your AWS credentials in .env.local', 'yellow');
      }
      return false;
    }
  } catch (error) {
    log('❌ Failed to connect to test endpoint:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function generatePresignedUrl(fileInfo) {
  log(`\n📝 Generating presigned URL for ${fileInfo.name}...`, 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/artist/content/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real testing, you would need proper authentication headers
      },
      body: JSON.stringify({
        fileName: fileInfo.name,
        fileType: fileInfo.type,
        fileSize: fileInfo.size
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Presigned URL generated successfully!', 'green');
      log(`   Upload URL: ${data.data.uploadUrl.substring(0, 50)}...`, 'reset');
      log(`   File URL: ${data.data.fileUrl}`, 'reset');
      return data.data;
    } else {
      log('❌ Failed to generate presigned URL:', 'red');
      log(`   Error: ${data.error.message}`, 'red');
      return null;
    }
  } catch (error) {
    log('❌ Request failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return null;
  }
}

async function uploadFileToS3(filePath, uploadUrl, contentType) {
  log(`\n📤 Uploading file to S3...`, 'blue');
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString()
      }
    });
    
    if (response.ok) {
      log('✅ File uploaded successfully!', 'green');
      log(`   Status: ${response.status} ${response.statusText}`, 'reset');
      return true;
    } else {
      log('❌ Upload failed:', 'red');
      log(`   Status: ${response.status} ${response.statusText}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Upload error:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function verifyUpload(fileUrl) {
  log(`\n🔍 Verifying upload...`, 'blue');
  
  try {
    const response = await fetch(fileUrl, { method: 'HEAD' });
    
    if (response.ok) {
      log('✅ Upload verified - file is accessible!', 'green');
      log(`   Content-Length: ${response.headers.get('content-length')}`, 'reset');
      log(`   Content-Type: ${response.headers.get('content-type')}`, 'reset');
      return true;
    } else {
      log('❌ Verification failed:', 'red');
      log(`   Status: ${response.status} ${response.statusText}`, 'red');
      return false;
    }
  } catch (error) {
    log('❌ Verification error:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function cleanupTestFile(fileUrl) {
  log(`\n🧹 Cleaning up test file...`, 'blue');
  // Note: In a real implementation, you would call a delete endpoint
  // that uses the deleteFile function from s3.ts
  log('   Test file cleanup would be implemented here', 'yellow');
}

async function testCompleteUploadWorkflow(fileInfo) {
  log(`\n${'='.repeat(60)}`, 'bold');
  log(`🚀 Testing ${fileInfo.category} Upload: ${fileInfo.name}`, 'bold');
  log(`${'='.repeat(60)}`, 'bold');
  
  // Create test file
  log(`\n📁 Creating test file...`, 'blue');
  const filePath = createTestFile(fileInfo.name, fileInfo.size);
  log(`   Created: ${filePath}`, 'reset');
  
  try {
    // Generate presigned URL
    const uploadData = await generatePresignedUrl(fileInfo);
    if (!uploadData) return false;
    
    // Upload file
    const uploadSuccess = await uploadFileToS3(filePath, uploadData.uploadUrl, fileInfo.type);
    if (!uploadSuccess) return false;
    
    // Verify upload
    const verifySuccess = await verifyUpload(uploadData.fileUrl);
    if (!verifySuccess) return false;
    
    // Cleanup remote file (optional)
    await cleanupTestFile(uploadData.fileUrl);
    
    log(`\n✅ ${fileInfo.name} upload test completed successfully!`, 'green');
    return true;
    
  } catch (error) {
    log(`\n❌ Test failed for ${fileInfo.name}:`, 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  } finally {
    // Cleanup local test file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log(`   Cleaned up local test file: ${filePath}`, 'reset');
    }
  }
}

async function main() {
  log(`\n${colors.bold}${colors.blue}🧪 DirectFanz S3 Upload Test Suite${colors.reset}`);
  log(`${'='.repeat(60)}`);
  
  // Step 1: Test S3 connectivity
  const connectivityOk = await testS3Connectivity();
  if (!connectivityOk) {
    log('\n❌ S3 connectivity failed. Please check your AWS configuration.', 'red');
    log('\n💡 Setup instructions:', 'yellow');
    log('   1. Create AWS account and S3 bucket', 'yellow');
    log('   2. Create IAM user with S3 permissions', 'yellow');
    log('   3. Update .env.local with real AWS credentials:', 'yellow');
    log('      AWS_ACCESS_KEY_ID="your_real_access_key"', 'yellow');
    log('      AWS_SECRET_ACCESS_KEY="your_real_secret_key"', 'yellow');
    log('      AWS_REGION="your_bucket_region"', 'yellow');
    log('      AWS_S3_BUCKET_NAME="your_bucket_name"', 'yellow');
    log('   4. Restart the development server', 'yellow');
    log('\n📖 See docs/aws-s3-setup.md for detailed instructions', 'blue');
    process.exit(1);
  }
  
  // Step 2: Test uploads for each file type
  const results = [];
  for (const fileInfo of TEST_FILES) {
    const success = await testCompleteUploadWorkflow(fileInfo);
    results.push({ file: fileInfo.name, success });
  }
  
  // Summary
  log(`\n${'='.repeat(60)}`, 'bold');
  log(`📊 Test Results Summary`, 'bold');
  log(`${'='.repeat(60)}`, 'bold');
  
  let passed = 0;
  for (const result of results) {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const color = result.success ? 'green' : 'red';
    log(`   ${result.file}: ${status}`, color);
    if (result.success) passed++;
  }
  
  log(`\n📈 Overall Results: ${passed}/${results.length} tests passed`, passed === results.length ? 'green' : 'red');
  
  if (passed === results.length) {
    log('\n🎉 All S3 upload tests passed! Your S3 configuration is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please check the error messages above.', 'yellow');
  }
  
  // Cleanup temp directory
  const tempDir = path.join(__dirname, '../temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    log('   Cleaned up temporary directory', 'reset');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n\n👋 Test interrupted. Cleaning up...', 'yellow');
  const tempDir = path.join(__dirname, '../temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  process.exit(0);
});

// Check if this script is being run directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath) {
    main().catch(console.error);
  }
}
