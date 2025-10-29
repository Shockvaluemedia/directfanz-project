import { ContentOptimizer, contentOptimizer, OPTIMIZATION_STRATEGIES } from '../lib/content-optimization';

describe('ContentOptimizer', () => {
  let service: ContentOptimizer;

  beforeEach(() => {
    service = contentOptimizer;
  });

  describe('Strategy Management', () => {
    test('should have predefined optimization strategies', () => {
      expect(OPTIMIZATION_STRATEGIES).toBeDefined();
      expect(Object.keys(OPTIMIZATION_STRATEGIES)).toHaveLength(5);
      expect(Object.keys(OPTIMIZATION_STRATEGIES)).toEqual([
        'aggressive', 'balanced', 'quality', 'mobile', 'streaming'
      ]);
    });

    test('should have correct strategy properties', () => {
      expect(OPTIMIZATION_STRATEGIES.balanced).toHaveProperty('name');
      expect(OPTIMIZATION_STRATEGIES.balanced).toHaveProperty('description');
      expect(OPTIMIZATION_STRATEGIES.balanced).toHaveProperty('targetSizeReduction');
      expect(OPTIMIZATION_STRATEGIES.balanced).toHaveProperty('qualityThreshold');
    });
  });

  describe('Content Analysis', () => {
    test('should analyze image content correctly', async () => {
      const mockFilePath = 'test-image.jpg';
      
      const analysis = await service.analyzeContent(mockFilePath, 'IMAGE' as any);
      
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('recommendedStrategy');
      expect(analysis).toHaveProperty('dimensions');
      expect(['low', 'medium', 'high']).toContain(analysis.complexity);
      expect(typeof analysis.recommendedStrategy).toBe('string');
    });

    test('should provide fallback analysis on error', async () => {
      const mockFilePath = 'invalid-file.xyz';
      
      const analysis = await service.analyzeContent(mockFilePath, 'IMAGE' as any);
      
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('recommendedStrategy');
      expect(['low', 'medium', 'high']).toContain(analysis.complexity);
      expect(typeof analysis.recommendedStrategy).toBe('string');
    });
  });

  describe('Content Optimization', () => {
    test('should optimize image content with balanced strategy', async () => {
      const mockFilePath = 'test-image.jpg';
      
      const result = await service.optimizeContent(mockFilePath, 'IMAGE' as any, {
        strategy: 'balanced'
      });

      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('optimizedSize');
      expect(result).toHaveProperty('sizeReduction');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('outputs');
      expect(Array.isArray(result.outputs)).toBe(true);
    });

    test('should optimize with mobile strategy', async () => {
      const mockFilePath = 'test-image.jpg';
      
      const result = await service.optimizeContent(mockFilePath, 'IMAGE' as any, {
        strategy: 'mobile',
        targetDevice: 'mobile',
        targetConnection: '3g'
      });

      expect(result).toHaveProperty('strategy');
      expect(result.sizeReduction).toBeGreaterThan(0);
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });
  });
});
