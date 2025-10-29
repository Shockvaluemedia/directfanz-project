import { NextRequest } from 'next/server';
import { 
  withAdminApiHandler, 
  ApiRequestContext 
} from '@/lib/api-error-handler';
import { performanceMonitor } from '@/lib/performance-monitor';

export const GET = withAdminApiHandler(
  async (context: ApiRequestContext, userId: string, request: NextRequest) => {
    const url = new URL(request.url);
    const severity = url.searchParams.get('severity');
    const type = url.searchParams.get('type');
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));

    const summary = performanceMonitor.getPerformanceSummary();
    let alerts = summary.recentAlerts;

    // Filter by severity if specified
    if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    // Filter by type if specified  
    if (type && ['regression', 'improvement', 'threshold_exceeded'].includes(type)) {
      alerts = alerts.filter(alert => alert.type === type);
    }

    // Apply limit
    alerts = alerts.slice(0, limit);

    return {
      alerts,
      summary: {
        total: summary.recentAlerts.length,
        filtered: alerts.length,
        counts: summary.alertCounts,
        regressions: summary.regressions,
        improvements: summary.improvements,
      },
      filters: {
        severity,
        type,
        limit
      },
      timestamp: new Date().toISOString()
    };
  }
);