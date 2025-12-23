#!/usr/bin/env node

/**
 * Send Cutover Notifications Script
 * 
 * Sends notifications about cutover status to stakeholders
 */

import { execSync } from 'child_process';
import fs from 'fs';

interface NotificationConfig {
  success: boolean;
  environment: string;
  startTime: string;
  endTime: string;
  duration: string;
  metrics?: any;
}

class CutoverNotifier {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  private async sendSlackNotification(): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('⚠️  Slack webhook not configured, skipping Slack notification');
      return;
    }

    const color = this.config.success ? 'good' : 'danger';
    const emoji = this.config.success ? '🎉' : '❌';
    const status = this.config.success ? 'SUCCESS' : 'FAILED';

    const message = {
      attachments: [{
        color,
        title: `${emoji} DirectFanz AWS Migration Cutover ${status}`,
        fields: [
          {
            title: 'Environment',
            value: this.config.environment,
            short: true
          },
          {
            title: 'Duration',
            value: this.config.duration,
            short: true
          },
          {
            title: 'Start Time',
            value: this.config.startTime,
            short: true
          },
          {
            title: 'End Time',
            value: this.config.endTime,
            short: true
          }
        ],
        footer: 'DirectFanz DevOps',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    if (this.config.success) {
      message.attachments[0].fields.push({
        title: 'Status',
        value: '✅ Platform is fully operational on AWS infrastructure',
        short: false
      });
    } else {
      message.attachments[0].fields.push({
        title: 'Status',
        value: '❌ Cutover failed - manual intervention required',
        short: false
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        console.log('✅ Slack notification sent successfully');
      } else {
        console.log('❌ Failed to send Slack notification');
      }
    } catch (error) {
      console.log('❌ Error sending Slack notification:', error);
    }
  }

  private async sendEmailNotification(): Promise<void> {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      console.log('⚠️  SendGrid not configured, skipping email notification');
      return;
    }

    const recipients = [
      'devops@directfanz.io',
      'engineering@directfanz.io'
    ];

    const subject = this.config.success 
      ? '🎉 DirectFanz AWS Migration Cutover Successful'
      : '❌ DirectFanz AWS Migration Cutover Failed';

    const htmlContent = this.config.success ? `
      <h2>🎉 AWS Migration Cutover Successful!</h2>
      <p>The DirectFanz platform has been successfully migrated to AWS infrastructure.</p>
      
      <h3>Cutover Details:</h3>
      <ul>
        <li><strong>Environment:</strong> ${this.config.environment}</li>
        <li><strong>Start Time:</strong> ${this.config.startTime}</li>
        <li><strong>End Time:</strong> ${this.config.endTime}</li>
        <li><strong>Duration:</strong> ${this.config.duration}</li>
      </ul>
      
      <h3>Status:</h3>
      <p>✅ Platform is fully operational on AWS infrastructure</p>
      <p>✅ All critical systems are healthy</p>
      <p>✅ Performance metrics meet requirements</p>
      
      <p>The platform is now running on:</p>
      <ul>
        <li>AWS ECS Fargate for application hosting</li>
        <li>AWS RDS PostgreSQL for database</li>
        <li>AWS ElastiCache Redis for caching</li>
        <li>AWS S3 + CloudFront for content delivery</li>
        <li>AWS MediaLive for streaming</li>
      </ul>
    ` : `
      <h2>❌ AWS Migration Cutover Failed</h2>
      <p>The DirectFanz platform migration to AWS infrastructure has failed.</p>
      
      <h3>Cutover Details:</h3>
      <ul>
        <li><strong>Environment:</strong> ${this.config.environment}</li>
        <li><strong>Start Time:</strong> ${this.config.startTime}</li>
        <li><strong>End Time:</strong> ${this.config.endTime}</li>
        <li><strong>Duration:</strong> ${this.config.duration}</li>
      </ul>
      
      <h3>Status:</h3>
      <p>❌ Cutover failed - manual intervention required</p>
      <p>⚠️  Platform may be in maintenance mode</p>
      
      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Check cutover logs for specific error details</li>
        <li>Verify system health and rollback if necessary</li>
        <li>Contact the engineering team for assistance</li>
      </ol>
    `;

    const emailData = {
      personalizations: recipients.map(email => ({ to: [{ email }] })),
      from: { email: 'noreply@directfanz.io', name: 'DirectFanz DevOps' },
      subject,
      content: [{ type: 'text/html', value: htmlContent }]
    };

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (response.ok) {
        console.log('✅ Email notifications sent successfully');
      } else {
        console.log('❌ Failed to send email notifications');
      }
    } catch (error) {
      console.log('❌ Error sending email notifications:', error);
    }
  }

  private async sendSNSNotification(): Promise<void> {
    const snsTopicArn = process.env.AWS_SNS_TOPIC_ARN;
    if (!snsTopicArn) {
      console.log('⚠️  SNS topic not configured, skipping SNS notification');
      return;
    }

    const message = this.config.success 
      ? `DirectFanz AWS Migration Cutover SUCCESSFUL\n\nEnvironment: ${this.config.environment}\nDuration: ${this.config.duration}\nStatus: Platform fully operational on AWS`
      : `DirectFanz AWS Migration Cutover FAILED\n\nEnvironment: ${this.config.environment}\nDuration: ${this.config.duration}\nStatus: Manual intervention required`;

    const subject = this.config.success 
      ? 'DirectFanz AWS Cutover Success'
      : 'DirectFanz AWS Cutover Failed';

    try {
      execSync(`aws sns publish --topic-arn "${snsTopicArn}" --subject "${subject}" --message "${message}"`, {
        stdio: 'pipe'
      });
      console.log('✅ SNS notification sent successfully');
    } catch (error) {
      console.log('❌ Error sending SNS notification:', error);
    }
  }

  private async logCutoverEvent(): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'aws_migration_cutover',
      status: this.config.success ? 'success' : 'failed',
      environment: this.config.environment,
      startTime: this.config.startTime,
      endTime: this.config.endTime,
      duration: this.config.duration,
      metrics: this.config.metrics
    };

    // Log to file
    const logFile = `logs/cutover-events-${new Date().toISOString().split('T')[0]}.json`;
    const existingLogs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
    existingLogs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));

    // Send to CloudWatch Logs if available
    try {
      const logGroup = '/aws/directfanz/cutover-events';
      const logStream = `cutover-${Date.now()}`;
      
      execSync(`aws logs create-log-stream --log-group-name "${logGroup}" --log-stream-name "${logStream}"`, {
        stdio: 'pipe'
      });

      execSync(`aws logs put-log-events --log-group-name "${logGroup}" --log-stream-name "${logStream}" --log-events timestamp=$(date +%s000),message='${JSON.stringify(logEntry)}'`, {
        stdio: 'pipe'
      });

      console.log('✅ Event logged to CloudWatch');
    } catch (error) {
      console.log('⚠️  Could not log to CloudWatch, logged to file only');
    }
  }

  public async sendNotifications(): Promise<void> {
    console.log('📢 Sending cutover notifications...');

    await Promise.all([
      this.sendSlackNotification(),
      this.sendEmailNotification(),
      this.sendSNSNotification(),
      this.logCutoverEvent()
    ]);

    console.log('✅ All notifications sent');
  }
}

async function main() {
  const isSuccess = process.argv.includes('--success');
  const environment = process.argv.includes('--staging') ? 'staging' : 'production';

  // Calculate duration from log files or use current time
  const startTime = process.env.CUTOVER_START_TIME || new Date().toISOString();
  const endTime = new Date().toISOString();
  const duration = `${Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 / 60)} minutes`;

  const config: NotificationConfig = {
    success: isSuccess,
    environment,
    startTime,
    endTime,
    duration
  };

  const notifier = new CutoverNotifier(config);
  await notifier.sendNotifications();
}

main().catch(error => {
  console.error('Failed to send notifications:', error);
  process.exit(1);
});