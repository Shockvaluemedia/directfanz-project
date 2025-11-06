# 📦 AWS S3 Setup for DirectFanZProject

## Overview

This guide helps you set up AWS S3 for file storage and content delivery for
your DirectFanZProject.

## Prerequisites

- AWS account (free tier available)
- Access to AWS Console
- Basic understanding of AWS IAM and S3

## Step 1: Create S3 Bucket

### 1.1 Create Bucket

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Click "Create bucket"
3. Choose a unique bucket name (e.g., `your-fan-platform-content-prod`)
4. Select region (preferably same as your app deployment region)
5. **Important:** Uncheck "Block all public access" for content to be accessible
6. Click "Create bucket"

### 1.2 Configure Bucket Policy

Add this bucket policy to allow public read access to uploaded content:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

## Step 2: Configure CORS

Add the following CORS configuration to your bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "https://directfanz-project.io",
      "https://*.directfanz-project.io",
      "https://www.directfanz-project.io"
    ],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

## Step 3: Create IAM User

### 3.1 Create User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" → "Create user"
3. Enter username: `fan-platform-s3-user`
4. Select "Attach policies directly"
5. Create and attach the custom policy below

### 3.2 Custom IAM Policy

Create a policy named `FanPlatformS3Access`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### 3.3 Generate Access Keys

1. Select your created user
2. Go to "Security credentials" tab
3. Click "Create access key"
4. Choose "Application running outside AWS"
5. Save the Access Key ID and Secret Access Key securely

## Step 4: Environment Variables

Add these to your production environment:

```bash
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="your-bucket-name"
```

## Step 5: Optional - CloudFront CDN

### 5.1 Create CloudFront Distribution

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click "Create distribution"
3. Set origin domain to your S3 bucket
4. Configure caching behaviors for different file types
5. Set up SSL certificate

### 5.2 Add CDN Environment Variable

```bash
AWS_CLOUDFRONT_URL="https://d123456abcdefg.cloudfront.net"
```

## Step 6: Test Configuration

### 6.1 Test Upload

Use the following script to test your S3 configuration:

```bash
# Install AWS CLI (if not already installed)
npm install -g aws-cli

# Configure AWS CLI
aws configure

# Test upload
echo "test content" > test.txt
aws s3 cp test.txt s3://your-bucket-name/test.txt
aws s3 ls s3://your-bucket-name/

# Test public access
curl https://your-bucket-name.s3.amazonaws.com/test.txt

# Clean up
aws s3 rm s3://your-bucket-name/test.txt
rm test.txt
```

## File Organization Structure

Your S3 bucket will be organized as:

```
your-bucket-name/
├── content/
│   ├── images/
│   │   ├── [user-id]/
│   │   │   ├── [content-id].jpg
│   │   └── thumbnails/
│   ├── videos/
│   │   ├── [user-id]/
│   │   │   ├── [content-id].mp4
│   │   └── previews/
│   └── audio/
│       └── [user-id]/
│           └── [content-id].mp3
├── avatars/
│   └── [user-id]/
│       └── avatar.jpg
└── temp/
    └── [upload-id]/
```

## Security Best Practices

1. **Principle of Least Privilege**: IAM user only has S3 access
2. **Bucket Encryption**: Enable server-side encryption
3. **Access Logging**: Enable S3 access logging
4. **Versioning**: Consider enabling versioning for important content
5. **Lifecycle Policies**: Set up lifecycle rules to manage costs

## Cost Optimization

1. **Storage Classes**: Use appropriate storage classes (Standard, IA, Glacier)
2. **Lifecycle Rules**: Auto-delete temporary uploads after 24 hours
3. **CloudFront**: Use CDN to reduce S3 transfer costs
4. **Monitoring**: Set up billing alerts

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify CORS policy includes your domain
   - Check browser network tab for actual error

2. **Access Denied**
   - Verify bucket policy allows public read
   - Check IAM user permissions

3. **Upload Failures**
   - Verify AWS credentials are correct
   - Check file size limits (5TB max for single upload)

### Monitoring

- Enable CloudWatch metrics for S3
- Set up alerts for failed uploads
- Monitor storage costs regularly

## Next Steps

1. Configure your environment variables
2. Test file uploads in your development environment
3. Deploy to production
4. Monitor upload performance and costs

---

**Important**: Replace `your-bucket-name` and `directfanz-project.io` with your actual
values throughout this guide.
