// Shared notification types - safe for client and server imports
export interface NotificationPreferences {
  email: {
    enabled: boolean;
    subscriptions: boolean;
    payments: boolean;
    messages: boolean;
    content: boolean;
    comments: boolean;
    marketing: boolean;
    security: boolean;
  };
  push: {
    enabled: boolean;
    subscriptions: boolean;
    payments: boolean;
    messages: boolean;
    content: boolean;
    comments: boolean;
    system: boolean;
  };
  inApp: {
    enabled: boolean;
    all: boolean;
  };
  sms: {
    enabled: boolean;
    security: boolean;
    payments: boolean;
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    enabled: true,
    subscriptions: true,
    payments: true,
    messages: true,
    content: false,
    comments: true,
    marketing: false,
    security: true,
  },
  push: {
    enabled: true,
    subscriptions: true,
    payments: true,
    messages: true,
    content: false,
    comments: true,
    system: true,
  },
  inApp: {
    enabled: true,
    all: true,
  },
  sms: {
    enabled: false,
    security: true,
    payments: false,
  },
};
