import { prisma } from './prisma';

interface ModerationResult {
  flagged: boolean;
  confidence: number;
  categories: string[];
  reason?: string;
}

export class AIContentModerator {
  async moderateText(content: string): Promise<ModerationResult> {
    // Use OpenAI Moderation API if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: content }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = data.results?.[0];
          if (result) {
            const flaggedCategories = Object.entries(result.categories)
              .filter(([, flagged]) => flagged)
              .map(([category]) => category);

            return {
              flagged: result.flagged,
              confidence: Math.max(...Object.values(result.category_scores) as number[]),
              categories: flaggedCategories,
              reason: result.flagged ? `Detected: ${flaggedCategories.join(', ')}` : undefined,
            };
          }
        }
      } catch (error) {
        console.error('OpenAI moderation failed, using pattern fallback:', error);
      }
    }

    // Fallback: pattern-based moderation
    const flaggedPatterns = [
      /\b(hate|violence|harassment)\b/i,
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
        } else if (pattern.source.includes('spam|scam')) {
          categories.push('spam');
        }
      }
    }

    return {
      flagged,
      confidence,
      categories,
      reason: flagged ? 'Content flagged by moderation' : undefined,
    };
  }

  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    // Use OpenAI Vision moderation if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: [{ type: 'image_url', image_url: { url: imageUrl } }],
            model: 'omni-moderation-latest',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = data.results?.[0];
          if (result) {
            const flaggedCategories = Object.entries(result.categories)
              .filter(([, flagged]) => flagged)
              .map(([category]) => category);

            return {
              flagged: result.flagged,
              confidence: Math.max(...Object.values(result.category_scores) as number[]),
              categories: flaggedCategories,
              reason: result.flagged ? `Detected: ${flaggedCategories.join(', ')}` : undefined,
            };
          }
        }
      } catch (error) {
        console.error('OpenAI image moderation failed:', error);
      }
    }

    // No image moderation available without OpenAI
    return {
      flagged: false,
      confidence: 0,
      categories: [],
    };
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
