// Enum definitions that are missing from the generated Prisma client
// These correspond to string fields in the schema that should be treated as enums

export enum UserRole {
  ARTIST = 'ARTIST',
  FAN = 'FAN',
  ADMIN = 'ADMIN',
}

export enum ContentType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
}

export enum ContentVisibility {
  PUBLIC = 'PUBLIC',
  TIER_LOCKED = 'TIER_LOCKED',
  PRIVATE = 'PRIVATE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CANCELED = 'CANCELED',
  PAST_DUE = 'PAST_DUE',
  TRIALING = 'TRIALING',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  CANCELED = 'CANCELED',
}

export enum CampaignType {
  ENGAGEMENT = 'ENGAGEMENT',
  CREATIVE = 'CREATIVE',
  SOCIAL = 'SOCIAL',
  CHALLENGE = 'CHALLENGE',
}

export enum CampaignMetric {
  VIEWS = 'VIEWS',
  LIKES = 'LIKES',
  SHARES = 'SHARES',
  COMMENTS = 'COMMENTS',
  SUBSCRIPTIONS = 'SUBSCRIPTIONS',
}

export enum ChallengeType {
  CREATIVE = 'CREATIVE',
  ENGAGEMENT = 'ENGAGEMENT',
  SOCIAL = 'SOCIAL',
  SKILL = 'SKILL',
}

export enum ChallengeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  PAUSED = 'PAUSED',
}

export enum SubmissionContentType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  TEXT = 'TEXT',
  LINK = 'LINK',
}

export enum RewardType {
  MONETARY = 'MONETARY',
  DIGITAL = 'DIGITAL',
  PHYSICAL = 'PHYSICAL',
  ACCESS = 'ACCESS',
  EXPERIENCE = 'EXPERIENCE',
}

// Export all enums as a single object for easy import
export const Enums = {
  UserRole,
  ContentType,
  ContentVisibility,
  SubscriptionStatus,
  CampaignStatus,
  CampaignType,
  CampaignMetric,
  ChallengeType,
  ChallengeStatus,
  SubmissionContentType,
  RewardType,
};
