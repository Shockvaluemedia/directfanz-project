// File upload configuration constants for client-side use
import { ContentType } from '@prisma/client';

export const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024,      // 10MB for images
  AUDIO: 100 * 1024 * 1024,     // 100MB for audio
  VIDEO: 500 * 1024 * 1024,     // 500MB for video
  DOCUMENT: 50 * 1024 * 1024,   // 50MB for documents
};

export const ALLOWED_EXTENSIONS = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  AUDIO: ['.mp3', '.wav', '.flac', '.m4a', '.ogg'],
  VIDEO: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  DOCUMENT: ['.pdf', '.doc', '.docx', '.txt'],
};

export { ContentType };