interface ContentReport {
  id: string;
  contentId: string;
  reporterId: string;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
}

interface PolicyViolation {
  userId: string;
  contentId: string;
  violationType: string;
  severity: 'warning' | 'suspension' | 'ban';
  duration?: number; // in hours
}

export class ContentPolicyManager {
  private reports: Map<string, ContentReport> = new Map();
  private violations: Map<string, PolicyViolation[]> = new Map();

  async submitReport(
    contentId: string,
    reporterId: string,
    reason: string,
    description: string
  ): Promise<string> {
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const report: ContentReport = {
      id: reportId,
      contentId,
      reporterId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date(),
    };

    this.reports.set(reportId, report);
    
    // Auto-escalate if multiple reports for same content
    await this.checkAutoEscalation(contentId);
    
    return reportId;
  }

  private async checkAutoEscalation(contentId: string): Promise<void> {
    const reportsForContent = Array.from(this.reports.values())
      .filter(report => report.contentId === contentId && report.status === 'pending');
    
    if (reportsForContent.length >= 3) {
      // Auto-escalate for immediate review
      console.log(`Content ${contentId} auto-escalated due to multiple reports`);
    }
  }

  async reviewReport(reportId: string, action: 'dismiss' | 'uphold'): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) return;

    report.status = action === 'uphold' ? 'resolved' : 'dismissed';
    report.reviewedAt = new Date();

    if (action === 'uphold') {
      await this.enforcePolicy(report.contentId, report.reason);
    }
  }

  private async enforcePolicy(contentId: string, violationType: string): Promise<void> {
    // Determine penalty based on violation type and user history
    const severity = this.determinePenaltySeverity(violationType);
    
    const violation: PolicyViolation = {
      userId: 'user-id', // Would get from content
      contentId,
      violationType,
      severity,
      duration: severity === 'suspension' ? 24 : undefined, // 24 hours
    };

    // Track violation
    const userId = violation.userId;
    if (!this.violations.has(userId)) {
      this.violations.set(userId, []);
    }
    this.violations.get(userId)!.push(violation);

    // Apply penalty
    await this.applyPenalty(violation);
  }

  private determinePenaltySeverity(violationType: string): PolicyViolation['severity'] {
    const severityMap: Record<string, PolicyViolation['severity']> = {
      'spam': 'warning',
      'harassment': 'suspension',
      'hate_speech': 'ban',
      'adult_content': 'warning',
      'violence': 'ban',
    };

    return severityMap[violationType] || 'warning';
  }

  private async applyPenalty(violation: PolicyViolation): Promise<void> {
    switch (violation.severity) {
      case 'warning':
        console.log(`Warning issued to user ${violation.userId}`);
        break;
      case 'suspension':
        console.log(`User ${violation.userId} suspended for ${violation.duration} hours`);
        break;
      case 'ban':
        console.log(`User ${violation.userId} permanently banned`);
        break;
    }
  }

  async getPendingReports(): Promise<ContentReport[]> {
    return Array.from(this.reports.values())
      .filter(report => report.status === 'pending')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getUserViolationHistory(userId: string): Promise<PolicyViolation[]> {
    return this.violations.get(userId) || [];
  }

  async getReportStats(): Promise<{
    pending: number;
    resolved: number;
    dismissed: number;
    avgResponseTime: number; // in hours
  }> {
    const reports = Array.from(this.reports.values());
    
    return {
      pending: reports.filter(r => r.status === 'pending').length,
      resolved: reports.filter(r => r.status === 'resolved').length,
      dismissed: reports.filter(r => r.status === 'dismissed').length,
      avgResponseTime: 12, // Mock average
    };
  }
}

export const policyManager = new ContentPolicyManager();