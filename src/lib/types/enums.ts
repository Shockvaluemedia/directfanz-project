// Temporary enum definitions to resolve import errors
// These should be replaced with proper enum definitions later

export enum UserRole {
  ARTIST = 'ARTIST',
  FAN = 'FAN',
}

export enum ContentType {
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
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
  CANCELLED = 'CANCELLED',
}

export enum ChallengeType {
  CREATIVE = 'CREATIVE',
  COMPETITIVE = 'COMPETITIVE',
  SOCIAL = 'SOCIAL',
  EDUCATIONAL = 'EDUCATIONAL',
}

export enum ChallengeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SubmissionContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
}

export enum RewardType {
  CONTENT = 'CONTENT',
  MERCHANDISE = 'MERCHANDISE',
  EXPERIENCE = 'EXPERIENCE',
  MONEY = 'MONEY',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum CampaignType {
  ENGAGEMENT = 'ENGAGEMENT',
  CREATIVE = 'CREATIVE',
  PROMOTIONAL = 'PROMOTIONAL',
  COMMUNITY = 'COMMUNITY',
}

export enum CampaignMetric {
  VIEWS = 'VIEWS',
  LIKES = 'LIKES',
  SHARES = 'SHARES',
  COMMENTS = 'COMMENTS',
  ENGAGEMENT_RATE = 'ENGAGEMENT_RATE',
  CONVERSION_RATE = 'CONVERSION_RATE',
}

export enum SubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}
