#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up DirectFanz for Local File Storage...\n');

// Create uploads directory
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory: public/uploads');
} else {
  console.log('✅ Uploads directory already exists: public/uploads');
}

// Create subdirectories for organization
const subDirs = ['content', 'temp', 'thumbnails'];
subDirs.forEach(dir => {
  const subPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(subPath)) {
    fs.mkdirSync(subPath, { recursive: true });
    console.log(`✅ Created subdirectory: public/uploads/${dir}`);
  }
});

// Check for .env.local file
const envPath = path.join(__dirname, '.env.local');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('✅ Found existing .env.local file');
} else {
  console.log('📝 Creating .env.local file...');
}

// Environment variables for local storage
const localStorageConfig = `
# Local File Storage Configuration
STORAGE_DIR=public/uploads
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Set to true to use local storage instead of AWS
USE_LOCAL_STORAGE=true

# FFmpeg processing (already included in dependencies)
# FFMPEG_PATH=/usr/local/bin/ffmpeg  # Optional: specify custom ffmpeg path
`;

// Check if local storage config already exists
if (!envContent.includes('STORAGE_DIR') && !envContent.includes('USE_LOCAL_STORAGE')) {
  envContent += localStorageConfig;
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Added local storage configuration to .env.local');
} else {
  console.log('✅ Local storage configuration already present in .env.local');
}

// Create .gitignore entries for uploads
const gitignorePath = path.join(__dirname, '.gitignore');
let gitignoreContent = '';

if (fs.existsSync(gitignorePath)) {
  gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
}

const uploadIgnores = `
# Local file uploads (don't commit user uploads)
public/uploads/content/
public/uploads/temp/
!public/uploads/.gitkeep
`;

if (!gitignoreContent.includes('public/uploads/content/')) {
  gitignoreContent += uploadIgnores;
  fs.writeFileSync(gitignorePath, gitignoreContent);
  console.log('✅ Added upload directories to .gitignore');
} else {
  console.log('✅ Upload directories already in .gitignore');
}

// Create .gitkeep file to preserve upload structure
const gitkeepPath = path.join(uploadsDir, '.gitkeep');
if (!fs.existsSync(gitkeepPath)) {
  fs.writeFileSync(gitkeepPath, 'Keep this directory in git');
  console.log('✅ Created .gitkeep file in uploads directory');
}

console.log(`
🎉 Local Storage Setup Complete!

📁 Your files will be stored in: public/uploads/
🌐 Accessible via: http://localhost:3000/uploads/

🎵 Supported file types:
   • Music: MP3, WAV, FLAC, M4A, OGG (up to 100MB)
   • Video: MP4, MOV, AVI, MKV, WebM (up to 500MB)  
   • Images: JPG, PNG, GIF, WebP (up to 10MB)
   • Documents: PDF, DOC, DOCX, TXT (up to 50MB)

🛠️ Features enabled:
   • Automatic audio/video processing with FFmpeg
   • Image optimization and thumbnail generation
   • File validation and security checks
   • Tier-based access control

🚀 To start uploading:
   1. npm run dev
   2. Login as an artist
   3. Go to http://localhost:3000/upload
   4. Drag and drop your files!

📌 Note: This is perfect for development and testing. 
   For production, consider using AWS S3 or another cloud storage service.
`);