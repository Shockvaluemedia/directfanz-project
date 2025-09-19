import { logger } from './logger';

// GDPR and privacy compliance types
export interface GDPRRequest {
  id: string;
  userId: string;
  type: 'DATA_EXPORT' | 'DATA_DELETION' | 'DATA_PORTABILITY' | 'DATA_RECTIFICATION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  requestDate: Date;
  completionDate?: Date;
  reason?: string;
  email: string;
  verificationToken?: string;
}

export interface UserData {
  personalInfo: {
    name: string;
    email: string;
    dateOfBirth?: Date;
    location?: string;
    phoneNumber?: string;
  };
  accountInfo: {
    username: string;
    role: string;
    createdAt: Date;
    lastLogin?: Date;
    emailVerified: boolean;
    preferences: Record<string, any>;
  };
  subscriptions?: Array<{
    artistId: string;
    tierName: string;
    startDate: Date;
    endDate?: Date;
    amount: number;
  }>;
  content?: Array<{
    id: string;
    title: string;
    type: string;
    createdAt: Date;
    viewCount?: number;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    date: Date;
    description: string;
    status: string;
  }>;
  interactions?: Array<{
    type: string;
    targetId: string;
    date: Date;
    metadata?: Record<string, any>;
  }>;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'COOKIES' | 'MARKETING' | 'ANALYTICS' | 'FUNCTIONAL' | 'NECESSARY';
  granted: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  source: 'BANNER' | 'SETTINGS' | 'REGISTRATION' | 'API';
  version: string; // Version of privacy policy/terms
}

export interface AgeVerification {
  userId: string;
  dateOfBirth: Date;
  verificationMethod: 'SELF_DECLARED' | 'ID_VERIFICATION' | 'PARENTAL_CONSENT';
  verifiedAt: Date;
  isMinor: boolean;
  parentalConsentRequired: boolean;
  parentalConsentGiven?: boolean;
}

// GDPR Compliance Service
export class GDPRComplianceService {
  // Submit a GDPR request
  static async submitRequest(
    userId: string,
    type: GDPRRequest['type'],
    email: string,
    reason?: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const requestId = this.generateRequestId();
      const verificationToken = this.generateVerificationToken();

      const request: GDPRRequest = {
        id: requestId,
        userId,
        type,
        status: 'PENDING',
        requestDate: new Date(),
        email,
        reason,
        verificationToken,
      };

      // In production, save to database
      await this.saveRequest(request);

      // Send verification email
      await this.sendVerificationEmail(email, type, verificationToken);

      logger.info('GDPR request submitted', {
        requestId,
        userId,
        type,
        email: this.maskEmail(email),
      });

      return { success: true, requestId };
    } catch (error) {
      logger.error(
        'Failed to submit GDPR request',
        {
          userId,
          type,
          email: this.maskEmail(email),
        },
        error as Error
      );

      return { success: false, error: (error as Error).message };
    }
  }

  // Verify and process GDPR request
  static async verifyAndProcessRequest(
    requestId: string,
    token: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const request = await this.getRequest(requestId);

      if (!request) {
        return { success: false, error: 'Request not found' };
      }

      if (request.verificationToken !== token) {
        return { success: false, error: 'Invalid verification token' };
      }

      if (request.status !== 'PENDING') {
        return { success: false, error: 'Request already processed' };
      }

      // Update status to in progress
      await this.updateRequestStatus(requestId, 'IN_PROGRESS');

      // Process the request based on type
      switch (request.type) {
        case 'DATA_EXPORT':
          await this.processDataExport(request);
          break;
        case 'DATA_DELETION':
          await this.processDataDeletion(request);
          break;
        case 'DATA_PORTABILITY':
          await this.processDataPortability(request);
          break;
        case 'DATA_RECTIFICATION':
          await this.processDataRectification(request);
          break;
      }

      await this.updateRequestStatus(requestId, 'COMPLETED');

      logger.info('GDPR request processed successfully', {
        requestId,
        type: request.type,
        userId: request.userId,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to process GDPR request', { requestId }, error as Error);
      await this.updateRequestStatus(requestId, 'REJECTED');
      return { success: false, error: (error as Error).message };
    }
  }

  // Export user data
  static async exportUserData(userId: string): Promise<UserData> {
    // In production, collect data from all relevant tables/services
    const userData: UserData = {
      personalInfo: await this.getUserPersonalInfo(userId),
      accountInfo: await this.getUserAccountInfo(userId),
      subscriptions: await this.getUserSubscriptions(userId),
      content: await this.getUserContent(userId),
      payments: await this.getUserPayments(userId),
      interactions: await this.getUserInteractions(userId),
    };

    logger.info('User data exported', { userId, dataSize: JSON.stringify(userData).length });
    return userData;
  }

  // Delete user data (Right to be forgotten)
  static async deleteUserData(
    userId: string,
    retainLegal = true
  ): Promise<{
    deleted: string[];
    retained: string[];
  }> {
    const deleted: string[] = [];
    const retained: string[] = [];

    try {
      // Delete personal information
      await this.anonymizePersonalInfo(userId);
      deleted.push('Personal information');

      // Delete content (if user-generated)
      await this.deleteUserContent(userId);
      deleted.push('User-generated content');

      // Delete interactions and preferences
      await this.deleteUserInteractions(userId);
      deleted.push('User interactions');

      // Retain financial records for legal/tax purposes
      if (retainLegal) {
        retained.push('Financial transactions (legal requirement)');
        retained.push('Subscription history (anonymized)');
      } else {
        await this.deleteFinancialRecords(userId);
        deleted.push('Financial records');
      }

      // Delete or anonymize account
      await this.anonymizeAccount(userId);
      deleted.push('Account data');

      logger.info('User data deletion completed', {
        userId,
        deleted: deleted.length,
        retained: retained.length,
      });

      return { deleted, retained };
    } catch (error) {
      logger.error('User data deletion failed', { userId }, error as Error);
      throw error;
    }
  }

  // Age verification
  static async verifyAge(
    userId: string,
    dateOfBirth: Date,
    method: AgeVerification['verificationMethod'] = 'SELF_DECLARED'
  ): Promise<AgeVerification> {
    const age = this.calculateAge(dateOfBirth);
    const isMinor = age < 18;
    const parentalConsentRequired = isMinor && age >= 13; // COPPA compliance

    const verification: AgeVerification = {
      userId,
      dateOfBirth,
      verificationMethod: method,
      verifiedAt: new Date(),
      isMinor,
      parentalConsentRequired,
    };

    // Save verification record
    await this.saveAgeVerification(verification);

    logger.info('Age verification completed', {
      userId,
      age,
      isMinor,
      parentalConsentRequired,
      method,
    });

    return verification;
  }

  // Consent management
  static async recordConsent(
    userId: string,
    consentType: ConsentRecord['consentType'],
    granted: boolean,
    source: ConsentRecord['source'],
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const consentId = this.generateConsentId();

    const consent: ConsentRecord = {
      id: consentId,
      userId,
      consentType,
      granted,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      source,
      version: '1.0', // Current privacy policy version
    };

    await this.saveConsentRecord(consent);

    logger.info('Consent recorded', {
      consentId,
      userId,
      consentType,
      granted,
      source,
    });

    return consentId;
  }

  // Get user consents
  static async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    return await this.getConsentRecords(userId);
  }

  // Check if user has given specific consent
  static async hasConsent(
    userId: string,
    consentType: ConsentRecord['consentType']
  ): Promise<boolean> {
    const consents = await this.getUserConsents(userId);
    const latestConsent = consents
      .filter(c => c.consentType === consentType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    return latestConsent?.granted ?? false;
  }

  // Privacy-compliant data processing
  static async processPersonalData(
    userId: string,
    processingPurpose: 'SERVICE_DELIVERY' | 'MARKETING' | 'ANALYTICS' | 'LEGAL_COMPLIANCE',
    dataTypes: string[]
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check if user has given consent for this type of processing
    const requiredConsents: ConsentRecord['consentType'][] = [];

    switch (processingPurpose) {
      case 'SERVICE_DELIVERY':
        requiredConsents.push('FUNCTIONAL', 'NECESSARY');
        break;
      case 'MARKETING':
        requiredConsents.push('MARKETING');
        break;
      case 'ANALYTICS':
        requiredConsents.push('ANALYTICS');
        break;
      case 'LEGAL_COMPLIANCE':
        // Legal basis, no consent required
        return { allowed: true };
    }

    for (const consentType of requiredConsents) {
      const hasConsent = await this.hasConsent(userId, consentType);
      if (!hasConsent) {
        return {
          allowed: false,
          reason: `User has not consented to ${consentType.toLowerCase()} data processing`,
        };
      }
    }

    return { allowed: true };
  }

  // Private helper methods
  private static generateRequestId(): string {
    return `gdpr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private static generateVerificationToken(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }

  private static generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.substring(0, 2) + '*'.repeat(Math.max(0, localPart.length - 2));
    return `${maskedLocal}@${domain}`;
  }

  private static calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  // Placeholder methods for database operations (implement with your ORM/database)
  private static async saveRequest(request: GDPRRequest): Promise<void> {
    // TODO: Implement database save
    logger.debug('Saving GDPR request', { requestId: request.id });
  }

  private static async getRequest(requestId: string): Promise<GDPRRequest | null> {
    // TODO: Implement database retrieval
    logger.debug('Getting GDPR request', { requestId });
    return null;
  }

  private static async updateRequestStatus(
    requestId: string,
    status: GDPRRequest['status']
  ): Promise<void> {
    // TODO: Implement database update
    logger.debug('Updating GDPR request status', { requestId, status });
  }

  private static async sendVerificationEmail(
    email: string,
    type: string,
    token: string
  ): Promise<void> {
    // TODO: Integrate with email service
    logger.debug('Sending verification email', { email: this.maskEmail(email), type });
  }

  private static async processDataExport(request: GDPRRequest): Promise<void> {
    const userData = await this.exportUserData(request.userId);
    // TODO: Send data export via secure email or download link
    logger.info('Data export processed', { requestId: request.id });
  }

  private static async processDataDeletion(request: GDPRRequest): Promise<void> {
    await this.deleteUserData(request.userId);
    logger.info('Data deletion processed', { requestId: request.id });
  }

  private static async processDataPortability(request: GDPRRequest): Promise<void> {
    // TODO: Implement data portability (structured export)
    logger.info('Data portability processed', { requestId: request.id });
  }

  private static async processDataRectification(request: GDPRRequest): Promise<void> {
    // TODO: Implement data correction process
    logger.info('Data rectification processed', { requestId: request.id });
  }

  // Data retrieval methods (implement with your database)
  private static async getUserPersonalInfo(userId: string): Promise<UserData['personalInfo']> {
    // TODO: Implement
    return {
      name: 'User Name',
      email: 'user@example.com',
    };
  }

  private static async getUserAccountInfo(userId: string): Promise<UserData['accountInfo']> {
    // TODO: Implement
    return {
      username: 'username',
      role: 'USER',
      createdAt: new Date(),
      emailVerified: true,
      preferences: {},
    };
  }

  private static async getUserSubscriptions(userId: string): Promise<UserData['subscriptions']> {
    // TODO: Implement
    return [];
  }

  private static async getUserContent(userId: string): Promise<UserData['content']> {
    // TODO: Implement
    return [];
  }

  private static async getUserPayments(userId: string): Promise<UserData['payments']> {
    // TODO: Implement
    return [];
  }

  private static async getUserInteractions(userId: string): Promise<UserData['interactions']> {
    // TODO: Implement
    return [];
  }

  // Data deletion methods
  private static async anonymizePersonalInfo(userId: string): Promise<void> {
    // TODO: Implement
    logger.debug('Anonymizing personal info', { userId });
  }

  private static async deleteUserContent(userId: string): Promise<void> {
    // TODO: Implement
    logger.debug('Deleting user content', { userId });
  }

  private static async deleteUserInteractions(userId: string): Promise<void> {
    // TODO: Implement
    logger.debug('Deleting user interactions', { userId });
  }

  private static async deleteFinancialRecords(userId: string): Promise<void> {
    // TODO: Implement
    logger.debug('Deleting financial records', { userId });
  }

  private static async anonymizeAccount(userId: string): Promise<void> {
    // TODO: Implement
    logger.debug('Anonymizing account', { userId });
  }

  private static async saveAgeVerification(verification: AgeVerification): Promise<void> {
    // TODO: Implement
    logger.debug('Saving age verification', { userId: verification.userId });
  }

  private static async saveConsentRecord(consent: ConsentRecord): Promise<void> {
    // TODO: Implement
    logger.debug('Saving consent record', { consentId: consent.id });
  }

  private static async getConsentRecords(userId: string): Promise<ConsentRecord[]> {
    // TODO: Implement
    return [];
  }
}

// Cookie consent utilities
export class CookieConsent {
  static readonly COOKIE_CATEGORIES = {
    NECESSARY: 'necessary',
    FUNCTIONAL: 'functional',
    ANALYTICS: 'analytics',
    MARKETING: 'marketing',
  } as const;

  // Generate cookie consent banner HTML
  static generateConsentBanner(): string {
    return `
      <div id="cookie-consent-banner" class="cookie-consent-banner" style="display: none;">
        <div class="cookie-consent-content">
          <h3>Cookie Consent</h3>
          <p>We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
             You can manage your preferences below.</p>
          
          <div class="cookie-categories">
            <label>
              <input type="checkbox" name="cookies" value="necessary" checked disabled>
              <span>Necessary Cookies (Required)</span>
            </label>
            <label>
              <input type="checkbox" name="cookies" value="functional">
              <span>Functional Cookies</span>
            </label>
            <label>
              <input type="checkbox" name="cookies" value="analytics">
              <span>Analytics Cookies</span>
            </label>
            <label>
              <input type="checkbox" name="cookies" value="marketing">
              <span>Marketing Cookies</span>
            </label>
          </div>
          
          <div class="cookie-actions">
            <button onclick="acceptAllCookies()">Accept All</button>
            <button onclick="acceptSelectedCookies()">Accept Selected</button>
            <button onclick="rejectOptionalCookies()">Reject Optional</button>
            <a href="/privacy" target="_blank">Privacy Policy</a>
          </div>
        </div>
      </div>
    `;
  }

  // Generate cookie consent JavaScript
  static generateConsentScript(): string {
    return `
      <script>
        // Cookie consent management
        function showCookieConsent() {
          if (!getCookieConsent()) {
            document.getElementById('cookie-consent-banner').style.display = 'block';
          }
        }

        function getCookieConsent() {
          const consent = localStorage.getItem('cookie-consent');
          return consent ? JSON.parse(consent) : null;
        }

        function setCookieConsent(categories) {
          const consent = {
            categories: categories,
            timestamp: new Date().toISOString(),
            version: '1.0'
          };
          localStorage.setItem('cookie-consent', JSON.stringify(consent));
          
          // Record consent via API
          fetch('/api/consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categories, source: 'BANNER' })
          });
          
          document.getElementById('cookie-consent-banner').style.display = 'none';
          initializeApprovedServices(categories);
        }

        function acceptAllCookies() {
          setCookieConsent(['necessary', 'functional', 'analytics', 'marketing']);
        }

        function acceptSelectedCookies() {
          const selected = Array.from(document.querySelectorAll('input[name="cookies"]:checked'))
            .map(input => input.value);
          setCookieConsent(selected);
        }

        function rejectOptionalCookies() {
          setCookieConsent(['necessary']);
        }

        function initializeApprovedServices(categories) {
          if (categories.includes('analytics')) {
            // Initialize analytics
            console.log('Analytics enabled');
          }
          if (categories.includes('marketing')) {
            // Initialize marketing tools
            console.log('Marketing enabled');
          }
          if (categories.includes('functional')) {
            // Initialize functional features
            console.log('Functional cookies enabled');
          }
        }

        // Show consent banner on page load
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(showCookieConsent, 1000);
        });
      </script>
    `;
  }
}

// Terms of Service and Privacy Policy templates
export const LegalTemplates = {
  privacyPolicy: `
# Privacy Policy

## Information We Collect
- Personal information (name, email, date of birth)
- Account information (username, preferences)
- Payment information (processed securely via Stripe)
- Usage data (interactions, content views)
- Technical data (IP address, browser information)

## How We Use Your Information
- Provide and improve our services
- Process payments and subscriptions
- Communicate with you about your account
- Analyze usage patterns (with consent)
- Marketing communications (with consent)

## Your Rights (GDPR)
- Right to access your personal data
- Right to rectification of incorrect data
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability
- Right to object to processing

## Data Retention
We retain your personal data for as long as necessary to provide our services and comply with legal obligations.

## International Transfers
Your data may be transferred to and processed in countries outside your jurisdiction. We ensure appropriate safeguards are in place.

## Contact Us
For privacy-related questions or to exercise your rights, contact us at privacy@directfan.com.

Last updated: ${new Date().toLocaleDateString()}
  `,

  termsOfService: `
# Terms of Service

## Acceptance of Terms
By accessing and using Direct Fan, you accept and agree to be bound by these terms.

## Age Requirements
You must be at least 13 years old to use our services. If you are between 13-18, you need parental consent.

## Account Registration
- Provide accurate and complete information
- Maintain the security of your account
- You are responsible for all activities under your account

## Prohibited Content
- Illegal, harmful, or offensive content
- Copyrighted material without permission
- Spam or misleading information
- Adult content involving minors

## Payment Terms
- Subscription fees are billed in advance
- All fees are non-refundable except where required by law
- We may change subscription prices with notice

## Intellectual Property
- Users retain rights to their original content
- Users grant Direct Fan a license to display and distribute their content
- Respect the intellectual property rights of others

## Termination
We may terminate accounts for violations of these terms or for any reason with notice.

## Limitation of Liability
Our liability is limited to the maximum extent permitted by law.

## Contact Information
Questions about these terms can be sent to legal@directfan.com.

Last updated: ${new Date().toLocaleDateString()}
  `,
};

export default {
  GDPRComplianceService,
  CookieConsent,
  LegalTemplates,
};
