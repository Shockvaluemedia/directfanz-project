# 🚀 AWS S3 Setup Guide for DirectFanZProject

This guide will walk you through setting up AWS S3 for your DirectFanZProject platform. Follow each step carefully!

## 📋 What We'll Set Up

1. **S3 Bucket** - For storing your files
2. **IAM User & Credentials** - For secure access
3. **CORS Configuration** - For web uploads
4. **CloudFront CDN** (Optional) - For faster delivery
5. **Environment Configuration** - Connect to your app

---

## 🎯 Step 1: Create S3 Bucket

### Via AWS Console:

1. **Go to AWS Console**
   - Visit: https://console.aws.amazon.com/
   - Sign in to your AWS account

2. **Navigate to S3**
   - In the search bar, type "S3" and click on "Amazon S3"

3. **Create Bucket**
   - Click "Create bucket"
   - **Bucket name**: `directfanz-project-content-[your-unique-suffix]` 
     - Example: `directfanz-project-content-prod-2024`
     - Must be globally unique!
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Object Ownership**: Keep "ACLs disabled"
   - **Block Public Access**: Keep all checkboxes checked for now
   - **Versioning**: Disable (optional)
   - **Encryption**: Enable with "Amazon S3 managed keys (SSE-S3)"
   - Click "Create bucket"

---

## 🔐 Step 2: Create IAM User

### Via AWS Console:

1. **Navigate to IAM**
   - Search for "IAM" in AWS Console
   - Click "Identity and Access Management (IAM)"

2. **Create User**
   - Click "Users" in the left sidebar
   - Click "Create user"
   - **User name**: `directfanz-project-s3-user`
   - **Access type**: Check "Programmatic access"
   - Click "Next"

3. **Set Permissions**
   - Click "Attach policies directly"
   - **DON'T** use AmazonS3FullAccess (too broad)
   - Instead, click "Create policy"

4. **Create Custom Policy**
   - Click the JSON tab
   - Replace the content with:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
        }
    ]
}
```

   - Replace `YOUR-BUCKET-NAME` with your actual bucket name
   - **Policy name**: `DirectFanZProjectS3Policy`
   - Click "Create policy"

5. **Attach Policy to User**
   - Go back to the user creation tab
   - Refresh the policy list
   - Search for "DirectFanZProjectS3Policy"
   - Select it and click "Next"

6. **Review and Create**
   - Review the user details
   - Click "Create user"

7. **Save Credentials**
   - **IMPORTANT**: Copy the Access Key ID and Secret Access Key
   - Store them securely - you won't see the secret again!

---

## 🌐 Step 3: Configure CORS

1. **Go to Your S3 Bucket**
   - Navigate back to S3
   - Click on your bucket name

2. **Set CORS Policy**
   - Click the "Permissions" tab
   - Scroll down to "Cross-origin resource sharing (CORS)"
   - Click "Edit"
   - Replace with:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3600
    }
]
```

   - Replace `https://yourdomain.com` with your actual domain
   - Click "Save changes"

---

## 🚀 Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=directfanz-project-content-your-suffix

# Optional: CloudFront CDN (setup in Step 5)
# AWS_CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net
```

---

## ⚡ Step 5: Setup CloudFront CDN (Optional but Recommended)

### Via AWS Console:

1. **Navigate to CloudFront**
   - Search for "CloudFront"
   - Click "Create distribution"

2. **Configure Origin**
   - **Origin domain**: Select your S3 bucket from dropdown
   - **Origin access**: "Origin access control settings"
   - **Origin access control**: Click "Create new OAC"
     - **Name**: `directfanz-project-oac`
     - Click "Create"

3. **Configure Default Cache Behavior**
   - **Viewer protocol policy**: "Redirect HTTP to HTTPS"
   - **Allowed HTTP methods**: "GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE"
   - **Cache policy**: "CachingOptimized"

4. **Configure Settings**
   - **Price class**: "Use all edge locations (best performance)"
   - **Alternate domain names (CNAME)**: Add your domain if you have one
   - **SSL certificate**: Use default CloudFront certificate

5. **Create Distribution**
   - Click "Create distribution"
   - Wait for deployment (10-15 minutes)
   - Copy the Distribution domain name (e.g., `d123456789.cloudfront.net`)

6. **Update S3 Bucket Policy**
   - CloudFront will show a banner to update S3 permissions
   - Click "Copy policy" and apply it to your S3 bucket

---

## 🧪 Step 6: Test Your Setup

I'll create a test script for you:

```bash
# Test AWS connection
node test-aws-setup.cjs
```

---

## 🔧 Troubleshooting

### Common Issues:

1. **Access Denied Error**
   - Check your IAM policy has the correct bucket name
   - Ensure the bucket name in your policy matches exactly

2. **CORS Error**
   - Verify your domain is in the CORS AllowedOrigins
   - Make sure you included `http://localhost:3000` for development

3. **Region Mismatch**
   - Ensure AWS_REGION matches your bucket's region

4. **Credentials Not Working**
   - Double-check your Access Key ID and Secret Key
   - Make sure there are no extra spaces

---

## 💰 Cost Estimation

**Typical costs for a small platform:**
- **S3 Storage**: $0.023/GB/month
- **S3 Requests**: $0.0004 per 1,000 PUT requests
- **CloudFront**: $0.085 per GB transferred
- **Example**: 10GB storage, 10,000 uploads, 100GB transfer = ~$10/month

---

## 🔒 Security Best Practices

1. **Never commit credentials** to git
2. **Use least-privilege** IAM policies
3. **Enable CloudTrail** for auditing (optional)
4. **Regular key rotation** (quarterly)
5. **Monitor usage** in AWS Console

---

## 📞 Need Help?

If you get stuck at any step, let me know:
- Which step you're on
- Any error messages you see
- Screenshots if helpful

Let's get your AWS setup running! 🚀