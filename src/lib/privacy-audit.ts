import { getDatabaseClient } from './database-production';

interface AuditLogEntry {
  event: string;
  userId?: string;
  data: any;
  ipAddress?: string;
  userAgent?: string;
}

export class PrivacyAuditLogger {
  private db = getDatabaseClient();

  async logDataAccess(userId: string, dataType: string, action: string, metadata?: any) {
    await this.log({
      event: 'data_access',
      userId,
      data: {
        dataType,
        action,
        timestamp: new Date(),
        ...metadata,
      },
    });
  }

  async logDataExport(userId: string, format: string, requestId: string) {
    await this.log({
      event: 'data_export',
      userId,
      data: {
        format,
        requestId,
        timestamp: new Date(),
      },
    });
  }

  async logDataDeletion(userId: string, dataTypes: string[]) {
    await this.log({
      event: 'data_deletion',
      userId,
      data: {
        dataTypes,
        timestamp: new Date(),
      },
    });
  }

  async logConsentChange(userId: string, consentData: any) {
    await this.log({
      event: 'consent_change',
      userId,
      data: {
        consent: consentData,
        timestamp: new Date(),
      },
    });
  }

  private async log(entry: AuditLogEntry) {
    try {
      await this.db.client.auditLog.create({
        data: {
          event: entry.event,
          userId: entry.userId,
          data: JSON.stringify(entry.data),
          ipAddress: entry.ipAddress || 'unknown',
          userAgent: entry.userAgent || 'unknown',
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  async getAuditLogs(userId: string, limit = 100) {
    return await this.db.client.auditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}

export const auditLogger = new PrivacyAuditLogger();