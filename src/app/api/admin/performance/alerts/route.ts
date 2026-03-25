import { NextRequest } from 'next/server';
import { 
  withAdminApiHandler, 
  ApiRequestContext 
} from '@/lib/api-error-handler';
import { performanceMonitor, getPerformanceSummary } from '@/lib/performance-monitor';

export const GET = withAdminApiHandler(
  async (context: ApiRequestContext, userId: string, request: NextRequest) => {
    const url = new URL(request.url);
    const severity = url.searchParams.get('severity');
    const type = url.searchParams.get('type');
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'));

    const summary = await getPerformanceSummary();
    let alerts = summary.alerts;

    // Filter by severity if specified
    if (severity && ['low', 'medium', 'high', 'critical'].includes(severity)) {
      alerts = alerts.filter((alert: { severity: string }) => alert.severity === severity);
    }

    // Filter by type if specified
    if (type && ['regression', 'improvement', 'threshold_exceeded'].includes(type)) {
      alerts = alerts.filter((alert: { metric: string }) => alert.metric === type);
    }

    // Apply limit
    alerts = alerts.slice(0, limit);

    return {
      alerts,
      summary: {
        total: summary.alerts.length,
        filtered: alerts.length,
        healthy: summary.healthy,
        metrics: summary.metrics,
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