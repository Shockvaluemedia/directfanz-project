interface ModerationResult {
  flagged: boolean;
  confidence: number;
  categories: string[];
  reason?: string;
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
    // In production, integrate with AWS Rekognition or similar
    return {
      flagged: false,
      confidence: 0.1,
      categories: [],
    };
  }

  async queueForReview(contentId: string, moderationResult: ModerationResult): Promise<void> {
    // Queue flagged content for human review
    console.log(`Content ${contentId} queued for review:`, moderationResult);
  }
}

export const aiModerator = new AIContentModerator();