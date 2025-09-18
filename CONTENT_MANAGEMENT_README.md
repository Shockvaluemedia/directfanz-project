# Content Management System

Your Nahvee Even platform now includes a comprehensive content management system that allows artists to upload, process, and share exclusive content with their fans. This system supports multiple media types with tier-based access control and real-time analytics.

## 🚀 Features

### **Content Upload & Processing**
- **Drag & Drop Interface**: Intuitive file upload with real-time validation
- **Multiple Media Types**: Images, Audio, Video, and Documents
- **Automatic Processing**: Thumbnail generation, video transcoding, audio optimization
- **Progress Tracking**: Real-time upload progress with error handling
- **File Validation**: Size limits and format validation before upload

### **Media Players & Viewers**
- **Custom Video Player**: Full-screen support, custom controls, seek functionality
- **Audio Player**: Beautiful gradient interface with waveform visualization
- **Image Viewer**: High-resolution display with zoom capabilities
- **Document Viewer**: Download functionality with file metadata display

### **Access Control & Security**
- **Tier-Based Access**: Content restricted to specific subscription tiers
- **Public/Private Content**: Artists control content visibility
- **Authentication Required**: Secure access with JWT validation
- **File Security**: AWS S3 with CloudFront CDN integration

### **Content Management**
- **CRUD Operations**: Create, read, update, delete content
- **Metadata Management**: Titles, descriptions, tags, and categorization
- **Bulk Operations**: Manage multiple files efficiently
- **Search & Filtering**: Find content by type, tags, or metadata

## 📁 System Architecture

```
src/
├── lib/
│   └── upload.ts                    # Core upload utilities and S3 integration
├── app/api/content/
│   ├── upload/route.ts              # File upload endpoint
│   ├── route.ts                     # Content listing and management
│   └── [id]/route.ts                # Individual content operations
├── components/content/
│   ├── FileUpload.tsx               # Drag & drop upload interface
│   └── ContentViewer.tsx            # Media players and content display
├── app/
│   └── upload/page.tsx              # Artist upload page
└── types/websocket.ts               # TypeScript interfaces (extended for content)
```

## 🛠 Installation & Setup

### 1. Environment Variables

Add to your `.env.local`:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_CLOUDFRONT_DOMAIN=your-cdn-domain.cloudfront.net  # Optional

# Content Processing
FFMPEG_PATH=/path/to/ffmpeg  # Optional, auto-detected
```

### 2. Database Schema

The system uses the existing Prisma schema. Make sure to run migrations:

```bash
npx prisma db push
# or
npx prisma migrate dev
```

Key models used:
- `Content`: Stores content metadata and file URLs
- `User`: Artist and fan management
- `Tier`: Subscription tier management
- `Subscription`: Fan subscriptions to artist tiers

### 3. AWS S3 Setup

1. Create an S3 bucket for content storage
2. Set up IAM user with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```
3. Optional: Set up CloudFront CDN for faster content delivery

## 💻 Usage

### Artist Content Upload

```tsx
// Upload page usage
import { FileUpload } from '@/components/content/FileUpload';

function ArtistUploadPage() {
  const handleUpload = async (file: File, metadata: ContentMetadata) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch('/api/content/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const result = await response.json();
    return result.data;
  };

  return (
    <FileUpload
      onUpload={handleUpload}
      onProgress={(progress) => console.log(progress)}
    />
  );
}
```

### Content Viewing

```tsx
// Content viewer usage
import { ContentViewer } from '@/components/content/ContentViewer';

function ContentPage({ content, hasAccess, currentUserId }) {
  const handleLike = async () => {
    // Implement like functionality
  };

  const handleComment = async (text: string) => {
    // Implement comment functionality
  };

  return (
    <ContentViewer
      content={content}
      hasAccess={hasAccess}
      currentUserId={currentUserId}
      onLike={handleLike}
      onComment={handleComment}
    />
  );
}
```

### API Usage

#### Upload Content
```javascript
POST /api/content/upload
Content-Type: multipart/form-data

// Form data:
file: [File object]
metadata: {
  "title": "My New Song",
  "description": "Latest track from my album",
  "isPublic": false,
  "tierIds": ["tier-id-1", "tier-id-2"],
  "tags": ["music", "rock", "2024"]
}
```

#### List Content
```javascript
GET /api/content?page=1&limit=20&type=AUDIO&search=rock

Response:
{
  "success": true,
  "data": {
    "content": [...],
    "pagination": {
      "page": 1,
      "totalPages": 5,
      "hasNextPage": true
    }
  }
}
```

#### Get Single Content
```javascript
GET /api/content/{content-id}

Response:
{
  "success": true,
  "data": {
    "id": "content-id",
    "title": "My Song",
    "fileUrl": "https://cdn.example.com/audio.mp3",
    "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
    // ... full content data
  }
}
```

## 📊 File Processing

### Image Processing
- **Optimization**: JPEG/PNG/WebP compression at 85% quality
- **Thumbnails**: 400x400px thumbnails generated automatically  
- **Formats**: Supports JPG, PNG, GIF, WebP
- **Size Limit**: 10MB maximum

### Video Processing  
- **Transcoding**: H.264 video, AAC audio
- **Resolution**: Standardized to 1280x720p (720p HD)
- **Thumbnails**: Auto-generated at 10% timestamp
- **Formats**: Supports MP4, MOV, AVI, MKV, WebM
- **Size Limit**: 500MB maximum

### Audio Processing
- **Compression**: MP3 encoding at 128kbps
- **Metadata**: Duration extraction and audio analysis
- **Formats**: Supports MP3, WAV, FLAC, M4A, OGG  
- **Size Limit**: 100MB maximum

### Document Processing
- **Direct Storage**: No processing, stored as-is
- **Formats**: Supports PDF, DOC, DOCX, TXT
- **Size Limit**: 50MB maximum

## 🔐 Security Features

### Authentication & Authorization
- **JWT Verification**: All endpoints require valid authentication
- **Role-Based Access**: Only artists can upload content
- **Ownership Validation**: Users can only manage their own content

### Content Access Control  
- **Tier-Based Access**: Content restricted to subscription tiers
- **Public/Private Toggle**: Artists control content visibility
- **Subscription Validation**: Real-time access checking

### File Security
- **S3 Integration**: Secure cloud storage with IAM permissions
- **CDN Distribution**: CloudFront for secure, fast content delivery
- **Input Validation**: File type and size validation before processing
- **Error Handling**: Graceful failure with cleanup

## 📈 Performance Optimizations

### Upload Performance
- **Progress Tracking**: Real-time upload progress feedback
- **Chunked Uploads**: Large files uploaded in chunks (future enhancement)
- **Background Processing**: Media processing happens asynchronously
- **Error Recovery**: Automatic retry logic for failed uploads

### Viewing Performance  
- **CDN Distribution**: Fast global content delivery
- **Lazy Loading**: Content loaded on-demand
- **Thumbnail Previews**: Quick preview before full content load
- **Caching**: Aggressive caching for static content

### Database Performance
- **Indexed Queries**: Optimized database queries with proper indexing
- **Pagination**: Efficient pagination for large content libraries
- **Selective Loading**: Only load necessary data fields

## 🐛 Troubleshooting

### Common Upload Issues

**Upload fails with "Invalid file type"**
- Check file extension matches supported formats
- Verify file is not corrupted
- Ensure file size is within limits

**Processing takes too long**
- Large video files may take several minutes
- Check server resources and ffmpeg installation
- Monitor logs for processing errors

**AWS S3 errors**
- Verify AWS credentials and permissions
- Check bucket name and region configuration
- Ensure bucket has proper CORS settings

### Performance Issues

**Slow upload speeds**
- Check network connection
- Consider implementing chunked uploads for large files
- Verify AWS region is geographically close

**Content not loading**
- Check CDN configuration
- Verify content URLs are accessible
- Check user access permissions

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## 🚀 Future Enhancements

### Planned Features
- **Batch Upload**: Multiple file upload with queue management
- **Content Analytics**: Detailed view and engagement metrics
- **Content Scheduling**: Schedule content releases
- **Advanced Media Players**: Playlist support, quality selection
- **Content Collaboration**: Multi-artist content collaboration
- **Advanced Search**: Full-text search, AI-powered recommendations

### Performance Improvements
- **Chunked Uploads**: Large file upload optimization
- **Progressive Upload**: Upload while user fills metadata
- **Background Sync**: Offline upload capability
- **Advanced Caching**: Smart cache invalidation strategies

### Security Enhancements
- **Watermarking**: Automatic content watermarking
- **DRM Integration**: Digital rights management
- **Content Encryption**: End-to-end content encryption
- **Access Logs**: Detailed content access logging

## 📄 License

This content management system is part of the Nahvee Even platform and follows the same licensing terms as the main project.

---

For technical support or feature requests related to the content management system, please refer to the troubleshooting section above or review the API documentation.