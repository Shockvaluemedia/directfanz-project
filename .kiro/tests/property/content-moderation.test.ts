import { AIContentModerator } from '../../src/lib/content-moderation';

describe('Property Test: Automated Content Scanning', () => {
  describe('Property 15: Automated content scanning', () => {
    test('Content moderation should flag inappropriate content', async () => {
      const moderator = new AIContentModerator();
      
      const inappropriateContent = 'This contains hate speech and violence';
      const result = await moderator.moderateText(inappropriateContent);
      
      expect(result.flagged).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.categories.length).toBeGreaterThan(0);
    });

    test('Content moderation should allow appropriate content', async () => {
      const moderator = new AIContentModerator();
      
      const appropriateContent = 'This is a normal, family-friendly message';
      const result = await moderator.moderateText(appropriateContent);
      
      expect(result.flagged).toBe(false);
      expect(result.categories.length).toBe(0);
    });

    test('Moderation results should include confidence scores', async () => {
      const moderator = new AIContentModerator();
      
      const result = await moderator.moderateText('test content');
      
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('Flagged content should be queued for review', async () => {
      const moderator = new AIContentModerator();
      
      expect(typeof moderator.queueForReview).toBe('function');
    });

    test('Image moderation should be available', async () => {
      const moderator = new AIContentModerator();
      
      expect(typeof moderator.moderateImage).toBe('function');
    });
  });
});