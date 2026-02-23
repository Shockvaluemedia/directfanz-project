import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UploadState,
  UploadAction,
  UploadConfig,
  MediaFile,
  ContentMetadata,
  MediaProcessingOptions,
  UploadQueueItem,
  UploadProgress,
  ContentDraft,
  UploadHistoryItem,
  UploadStatistics,
  ValidationResult,
  UPLOAD_CONSTANTS,
} from '../types/upload';

// Initial state
const initialState: UploadState = {
  uploadQueue: [],
  activeUploads: {},
  
  config: {
    maxFileSize: UPLOAD_CONSTANTS.MAX_FILE_SIZE,
    allowedMimeTypes: [
      ...UPLOAD_CONSTANTS.SUPPORTED_IMAGE_TYPES,
      ...UPLOAD_CONSTANTS.SUPPORTED_VIDEO_TYPES,
      ...UPLOAD_CONSTANTS.SUPPORTED_AUDIO_TYPES,
      ...UPLOAD_CONSTANTS.SUPPORTED_DOCUMENT_TYPES,
    ],
    chunkSize: UPLOAD_CONSTANTS.CHUNK_SIZE,
    maxConcurrentUploads: UPLOAD_CONSTANTS.MAX_CONCURRENT_UPLOADS,
    retryAttempts: UPLOAD_CONSTANTS.MAX_RETRIES,
    retryDelay: UPLOAD_CONSTANTS.RETRY_DELAY,
    compressionQuality: 0.8,
    generateThumbnails: true,
    thumbnailSize: UPLOAD_CONSTANTS.THUMBNAIL_SIZE,
  },
  
  currentUpload: {
    mediaFile: null,
    metadata: {
      title: '',
      description: '',
      category: 'other',
      tags: [],
      visibility: 'public',
      pricingType: 'free',
      isExplicit: false,
      allowComments: true,
      allowDownloads: true,
    },
    processingOptions: {
      compress: true,
      compressionQuality: 0.8,
      generateThumbnail: true,
    },
    step: 'select',
    validation: null,
  },
  
  drafts: [],
  uploadHistory: [],
  statistics: {
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalDataUploaded: 0,
    averageUploadTime: 0,
    mostUploadedCategory: 'other',
    uploadsThisMonth: 0,
    storageUsed: 0,
    storageQuota: 2 * 1024 * 1024 * 1024, // 2GB default
  },
  
  isUploading: false,
  isProcessing: false,
  showUploadQueue: false,
  selectedDraftId: null,
  
  cameraPermission: 'undetermined',
  microphonePermission: 'undetermined',
  storagePermission: 'undetermined',
  
  error: null,
  networkError: false,
};

// Reducer function
function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    // Media file management
    case 'SET_MEDIA_FILE':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          mediaFile: action.payload,
          step: 'details',
        },
        error: null,
      };

    case 'CLEAR_MEDIA_FILE':
      return {
        ...state,
        currentUpload: {
          ...initialState.currentUpload,
          step: 'select',
        },
        error: null,
      };

    // Metadata management
    case 'UPDATE_METADATA':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          metadata: {
            ...state.currentUpload.metadata,
            ...action.payload,
          },
        },
      };

    case 'CLEAR_METADATA':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          metadata: initialState.currentUpload.metadata,
        },
      };

    case 'SET_PROCESSING_OPTIONS':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          processingOptions: action.payload,
        },
      };

    // Upload flow
    case 'SET_UPLOAD_STEP':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          step: action.payload,
        },
      };

    case 'START_UPLOAD':
      const newUpload = action.payload;
      return {
        ...state,
        uploadQueue: [...state.uploadQueue, newUpload],
        activeUploads: {
          ...state.activeUploads,
          [newUpload.id]: newUpload.progress,
        },
        isUploading: true,
      };

    case 'UPDATE_UPLOAD_PROGRESS':
      const { uploadId, progress } = action.payload;
      const existingProgress = state.activeUploads[uploadId];
      if (!existingProgress) return state;

      const updatedProgress = { ...existingProgress, ...progress };
      
      return {
        ...state,
        activeUploads: {
          ...state.activeUploads,
          [uploadId]: updatedProgress,
        },
        uploadQueue: state.uploadQueue.map(item =>
          item.id === uploadId
            ? { ...item, progress: updatedProgress }
            : item
        ),
      };

    case 'COMPLETE_UPLOAD':
      const completedUploadId = action.payload.uploadId;
      const contentId = action.payload.contentId;
      const completedUpload = state.activeUploads[completedUploadId];
      
      if (!completedUpload) return state;

      // Move to history
      const historyItem: UploadHistoryItem = {
        uploadId: completedUploadId,
        contentId,
        mediaFile: completedUpload.mediaFile,
        metadata: completedUpload.metadata,
        status: 'completed',
        uploadDate: new Date().toISOString(),
        processingTime: completedUpload.startedAt 
          ? Date.now() - new Date(completedUpload.startedAt).getTime()
          : undefined,
        fileSize: completedUpload.totalBytes,
      };

      // Update statistics
      const newStats: UploadStatistics = {
        ...state.statistics,
        totalUploads: state.statistics.totalUploads + 1,
        successfulUploads: state.statistics.successfulUploads + 1,
        totalDataUploaded: state.statistics.totalDataUploaded + completedUpload.totalBytes,
        averageUploadTime: Math.round(
          (state.statistics.averageUploadTime * state.statistics.successfulUploads + 
           (historyItem.processingTime || 0)) / (state.statistics.successfulUploads + 1)
        ),
      };

      const updatedActiveUploads = { ...state.activeUploads };
      delete updatedActiveUploads[completedUploadId];

      return {
        ...state,
        activeUploads: updatedActiveUploads,
        uploadQueue: state.uploadQueue.filter(item => item.id !== completedUploadId),
        uploadHistory: [historyItem, ...state.uploadHistory],
        statistics: newStats,
        isUploading: Object.keys(updatedActiveUploads).length > 0,
        currentUpload: {
          ...initialState.currentUpload,
          step: 'complete',
        },
      };

    case 'FAIL_UPLOAD':
      const failedUploadId = action.payload.uploadId;
      const error = action.payload.error;
      const failedUpload = state.activeUploads[failedUploadId];
      
      if (!failedUpload) return state;

      const failedProgress = {
        ...failedUpload,
        status: 'failed' as const,
        error,
      };

      return {
        ...state,
        activeUploads: {
          ...state.activeUploads,
          [failedUploadId]: failedProgress,
        },
        uploadQueue: state.uploadQueue.map(item =>
          item.id === failedUploadId
            ? { ...item, progress: failedProgress }
            : item
        ),
        statistics: {
          ...state.statistics,
          failedUploads: state.statistics.failedUploads + 1,
        },
      };

    case 'CANCEL_UPLOAD':
      const cancelUploadId = action.payload;
      const cancelledUpload = state.activeUploads[cancelUploadId];
      
      if (!cancelledUpload) return state;

      const cancelledActiveUploads = { ...state.activeUploads };
      delete cancelledActiveUploads[cancelUploadId];

      return {
        ...state,
        activeUploads: cancelledActiveUploads,
        uploadQueue: state.uploadQueue.filter(item => item.id !== cancelUploadId),
        isUploading: Object.keys(cancelledActiveUploads).length > 0,
      };

    case 'RETRY_UPLOAD':
      const retryUploadId = action.payload;
      const retryUpload = state.activeUploads[retryUploadId];
      
      if (!retryUpload) return state;

      return {
        ...state,
        activeUploads: {
          ...state.activeUploads,
          [retryUploadId]: {
            ...retryUpload,
            status: 'pending',
            progress: 0,
            error: undefined,
            retryCount: retryUpload.retryCount + 1,
          },
        },
      };

    // Queue management
    case 'ADD_TO_QUEUE':
      return {
        ...state,
        uploadQueue: [...state.uploadQueue, action.payload],
      };

    case 'REMOVE_FROM_QUEUE':
      const removeId = action.payload;
      const updatedQueue = state.uploadQueue.filter(item => item.id !== removeId);
      const updatedActive = { ...state.activeUploads };
      delete updatedActive[removeId];

      return {
        ...state,
        uploadQueue: updatedQueue,
        activeUploads: updatedActive,
        isUploading: Object.keys(updatedActive).length > 0,
      };

    case 'CLEAR_QUEUE':
      return {
        ...state,
        uploadQueue: [],
        activeUploads: {},
        isUploading: false,
      };

    case 'REORDER_QUEUE':
      const { fromIndex, toIndex } = action.payload;
      const newQueue = [...state.uploadQueue];
      const [movedItem] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, movedItem);

      return {
        ...state,
        uploadQueue: newQueue,
      };

    // Drafts
    case 'SAVE_DRAFT':
      const draft = action.payload;
      const existingDraftIndex = state.drafts.findIndex(d => d.id === draft.id);
      
      if (existingDraftIndex >= 0) {
        const updatedDrafts = [...state.drafts];
        updatedDrafts[existingDraftIndex] = draft;
        return { ...state, drafts: updatedDrafts };
      }
      
      return {
        ...state,
        drafts: [...state.drafts, draft],
      };

    case 'DELETE_DRAFT':
      return {
        ...state,
        drafts: state.drafts.filter(draft => draft.id !== action.payload),
        selectedDraftId: state.selectedDraftId === action.payload ? null : state.selectedDraftId,
      };

    case 'LOAD_DRAFT':
      const loadDraftId = action.payload;
      const draftToLoad = state.drafts.find(d => d.id === loadDraftId);
      
      if (!draftToLoad) return state;

      return {
        ...state,
        currentUpload: {
          mediaFile: draftToLoad.mediaFile,
          metadata: draftToLoad.metadata,
          processingOptions: draftToLoad.processingOptions,
          step: 'details',
          validation: null,
        },
        selectedDraftId: loadDraftId,
      };

    case 'CLEAR_DRAFTS':
      return {
        ...state,
        drafts: [],
        selectedDraftId: null,
      };

    // History and statistics
    case 'ADD_TO_HISTORY':
      return {
        ...state,
        uploadHistory: [action.payload, ...state.uploadHistory],
      };

    case 'UPDATE_STATISTICS':
      return {
        ...state,
        statistics: {
          ...state.statistics,
          ...action.payload,
        },
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        uploadHistory: [],
      };

    // UI state
    case 'SET_UPLOADING':
      return {
        ...state,
        isUploading: action.payload,
      };

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
      };

    case 'TOGGLE_UPLOAD_QUEUE':
      return {
        ...state,
        showUploadQueue: !state.showUploadQueue,
      };

    case 'SELECT_DRAFT':
      return {
        ...state,
        selectedDraftId: action.payload,
      };

    // Permissions
    case 'SET_CAMERA_PERMISSION':
      return {
        ...state,
        cameraPermission: action.payload,
      };

    case 'SET_MICROPHONE_PERMISSION':
      return {
        ...state,
        microphonePermission: action.payload,
      };

    case 'SET_STORAGE_PERMISSION':
      return {
        ...state,
        storagePermission: action.payload,
      };

    // Configuration
    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: {
          ...state.config,
          ...action.payload,
        },
      };

    // Validation
    case 'SET_VALIDATION_RESULT':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          validation: action.payload,
        },
      };

    case 'CLEAR_VALIDATION':
      return {
        ...state,
        currentUpload: {
          ...state.currentUpload,
          validation: null,
        },
      };

    // Error handling
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isUploading: false,
        isProcessing: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_NETWORK_ERROR':
      return {
        ...state,
        networkError: action.payload,
      };

    default:
      return state;
  }
}

// Context interface
interface UploadContextType {
  state: UploadState;
  dispatch: React.Dispatch<UploadAction>;
  
  // Media file actions
  setMediaFile: (file: MediaFile) => void;
  clearMediaFile: () => void;
  
  // Metadata actions
  updateMetadata: (metadata: Partial<ContentMetadata>) => void;
  clearMetadata: () => void;
  setProcessingOptions: (options: MediaProcessingOptions) => void;
  
  // Upload flow actions
  setUploadStep: (step: UploadState['currentUpload']['step']) => void;
  startUpload: () => Promise<void>;
  cancelUpload: (uploadId: string) => void;
  retryUpload: (uploadId: string) => void;
  
  // Queue management
  addToQueue: (item: UploadQueueItem) => void;
  removeFromQueue: (uploadId: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  
  // Draft management
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  autoSaveDraft: () => void;
  
  // History and statistics
  loadUploadHistory: () => Promise<void>;
  clearHistory: () => void;
  updateStatistics: () => Promise<void>;
  
  // Content management
  updateContentMetadata: (uploadId: string, metadata: ContentMetadata) => Promise<void>;
  
  // Validation
  validateCurrentUpload: () => ValidationResult;
  
  // Utility functions
  getUploadProgress: (uploadId: string) => UploadProgress | undefined;
  getActiveUploadsCount: () => number;
  getTotalQueueSize: () => number;
  getEstimatedUploadTime: () => number;
  canStartNewUpload: () => boolean;
  
  // Configuration
  updateConfig: (config: Partial<UploadConfig>) => void;
  
  // Error handling
  clearError: () => void;
}

// Create context
const UploadContext = createContext<UploadContextType | undefined>(undefined);

// Storage keys
const STORAGE_KEYS = {
  DRAFTS: 'upload_drafts',
  HISTORY: 'upload_history',
  STATISTICS: 'upload_statistics',
  CONFIG: 'upload_config',
  PERMISSIONS: 'upload_permissions',
} as const;

// Provider component
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(uploadReducer, initialState);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        // Load drafts
        const draftsData = await AsyncStorage.getItem(STORAGE_KEYS.DRAFTS);
        if (draftsData) {
          const drafts = JSON.parse(draftsData);
          drafts.forEach((draft: ContentDraft) => {
            dispatch({ type: 'SAVE_DRAFT', payload: draft });
          });
        }
        
        // Load history
        const historyData = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
        if (historyData) {
          const history = JSON.parse(historyData);
          history.forEach((item: UploadHistoryItem) => {
            dispatch({ type: 'ADD_TO_HISTORY', payload: item });
          });
        }
        
        // Load statistics
        const statsData = await AsyncStorage.getItem(STORAGE_KEYS.STATISTICS);
        if (statsData) {
          const statistics = JSON.parse(statsData);
          dispatch({ type: 'UPDATE_STATISTICS', payload: statistics });
        }
        
        // Load config
        const configData = await AsyncStorage.getItem(STORAGE_KEYS.CONFIG);
        if (configData) {
          const config = JSON.parse(configData);
          dispatch({ type: 'UPDATE_CONFIG', payload: config });
        }
      } catch (error) {
        console.warn('Failed to load upload data from storage:', error);
      }
    };
    
    loadPersistedData();
  }, []);
  
  // Persist drafts when they change
  useEffect(() => {
    const persistDrafts = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(state.drafts));
      } catch (error) {
        console.warn('Failed to persist drafts:', error);
      }
    };
    
    if (state.drafts.length > 0) {
      persistDrafts();
    }
  }, [state.drafts]);
  
  // Persist statistics when they change
  useEffect(() => {
    const persistStatistics = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(state.statistics));
      } catch (error) {
        console.warn('Failed to persist statistics:', error);
      }
    };
    
    persistStatistics();
  }, [state.statistics]);
  
  // Media file actions
  const setMediaFile = useCallback((file: MediaFile) => {
    dispatch({ type: 'SET_MEDIA_FILE', payload: file });
  }, []);
  
  const clearMediaFile = useCallback(() => {
    dispatch({ type: 'CLEAR_MEDIA_FILE' });
  }, []);
  
  // Metadata actions
  const updateMetadata = useCallback((metadata: Partial<ContentMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', payload: metadata });
    // Trigger auto-save after metadata update
    autoSaveDraft();
  }, []);
  
  const clearMetadata = useCallback(() => {
    dispatch({ type: 'CLEAR_METADATA' });
  }, []);
  
  const setProcessingOptions = useCallback((options: MediaProcessingOptions) => {
    dispatch({ type: 'SET_PROCESSING_OPTIONS', payload: options });
  }, []);
  
  // Upload flow actions
  const setUploadStep = useCallback((step: UploadState['currentUpload']['step']) => {
    dispatch({ type: 'SET_UPLOAD_STEP', payload: step });
  }, []);
  
  const startUpload = useCallback(async () => {
    const { mediaFile, metadata } = state.currentUpload;
    
    if (!mediaFile || !metadata.title) {
      dispatch({ type: 'SET_ERROR', payload: 'Missing required upload data' });
      return;
    }
    
    // Create upload queue item
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const progress: UploadProgress = {
      uploadId,
      mediaFile,
      metadata: metadata as ContentMetadata,
      status: 'pending',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: mediaFile.size,
      retryCount: 0,
      maxRetries: state.config.retryAttempts,
      createdAt: new Date().toISOString(),
    };
    
    const queueItem: UploadQueueItem = {
      id: uploadId,
      mediaFile,
      metadata: metadata as ContentMetadata,
      progress,
      priority: 1,
    };
    
    dispatch({ type: 'START_UPLOAD', payload: queueItem });
    dispatch({ type: 'SET_UPLOAD_STEP', payload: 'uploading' });
  }, [state.currentUpload, state.config.retryAttempts]);
  
  const cancelUpload = useCallback((uploadId: string) => {
    dispatch({ type: 'CANCEL_UPLOAD', payload: uploadId });
  }, []);
  
  const retryUpload = useCallback((uploadId: string) => {
    dispatch({ type: 'RETRY_UPLOAD', payload: uploadId });
  }, []);
  
  // Queue management
  const addToQueue = useCallback((item: UploadQueueItem) => {
    dispatch({ type: 'ADD_TO_QUEUE', payload: item });
  }, []);
  
  const removeFromQueue = useCallback((uploadId: string) => {
    dispatch({ type: 'REMOVE_FROM_QUEUE', payload: uploadId });
  }, []);
  
  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_QUEUE' });
  }, []);
  
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_QUEUE', payload: { fromIndex, toIndex } });
  }, []);
  
  // Draft management
  const saveDraft = useCallback(async () => {
    const { mediaFile, metadata, processingOptions } = state.currentUpload;
    
    if (!mediaFile) return;
    
    const draftId = state.selectedDraftId || `draft_${Date.now()}`;
    const draft: ContentDraft = {
      id: draftId,
      mediaFile,
      metadata,
      processingOptions,
      createdAt: state.selectedDraftId 
        ? state.drafts.find(d => d.id === draftId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoSaveEnabled: true,
    };
    
    dispatch({ type: 'SAVE_DRAFT', payload: draft });
  }, [state.currentUpload, state.selectedDraftId, state.drafts]);
  
  const loadDraft = useCallback((draftId: string) => {
    dispatch({ type: 'LOAD_DRAFT', payload: draftId });
  }, []);
  
  const deleteDraft = useCallback((draftId: string) => {
    dispatch({ type: 'DELETE_DRAFT', payload: draftId });
  }, []);
  
  const autoSaveDraft = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (state.currentUpload.mediaFile) {
        saveDraft();
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  }, [state.currentUpload.mediaFile, saveDraft]);
  
  // History and statistics
  const loadUploadHistory = useCallback(async () => {
    // In a real app, this would load from server
    // For now, we use local storage
  }, []);
  
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
    AsyncStorage.removeItem(STORAGE_KEYS.HISTORY);
  }, []);
  
  const updateStatistics = useCallback(async () => {
    // Calculate statistics based on upload history
    const stats: Partial<UploadStatistics> = {
      totalUploads: state.uploadHistory.length,
      successfulUploads: state.uploadHistory.filter(item => item.status === 'completed').length,
      failedUploads: state.uploadHistory.filter(item => item.status === 'failed').length,
      totalDataUploaded: state.uploadHistory.reduce((total, item) => total + item.fileSize, 0),
    };
    
    dispatch({ type: 'UPDATE_STATISTICS', payload: stats });
  }, [state.uploadHistory]);
  
  // Content management
  const updateContentMetadata = useCallback(async (uploadId: string, metadata: ContentMetadata) => {
    // In a real app, this would make an API call to update the content metadata on the server
    // For now, we'll simulate the operation
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the history item if it exists
      const updatedHistory = state.uploadHistory.map(item => {
        if (item.uploadId === uploadId) {
          return {
            ...item,
            metadata: {
              ...item.metadata,
              ...metadata,
            },
          };
        }
        return item;
      });
      
      // Update state by replacing the history
      dispatch({ type: 'CLEAR_HISTORY' });
      updatedHistory.forEach(item => {
        dispatch({ type: 'ADD_TO_HISTORY', payload: item });
      });
      
      // In a real implementation, you would also save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Failed to update content metadata:', error);
      throw new Error('Failed to update content metadata');
    }
  }, [state.uploadHistory]);
  
  // Validation
  const validateCurrentUpload = useCallback((): ValidationResult => {
    const { mediaFile, metadata } = state.currentUpload;
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string; code: string }> = [];
    
    // Required fields
    if (!mediaFile) {
      errors.push({ field: 'mediaFile', message: 'Please select a media file', code: 'REQUIRED' });
    }
    
    if (!metadata.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required', code: 'REQUIRED' });
    }
    
    if (!metadata.description?.trim()) {
      warnings.push({ field: 'description', message: 'Adding a description helps with discoverability', code: 'RECOMMENDED' });
    }
    
    // File size validation
    if (mediaFile && mediaFile.size > state.config.maxFileSize) {
      errors.push({ 
        field: 'mediaFile', 
        message: `File size exceeds maximum allowed size of ${Math.round(state.config.maxFileSize / (1024 * 1024))}MB`, 
        code: 'FILE_TOO_LARGE' 
      });
    }
    
    // Pricing validation
    if (metadata.pricingType === 'paid' && (!metadata.price || metadata.price <= 0)) {
      errors.push({ field: 'price', message: 'Price is required for paid content', code: 'REQUIRED' });
    }
    
    if (metadata.pricingType === 'subscription' && !metadata.subscriptionTier) {
      errors.push({ field: 'subscriptionTier', message: 'Subscription tier is required', code: 'REQUIRED' });
    }
    
    // Tags validation
    if (metadata.tags && metadata.tags.length === 0) {
      warnings.push({ field: 'tags', message: 'Adding tags helps with discoverability', code: 'RECOMMENDED' });
    }
    
    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
    
    dispatch({ type: 'SET_VALIDATION_RESULT', payload: result });
    return result;
  }, [state.currentUpload, state.config.maxFileSize]);
  
  // Utility functions
  const getUploadProgress = useCallback((uploadId: string): UploadProgress | undefined => {
    return state.activeUploads[uploadId];
  }, [state.activeUploads]);
  
  const getActiveUploadsCount = useCallback((): number => {
    return Object.keys(state.activeUploads).length;
  }, [state.activeUploads]);
  
  const getTotalQueueSize = useCallback((): number => {
    return state.uploadQueue.length;
  }, [state.uploadQueue]);
  
  const getEstimatedUploadTime = useCallback((): number => {
    // Simple estimation based on file sizes and average upload speed
    const totalBytes = state.uploadQueue.reduce((total, item) => total + item.mediaFile.size, 0);
    const avgSpeed = 1024 * 1024; // 1MB/s average
    return Math.round(totalBytes / avgSpeed);
  }, [state.uploadQueue]);
  
  const canStartNewUpload = useCallback((): boolean => {
    return getActiveUploadsCount() < state.config.maxConcurrentUploads;
  }, [getActiveUploadsCount, state.config.maxConcurrentUploads]);
  
  // Configuration
  const updateConfig = useCallback((config: Partial<UploadConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: config });
  }, []);
  
  // Error handling
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);
  
  const contextValue: UploadContextType = {
    state,
    dispatch,
    
    // Media file actions
    setMediaFile,
    clearMediaFile,
    
    // Metadata actions
    updateMetadata,
    clearMetadata,
    setProcessingOptions,
    
    // Upload flow actions
    setUploadStep,
    startUpload,
    cancelUpload,
    retryUpload,
    
    // Queue management
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    
    // Draft management
    saveDraft,
    loadDraft,
    deleteDraft,
    autoSaveDraft,
    
    // History and statistics
    loadUploadHistory,
    clearHistory,
    updateStatistics,
    
    // Content management
    updateContentMetadata,
    
    // Validation
    validateCurrentUpload,
    
    // Utility functions
    getUploadProgress,
    getActiveUploadsCount,
    getTotalQueueSize,
    getEstimatedUploadTime,
    canStartNewUpload,
    
    // Configuration
    updateConfig,
    
    // Error handling
    clearError,
  };
  
  return (
    <UploadContext.Provider value={contextValue}>
      {children}
    </UploadContext.Provider>
  );
}

// Hook for using upload context
export function useUpload(): UploadContextType {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}

export default UploadContext;