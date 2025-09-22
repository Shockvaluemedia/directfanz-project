/**
 * Advanced Content Optimization Service
 * 
 * This service provides intelligent content optimization strategies that enhance
 * the existing media processing system with smart decisions about quality,
 * compression, and delivery optimization based on content analysis.
 */

import sharp from 'sharp';
import { mediaProcessor } from './media-processing';
import { logger } from './logger';

// Optimization strategies
export interface OptimizationStrategy {
  name: string;
  description: string;
  targetSizeReduction: number; // percentage
  qualityThreshold: number; // 0-100
  supportedTypes: ContentType[];
}

export interface ContentAnalysis {
  complexity: 'low' | 'medium' | 'high';
  motionLevel?: 'static' | 'low' | 'medium' | 'high';
  colorComplexity: 'monochrome' | 'limited' | 'full';
  noiseLevel: 'clean' | 'moderate' | 'noisy';
  dimensions: { width: number; height: number };
  duration?: number;
  bitrate?: number;
  hasText: boolean;
  hasFaces: boolean;
  dominantColors: string[];
  recommendedStrategy: string;
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  sizeReduction: number; // percentage
  qualityScore: number; // 0-100
  processingTime: number;
  strategy: string;
  outputs: Array<{
    quality: string;
    format: string;
    size: number;
    url: string;
    optimizations: string[];
  }>;
}

enum ContentType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO'
}

// Predefined optimization strategies
export const OPTIMIZATION_STRATEGIES: Record<string, OptimizationStrategy> = {
  aggressive: {
    name: 'Aggressive Compression',
    description: 'Maximum file size reduction with acceptable quality loss',
    targetSizeReduction: 60,
    qualityThreshold: 70,
    supportedTypes: [ContentType.IMAGE, ContentType.VIDEO, ContentType.AUDIO],
  },
  balanced: {
    name: 'Balanced Optimization',
    description: 'Good balance between file size and quality',
    targetSizeReduction: 40,
    qualityThreshold: 85,
    supportedTypes: [ContentType.IMAGE, ContentType.VIDEO, ContentType.AUDIO],
  },
  quality: {
    name: 'Quality Preserving',
    description: 'Minimal compression to preserve maximum quality',
    targetSizeReduction: 20,
    qualityThreshold: 95,
    supportedTypes: [ContentType.IMAGE, ContentType.VIDEO, ContentType.AUDIO],
  },
  mobile: {
    name: 'Mobile Optimized',
    description: 'Optimized for mobile devices and slower connections',
    targetSizeReduction: 70,
    qualityThreshold: 75,
    supportedTypes: [ContentType.IMAGE, ContentType.VIDEO, ContentType.AUDIO],
  },
  streaming: {
    name: 'Streaming Optimized',
    description: 'Optimized for adaptive streaming and quick start',
    targetSizeReduction: 45,
    qualityThreshold: 80,
    supportedTypes: [ContentType.VIDEO, ContentType.AUDIO],
  },
};

export class ContentOptimizer {
  /**
   * Analyze content characteristics to determine optimal processing strategy
   */
  async analyzeContent(filePath: string, contentType: ContentType): Promise<ContentAnalysis> {
    const startTime = Date.now();
    
    try {
      let analysis: Partial<ContentAnalysis> = {
        hasText: false,
        hasFaces: false,
        dominantColors: [],
      };

      if (contentType === ContentType.IMAGE) {
        analysis = await this.analyzeImage(filePath);
      } else if (contentType === ContentType.VIDEO) {
        analysis = await this.analyzeVideo(filePath);
      } else if (contentType === ContentType.AUDIO) {
        analysis = await this.analyzeAudio(filePath);
      }

      // Determine recommended strategy based on analysis
      const recommendedStrategy = this.determineOptimalStrategy(analysis as ContentAnalysis);

      const result: ContentAnalysis = {
        complexity: analysis.complexity || 'medium',
        motionLevel: analysis.motionLevel,
        colorComplexity: analysis.colorComplexity || 'full',
        noiseLevel: analysis.noiseLevel || 'moderate',
        dimensions: analysis.dimensions || { width: 0, height: 0 },
        duration: analysis.duration,
        bitrate: analysis.bitrate,
        hasText: analysis.hasText || false,
        hasFaces: analysis.hasFaces || false,
        dominantColors: analysis.dominantColors || [],
        recommendedStrategy,
      };

      const processingTime = Date.now() - startTime;
      
      logger.info('Content analysis completed', {
        filePath,
        contentType,
        processingTime,
        recommendedStrategy,
        complexity: result.complexity,
      });

      return result;
    } catch (error) {
      logger.error('Content analysis failed', { filePath, contentType }, error as Error);
      
      // Return safe defaults
      return {
        complexity: 'medium',
        colorComplexity: 'full',
        noiseLevel: 'moderate',
        dimensions: { width: 1920, height: 1080 },
        hasText: false,
        hasFaces: false,
        dominantColors: [],
        recommendedStrategy: 'balanced',
      };
    }
  }

  /**
   * Optimize content using intelligent strategies
   */
  async optimizeContent(
    filePath: string,
    contentType: ContentType,
    options: {
      strategy?: string;
      customStrategy?: Partial<OptimizationStrategy>;
      targetDevice?: 'mobile' | 'tablet' | 'desktop' | 'tv';
      targetConnection?: '2g' | '3g' | '4g' | '5g' | 'wifi';
      preserveMetadata?: boolean;
      enableAnalytics?: boolean;
      contentId?: string;
      artistId?: string;
    } = {}
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    logger.info('Starting content optimization', {
      filePath,
      contentType,
      options,
    });

    try {
      // Analyze content if strategy not specified
      let strategy = options.strategy;
      let analysis: ContentAnalysis | undefined;

      if (!strategy || strategy === 'auto') {
        analysis = await this.analyzeContent(filePath, contentType);
        strategy = analysis.recommendedStrategy;
      }

      // Get optimization strategy
      const optimizationStrategy = options.customStrategy 
        ? { ...OPTIMIZATION_STRATEGIES.balanced, ...options.customStrategy }
        : OPTIMIZATION_STRATEGIES[strategy] || OPTIMIZATION_STRATEGIES.balanced;

      // Adjust strategy based on target device and connection
      const adjustedStrategy = this.adjustStrategyForTarget(
        optimizationStrategy,
        options.targetDevice,
        options.targetConnection
      );

      // Get original file size
      const fs = await import('fs/promises');
      const stats = await fs.stat(filePath);
      const originalSize = stats.size;

      // Process content with optimized settings
      const processingOptions = this.buildProcessingOptions(
        adjustedStrategy,
        contentType,
        analysis,
        options
      );

      let outputs: any[] = [];
      
      if (contentType === ContentType.IMAGE) {
        outputs = await this.optimizeImage(filePath, processingOptions);
      } else if (contentType === ContentType.VIDEO) {
        outputs = await this.optimizeVideo(filePath, processingOptions);
      } else if (contentType === ContentType.AUDIO) {
        outputs = await this.optimizeAudio(filePath, processingOptions);
      }

      // Calculate optimization metrics
      const totalOptimizedSize = outputs.reduce((sum, output) => sum + output.size, 0);
      const sizeReduction = ((originalSize - totalOptimizedSize) / originalSize) * 100;
      const qualityScore = this.calculateQualityScore(outputs, adjustedStrategy);
      const processingTime = Date.now() - startTime;

      const result: OptimizationResult = {
        originalSize,
        optimizedSize: totalOptimizedSize,
        sizeReduction: Math.max(0, sizeReduction),
        qualityScore,
        processingTime,
        strategy: strategy,
        outputs: outputs.map(output => ({
          quality: output.quality,
          format: output.format,
          size: output.size,
          url: output.url,
          optimizations: output.optimizations || [],
        })),
      };

      logger.info('Content optimization completed', {
        filePath,
        strategy,
        sizeReduction: result.sizeReduction,
        qualityScore: result.qualityScore,
        processingTime,
      });

      return result;
    } catch (error) {
      logger.error('Content optimization failed', { filePath, contentType }, error as Error);
      throw new Error(`Content optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch optimize multiple content files
   */
  async batchOptimize(
    files: Array<{
      path: string;
      type: ContentType;
      options?: any;
    }>,
    globalOptions: {
      strategy?: string;
      maxConcurrent?: number;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<OptimizationResult[]> {
    const maxConcurrent = globalOptions.maxConcurrent || 3;
    const results: OptimizationResult[] = [];
    let completed = 0;

    logger.info('Starting batch optimization', {
      totalFiles: files.length,
      maxConcurrent,
    });

    // Process files in batches
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const result = await this.optimizeContent(file.path, file.type, {
            ...globalOptions,
            ...file.options,
          });
          
          completed++;
          globalOptions.onProgress?.(completed, files.length);
          
          return result;
        } catch (error) {
          logger.error('Batch optimization file failed', { path: file.path }, error as Error);
          completed++;
          globalOptions.onProgress?.(completed, files.length);
          throw error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    logger.info('Batch optimization completed', {
      totalFiles: files.length,
      successfulFiles: results.length,
      failedFiles: files.length - results.length,
    });

    return results;
  }

  // Private helper methods

  private async analyzeImage(filePath: string): Promise<Partial<ContentAnalysis>> {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    const stats = await image.stats();

    // Analyze image complexity based on color channels and entropy
    const hasAlpha = metadata.channels === 4;
    const isGrayscale = metadata.channels === 1;
    
    // Simple complexity analysis based on file size vs dimensions
    const pixelCount = (metadata.width || 1) * (metadata.height || 1);
    const fs = await import('fs/promises');
    const fileStats = await fs.stat(filePath);
    const bytesPerPixel = fileStats.size / pixelCount;
    
    const complexity: 'low' | 'medium' | 'high' = 
      bytesPerPixel < 1 ? 'low' :
      bytesPerPixel < 3 ? 'medium' : 'high';

    // Determine color complexity
    const colorComplexity: 'monochrome' | 'limited' | 'full' = 
      isGrayscale ? 'monochrome' :
      metadata.channels === 3 ? 'full' : 'limited';

    return {
      complexity,
      colorComplexity,
      noiseLevel: 'clean', // Would need more sophisticated analysis
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
      hasText: false, // Would need OCR for accurate detection
      hasFaces: false, // Would need face detection
      dominantColors: [], // Would need color analysis
    };
  }

  private async analyzeVideo(filePath: string): Promise<Partial<ContentAnalysis>> {
    // This would use FFmpeg to analyze video characteristics
    // For now, return reasonable defaults
    return {
      complexity: 'medium',
      motionLevel: 'medium',
      colorComplexity: 'full',
      noiseLevel: 'moderate',
      dimensions: { width: 1920, height: 1080 },
      duration: 60, // Would extract from video metadata
      bitrate: 2000000, // Would extract from video metadata
    };
  }

  private async analyzeAudio(filePath: string): Promise<Partial<ContentAnalysis>> {
    // This would analyze audio characteristics
    return {
      complexity: 'medium',
      noiseLevel: 'clean',
      dimensions: { width: 0, height: 0 },
      duration: 180, // Would extract from audio metadata
      bitrate: 192000, // Would extract from audio metadata
    };
  }

  private determineOptimalStrategy(analysis: ContentAnalysis): string {
    // Logic to determine the best strategy based on content analysis
    if (analysis.complexity === 'low' && !analysis.hasText) {
      return 'aggressive';
    }
    
    if (analysis.hasText || analysis.hasFaces) {
      return 'quality';
    }
    
    if (analysis.dimensions.width < 800 || analysis.dimensions.height < 600) {
      return 'mobile';
    }
    
    if (analysis.motionLevel === 'high' || analysis.duration && analysis.duration > 300) {
      return 'streaming';
    }
    
    return 'balanced';
  }

  private adjustStrategyForTarget(
    strategy: OptimizationStrategy,
    targetDevice?: string,
    targetConnection?: string
  ): OptimizationStrategy {
    let adjustedStrategy = { ...strategy };

    // Adjust for mobile devices
    if (targetDevice === 'mobile') {
      adjustedStrategy.targetSizeReduction = Math.max(
        adjustedStrategy.targetSizeReduction,
        60
      );
      adjustedStrategy.qualityThreshold = Math.min(
        adjustedStrategy.qualityThreshold,
        80
      );
    }

    // Adjust for slow connections
    if (targetConnection === '2g' || targetConnection === '3g') {
      adjustedStrategy.targetSizeReduction = Math.max(
        adjustedStrategy.targetSizeReduction,
        70
      );
      adjustedStrategy.qualityThreshold = Math.min(
        adjustedStrategy.qualityThreshold,
        75
      );
    }

    // Adjust for TV/desktop with good connection
    if (targetDevice === 'tv' && (targetConnection === '5g' || targetConnection === 'wifi')) {
      adjustedStrategy.targetSizeReduction = Math.min(
        adjustedStrategy.targetSizeReduction,
        30
      );
      adjustedStrategy.qualityThreshold = Math.max(
        adjustedStrategy.qualityThreshold,
        90
      );
    }

    return adjustedStrategy;
  }

  private buildProcessingOptions(
    strategy: OptimizationStrategy,
    contentType: ContentType,
    analysis?: ContentAnalysis,
    options: any = {}
  ): any {
    const baseOptions = {
      optimizeFor: strategy.targetSizeReduction > 50 ? 'size' : 'quality',
      targetDevices: options.targetDevice ? [options.targetDevice] : ['desktop'],
      enableAnalytics: options.enableAnalytics,
      contentId: options.contentId,
      artistId: options.artistId,
    };

    if (contentType === ContentType.VIDEO) {
      return {
        ...baseOptions,
        generateThumbnails: true,
        enableStreaming: true,
        qualities: this.determineVideoQualities(strategy, analysis),
      };
    }

    if (contentType === ContentType.AUDIO) {
      return {
        ...baseOptions,
        generateWaveform: true,
        formats: ['mp3', 'aac'],
        qualities: this.determineAudioQualities(strategy),
      };
    }

    if (contentType === ContentType.IMAGE) {
      return {
        ...baseOptions,
        formats: ['jpg', 'webp'],
        qualities: this.determineImageQualities(strategy),
      };
    }

    return baseOptions;
  }

  private determineVideoQualities(
    strategy: OptimizationStrategy,
    analysis?: ContentAnalysis
  ): string[] {
    if (strategy.targetSizeReduction > 60) {
      return ['720p', '480p', '360p'];
    }
    
    if (strategy.qualityThreshold > 90) {
      return ['1080p', '720p', '480p', '360p'];
    }
    
    // Check input resolution if available
    if (analysis?.dimensions.height && analysis.dimensions.height < 720) {
      return ['480p', '360p'];
    }
    
    return ['1080p', '720p', '480p'];
  }

  private determineAudioQualities(strategy: OptimizationStrategy): string[] {
    if (strategy.targetSizeReduction > 60) {
      return ['medium', 'low'];
    }
    
    if (strategy.qualityThreshold > 90) {
      return ['high', 'medium'];
    }
    
    return ['medium'];
  }

  private determineImageQualities(strategy: OptimizationStrategy): string[] {
    if (strategy.targetSizeReduction > 60) {
      return ['medium', 'small'];
    }
    
    return ['large', 'medium'];
  }

  private async optimizeImage(filePath: string, options: any): Promise<any[]> {
    // Implementation for image optimization using Sharp
    const outputs = [];
    
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // Generate WebP version (usually smaller)
    const webpBuffer = await image
      .webp({ quality: options.optimizeFor === 'size' ? 70 : 85 })
      .toBuffer();
    
    // Generate JPEG version
    const jpegBuffer = await image
      .jpeg({ quality: options.optimizeFor === 'size' ? 75 : 90, progressive: true })
      .toBuffer();

    outputs.push({
      quality: 'webp',
      format: 'webp',
      size: webpBuffer.length,
      url: `/optimized/${Date.now()}-optimized.webp`,
      optimizations: ['format_conversion', 'quality_adjustment'],
    });

    outputs.push({
      quality: 'jpeg',
      format: 'jpeg',
      size: jpegBuffer.length,
      url: `/optimized/${Date.now()}-optimized.jpg`,
      optimizations: ['progressive_encoding', 'quality_adjustment'],
    });

    return outputs;
  }

  private async optimizeVideo(filePath: string, options: any): Promise<any[]> {
    // Use existing media processor with optimized settings
    const result = await mediaProcessor.processMedia(filePath, {
      type: 'video',
      ...options,
    });
    
    return result.outputs.map(output => ({
      quality: output.quality,
      format: output.format,
      size: output.size,
      url: output.url,
      optimizations: ['transcoding', 'bitrate_optimization', 'keyframe_optimization'],
    }));
  }

  private async optimizeAudio(filePath: string, options: any): Promise<any[]> {
    // Use existing media processor with optimized settings
    const result = await mediaProcessor.processMedia(filePath, {
      type: 'audio',
      ...options,
    });
    
    return result.outputs.map(output => ({
      quality: output.quality,
      format: output.format,
      size: output.size,
      url: output.url,
      optimizations: ['format_conversion', 'bitrate_optimization', 'normalization'],
    }));
  }

  private calculateQualityScore(outputs: any[], strategy: OptimizationStrategy): number {
    // Calculate quality score based on strategy and outputs
    const baseScore = strategy.qualityThreshold;
    
    // Adjust based on number of outputs (more = better adaptive experience)
    const outputBonus = Math.min(outputs.length * 5, 20);
    
    return Math.min(100, baseScore + outputBonus);
  }
}

// Export singleton instance
export const contentOptimizer = new ContentOptimizer();

// Convenience functions for common optimization tasks
export async function optimizeForMobile(filePath: string, contentType: ContentType) {
  return contentOptimizer.optimizeContent(filePath, contentType, {
    strategy: 'mobile',
    targetDevice: 'mobile',
    targetConnection: '4g',
  });
}

export async function optimizeForStreaming(filePath: string, contentType: ContentType) {
  return contentOptimizer.optimizeContent(filePath, contentType, {
    strategy: 'streaming',
    targetDevice: 'desktop',
    targetConnection: 'wifi',
  });
}

export async function optimizeForSize(filePath: string, contentType: ContentType) {
  return contentOptimizer.optimizeContent(filePath, contentType, {
    strategy: 'aggressive',
  });
}

export async function optimizeForQuality(filePath: string, contentType: ContentType) {
  return contentOptimizer.optimizeContent(filePath, contentType, {
    strategy: 'quality',
  });
}