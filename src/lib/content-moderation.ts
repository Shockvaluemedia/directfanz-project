import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';
import { prisma } from './prisma';

interface ModerationResult {
  flagged: boolean;
  confidence: number;
  categories: string[];
  reason?: string;
}

let rekognitionClient: RekognitionClient | null = null;

function getRekognitionClient(): RekognitionClient {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return rekognitionClient;
}

export class AIContentModerator {
  async moderateText(content: string): Promise<ModerationResult> {
    // In production, integrate with OpenAI Moderation API or similar
    const flaggedPatterns = [
      /\b(hate|violence|harassment)\b/i,
      /\b(explicit|adult|nsfw)\b/i,
      /\b(spam|scam|fraud)\b/i,
    ];

    const categories: string[] = [];
    let flagged = false;
    let confidence = 0;

    for (const pattern of flaggedPatterns) {
      if (pattern.test(content)) {
        flagged = true;
        confidence = Math.max(confidence, 0.8);
        
        if (pattern.source.includes('hate|violence')) {
          categories.push('hate_speech');
        } else if (pattern.source.includes('explicit|adult')) {
          categories.push('adult_content');
        } else if (pattern.source.includes('spam|scam')) {
          categories.push('spam');
        }
      }
    }

    return {
      flagged,
      confidence,
      categories,
      reason: flagged ? 'Content flagged by AI moderation' : undefined,
    };
  }

  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    try {
      const client = getRekognitionClient();

      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const imageBytes = new Uint8Array(arrayBuffer);

      const command = new DetectModerationLabelsCommand({
        Image: {
          Bytes: imageBytes,
        },
        MinConfidence: 60,
      });

      const result = await client.send(command);
      const labels = result.ModerationLabels || [];

      if (labels.length === 0) {
        return {
          flagged: false,
          confidence: 0,
          categories: [],
        };
      }

      const categories = [...new Set(labels.map((label) => label.Name || 'Unknown'))];
      const confidence = Math.max(...labels.map((label) => (label.Confidence || 0) / 100));

      return {
        flagged: true,
        confidence,
        categories,
        reason: `Detected: ${categories.join(', ')}`,
      };
    } catch (error) {
      console.error('Rekognition moderation failed, falling back to unflagged:', error);
      return {
        flagged: false,
        confidence: 0,
        categories: [],
      };
    }
  }

  async queueForReview(contentId: string, moderationResult: ModerationResult): Promise<void> {
    await prisma.moderation_logs.create({
      data: {
        contentId,
        result: JSON.stringify(moderationResult),
        status: 'PENDING_REVIEW',
        userId: 'system',
      },
    });

    try {
      await prisma.content.update({
        where: { id: contentId },
        data: { status: 'UNDER_REVIEW' },
      });
    } catch (error) {
      console.error(`Failed to update content status for ${contentId}:`, error);
    }
  }
}

export const aiModerator = new AIContentModerator();