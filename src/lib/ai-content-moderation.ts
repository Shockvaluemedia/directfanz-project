import { createAgentTask, createAgentRegistry, DEFAULT_AGENT_CONFIGS } from '@/lib/ai';
import { Logger } from '@/lib/logger';
import { ContentType } from '@/lib/types/enums';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

const logger = new Logger('ai-content-moderation');

export interface ModerationResult {
  approved: boolean;
  confidence: number;
  flags: ModerationFlag[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  processingTime: number;
}

export interface ModerationFlag {
  type: 'explicit_content' | 'violence' | 'harassment' | 'spam' | 'copyright' | 'inappropriate_text' | 'hate_speech' | 'fake_content';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  location?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    timestamp?: number; // for video content
  };
}

export interface ContentAnalysis {
  metadata: {
    fileSize: number;
    duration?: number;
    dimensions?: { width: number; height: number };
    format: string;
    estimatedAudience?: 'general' | 'teen' | 'mature' | 'adult';
  };
  textContent?: string; // extracted text from images/documents
  audioTranscription?: string; // for video/audio files
  visualAnalysis?: {
    dominantColors: string[];
    objectsDetected: string[];
    facesDetected: number;
    emotionalTone?: 'positive' | 'neutral' | 'negative';
  };
}

let registry: any = null;

async function getRegistry() {
  if (!registry) {
    registry = createAgentRegistry(
      DEFAULT_AGENT_CONFIGS.agentRegistry,
      logger
    );
  }
  return registry;
}

/**
 * Main content moderation function that analyzes content using AI
 */
export async function moderateContent(
  file: File | Buffer,
  contentType: ContentType,
  userId: string,
  metadata: any = {}
): Promise<ModerationResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting AI content moderation', {
      userId,
      contentType,
      fileSize: file instanceof File ? file.size : file.length
    });

    // Step 1: Analyze content and extract features
    const analysis = await analyzeContent(file, contentType);
    
    // Step 2: Run AI moderation using our moderation agent
    const agentRegistry = await getRegistry();
    const moderationTask = createAgentTask('moderate_content', {
      contentType,
      analysis,
      userId,
      metadata,
      strictMode: true,
      includeExplanation: true
    });

    const aiResponse = await agentRegistry.executeTask('moderation-safety-main', moderationTask);
    
    if (!aiResponse.success) {
      logger.error('AI moderation failed', { userId, contentType }, new Error(aiResponse.error));
      
      // Fall back to basic rule-based moderation
      return await fallbackModeration(analysis, contentType);
    }

    // Step 3: Process AI response and generate final moderation result
    const result = await processAIModerationResult(aiResponse.data, analysis);
    
    const processingTime = Date.now() - startTime;
    result.processingTime = processingTime;

    logger.info('AI content moderation completed', {
      userId,
      contentType,
      approved: result.approved,
      riskLevel: result.riskLevel,
      flagsCount: result.flags.length,
      processingTime
    });

    return result;

  } catch (error) {
    logger.error('Content moderation error', { userId, contentType }, error as Error);
    
    // Return a safe default - reject the content
    return {
      approved: false,
      confidence: 0.9,
      flags: [{
        type: 'spam',
        severity: 'high',
        confidence: 0.9,
        description: 'Content could not be analyzed due to technical error. Manual review required.'
      }],
      riskLevel: 'high',
      recommendations: [
        'Submit content for manual review',
        'Check file format and integrity',
        'Try uploading again with a different file'
      ],
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Analyze content to extract features for AI moderation
 */
async function analyzeContent(
  file: File | Buffer,
  contentType: ContentType
): Promise<ContentAnalysis> {
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
  const analysis: ContentAnalysis = {
    metadata: {
      fileSize: buffer.length,
      format: file instanceof File ? file.type : 'unknown'
    }
  };

  try {
    switch (contentType) {
      case ContentType.IMAGE:
        analysis.visualAnalysis = await analyzeImage(buffer);
        analysis.textContent = await extractTextFromImage(buffer);
        break;
        
      case ContentType.VIDEO:
        const videoAnalysis = await analyzeVideo(buffer);
        analysis.metadata.duration = videoAnalysis.duration;
        analysis.metadata.dimensions = videoAnalysis.dimensions;
        analysis.visualAnalysis = videoAnalysis.visualAnalysis;
        analysis.audioTranscription = videoAnalysis.audioTranscription;
        break;
        
      case ContentType.AUDIO:
        const audioAnalysis = await analyzeAudio(buffer);
        analysis.metadata.duration = audioAnalysis.duration;
        analysis.audioTranscription = audioAnalysis.transcription;
        break;
        
      case ContentType.DOCUMENT:
        analysis.textContent = await extractTextFromDocument(buffer);
        break;
    }

    // Estimate content audience based on analysis
    analysis.metadata.estimatedAudience = estimateAudience(analysis);
    
  } catch (error) {
    logger.warn('Content analysis partially failed', error);
    // Continue with whatever analysis we could perform
  }

  return analysis;
}

/**
 * Analyze image content
 */
async function analyzeImage(buffer: Buffer): Promise<{
  dominantColors: string[];
  objectsDetected: string[];
  facesDetected: number;
  emotionalTone: 'positive' | 'neutral' | 'negative';
}> {
  try {
    // Use sharp for basic image analysis
    const metadata = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    
    // Extract dominant colors (simplified)
    const dominantColors = stats.channels?.map((channel, index) => {
      const colorNames = ['red', 'green', 'blue'];
      return `${colorNames[index] || 'unknown'}: ${Math.round(channel.mean)}`;
    }) || [];

    // For a real implementation, you would use:
    // - AWS Rekognition for object/face detection
    // - Google Vision API for text extraction
    // - Custom ML models for content classification
    
    return {
      dominantColors,
      objectsDetected: ['general_content'], // Simplified
      facesDetected: 0, // Would be detected by actual AI service
      emotionalTone: 'neutral'
    };
    
  } catch (error) {
    logger.warn('Image analysis failed', error);
    return {
      dominantColors: [],
      objectsDetected: [],
      facesDetected: 0,
      emotionalTone: 'neutral'
    };
  }
}

/**
 * Extract text from images using OCR (simplified implementation)
 */
async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    // In a real implementation, you would use:
    // - Tesseract.js for client-side OCR
    // - AWS Textract for cloud OCR
    // - Google Vision API for text detection
    
    // For now, return empty string
    return '';
  } catch (error) {
    logger.warn('Text extraction from image failed', error);
    return '';
  }
}

/**
 * Analyze video content (simplified)
 */
async function analyzeVideo(buffer: Buffer): Promise<{
  duration: number;
  dimensions: { width: number; height: number };
  visualAnalysis: any;
  audioTranscription: string;
}> {
  try {
    // In a real implementation, you would:
    // - Extract frames at regular intervals
    // - Analyze each frame for visual content
    // - Extract and transcribe audio track
    // - Use video-specific ML models
    
    return {
      duration: 0, // Would be extracted from video metadata
      dimensions: { width: 1920, height: 1080 }, // Default
      visualAnalysis: {
        dominantColors: [],
        objectsDetected: ['video_content'],
        facesDetected: 0,
        emotionalTone: 'neutral'
      },
      audioTranscription: '' // Would be transcribed using speech-to-text
    };
    
  } catch (error) {
    logger.warn('Video analysis failed', error);
    return {
      duration: 0,
      dimensions: { width: 0, height: 0 },
      visualAnalysis: { dominantColors: [], objectsDetected: [], facesDetected: 0, emotionalTone: 'neutral' },
      audioTranscription: ''
    };
  }
}

/**
 * Analyze audio content
 */
async function analyzeAudio(buffer: Buffer): Promise<{
  duration: number;
  transcription: string;
}> {
  try {
    // In a real implementation, you would:
    // - Use speech-to-text services (AWS Transcribe, Google Speech-to-Text)
    // - Analyze audio for inappropriate content
    // - Detect music vs speech
    
    return {
      duration: 0,
      transcription: ''
    };
    
  } catch (error) {
    logger.warn('Audio analysis failed', error);
    return {
      duration: 0,
      transcription: ''
    };
  }
}

/**
 * Extract text from document files
 */
async function extractTextFromDocument(buffer: Buffer): Promise<string> {
  try {
    // In a real implementation, you would:
    // - Use PDF parsing libraries for PDFs
    // - Use document parsing libraries for Word docs
    // - Extract and analyze text content
    
    return '';
    
  } catch (error) {
    logger.warn('Document text extraction failed', error);
    return '';
  }
}

/**
 * Estimate target audience based on content analysis
 */
function estimateAudience(analysis: ContentAnalysis): 'general' | 'teen' | 'mature' | 'adult' {
  // This would use more sophisticated analysis in a real implementation
  // For now, default to general audience
  return 'general';
}

/**
 * Process AI moderation result and convert to standardized format
 */
async function processAIModerationResult(
  aiData: any,
  analysis: ContentAnalysis
): Promise<ModerationResult> {
  // Extract information from AI response
  const approved = aiData.approved !== false && aiData.riskLevel !== 'critical';
  const confidence = aiData.confidence || 0.8;
  const riskLevel = aiData.riskLevel || 'low';
  
  // Convert AI flags to standardized format
  const flags: ModerationFlag[] = (aiData.flags || []).map((flag: any) => ({
    type: flag.type || 'inappropriate_content',
    severity: flag.severity || 'medium',
    confidence: flag.confidence || 0.7,
    description: flag.description || 'Content flagged by AI moderation',
    location: flag.location
  }));

  // Generate recommendations based on AI analysis
  const recommendations = generateModerationRecommendations(aiData, analysis, flags);

  return {
    approved,
    confidence,
    flags,
    riskLevel,
    recommendations,
    processingTime: 0 // Will be set by caller
  };
}

/**
 * Fallback moderation when AI fails
 */
async function fallbackModeration(
  analysis: ContentAnalysis,
  contentType: ContentType
): Promise<ModerationResult> {
  const flags: ModerationFlag[] = [];
  
  // Basic rule-based checks
  if (analysis.textContent && containsInappropriateText(analysis.textContent)) {
    flags.push({
      type: 'inappropriate_text',
      severity: 'medium',
      confidence: 0.7,
      description: 'Text content may contain inappropriate language'
    });
  }

  if (analysis.metadata.fileSize > 100 * 1024 * 1024) { // 100MB
    flags.push({
      type: 'spam',
      severity: 'low',
      confidence: 0.6,
      description: 'File size is unusually large'
    });
  }

  const approved = flags.length === 0 || !flags.some(f => f.severity === 'high' || f.severity === 'critical');
  const riskLevel = flags.some(f => f.severity === 'high') ? 'high' : 
                   flags.some(f => f.severity === 'medium') ? 'medium' : 'low';

  return {
    approved,
    confidence: 0.6,
    flags,
    riskLevel,
    recommendations: [
      'Content reviewed using basic filters only',
      'Consider manual review for higher accuracy',
      'AI moderation service temporarily unavailable'
    ],
    processingTime: 0
  };
}

/**
 * Generate recommendations based on moderation results
 */
function generateModerationRecommendations(
  aiData: any,
  analysis: ContentAnalysis,
  flags: ModerationFlag[]
): string[] {
  const recommendations: string[] = [];

  if (flags.length === 0) {
    recommendations.push('Content approved - no issues detected');
    recommendations.push('Monitor engagement metrics after publishing');
  } else {
    recommendations.push('Review flagged content before publishing');
    
    if (flags.some(f => f.type === 'explicit_content')) {
      recommendations.push('Consider age-restricting this content');
      recommendations.push('Add appropriate content warnings');
    }
    
    if (flags.some(f => f.type === 'inappropriate_text')) {
      recommendations.push('Review and edit text content');
      recommendations.push('Consider using content filters for text');
    }
    
    if (flags.some(f => f.severity === 'high' || f.severity === 'critical')) {
      recommendations.push('Manual review required before approval');
      recommendations.push('Consider rejecting content if violations are severe');
    }
  }

  return recommendations;
}

/**
 * Simple inappropriate text detection (placeholder)
 */
function containsInappropriateText(text: string): boolean {
  const inappropriateWords = ['spam', 'scam', 'fake']; // Very basic list
  const lowerText = text.toLowerCase();
  
  return inappropriateWords.some(word => lowerText.includes(word));
}

/**
 * Batch moderate multiple files
 */
export async function batchModerateContent(
  files: Array<{ file: File | Buffer; contentType: ContentType; metadata?: any }>,
  userId: string
): Promise<ModerationResult[]> {
  const results = await Promise.all(
    files.map(({ file, contentType, metadata }) =>
      moderateContent(file, contentType, userId, metadata)
    )
  );

  logger.info('Batch content moderation completed', {
    userId,
    totalFiles: files.length,
    approvedCount: results.filter(r => r.approved).length,
    flaggedCount: results.filter(r => r.flags.length > 0).length
  });

  return results;
}

/**
 * Get moderation statistics for an artist
 */
export async function getModerationStats(userId: string, timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly') {
  // This would query the database for actual stats
  // For now, return mock data
  return {
    totalContentModerated: 156,
    approvalRate: 0.94,
    commonFlags: [
      { type: 'inappropriate_text', count: 8 },
      { type: 'explicit_content', count: 3 },
      { type: 'spam', count: 2 }
    ],
    averageProcessingTime: 2.3,
    timeframe
  };
}