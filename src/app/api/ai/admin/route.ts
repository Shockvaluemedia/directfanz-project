import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createAgentTask, createAgentRegistry, DEFAULT_AGENT_CONFIGS } from '@/lib/ai';
import { Logger } from '@/lib/logger';

const logger = new Logger('ai-admin-api');

let registry: any = null;

async function getRegistry() {
  if (!registry) {
    registry = createAgentRegistry(
      DEFAULT_AGENT_CONFIGS.agentRegistry,
      logger
    );
  }
  return registry;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    // Additional admin check - you might want to verify admin role
    if (!isAdminUser(session)) {
      return NextResponse.json({
        error: 'Admin privileges required'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const operationType = searchParams.get('type') || 'overview';
    const timeframe = searchParams.get('timeframe') || 'daily';
    const scope = searchParams.get('scope') || 'platform';

    const agentRegistry = await getRegistry();
    const agentId = 'admin-operations-main';

    let task;

    switch (operationType) {
      case 'system_health':
        task = createAgentTask('monitor_system_health', {
          scope: scope, // 'platform', 'api', 'database', 'storage'
          timeframe,
          includeMetrics: true,
          alertThreshold: 'medium',
        });
        break;

      case 'user_management':
        task = createAgentTask('analyze_user_activity', {
          timeframe,
          includeRegistrations: true,
          includeActivity: true,
          includeSuspensions: true,
          includeSupport: true,
        });
        break;

      case 'resource_usage':
        task = createAgentTask('analyze_resource_usage', {
          timeframe,
          resources: ['cpu', 'memory', 'storage', 'bandwidth'],
          includeForecasting: true,
          includeCostAnalysis: true,
        });
        break;

      case 'security_audit':
        task = createAgentTask('security_audit', {
          scope,
          auditType: 'comprehensive',
          includeVulnerabilities: true,
          includeAccessLogs: true,
          includeCompliance: true,
        });
        break;

      case 'performance_metrics':
        task = createAgentTask('analyze_performance', {
          timeframe,
          metrics: ['response_times', 'throughput', 'error_rates', 'availability'],
          includeBottlenecks: true,
          includeTrends: true,
        });
        break;

      case 'overview':
      default:
        // Get comprehensive admin overview
        const tasks = [
          createAgentTask('monitor_system_health', { scope: 'platform', timeframe }),
          createAgentTask('analyze_user_activity', { timeframe }),
          createAgentTask('analyze_resource_usage', { timeframe }),
          createAgentTask('analyze_performance', { timeframe }),
          createAgentTask('security_audit', { scope: 'quick', auditType: 'basic' }),
        ];

        const results = await Promise.all(
          tasks.map(t => agentRegistry.executeTask(agentId, t))
        );

        return NextResponse.json({
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            timeframe,
            scope,
            admin: {
              systemHealth: results[0].success ? results[0].data : null,
              userActivity: results[1].success ? results[1].data : null,
              resourceUsage: results[2].success ? results[2].data : null,
              performance: results[3].success ? results[3].data : null,
              security: results[4].success ? results[4].data : null,
            },
            alerts: await generateSystemAlerts(results),
            insights: await generateAdminInsights(results),
            recommendations: await generateAdminRecommendations(results),
            status: determineOverallSystemStatus(results),
          },
          metrics: {
            tasksExecuted: tasks.length,
            successfulTasks: results.filter(r => r.success).length,
            totalProcessingTime: results.reduce((sum, r) => sum + (r.metrics?.processingTime || 0), 0),
          }
        });
    }

    const response = await agentRegistry.executeTask(agentId, task);

    if (!response.success) {
      return NextResponse.json({
        error: 'Admin operation failed',
        details: response.error,
        suggestion: 'Check agent status or system permissions'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        operationType,
        timeframe,
        scope,
        timestamp: new Date().toISOString(),
        result: response.data,
        insights: await generateSingleAdminInsight(response.data, operationType),
        actionItems: await generateAdminActionItems(response.data, operationType),
        priority: determinePriority(response.data, operationType),
      },
      metrics: response.metrics
    });

  } catch (error) {
    logger.error('Admin API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    if (!isAdminUser(session)) {
      return NextResponse.json({
        error: 'Admin privileges required'
      }, { status: 403 });
    }

    const body = await request.json();
    const { 
      action, 
      parameters = {},
      confirmationCode, // Required for destructive actions
      dryRun = true // Default to dry run for safety
    } = body;

    if (!action) {
      return NextResponse.json({
        error: 'Action is required',
        availableActions: [
          'user_action',
          'system_maintenance',
          'resource_scaling',
          'security_action',
          'backup_restore',
          'configuration_update'
        ]
      }, { status: 400 });
    }

    const agentRegistry = await getRegistry();
    const agentId = 'admin-operations-main';

    // Validate destructive actions require confirmation
    const destructiveActions = ['user_suspension', 'system_shutdown', 'data_deletion', 'security_lockdown'];
    const isDestructive = destructiveActions.includes(action) || parameters.destructive === true;
    
    if (isDestructive && !confirmationCode) {
      return NextResponse.json({
        error: 'Destructive action requires confirmation code',
        confirmationRequired: true,
        action,
        warningMessage: 'This action may impact platform availability or user access'
      }, { status: 400 });
    }

    let task;

    switch (action) {
      case 'user_action':
        task = createAgentTask('execute_user_action', {
          userId: parameters.userId,
          action: parameters.userAction, // 'suspend', 'activate', 'reset_password', 'delete'
          reason: parameters.reason,
          duration: parameters.duration,
          notifyUser: parameters.notifyUser || false,
          dryRun,
        });
        break;

      case 'system_maintenance':
        task = createAgentTask('system_maintenance', {
          maintenanceType: parameters.type || 'routine',
          scheduledTime: parameters.scheduledTime,
          estimatedDuration: parameters.duration || 30, // minutes
          affectedServices: parameters.services || [],
          maintenanceWindow: parameters.window || 'low-traffic',
          dryRun,
        });
        break;

      case 'resource_scaling':
        task = createAgentTask('scale_resources', {
          resourceType: parameters.resourceType, // 'compute', 'storage', 'bandwidth'
          scalingDirection: parameters.direction, // 'up', 'down', 'auto'
          targetCapacity: parameters.capacity,
          autoScaling: parameters.autoScaling || false,
          costLimit: parameters.maxCost,
          dryRun,
        });
        break;

      case 'security_action':
        task = createAgentTask('security_action', {
          actionType: parameters.securityAction, // 'ip_block', 'rate_limit', 'account_lockdown'
          target: parameters.target,
          duration: parameters.duration,
          severity: parameters.severity || 'medium',
          autoRevert: parameters.autoRevert || true,
          dryRun,
        });
        break;

      case 'backup_restore':
        task = createAgentTask('backup_restore', {
          operation: parameters.operation, // 'backup', 'restore', 'verify'
          backupType: parameters.backupType || 'incremental',
          targetTime: parameters.targetTime,
          includeFiles: parameters.includeFiles || true,
          includeDatabase: parameters.includeDatabase || true,
          dryRun,
        });
        break;

      case 'configuration_update':
        task = createAgentTask('update_configuration', {
          configType: parameters.configType, // 'rate_limits', 'features', 'integrations'
          updates: parameters.updates,
          environment: parameters.environment || 'production',
          rollbackPlan: parameters.rollbackPlan,
          testFirst: parameters.testFirst || true,
          dryRun,
        });
        break;

      default:
        return NextResponse.json({
          error: 'Unknown action type',
          action,
          availableActions: [
            'user_action',
            'system_maintenance',
            'resource_scaling',
            'security_action',
            'backup_restore',
            'configuration_update'
          ]
        }, { status: 400 });
    }

    const response = await agentRegistry.executeTask(agentId, task);

    // Generate safety information and rollback plan
    const safetyInfo = await generateSafetyInfo(action, parameters, dryRun, response);
    
    return NextResponse.json({
      success: response.success,
      data: {
        action,
        parameters,
        dryRun,
        timestamp: new Date().toISOString(),
        result: response.data,
        safety: safetyInfo,
        recommendations: response.success 
          ? await generateActionRecommendations(response.data, action)
          : [],
        nextSteps: await generateActionNextSteps(response.data, action, dryRun),
        rollbackPlan: await generateRollbackPlan(action, parameters, response.data),
      },
      metrics: response.metrics,
      error: response.error
    });

  } catch (error) {
    logger.error('Admin POST API Error:', error);
    return NextResponse.json({
      error: 'Admin action failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Utility function to check if user has admin privileges
function isAdminUser(session: any): boolean {
  // Implement your admin role checking logic here
  return session?.user?.role === 'admin' || session?.user?.permissions?.includes('admin');
}

// Helper functions for generating insights and recommendations
async function generateSystemAlerts(results: any[]): Promise<Array<{type: string, severity: string, message: string}>> {
  const alerts: Array<{type: string, severity: string, message: string}> = [];

  results.forEach((result, index) => {
    if (result.success && result.data) {
      switch (index) {
        case 0: // System health
          if (result.data.status === 'degraded') {
            alerts.push({
              type: 'system_health',
              severity: 'warning',
              message: 'System performance is degraded'
            });
          }
          if (result.data.alerts) {
            result.data.alerts.forEach((alert: any) => {
              alerts.push({
                type: 'system_health',
                severity: alert.severity || 'info',
                message: alert.message
              });
            });
          }
          break;
        case 1: // User activity
          if (result.data.suspiciousActivity && result.data.suspiciousActivity > 0) {
            alerts.push({
              type: 'security',
              severity: 'warning',
              message: `${result.data.suspiciousActivity} suspicious user activities detected`
            });
          }
          break;
        case 2: // Resource usage
          if (result.data.resourceAlerts) {
            result.data.resourceAlerts.forEach((alert: any) => {
              alerts.push({
                type: 'resource',
                severity: alert.severity || 'warning',
                message: alert.message
              });
            });
          }
          break;
      }
    }
  });

  return alerts;
}

async function generateAdminInsights(results: any[]): Promise<string[]> {
  const insights: string[] = [];

  if (results[0]?.success) { // System health
    const health = results[0].data;
    if (health.uptime) {
      insights.push(`Platform uptime: ${health.uptime}%`);
    }
    if (health.responseTime) {
      insights.push(`Average response time: ${health.responseTime}ms`);
    }
  }

  if (results[1]?.success) { // User activity
    const users = results[1].data;
    if (users.totalUsers) {
      insights.push(`Total platform users: ${users.totalUsers.toLocaleString()}`);
    }
    if (users.newRegistrations) {
      insights.push(`New registrations today: ${users.newRegistrations}`);
    }
  }

  if (results[2]?.success) { // Resource usage
    const resources = results[2].data;
    if (resources.costSummary?.total) {
      insights.push(`Current resource costs: $${resources.costSummary.total.toLocaleString()}/month`);
    }
  }

  return insights;
}

async function generateAdminRecommendations(results: any[]): Promise<string[]> {
  const recommendations: string[] = [];

  if (results[0]?.success && results[0].data?.recommendations) {
    recommendations.push(...results[0].data.recommendations);
  }

  if (results[2]?.success) { // Resource usage
    const resources = results[2].data;
    if (resources.utilizationRate < 0.4) {
      recommendations.push('Consider scaling down underutilized resources to reduce costs');
    } else if (resources.utilizationRate > 0.8) {
      recommendations.push('Monitor resource usage closely - may need scaling up soon');
    }
  }

  if (results[4]?.success && results[4].data?.vulnerabilities?.length > 0) {
    recommendations.push('Address identified security vulnerabilities immediately');
  }

  return recommendations;
}

function determineOverallSystemStatus(results: any[]): string {
  if (results.some(r => !r.success)) {
    return 'error';
  }

  const healthResult = results[0];
  if (healthResult?.success) {
    const status = healthResult.data?.status;
    if (status === 'critical' || status === 'degraded') {
      return status;
    }
  }

  return 'healthy';
}

async function generateSingleAdminInsight(data: any, operationType: string): Promise<string[]> {
  const insights: string[] = [];

  switch (operationType) {
    case 'system_health':
      if (data?.status) {
        insights.push(`System status: ${data.status}`);
      }
      if (data?.uptime) {
        insights.push(`Current uptime: ${data.uptime}%`);
      }
      break;
    case 'user_management':
      if (data?.totalUsers) {
        insights.push(`Managing ${data.totalUsers.toLocaleString()} total users`);
      }
      if (data?.activeUsers) {
        insights.push(`${data.activeUsers.toLocaleString()} active users in selected timeframe`);
      }
      break;
    case 'resource_usage':
      if (data?.summary?.totalCost) {
        insights.push(`Total resource cost: $${data.summary.totalCost.toLocaleString()}`);
      }
      break;
  }

  return insights;
}

async function generateAdminActionItems(data: any, operationType: string): Promise<string[]> {
  const actions: string[] = [];

  switch (operationType) {
    case 'system_health':
      if (data?.alerts?.length > 0) {
        actions.push('Review and address system alerts');
      }
      actions.push('Schedule routine maintenance if needed');
      break;
    case 'security_audit':
      if (data?.vulnerabilities?.length > 0) {
        actions.push('Patch identified security vulnerabilities');
      }
      actions.push('Review and update security policies');
      break;
    case 'resource_usage':
      actions.push('Optimize resource allocation based on usage patterns');
      actions.push('Set up automated scaling rules if appropriate');
      break;
  }

  return actions;
}

function determinePriority(data: any, operationType: string): string {
  switch (operationType) {
    case 'system_health':
      if (data?.status === 'critical') return 'critical';
      if (data?.status === 'degraded') return 'high';
      return 'normal';
    case 'security_audit':
      if (data?.vulnerabilities?.some((v: any) => v.severity === 'critical')) return 'critical';
      if (data?.vulnerabilities?.some((v: any) => v.severity === 'high')) return 'high';
      return 'normal';
    default:
      return 'normal';
  }
}

async function generateSafetyInfo(action: string, parameters: any, dryRun: boolean, response: any) {
  const safety: any = {
    dryRun,
    destructive: ['user_suspension', 'system_shutdown', 'data_deletion'].includes(action),
    reversible: !['data_deletion', 'account_deletion'].includes(action),
  };

  if (dryRun) {
    safety.warnings = [
      'This was a dry run - no actual changes were made',
      'Review the proposed changes carefully before executing',
      'Ensure you have proper authorization for this action'
    ];
  } else {
    safety.warnings = [
      'This action has been executed on the live system',
      'Monitor system status closely after this change',
      'Have rollback plan ready if issues arise'
    ];
  }

  return safety;
}

async function generateActionRecommendations(data: any, action: string): Promise<string[]> {
  const recommendations: string[] = [];

  switch (action) {
    case 'user_action':
      recommendations.push('Document the reason for this action');
      recommendations.push('Monitor user feedback and support requests');
      break;
    case 'system_maintenance':
      recommendations.push('Notify users about scheduled maintenance');
      recommendations.push('Prepare rollback plan in case of issues');
      break;
    case 'resource_scaling':
      recommendations.push('Monitor performance metrics after scaling');
      recommendations.push('Adjust scaling thresholds based on results');
      break;
  }

  return recommendations;
}

async function generateActionNextSteps(data: any, action: string, dryRun: boolean): Promise<string[]> {
  const steps: string[] = [];

  if (dryRun) {
    steps.push('Review the dry run results');
    steps.push('Execute the action without dry run if results look good');
    steps.push('Monitor system status after execution');
  } else {
    steps.push('Monitor system metrics for the next hour');
    steps.push('Check for any error logs or alerts');
    steps.push('Document the action in the change log');
  }

  return steps;
}

async function generateRollbackPlan(action: string, parameters: any, result: any): Promise<string[]> {
  const plan: string[] = [];

  switch (action) {
    case 'user_action':
      plan.push('Reverse user action if needed');
      plan.push('Restore user access if suspension was incorrect');
      break;
    case 'configuration_update':
      plan.push('Revert to previous configuration version');
      plan.push('Clear application cache to ensure old config is loaded');
      break;
    case 'resource_scaling':
      plan.push('Scale back to previous resource levels');
      plan.push('Monitor performance during scale-back');
      break;
    default:
      plan.push('Contact system administrator for rollback assistance');
  }

  return plan;
}