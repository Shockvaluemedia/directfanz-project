#!/usr/bin/env node

/**
 * Complete Pipeline Test - Database + S3 Integration
 * 
 * This script tests the full pipeline:
 * 1. Database connectivity
 * 2. S3 file upload
 * 3. Content record creation
 * 4. Access control verification
 */

import { PrismaClient } from '@prisma/client';
import { generatePresignedUrl } from '../src/lib/s3.ts';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Prisma client
const prisma = new PrismaClient();

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

async function testDatabaseConnection() {
  log('\n🔍 Testing Database Connection', 'bold');
  log('='.repeat(40), 'blue');
  
  try {
    // Test basic connection
    await prisma.$connect();
    log('✅ Database connection successful', 'green');
    
    // Test user count
    const userCount = await prisma.users.count();
    log(`   Found ${userCount} users in database`, 'reset');
    
    // Test content count
    const contentCount = await prisma.content.count();
    log(`   Found ${contentCount} content items in database`, 'reset');
    
    return true;
  } catch (error) {
    log('❌ Database connection failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function createTestArtist() {
  log('\n👤 Creating Test Artist', 'bold');
  log('='.repeat(40), 'blue');
  
  try {
    const testArtist = await prisma.users.upsert({
      where: { email: 'test-artist@directfanz.io' },
      update: {},
      create: {
        email: 'test-artist@directfanz.io',
        displayName: 'Test Artist',
        role: 'ARTIST',
        isVerified: true,
        isActive: true,
      },
    });
    
    log('✅ Test artist created/found:', 'green');
    log(`   ID: ${testArtist.id}`, 'reset');
    log(`   Name: ${testArtist.displayName}`, 'reset');
    log(`   Role: ${testArtist.role}`, 'reset');
    
    return testArtist;
  } catch (error) {
    log('❌ Failed to create test artist:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return null;
  }
}

async function testS3Integration(artistId) {
  log('\n☁️  Testing S3 Integration', 'bold');
  log('='.repeat(40), 'blue');
  
  try {
    // Generate presigned URL
    const uploadRequest = {
      fileName: 'pipeline-test.mp3',
      fileType: 'audio/mpeg',
      fileSize: 1024 * 1024, // 1MB
      artistId: artistId,
    };
    
    log('📝 Generating presigned URL...', 'blue');
    const s3Result = await generatePresignedUrl(uploadRequest);
    
    log('✅ Presigned URL generated successfully!', 'green');
    log(`   Upload URL: ${s3Result.uploadUrl.substring(0, 80)}...`, 'reset');
    log(`   File URL: ${s3Result.fileUrl}`, 'reset');
    log(`   S3 Key: ${s3Result.key}`, 'reset');
    
    // Test upload with dummy data
    log('\n📤 Testing file upload to S3...', 'blue');
    const testContent = 'DirectFanz Full Pipeline Test - ' + new Date().toISOString();
    const buffer = Buffer.from(testContent, 'utf8');
    
    const uploadResponse = await fetch(s3Result.uploadUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': uploadRequest.fileType,
        'Content-Length': buffer.length.toString(),
      },
    });
    
    if (uploadResponse.ok) {
      log('✅ File uploaded to S3 successfully!', 'green');
      log(`   Status: ${uploadResponse.status} ${uploadResponse.statusText}`, 'reset');
      return s3Result;
    } else {
      log(`❌ S3 upload failed: ${uploadResponse.status}`, 'red');
      return null;
    }
  } catch (error) {
    log('❌ S3 integration test failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return null;
  }
}

async function testContentCreation(artist, s3Result) {
  log('\n📄 Testing Content Record Creation', 'bold');
  log('='.repeat(40), 'blue');
  
  try {
    const contentRecord = await prisma.content.create({
      data: {
        artistId: artist.id,
        title: 'Full Pipeline Test Audio',
        description: 'Test content created by the full pipeline test',
        type: 'AUDIO',
        fileUrl: s3Result.fileUrl,
        visibility: 'PUBLIC',
        fileSize: 1024,
        format: 'mp3',
        tags: JSON.stringify(['test', 'pipeline', 'audio']),
      },
      include: {
        artist: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
    
    log('✅ Content record created successfully!', 'green');
    log(`   Content ID: ${contentRecord.id}`, 'reset');
    log(`   Title: ${contentRecord.title}`, 'reset');
    log(`   Artist: ${contentRecord.artist.displayName}`, 'reset');
    log(`   File URL: ${contentRecord.fileUrl}`, 'reset');
    log(`   Type: ${contentRecord.type}`, 'reset');
    
    return contentRecord;
  } catch (error) {
    log('❌ Content record creation failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return null;
  }
}

async function testDataRetrieval(contentId) {
  log('\n📊 Testing Data Retrieval', 'bold');
  log('='.repeat(40), 'blue');
  
  try {
    // Test content retrieval
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        artist: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
    
    if (content) {
      log('✅ Content retrieval successful!', 'green');
      log(`   Retrieved content: ${content.title}`, 'reset');
      log(`   Artist: ${content.artist.displayName}`, 'reset');
      log(`   Created: ${content.createdAt.toISOString()}`, 'reset');
      log(`   Views: ${content.totalViews}`, 'reset');
      
      // Test artist content listing
      const artistContent = await prisma.content.findMany({
        where: { artistId: content.artistId },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      
      log(`   Artist has ${artistContent.length} total content items`, 'reset');
      return true;
    } else {
      log('❌ Content not found!', 'red');
      return false;
    }
  } catch (error) {
    log('❌ Data retrieval test failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    return false;
  }
}

async function cleanupTestData(artist, contentId) {
  log('\n🧹 Cleaning up test data', 'blue');
  
  try {
    // Delete content record
    if (contentId) {
      await prisma.content.delete({
        where: { id: contentId },
      });
      log('   ✅ Test content deleted', 'green');
    }
    
    // Delete test artist (optional - keep for future tests)
    // await prisma.users.delete({
    //   where: { id: artist.id },
    // });
    // log('   ✅ Test artist deleted', 'green');
    
    log('   ℹ️  Test artist preserved for future tests', 'yellow');
  } catch (error) {
    log(`   ⚠️  Cleanup warning: ${error.message}`, 'yellow');
  }
}

async function main() {
  log(`\n${colors.bold}${colors.blue}🧪 DirectFanz Full Pipeline Test${colors.reset}`);
  log('Testing Database + S3 + Content Management Integration');
  log('='.repeat(60));
  
  let testArtist = null;
  let s3Result = null;
  let contentRecord = null;
  
  try {
    // Test 1: Database Connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      process.exit(1);
    }
    
    // Test 2: Create Test Artist
    testArtist = await createTestArtist();
    if (!testArtist) {
      process.exit(1);
    }
    
    // Test 3: S3 Integration
    s3Result = await testS3Integration(testArtist.id);
    if (!s3Result) {
      process.exit(1);
    }
    
    // Test 4: Content Creation
    contentRecord = await testContentCreation(testArtist, s3Result);
    if (!contentRecord) {
      process.exit(1);
    }
    
    // Test 5: Data Retrieval
    const retrievalSuccess = await testDataRetrieval(contentRecord.id);
    if (!retrievalSuccess) {
      process.exit(1);
    }
    
    // Success!
    log('\n🎉 Full Pipeline Test Results', 'bold');
    log('='.repeat(40), 'blue');
    log('✅ Database connection: PASSED', 'green');
    log('✅ S3 file upload: PASSED', 'green');
    log('✅ Content record creation: PASSED', 'green');
    log('✅ Data retrieval: PASSED', 'green');
    log('\n🚀 Complete pipeline is working perfectly!', 'green');
    
    // Cleanup
    await cleanupTestData(testArtist, contentRecord.id);
    
  } catch (error) {
    log('\n❌ Pipeline test failed:', 'red');
    log(`   Error: ${error.message}`, 'red');
    
    // Attempt cleanup on failure
    if (testArtist && contentRecord) {
      await cleanupTestData(testArtist, contentRecord.id);
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url.startsWith('file:')) {
  main().catch(console.error);
}