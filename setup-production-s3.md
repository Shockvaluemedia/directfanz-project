# 🚀 DirectFanZ Production AWS S3 Setup Guide

## 📋 Prerequisites Checklist

- [ ] AWS Account created
- [ ] AWS CLI installed
- [ ] S3 bucket created
- [ ] IAM user with appropriate permissions
- [ ] CloudFront distribution (optional but recommended)

---

## 🔧 Step-by-Step Setup

### 1. Create AWS S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://directfanz-production-content --region us-east-1

# Or create via AWS Console:
# 1. Go to S3 Console
# 2. Create bucket: directfanz-production-content
# 3. Region: us-east-1 (or your preferred region)
# 4. Block public access: Configure as needed
```

### 2. Configure Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::directfanz-production-content/public/*"
    },
    {
      "Sid": "DenyDirectAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::directfanz-production-content/private/*",
        "arn:aws:s3:::directfanz-production-content/premium/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalServiceName": "cloudfront.amazonaws.com"
        }
      }
    }
  ]
}
```

### 3. Create IAM User and Policy

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
        "arn:aws:s3:::directfanz-production-content",
        "arn:aws:s3:::directfanz-production-content/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetSignedUrl"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4. Environment Variables

Add to your `.env.production`:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=directfanz-production-content

# Optional: CloudFront Distribution
CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net

# Storage Mode
USE_LOCAL_STORAGE=false
```

---

## 🔒 Security Configuration

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "https://your-domain.com",
      "https://www.your-domain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Lifecycle Rules

```json
{
  "Rules": [
    {
      "ID": "DeleteIncompleteUploads",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 1
      }
    },
    {
      "ID": "TransitionToIA",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

---

## 📁 Folder Structure

```
directfanz-production-content/
├── public/              # Public content (free posts, previews)
│   ├── images/
│   ├── videos/
│   ├── audio/
│   └── documents/
├── private/             # Subscriber-only content
│   ├── images/
│   ├── videos/
│   ├── audio/
│   └── documents/
├── premium/             # Premium tier content
│   ├── images/
│   ├── videos/
│   ├── audio/
│   └── documents/
└── uploads/             # Temporary upload area
    └── temp/
```

---

## 🧪 Testing Configuration

Run this script to verify your S3 setup:

```bash
# Test script will be created below
node test-s3-production.js
```

---

## 🔄 Migration from Local Storage

When ready to switch:

1. Update `USE_LOCAL_STORAGE=false` in production env
2. Run migration script for existing files
3. Update CDN/cache settings
4. Test upload functionality

---

## 📊 Monitoring & Costs

### CloudWatch Metrics to Monitor:
- Storage usage
- Request metrics
- Error rates
- Data transfer costs

### Cost Optimization:
- Use S3 Intelligent Tiering
- Set up lifecycle policies
- Monitor and alert on unusual usage

---

## 🚨 Backup Strategy

1. Enable versioning on the bucket
2. Set up cross-region replication
3. Regular backup verification
4. Document recovery procedures

---

## 🔗 CDN Setup (CloudFront)

Benefits:
- Faster global content delivery
- Reduced S3 costs
- Enhanced security
- Custom domain support

Configuration will be added in deployment section.

---

## ✅ Verification Checklist

- [ ] S3 bucket created and configured
- [ ] IAM permissions set correctly
- [ ] CORS policy applied
- [ ] Environment variables updated
- [ ] Upload functionality tested
- [ ] Content delivery verified
- [ ] Security settings reviewed
- [ ] Monitoring enabled
- [ ] Backup strategy implemented

---

**Next:** Configure Stripe payments and deploy to production!