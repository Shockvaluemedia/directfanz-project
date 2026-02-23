// Content Upload System Types

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export type ContentCategory = 
  | 'music'
  | 'podcast'
  | 'audiobook'
  | 'sound_effect'
  | 'video'
  | 'art'
  | 'photography'
  | 'document'
  | 'other';

export type UploadStatus = 
  | 'pending'
  | 'preparing'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ContentVisibility = 'public' | 'private' | 'unlisted' | 'subscribers_only';

export type PricingType = 'free' | 'paid' | 'subscription';

// File Information
export interface MediaFile {
  uri: string;
  name: string;
  type: string;
  size: number;
  duration?: number; // For audio/video files
  width?: number; // For images/video
  height?: number; // For images/video
  thumbnail?: string; // Generated thumbnail URI
  mimeType?: string;
}

// Content metadata for upload
export interface ContentMetadata {
  title: string;
  description: string;
  category: ContentCategory;
  tags: string[];
  visibility: ContentVisibility;
  pricingType: PricingType;
  price?: number; // Required if pricingType is 'paid'
  subscriptionTier?: string; // Required if pricingType is 'subscription'
  isExplicit: boolean;
  allowComments: boolean;
  allowDownloads: boolean;
  scheduledPublishDate?: string; // ISO string for scheduled publishing
  customThumbnail?: MediaFile; // Custom thumbnail if provided
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
}

// Upload progress tracking
export interface UploadProgress {
  uploadId: string;
  mediaFile: MediaFile;
  metadata: ContentMetadata;
  status: UploadStatus;
  progress: number; // 0-100
  uploadedBytes: number;
  totalBytes: number;
  uploadSpeed?: number; // bytes per second
  remainingTime?: number; // seconds
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  serverContentId?: string; // ID returned from server after successful upload
}

// Upload queue item
export interface UploadQueueItem {
  id: string;
  mediaFile: MediaFile;
  metadata: ContentMetadata;
  progress: UploadProgress;
  priority: number; // Higher number = higher priority
}

// Upload configuration
export interface UploadConfig {
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  chunkSize: number; // bytes for chunked uploads
  maxConcurrentUploads: number;
  retryAttempts: number;
  retryDelay: number; // milliseconds
  compressionQuality: number; // 0-1 for image/video compression
  generateThumbnails: boolean;
  thumbnailSize: { width: number; height: number };
}

// Upload session for resumable uploads
export interface UploadSession {
  sessionId: string;
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  serverUrl: string;
  expiresAt: string;
}

// Media processing options
export interface MediaProcessingOptions {
  compress: boolean;
  compressionQuality?: number;
  generateThumbnail: boolean;
  thumbnailTimestamp?: number; // For video thumbnails (seconds)
  resizeImages?: {
    maxWidth: number;
    maxHeight: number;
    maintainAspectRatio: boolean;
  };
  audioSettings?: {
    bitrate?: number;
    sampleRate?: number;
    format?: 'mp3' | 'aac' | 'wav';
  };
  videoSettings?: {
    bitrate?: number;
    resolution?: '480p' | '720p' | '1080p';
    format?: 'mp4' | 'mov';
  };
}

// Content draft (saved but not published)
export interface ContentDraft {
  id: string;
  mediaFile: MediaFile;
  metadata: Partial<ContentMetadata>;
  processingOptions: MediaProcessingOptions;
  createdAt: string;
  updatedAt: string;
  autoSaveEnabled: boolean;
}

// Upload history item
export interface UploadHistoryItem {
  uploadId: string;
  contentId?: string; // Server content ID if successful
  mediaFile: MediaFile;
  metadata: ContentMetadata;
  status: UploadStatus;
  uploadDate: string;
  processingTime?: number; // milliseconds
  fileSize: number;
  error?: string;
  downloadUrl?: string; // If available
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

// Upload statistics
export interface UploadStatistics {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  totalDataUploaded: number; // bytes
  averageUploadTime: number; // milliseconds
  mostUploadedCategory: ContentCategory;
  uploadsThisMonth: number;
  storageUsed: number; // bytes
  storageQuota: number; // bytes
}

// Media capture options
export interface CaptureOptions {
  mediaType: MediaType;
  quality: 'low' | 'medium' | 'high';
  duration?: number; // Max duration for video/audio in seconds
  flashMode?: 'on' | 'off' | 'auto';
  cameraType?: 'front' | 'back';
  includeLocation: boolean;
}

// Gallery selection options
export interface GallerySelectionOptions {
  mediaType: MediaType | 'any';
  allowMultiple: boolean;
  maxSelections?: number;
  includeVideos: boolean;
  includeImages: boolean;
  quality: 'low' | 'medium' | 'high';
}

// File picker options
export interface FilePickerOptions {
  allowedTypes: string[];
  allowMultiple: boolean;
  maxFileSize: number;
  title?: string;
}

// Upload validation result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// Redux/Context state
export interface UploadState {
  // Upload queue
  uploadQueue: UploadQueueItem[];
  activeUploads: { [uploadId: string]: UploadProgress };
  
  // Configuration
  config: UploadConfig;
  
  // Current upload flow
  currentUpload: {
    mediaFile: MediaFile | null;
    metadata: Partial<ContentMetadata>;
    processingOptions: MediaProcessingOptions;
    step: 'select' | 'capture' | 'details' | 'preview' | 'uploading' | 'complete';
    validation: ValidationResult | null;
  };
  
  // Drafts and history
  drafts: ContentDraft[];
  uploadHistory: UploadHistoryItem[];
  statistics: UploadStatistics;
  
  // UI state
  isUploading: boolean;
  isProcessing: boolean;
  showUploadQueue: boolean;
  selectedDraftId: string | null;
  
  // Permissions
  cameraPermission: 'granted' | 'denied' | 'undetermined';
  microphonePermission: 'granted' | 'denied' | 'undetermined';
  storagePermission: 'granted' | 'denied' | 'undetermined';
  
  // Errors
  error: string | null;
  networkError: boolean;
}

// Action types for upload context
export type UploadAction =
  // Media selection
  | { type: 'SET_MEDIA_FILE'; payload: MediaFile }
  | { type: 'CLEAR_MEDIA_FILE' }
  
  // Metadata management
  | { type: 'UPDATE_METADATA'; payload: Partial<ContentMetadata> }
  | { type: 'CLEAR_METADATA' }
  | { type: 'SET_PROCESSING_OPTIONS'; payload: MediaProcessingOptions }
  
  // Upload flow
  | { type: 'SET_UPLOAD_STEP'; payload: UploadState['currentUpload']['step'] }
  | { type: 'START_UPLOAD'; payload: UploadQueueItem }
  | { type: 'UPDATE_UPLOAD_PROGRESS'; payload: { uploadId: string; progress: Partial<UploadProgress> } }
  | { type: 'COMPLETE_UPLOAD'; payload: { uploadId: string; contentId: string } }
  | { type: 'FAIL_UPLOAD'; payload: { uploadId: string; error: string } }
  | { type: 'CANCEL_UPLOAD'; payload: string }
  | { type: 'RETRY_UPLOAD'; payload: string }
  
  // Queue management
  | { type: 'ADD_TO_QUEUE'; payload: UploadQueueItem }
  | { type: 'REMOVE_FROM_QUEUE'; payload: string }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'REORDER_QUEUE'; payload: { fromIndex: number; toIndex: number } }
  
  // Drafts
  | { type: 'SAVE_DRAFT'; payload: ContentDraft }
  | { type: 'DELETE_DRAFT'; payload: string }
  | { type: 'LOAD_DRAFT'; payload: string }
  | { type: 'CLEAR_DRAFTS' }
  
  // History and statistics
  | { type: 'ADD_TO_HISTORY'; payload: UploadHistoryItem }
  | { type: 'UPDATE_STATISTICS'; payload: Partial<UploadStatistics> }
  | { type: 'CLEAR_HISTORY' }
  
  // UI state
  | { type: 'SET_UPLOADING'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'TOGGLE_UPLOAD_QUEUE' }
  | { type: 'SELECT_DRAFT'; payload: string | null }
  
  // Permissions
  | { type: 'SET_CAMERA_PERMISSION'; payload: 'granted' | 'denied' | 'undetermined' }
  | { type: 'SET_MICROPHONE_PERMISSION'; payload: 'granted' | 'denied' | 'undetermined' }
  | { type: 'SET_STORAGE_PERMISSION'; payload: 'granted' | 'denied' | 'undetermined' }
  
  // Configuration
  | { type: 'UPDATE_CONFIG'; payload: Partial<UploadConfig> }
  
  // Validation
  | { type: 'SET_VALIDATION_RESULT'; payload: ValidationResult }
  | { type: 'CLEAR_VALIDATION' }
  
  // Error handling
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_NETWORK_ERROR'; payload: boolean };

// API interfaces
export interface UploadStartRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  metadata: ContentMetadata;
  chunkSize?: number;
}

export interface UploadStartResponse {
  uploadId: string;
  sessionId: string;
  uploadUrl: string;
  chunkSize: number;
  expiresAt: string;
}

export interface UploadChunkRequest {
  uploadId: string;
  chunkIndex: number;
  chunkData: ArrayBuffer | Blob;
  chunkHash: string;
}

export interface UploadCompleteRequest {
  uploadId: string;
  totalChunks: number;
  finalHash: string;
  metadata: ContentMetadata;
}

export interface UploadCompleteResponse {
  success: boolean;
  contentId: string;
  processingStatus: 'queued' | 'processing' | 'completed';
  downloadUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
}

// Constants
export const UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  MAX_CONCURRENT_UPLOADS: 3,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  THUMBNAIL_SIZE: { width: 300, height: 300 },
  
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  SUPPORTED_VIDEO_TYPES: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
  SUPPORTED_AUDIO_TYPES: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/ogg'],
  SUPPORTED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword'],
  
  CATEGORY_LABELS: {
    music: 'Music',
    podcast: 'Podcast',
    audiobook: 'Audiobook',
    sound_effect: 'Sound Effect',
    video: 'Video',
    art: 'Digital Art',
    photography: 'Photography',
    document: 'Document',
    other: 'Other',
  } as const,
  
  VISIBILITY_LABELS: {
    public: 'Public',
    private: 'Private',
    unlisted: 'Unlisted',
    subscribers_only: 'Subscribers Only',
  } as const,
} as const;