const { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

// Configuration - Update these with your actual values
const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  bucketName: process.env.AWS_S3_BUCKET_NAME || 'directfanz-production-content',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

console.log('🧪 DirectFanZ Production S3 Testing\n');

async function testS3Configuration() {
  console.log('📋 Configuration Check:');
  console.log(`   Region: ${config.region}`);
  console.log(`   Bucket: ${config.bucketName}`);
  console.log(`   Access Key ID: ${config.accessKeyId ? config.accessKeyId.substring(0, 8) + '...' : '❌ NOT SET'}`);
  console.log(`   Secret Key: ${config.secretAccessKey ? '✅ SET' : '❌ NOT SET'}\n`);

  if (!config.accessKeyId || !config.secretAccessKey) {
    console.log('❌ Missing AWS credentials!');
    console.log('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
    return false;
  }

  // Initialize S3 client
  const s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    console.log('🔍 Testing S3 Connection...');
    
    // Test 1: Create a test file
    const testContent = 'DirectFanZ S3 Test - ' + new Date().toISOString();
    const testKey = 'test-uploads/connection-test.txt';
    
    console.log('   📤 Uploading test file...');
    await s3Client.send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    }));
    console.log('   ✅ Upload successful');

    // Test 2: Download the test file
    console.log('   📥 Downloading test file...');
    const getResponse = await s3Client.send(new GetObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
    }));
    
    const downloadedContent = await streamToString(getResponse.Body);
    if (downloadedContent === testContent) {
      console.log('   ✅ Download successful - content matches');
    } else {
      console.log('   ❌ Download failed - content mismatch');
      return false;
    }

    // Test 3: Generate presigned URL
    console.log('   🔗 Generating presigned URL...');
    const presignedUrl = await getSignedUrl(s3Client, new PutObjectCommand({
      Bucket: config.bucketName,
      Key: 'test-uploads/presigned-test.txt',
      ContentType: 'text/plain',
    }), { expiresIn: 3600 });
    
    if (presignedUrl.includes(config.bucketName)) {
      console.log('   ✅ Presigned URL generated successfully');
    } else {
      console.log('   ❌ Presigned URL generation failed');
      return false;
    }

    // Test 4: Clean up
    console.log('   🧹 Cleaning up test file...');
    await s3Client.send(new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: testKey,
    }));
    console.log('   ✅ Cleanup successful');

    return true;

  } catch (error) {
    console.error('❌ S3 Test Failed:', error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.log('\n💡 Bucket does not exist. Create it with:');
      console.log(`   aws s3 mb s3://${config.bucketName} --region ${config.region}`);
    } else if (error.name === 'AccessDenied') {
      console.log('\n💡 Access denied. Check your IAM permissions.');
    } else if (error.name === 'InvalidAccessKeyId') {
      console.log('\n💡 Invalid access key. Check your AWS credentials.');
    }
    
    return false;
  }
}

async function testDirectFanZFolders() {
  console.log('\n📁 Testing DirectFanZ Folder Structure...');
  
  const s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const folders = [
    'public/images/',
    'public/videos/',
    'public/audio/',
    'public/documents/',
    'private/images/',
    'private/videos/',
    'private/audio/',
    'private/documents/',
    'premium/images/',
    'premium/videos/',
    'premium/audio/',
    'premium/documents/',
    'uploads/temp/'
  ];

  try {
    for (const folder of folders) {
      console.log(`   📂 Creating ${folder}...`);
      await s3Client.send(new PutObjectCommand({
        Bucket: config.bucketName,
        Key: folder + '.gitkeep',
        Body: '# DirectFanZ folder structure',
        ContentType: 'text/plain',
      }));
    }
    
    console.log('   ✅ All folders created successfully');
    return true;
    
  } catch (error) {
    console.error('   ❌ Folder creation failed:', error.message);
    return false;
  }
}

async function generateProductionConfig() {
  console.log('\n⚙️  Generating Production Configuration...');
  
  const envTemplate = `
# DirectFanZ Production Environment Variables
# Copy these to your production .env file

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=${config.accessKeyId || 'your_access_key_here'}
AWS_SECRET_ACCESS_KEY=${config.secretAccessKey || 'your_secret_key_here'}
AWS_REGION=${config.region}
AWS_S3_BUCKET_NAME=${config.bucketName}

# Storage Mode (set to false for production)
USE_LOCAL_STORAGE=false

# Optional: CloudFront Distribution
# CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net

# Content Delivery
NEXT_PUBLIC_CDN_URL=https://${config.bucketName}.s3.${config.region}.amazonaws.com
`;

  const envPath = path.join(__dirname, '.env.production.s3');
  fs.writeFileSync(envPath, envTemplate.trim());
  
  console.log(`   ✅ Configuration saved to: ${envPath}`);
  console.log('   📋 Copy these variables to your production environment');
}

// Utility function to convert stream to string
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  console.log('🚀 DirectFanZ Production S3 Setup Test\n');
  
  const connectionTest = await testS3Configuration();
  
  if (connectionTest) {
    console.log('\n🎉 S3 Connection Test: PASSED');
    
    const folderTest = await testDirectFanZFolders();
    if (folderTest) {
      console.log('🎉 Folder Structure Test: PASSED');
    }
    
    await generateProductionConfig();
    
    console.log('\n✅ Your DirectFanZ S3 configuration is ready for production!');
    console.log('\n📋 Next Steps:');
    console.log('1. Copy the generated environment variables to production');
    console.log('2. Update USE_LOCAL_STORAGE=false in production');
    console.log('3. Test upload functionality in production');
    console.log('4. Set up CloudFront CDN (optional but recommended)');
    console.log('5. Configure bucket policies and CORS');
    
  } else {
    console.log('\n❌ S3 Configuration Test: FAILED');
    console.log('Please fix the issues above before proceeding to production.');
  }
}

// Check if running directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testS3Configuration, testDirectFanZFolders };