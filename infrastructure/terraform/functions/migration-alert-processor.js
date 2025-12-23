/**
 * Migration Alert Processor Lambda Function
 * Processes migration alerts and sends notifications to various channels
 * Implements Requirements 11.6
 */

const https = require('https');
const util = require('util');

exports.handler = async (event) => {
    console.log('Processing migration alert:', JSON.stringify(event, null, 2));
    
    try {
        // Parse SNS message
        const snsMessage = JSON.parse(event.Records[0].Sns.Message);
        const { migrationId, alert } = snsMessage;
        
        // Format alert for different channels
        const formattedAlert = formatAlert(migrationId, alert);
        
        // Send to Slack if webhook URL is configured
        if (process.env.SLACK_WEBHOOK_URL) {
            await sendSlackNotification(formattedAlert);
        }
        
        // Log the alert
        console.log('Migration alert processed:', formattedAlert);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Alert processed successfully',
                migrationId,
                alertType: alert.type
            })
        };
        
    } catch (error) {
        console.error('Error processing migration alert:', error);
        throw error;
    }
};

function formatAlert(migrationId, alert) {
    const severity = getSeverityEmoji(alert.type);
    const timestamp = new Date(alert.timestamp).toLocaleString();
    
    return {
        migrationId,
        type: alert.type,
        message: alert.message,
        timestamp,
        phase: alert.phase,
        subTask: alert.subTask,
        severity,
        environment: process.env.ENVIRONMENT || 'unknown'
    };
}

function getSeverityEmoji(type) {
    switch (type) {
        case 'critical':
            return '🚨';
        case 'error':
            return '❌';
        case 'warning':
            return '⚠️';
        case 'info':
            return 'ℹ️';
        default:
            return '📢';
    }
}

async function sendSlackNotification(alert) {
    const slackMessage = {
        text: `Migration Alert: ${alert.type.toUpperCase()}`,
        attachments: [
            {
                color: getSlackColor(alert.type),
                fields: [
                    {
                        title: 'Migration ID',
                        value: alert.migrationId,
                        short: true
                    },
                    {
                        title: 'Environment',
                        value: alert.environment,
                        short: true
                    },
                    {
                        title: 'Alert Type',
                        value: `${alert.severity} ${alert.type.toUpperCase()}`,
                        short: true
                    },
                    {
                        title: 'Timestamp',
                        value: alert.timestamp,
                        short: true
                    },
                    {
                        title: 'Message',
                        value: alert.message,
                        short: false
                    }
                ],
                footer: 'DirectFanz Migration System',
                ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
            }
        ]
    };
    
    if (alert.phase) {
        slackMessage.attachments[0].fields.push({
            title: 'Phase',
            value: alert.phase,
            short: true
        });
    }
    
    if (alert.subTask) {
        slackMessage.attachments[0].fields.push({
            title: 'Sub-Task',
            value: alert.subTask,
            short: true
        });
    }
    
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(slackMessage);
        const url = new URL(process.env.SLACK_WEBHOOK_URL);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('Slack notification sent successfully');
                    resolve(data);
                } else {
                    console.error('Failed to send Slack notification:', res.statusCode, data);
                    reject(new Error(`Slack API returned ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Error sending Slack notification:', error);
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

function getSlackColor(type) {
    switch (type) {
        case 'critical':
            return 'danger';
        case 'error':
            return 'danger';
        case 'warning':
            return 'warning';
        case 'info':
            return 'good';
        default:
            return '#36a64f';
    }
}