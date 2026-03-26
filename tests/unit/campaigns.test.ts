/**
 * Unit tests for campaigns API validation
 */
import { z } from 'zod';

// Replicate the validation schemas from the campaigns route
const createCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['CONTEST', 'CHALLENGE', 'PROMOTION', 'GIVEAWAY']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  maxParticipants: z.number().int().positive().optional(),
  entryFee: z.number().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  targetMetric: z.enum(['SUBSCRIBERS', 'VIEWS', 'ENGAGEMENT', 'REVENUE']),
  targetValue: z.number().int().positive(),
  totalPrizePool: z.number().min(0).default(0),
  tags: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

describe('Campaign Create Validation', () => {
  const validCampaign = {
    title: 'Summer Music Challenge',
    type: 'CONTEST' as const,
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-08-01T00:00:00.000Z',
    targetMetric: 'SUBSCRIBERS' as const,
    targetValue: 100,
  };

  it('accepts valid campaign data', () => {
    const result = createCampaignSchema.safeParse(validCampaign);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createCampaignSchema.safeParse({ ...validCampaign, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = createCampaignSchema.safeParse({ ...validCampaign, title: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = createCampaignSchema.safeParse({ ...validCampaign, type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime format', () => {
    const result = createCampaignSchema.safeParse({ ...validCampaign, startDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects negative entry fee', () => {
    const result = createCampaignSchema.safeParse({ ...validCampaign, entryFee: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects zero target value', () => {
    const result = createCampaignSchema.safeParse({ ...validCampaign, targetValue: 0 });
    expect(result.success).toBe(false);
  });

  it('defaults currency to USD', () => {
    const result = createCampaignSchema.parse(validCampaign);
    expect(result.currency).toBe('USD');
  });

  it('accepts optional fields', () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaign,
      description: 'A fun challenge',
      maxParticipants: 50,
      entryFee: 5.99,
      totalPrizePool: 1000,
      tags: ['music', 'summer'],
    });
    expect(result.success).toBe(true);
  });
});

describe('Campaign List Query Validation', () => {
  it('defaults page to 1 and limit to 20', () => {
    const result = listQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string numbers', () => {
    const result = listQuerySchema.parse({ page: '3', limit: '10' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
  });

  it('rejects limit over 50', () => {
    const result = listQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(false);
  });

  it('rejects page 0', () => {
    const result = listQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });
});
