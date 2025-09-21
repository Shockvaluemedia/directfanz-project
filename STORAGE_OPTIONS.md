# 📁 Storage Options for DirectFanZProject

Your DirectFanZProject platform supports multiple storage backends for uploading and managing music, videos, and other content. You can choose the option that best fits your needs!

## 🏠 Local Storage (Default - No AWS Required!)

**Perfect for development, testing, and small deployments**

### ✅ Advantages:
- **No cloud dependencies** - Works entirely on your server
- **No additional costs** - Free storage on your own hardware
- **Simple setup** - Just run the setup script
- **Full control** - All files stored on your server
- **Privacy** - Data never leaves your infrastructure

### ⚙️ Setup:
```bash
# Run the automated setup
node setup-local-storage.cjs

# Or manually configure
mkdir -p public/uploads
echo "STORAGE_DIR=public/uploads" >> .env.local
echo "NEXT_PUBLIC_BASE_URL=http://localhost:3000" >> .env.local
```

### 📁 File Storage:
```
public/uploads/
├── content/
│   ├── [userId]/
│   │   ├── audio/
│   │   ├── video/
│   │   ├── image/
│   │   └── document/
├── temp/
└── thumbnails/
```

### 🌐 File URLs:
- **Music:** `http://localhost:3000/uploads/content/user123/audio/song.mp3`
- **Videos:** `http://localhost:3000/uploads/content/user123/video/clip.mp4`
- **Thumbnails:** `http://localhost:3000/uploads/content/user123/video/clip-thumb.jpg`

---

## ☁️ AWS S3 Storage (Production Ready)

**Recommended for production and scaling**

### ✅ Advantages:
- **Scalable** - Handle millions of files
- **Global CDN** - Fast delivery worldwide with CloudFront
- **Reliable** - 99.999999999% durability
- **Cost-effective** - Pay only for what you use
- **Professional** - Industry standard solution

### ⚙️ Setup:
```bash
# Install AWS CLI (optional)
brew install awscli

# Configure environment variables
echo "AWS_ACCESS_KEY_ID=your-access-key" >> .env.local
echo "AWS_SECRET_ACCESS_KEY=your-secret-key" >> .env.local
echo "AWS_REGION=us-east-1" >> .env.local
echo "AWS_S3_BUCKET_NAME=your-bucket-name" >> .env.local
echo "AWS_CLOUDFRONT_DOMAIN=your-cdn.cloudfront.net" >> .env.local
```

### 🪣 S3 Bucket Setup:
1. **Create S3 Bucket**
2. **Set CORS Policy:**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": []
  }
]
```

3. **Create IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

---

## 🔄 Other Storage Options (Coming Soon)

### Google Cloud Storage
- Alternative cloud storage
- Global CDN with Cloud CDN
- Competitive pricing

### DigitalOcean Spaces
- S3-compatible API
- Simple pricing model
- Good for medium-scale apps

### Cloudflare R2
- S3-compatible
- Zero egress costs
- Fast global network

---

## 🎛️ Configuration Comparison

| Feature | Local Storage | AWS S3 | Google Cloud | DO Spaces |
|---------|---------------|--------|--------------|------------|
| **Cost** | Free | Pay-as-use | Pay-as-use | Fixed pricing |
| **Setup** | 1 minute | 15 minutes | 15 minutes | 10 minutes |
| **Scalability** | Server limited | Unlimited | Unlimited | High |
| **Global CDN** | No | CloudFront | Cloud CDN | Built-in |
| **Backup** | Manual | Built-in | Built-in | Built-in |

---

## 🚀 Quick Start Guide

### For Development (Local Storage):
```bash
# 1. Setup local storage
node setup-local-storage.cjs

# 2. Start the server
npm run dev

# 3. Upload files at http://localhost:3000/upload
```

### For Production (AWS S3):
```bash
# 1. Create AWS S3 bucket
aws s3 mb s3://your-directfanz-project-bucket

# 2. Configure environment
cp .env.example .env.local
# Add your AWS credentials

# 3. Deploy
npm run build
npm start
```

---

## 📊 File Processing Features (All Storage Options)

### 🎵 **Audio Processing:**
- **Format Conversion:** All formats → optimized MP3 (128kbps)
- **Duration Extraction:** Automatic metadata parsing
- **File Validation:** Size limits and format checking

### 🎥 **Video Processing:**
- **Transcoding:** All formats → H.264 MP4 (1280x720)
- **Thumbnail Generation:** Automatic video thumbnails at 10% timestamp
- **Compression:** Optimized for web streaming (2000kbps video, 128kbps audio)

### 🖼️ **Image Processing:**
- **Optimization:** JPEG/PNG/WebP compression (85% quality)
- **Thumbnail Generation:** 400x400px thumbnails
- **Format Conversion:** Auto-optimize for web delivery

### 📄 **Document Handling:**
- **Direct Upload:** PDFs, DOCs, TXT files
- **Size Validation:** Up to 50MB per document
- **Secure Access:** Tier-based permissions

---

## 🔧 Advanced Configuration

### Custom Storage Directory:
```bash
# Change storage location
STORAGE_DIR=/custom/path/uploads
```

### Custom Processing Settings:
```bash
# Custom FFmpeg path
FFMPEG_PATH=/usr/local/bin/ffmpeg

# Custom image quality
IMAGE_QUALITY=90

# Custom video settings
VIDEO_BITRATE=3000
AUDIO_BITRATE=256
```

### File Size Limits:
```typescript
// Customize in upload-constants.ts
export const MAX_FILE_SIZES = {
  IMAGE: 20 * 1024 * 1024,  // 20MB
  AUDIO: 200 * 1024 * 1024, // 200MB
  VIDEO: 1000 * 1024 * 1024, // 1GB
  DOCUMENT: 100 * 1024 * 1024, // 100MB
};
```

---

## 🎯 Recommendations

- **Development:** Use Local Storage
- **Small Production (< 1000 users):** Local Storage or DigitalOcean Spaces
- **Medium Production (1k-100k users):** AWS S3 with CloudFront
- **Large Production (100k+ users):** AWS S3 with CloudFront + multiple regions

Your DirectFanZProject platform is ready for any scale! 🚀