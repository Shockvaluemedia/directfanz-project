import { BaseAgent, AgentType, AgentTask, AgentResponse, AgentConfig } from '../base-agent';
import { Logger } from '@/lib/logger';
import type { Database } from '@/lib/database/types';

export interface ModerationResult {
  contentId: string;
  status: 'approved' | 'rejected' | 'flagged' | 'pending_review';
  confidence: number;
  violations: ModerationViolation[];
  suggestedActions: ModerationAction[];
  metadata: {
    scanTimestamp: Date;
    scanDuration: number;
    rulesApplied: string[];
    aiModelUsed: string;
  };
}

export interface ModerationViolation {
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: {
    start?: number;
    end?: number;
    coordinates?: { x: number; y: number; width: number; height: number };
  };
  confidence: number;
  rule: string;
}

export interface ModerationAction {
  type: 'approve' | 'reject' | 'edit' | 'blur' | 'age_gate' | 'human_review';
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  automated: boolean;
}

export interface ComplianceStatus {
  compliant: boolean;
  violations: PolicyViolation[];
  recommendations: string[];
  riskScore: number;
  lastChecked: Date;
}

export interface PolicyViolation {
  policyId: string;
  policyName: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  remediation: string[];
}

export interface RiskScore {
  overall: number;
  categories: {
    content: number;
    user: number;
    financial: number;
    legal: number;
  };
  factors: RiskFactor[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface RiskFactor {
  category: string;
  factor: string;
  weight: number;
  score: number;
  description: string;
}

export interface ModerationAppeal {
  appealId: string;
  contentId: string;
  userId: string;
  reason: string;
  originalDecision: ModerationResult;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
}

export interface AppealDecision {
  appealId: string;
  decision: 'upheld' | 'overturned' | 'partial';
  newStatus?: 'approved' | 'rejected' | 'flagged';
  reasoning: string;
  reviewedBy: string;
  reviewedAt: Date;
  compensationOffered?: boolean;
}

export enum ViolationType {
  NUDITY = 'nudity',
  EXPLICIT_CONTENT = 'explicit_content',
  VIOLENCE = 'violence',
  HATE_SPEECH = 'hate_speech',
  HARASSMENT = 'harassment',
  SPAM = 'spam',
  COPYRIGHT = 'copyright',
  UNDERAGE = 'underage',
  DANGEROUS_CONTENT = 'dangerous_content',
  MISINFORMATION = 'misinformation',
  PERSONAL_INFO = 'personal_info',
  FINANCIAL_FRAUD = 'financial_fraud',
  POLICY_VIOLATION = 'policy_violation',
}

export interface ContentModerationConfig extends AgentConfig {
  openaiModerationApiKey: string;
  photoDnaApiKey?: string;
  customRulesEndpoint?: string;
  strictnessLevel: 'permissive' | 'moderate' | 'strict';
  enableImageScanning: boolean;
  enableVideoScanning: boolean;
  enableTextScanning: boolean;
  enableAudioScanning: boolean;
  autoRejectThreshold: number;
  humanReviewThreshold: number;
  appealEnabled: boolean;
  maxProcessingTime: number;
  enableLearning: boolean;
  customPolicies: CustomPolicy[];
}

export interface CustomPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface PolicyRule {
  type: 'keyword' | 'pattern' | 'ai_model' | 'custom_function';
  condition: string;
  action: 'flag' | 'reject' | 'review' | 'log';
  weight: number;
}

// Content Moderation AI Agent for platform safety
export class ContentModerationAgent extends BaseAgent {
  private readonly config: ContentModerationConfig;
  private readonly appealQueue: Map<string, ModerationAppeal> = new Map();
  private readonly moderationHistory: Map<string, ModerationResult[]> = new Map();

  constructor(
    id: string,
    config: ContentModerationConfig,
    logger?: Logger,
    db?: Database
  ) {
    super(id, AgentType.CONTENT_MODERATION, config, logger, db);
    this.config = config;
  }

  public getCapabilities(): string[] {
    return [
      'content_scanning',
      'policy_compliance',
      'risk_assessment',
      'appeal_processing',
      'automated_moderation',
      'human_review_routing',
      'violation_detection',
      'content_classification',
      'batch_processing',
    ];
  }

  public validateTask(task: AgentTask): boolean {
    const validTypes = [
      'scan_content',
      'check_policy_compliance',
      'assess_risk',
      'process_appeal',
      'batch_moderate',
      'get_moderation_history',
      'update_policies',
    ];

    return validTypes.includes(task.type);
  }

  public async executeTask(task: AgentTask): Promise<AgentResponse> {
    switch (task.type) {
      case 'scan_content':
        return this.scanContent(task.payload.content);
      
      case 'check_policy_compliance':
        return this.checkPolicyCompliance(task.payload.content);
      
      case 'assess_risk':
        return this.assessRisk(task.payload.user, task.payload.activity);
      
      case 'process_appeal':
        return this.processAppeal(task.payload.appeal);
      
      case 'batch_moderate':
        return this.batchModerate(task.payload.contents);
      
      case 'get_moderation_history':
        return this.getModerationHistory(task.payload.contentId);
      
      case 'update_policies':
        return this.updatePolicies(task.payload.policies);
      
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  // Scan content for violations
  public async scanContent(content: {
    id: string;
    type: 'text' | 'image' | 'video' | 'audio';
    data: string | Buffer;
    metadata?: any;
  }): Promise<AgentResponse<ModerationResult>> {
    const startTime = Date.now();

    try {
      const violations: ModerationViolation[] = [];
      const rulesApplied: string[] = [];

      // Scan based on content type
      switch (content.type) {
        case 'text':
          const textViolations = await this.scanText(content.data as string);
          violations.push(...textViolations.violations);
          rulesApplied.push(...textViolations.rules);
          break;

        case 'image':
          if (this.config.enableImageScanning) {
            const imageViolations = await this.scanImage(content.data as Buffer);
            violations.push(...imageViolations.violations);
            rulesApplied.push(...imageViolations.rules);
          }
          break;

        case 'video':
          if (this.config.enableVideoScanning) {
            const videoViolations = await this.scanVideo(content.data as Buffer);
            violations.push(...videoViolations.violations);
            rulesApplied.push(...videoViolations.rules);
          }
          break;

        case 'audio':
          if (this.config.enableAudioScanning) {
            const audioViolations = await this.scanAudio(content.data as Buffer);
            violations.push(...violations.violations);
            rulesApplied.push(...audioViolations.rules);
          }
          break;
      }

      // Apply custom policies
      const customViolations = await this.applyCustomPolicies(content);
      violations.push(...customViolations.violations);
      rulesApplied.push(...customViolations.rules);

      // Calculate overall confidence and status
      const confidence = this.calculateConfidence(violations);
      const status = this.determineStatus(violations, confidence);
      const suggestedActions = this.generateSuggestedActions(violations, status);

      const result: ModerationResult = {
        contentId: content.id,
        status,
        confidence,
        violations,
        suggestedActions,
        metadata: {
          scanTimestamp: new Date(),
          scanDuration: Date.now() - startTime,
          rulesApplied,
          aiModelUsed: this.config.model || 'openai-moderation',
        },
      };

      // Store result in history
      this.addToModerationHistory(content.id, result);

      // Auto-execute actions if confidence is high enough
      if (confidence > this.config.autoRejectThreshold && status === 'rejected') {
        await this.executeAutoModeration(result);
      }

      return {
        success: true,
        data: result,
        metrics: {
          processingTime: Date.now() - startTime,
          model: this.config.model,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONTENT_SCAN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
        metrics: {
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  // Check policy compliance
  public async checkPolicyCompliance(content: any): Promise<AgentResponse<ComplianceStatus>> {
    const startTime = Date.now();

    try {
      const violations: PolicyViolation[] = [];
      const recommendations: string[] = [];

      // Check platform policies
      const platformViolations = await this.checkPlatformPolicies(content);
      violations.push(...platformViolations);

      // Check legal compliance
      const legalViolations = await this.checkLegalCompliance(content);
      violations.push(...legalViolations);

      // Check community standards
      const communityViolations = await this.checkCommunityStandards(content);
      violations.push(...communityViolations);

      // Generate recommendations
      if (violations.length > 0) {
        recommendations.push(...this.generateComplianceRecommendations(violations));
      }

      // Calculate risk score
      const riskScore = this.calculateRiskScore(violations);

      const status: ComplianceStatus = {
        compliant: violations.length === 0,
        violations,
        recommendations,
        riskScore,
        lastChecked: new Date(),
      };

      return {
        success: true,
        data: status,
        metrics: {
          processingTime: Date.now() - startTime,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COMPLIANCE_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: {
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  // Assess user and activity risk
  public async assessRisk(user: any, activity: any): Promise<AgentResponse<RiskScore>> {
    try {
      const riskFactors: RiskFactor[] = [];

      // User-based risk factors
      riskFactors.push(...this.assessUserRisk(user));

      // Content-based risk factors
      riskFactors.push(...this.assessContentRisk(activity));

      // Financial risk factors
      riskFactors.push(...this.assessFinancialRisk(user, activity));

      // Legal risk factors
      riskFactors.push(...this.assessLegalRisk(user, activity));

      // Calculate category scores
      const categories = {
        content: this.calculateCategoryScore(riskFactors, 'content'),
        user: this.calculateCategoryScore(riskFactors, 'user'),
        financial: this.calculateCategoryScore(riskFactors, 'financial'),
        legal: this.calculateCategoryScore(riskFactors, 'legal'),
      };

      // Calculate overall score
      const overall = (categories.content + categories.user + categories.financial + categories.legal) / 4;

      // Determine trend (would require historical data)
      const trend: 'increasing' | 'stable' | 'decreasing' = 'stable';

      const riskScore: RiskScore = {
        overall,
        categories,
        factors: riskFactors,
        trend,
      };

      return {
        success: true,
        data: riskScore,
        metrics: {
          processingTime: 0,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RISK_ASSESSMENT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: {
          processingTime: 0,
        },
      };
    }
  }

  // Process moderation appeal
  public async processAppeal(appeal: ModerationAppeal): Promise<AgentResponse<AppealDecision>> {
    try {
      // Add to appeal queue
      this.appealQueue.set(appeal.appealId, appeal);

      // Auto-process if simple case
      if (this.canAutoProcessAppeal(appeal)) {
        return this.autoProcessAppeal(appeal);
      }

      // Route to human review
      await this.routeToHumanReview(appeal);

      const decision: AppealDecision = {
        appealId: appeal.appealId,
        decision: 'upheld', // Placeholder
        reasoning: 'Appeal routed to human review',
        reviewedBy: 'system',
        reviewedAt: new Date(),
      };

      return {
        success: true,
        data: decision,
        metrics: {
          processingTime: 0,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'APPEAL_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: {
          processingTime: 0,
        },
      };
    }
  }

  // Batch moderate multiple contents
  private async batchModerate(contents: any[]): Promise<AgentResponse<ModerationResult[]>> {
    const results: ModerationResult[] = [];
    
    for (const content of contents) {
      const scanResult = await this.scanContent(content);
      if (scanResult.success && scanResult.data) {
        results.push(scanResult.data);
      }
    }

    return {
      success: true,
      data: results,
      metrics: {
        processingTime: 0,
      },
    };
  }

  // Get moderation history for content
  private async getModerationHistory(contentId: string): Promise<AgentResponse<ModerationResult[]>> {
    const history = this.moderationHistory.get(contentId) || [];

    return {
      success: true,
      data: history,
      metrics: {
        processingTime: 0,
      },
    };
  }

  // Update moderation policies
  private async updatePolicies(policies: CustomPolicy[]): Promise<AgentResponse<{ updated: boolean }>> {
    try {
      // Update configuration
      this.config.customPolicies = policies;

      return {
        success: true,
        data: { updated: true },
        metrics: {
          processingTime: 0,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POLICY_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metrics: {
          processingTime: 0,
        },
      };
    }
  }

  // Text content scanning
  private async scanText(text: string): Promise<{ violations: ModerationViolation[]; rules: string[] }> {
    const violations: ModerationViolation[] = [];
    const rules: string[] = [];

    // Use OpenAI Moderation API
    if (this.config.openaiModerationApiKey) {
      try {
        const response = await this.makeApiCall<any>(
          'https://api.openai.com/v1/moderations',
          { input: text },
          {
            headers: {
              'Authorization': `Bearer ${this.config.openaiModerationApiKey}`,
            },
          }
        );

        if (response.results?.[0]) {
          const result = response.results[0];
          rules.push('openai-moderation');

          // Check each category
          Object.entries(result.categories).forEach(([category, flagged]) => {
            if (flagged) {
              const scores = result.category_scores;
              violations.push({
                type: this.mapOpenAICategory(category),
                severity: scores[category] > 0.8 ? 'high' : scores[category] > 0.5 ? 'medium' : 'low',
                description: `Content flagged for ${category}`,
                confidence: scores[category],
                rule: 'openai-moderation',
              });
            }
          });
        }
      } catch (error) {
        this.logger.error('OpenAI Moderation API error:', error);
      }
    }

    // Custom text analysis
    const customViolations = this.analyzeTextContent(text);
    violations.push(...customViolations.violations);
    rules.push(...customViolations.rules);

    return { violations, rules };
  }

  // Image content scanning
  private async scanImage(imageBuffer: Buffer): Promise<{ violations: ModerationViolation[]; rules: string[] }> {
    const violations: ModerationViolation[] = [];
    const rules: string[] = [];

    // Placeholder for image scanning
    // In production, integrate with services like:
    // - PhotoDNA for CSAM detection
    // - AWS Rekognition for content analysis
    // - Google Vision AI for safety detection
    
    rules.push('image-analysis');
    
    return { violations, rules };
  }

  // Video content scanning
  private async scanVideo(videoBuffer: Buffer): Promise<{ violations: ModerationViolation[]; rules: string[] }> {
    const violations: ModerationViolation[] = [];
    const rules: string[] = [];

    // Placeholder for video scanning
    // In production, integrate with services like:
    // - AWS Rekognition Video
    // - Google Video Intelligence
    // - Custom ML models
    
    rules.push('video-analysis');
    
    return { violations, rules };
  }

  // Audio content scanning
  private async scanAudio(audioBuffer: Buffer): Promise<{ violations: ModerationViolation[]; rules: string[] }> {
    const violations: ModerationViolation[] = [];
    const rules: string[] = [];

    // Placeholder for audio scanning
    // In production, integrate with:
    // - Speech-to-text + text moderation
    // - Audio classification models
    
    rules.push('audio-analysis');
    
    return { violations, rules };
  }

  // Apply custom policies
  private async applyCustomPolicies(content: any): Promise<{ violations: ModerationViolation[]; rules: string[] }> {
    const violations: ModerationViolation[] = [];
    const rules: string[] = [];

    for (const policy of this.config.customPolicies) {
      if (!policy.enabled) continue;

      for (const rule of policy.rules) {
        const ruleResult = this.evaluateRule(rule, content);
        if (ruleResult.violated) {
          violations.push({
            type: ViolationType.POLICY_VIOLATION,
            severity: policy.severity,
            description: `Custom policy violation: ${policy.name}`,
            confidence: ruleResult.confidence,
            rule: policy.id,
          });
          rules.push(policy.id);
        }
      }
    }

    return { violations, rules };
  }

  // Helper methods
  private calculateConfidence(violations: ModerationViolation[]): number {
    if (violations.length === 0) return 0.95; // High confidence in clean content
    
    const avgConfidence = violations.reduce((sum, v) => sum + v.confidence, 0) / violations.length;
    return Math.min(0.95, avgConfidence);
  }

  private determineStatus(violations: ModerationViolation[], confidence: number): 'approved' | 'rejected' | 'flagged' | 'pending_review' {
    if (violations.length === 0) return 'approved';
    
    const hasCritical = violations.some(v => v.severity === 'critical');
    const hasHigh = violations.some(v => v.severity === 'high');

    if (hasCritical && confidence > this.config.autoRejectThreshold) {
      return 'rejected';
    }

    if ((hasHigh || hasCritical) && confidence > this.config.humanReviewThreshold) {
      return 'pending_review';
    }

    return 'flagged';
  }

  private generateSuggestedActions(violations: ModerationViolation[], status: string): ModerationAction[] {
    const actions: ModerationAction[] = [];

    switch (status) {
      case 'rejected':
        actions.push({
          type: 'reject',
          reason: 'Content violates platform policies',
          priority: 'high',
          automated: true,
        });
        break;

      case 'pending_review':
        actions.push({
          type: 'human_review',
          reason: 'Content requires manual review',
          priority: 'medium',
          automated: false,
        });
        break;

      case 'flagged':
        actions.push({
          type: 'edit',
          reason: 'Content may need modifications',
          priority: 'low',
          automated: false,
        });
        break;

      case 'approved':
        actions.push({
          type: 'approve',
          reason: 'Content complies with policies',
          priority: 'low',
          automated: true,
        });
        break;
    }

    return actions;
  }

  private addToModerationHistory(contentId: string, result: ModerationResult): void {
    if (!this.moderationHistory.has(contentId)) {
      this.moderationHistory.set(contentId, []);
    }
    this.moderationHistory.get(contentId)!.push(result);
  }

  private async executeAutoModeration(result: ModerationResult): Promise<void> {
    // Implement auto-moderation actions
    this.logger.info(`Auto-moderating content ${result.contentId} with status ${result.status}`);
  }

  private mapOpenAICategory(category: string): ViolationType {
    const mapping: Record<string, ViolationType> = {
      'sexual': ViolationType.EXPLICIT_CONTENT,
      'hate': ViolationType.HATE_SPEECH,
      'harassment': ViolationType.HARASSMENT,
      'self-harm': ViolationType.DANGEROUS_CONTENT,
      'sexual/minors': ViolationType.UNDERAGE,
      'hate/threatening': ViolationType.HATE_SPEECH,
      'violence/graphic': ViolationType.VIOLENCE,
      'self-harm/intent': ViolationType.DANGEROUS_CONTENT,
      'self-harm/instructions': ViolationType.DANGEROUS_CONTENT,
      'harassment/threatening': ViolationType.HARASSMENT,
      'violence': ViolationType.VIOLENCE,
    };

    return mapping[category] || ViolationType.POLICY_VIOLATION;
  }

  private analyzeTextContent(text: string): { violations: ModerationViolation[]; rules: string[] } {
    const violations: ModerationViolation[] = [];
    const rules: string[] = [];

    // Basic keyword detection
    const profanityWords = ['example1', 'example2']; // Replace with actual profanity list
    const spamIndicators = ['limited time', 'act now', 'free money'];

    const lowerText = text.toLowerCase();

    // Check for profanity
    profanityWords.forEach(word => {
      if (lowerText.includes(word)) {
        violations.push({
          type: ViolationType.HARASSMENT,
          severity: 'medium',
          description: 'Potentially offensive language detected',
          confidence: 0.7,
          rule: 'profanity-filter',
        });
      }
    });

    // Check for spam
    spamIndicators.forEach(indicator => {
      if (lowerText.includes(indicator)) {
        violations.push({
          type: ViolationType.SPAM,
          severity: 'low',
          description: 'Potential spam content detected',
          confidence: 0.6,
          rule: 'spam-filter',
        });
      }
    });

    if (violations.length > 0) {
      rules.push('custom-text-analysis');
    }

    return { violations, rules };
  }

  // Additional methods for policy compliance, risk assessment, etc.
  private async checkPlatformPolicies(content: any): Promise<PolicyViolation[]> {
    // Placeholder implementation
    return [];
  }

  private async checkLegalCompliance(content: any): Promise<PolicyViolation[]> {
    // Placeholder implementation
    return [];
  }

  private async checkCommunityStandards(content: any): Promise<PolicyViolation[]> {
    // Placeholder implementation
    return [];
  }

  private generateComplianceRecommendations(violations: PolicyViolation[]): string[] {
    return violations.map(v => v.remediation).flat();
  }

  private calculateRiskScore(violations: PolicyViolation[]): number {
    if (violations.length === 0) return 0;
    
    const severity_scores = { minor: 1, major: 3, critical: 5 };
    const total = violations.reduce((sum, v) => sum + severity_scores[v.severity], 0);
    return Math.min(10, total / violations.length);
  }

  private assessUserRisk(user: any): RiskFactor[] {
    // Placeholder implementation
    return [];
  }

  private assessContentRisk(activity: any): RiskFactor[] {
    // Placeholder implementation
    return [];
  }

  private assessFinancialRisk(user: any, activity: any): RiskFactor[] {
    // Placeholder implementation
    return [];
  }

  private assessLegalRisk(user: any, activity: any): RiskFactor[] {
    // Placeholder implementation
    return [];
  }

  private calculateCategoryScore(factors: RiskFactor[], category: string): number {
    const categoryFactors = factors.filter(f => f.category === category);
    if (categoryFactors.length === 0) return 0;
    
    return categoryFactors.reduce((sum, f) => sum + f.score * f.weight, 0) / categoryFactors.length;
  }

  private canAutoProcessAppeal(appeal: ModerationAppeal): boolean {
    // Simple heuristics for auto-processing
    return appeal.originalDecision.confidence < 0.6;
  }

  private async autoProcessAppeal(appeal: ModerationAppeal): Promise<AgentResponse<AppealDecision>> {
    const decision: AppealDecision = {
      appealId: appeal.appealId,
      decision: 'overturned',
      newStatus: 'approved',
      reasoning: 'Low confidence in original decision',
      reviewedBy: 'ai-system',
      reviewedAt: new Date(),
    };

    return {
      success: true,
      data: decision,
      metrics: { processingTime: 0 },
    };
  }

  private async routeToHumanReview(appeal: ModerationAppeal): Promise<void> {
    // Placeholder - would route to human review system
    this.logger.info(`Appeal ${appeal.appealId} routed to human review`);
  }

  private evaluateRule(rule: PolicyRule, content: any): { violated: boolean; confidence: number } {
    // Placeholder rule evaluation
    return { violated: false, confidence: 0 };
  }
}