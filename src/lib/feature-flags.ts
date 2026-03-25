export const FeatureFlags = {
  AI_RECOMMENDATIONS: process.env.FEATURE_AI_RECOMMENDATIONS === 'true',
  AI_REVENUE_OPTIMIZATION: process.env.FEATURE_AI_REVENUE === 'true',
  AI_PREDICTIVE_ANALYTICS: process.env.FEATURE_AI_ANALYTICS === 'true',
  AI_CONTENT_MODERATION: process.env.FEATURE_AI_MODERATION === 'true',
  AI_AGENTS_ENABLED: process.env.FEATURE_AI_AGENTS === 'true',
} as const;

export function isFeatureEnabled(flag: keyof typeof FeatureFlags): boolean {
  return FeatureFlags[flag] ?? false;
}
