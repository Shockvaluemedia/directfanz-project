/**
 * ECR Scan Result Processor Lambda Function
 * 
 * Processes ECR image scan results and sends notifications for vulnerabilities
 */

const AWS = require('aws-sdk');

const ecr = new AWS.ECR();
const sns = new AWS.SNS();

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const PROJECT_NAME = process.env.PROJECT_NAME;

exports.handler = async (event) => {
    console.log('ECR Scan Event:', JSON.stringify(event, null, 2));
    
    try {
        const detail = event.detail;
        const repositoryName = detail['repository-name'];
        const imageTag = detail['image-tags'] && detail['image-tags'][0];
        const scanStatus = detail['scan-status'];
        
        if (scanStatus !== 'COMPLETE') {
            console.log(`Scan not complete for ${repositoryName}:${imageTag}, status: ${scanStatus}`);
            return;
        }
        
        // Get scan findings
        const scanResults = await ecr.describeImageScanFindings({
            repositoryName: repositoryName,
            imageId: {
                imageTag: imageTag || 'latest'
            }
        }).promise();
        
        const findings = scanResults.imageScanFindings;
        const findingCounts = findings.findingCounts || {};
        
        // Calculate severity counts
        const criticalCount = findingCounts.CRITICAL || 0;
        const highCount = findingCounts.HIGH || 0;
        const mediumCount = findingCounts.MEDIUM || 0;
        const lowCount = findingCounts.LOW || 0;
        const informationalCount = findingCounts.INFORMATIONAL || 0;
        
        const totalVulnerabilities = criticalCount + highCount + mediumCount + lowCount + informationalCount;
        
        console.log(`Scan results for ${repositoryName}:${imageTag}:`, {
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            informational: informationalCount,
            total: totalVulnerabilities
        });
        
        // Determine if notification is needed
        const shouldNotify = criticalCount > 0 || highCount > 5;
        
        if (shouldNotify) {
            const message = {
                project: PROJECT_NAME,
                repository: repositoryName,
                imageTag: imageTag || 'latest',
                scanStatus: scanStatus,
                vulnerabilities: {
                    critical: criticalCount,
                    high: highCount,
                    medium: mediumCount,
                    low: lowCount,
                    informational: informationalCount,
                    total: totalVulnerabilities
                },
                timestamp: new Date().toISOString(),
                action: 'ECR_VULNERABILITY_ALERT'
            };
            
            const subject = `[${PROJECT_NAME}] ECR Vulnerability Alert - ${repositoryName}`;
            const messageBody = `
ECR Image Scan Alert

Repository: ${repositoryName}
Image Tag: ${imageTag || 'latest'}
Scan Status: ${scanStatus}

Vulnerability Summary:
- Critical: ${criticalCount}
- High: ${highCount}
- Medium: ${mediumCount}
- Low: ${lowCount}
- Informational: ${informationalCount}
- Total: ${totalVulnerabilities}

${criticalCount > 0 ? '⚠️  CRITICAL vulnerabilities found! Immediate action required.' : ''}
${highCount > 5 ? '⚠️  High number of HIGH severity vulnerabilities detected.' : ''}

Please review the scan results and update the base image or dependencies as needed.

Scan completed at: ${new Date().toISOString()}
            `.trim();
            
            await sns.publish({
                TopicArn: SNS_TOPIC_ARN,
                Subject: subject,
                Message: messageBody,
                MessageAttributes: {
                    'alert-type': {
                        DataType: 'String',
                        StringValue: 'ecr-vulnerability'
                    },
                    'severity': {
                        DataType: 'String',
                        StringValue: criticalCount > 0 ? 'critical' : 'high'
                    },
                    'repository': {
                        DataType: 'String',
                        StringValue: repositoryName
                    }
                }
            }).promise();
            
            console.log(`Vulnerability notification sent for ${repositoryName}:${imageTag}`);
        } else {
            console.log(`No notification needed for ${repositoryName}:${imageTag} - vulnerability levels acceptable`);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'ECR scan processed successfully',
                repository: repositoryName,
                imageTag: imageTag,
                vulnerabilities: {
                    critical: criticalCount,
                    high: highCount,
                    medium: mediumCount,
                    low: lowCount,
                    total: totalVulnerabilities
                },
                notificationSent: shouldNotify
            })
        };
        
    } catch (error) {
        console.error('Error processing ECR scan result:', error);
        
        // Send error notification
        if (SNS_TOPIC_ARN) {
            try {
                await sns.publish({
                    TopicArn: SNS_TOPIC_ARN,
                    Subject: `[${PROJECT_NAME}] ECR Scan Processing Error`,
                    Message: `Error processing ECR scan result: ${error.message}\n\nEvent: ${JSON.stringify(event, null, 2)}`,
                    MessageAttributes: {
                        'alert-type': {
                            DataType: 'String',
                            StringValue: 'ecr-processing-error'
                        }
                    }
                }).promise();
            } catch (snsError) {
                console.error('Failed to send error notification:', snsError);
            }
        }
        
        throw error;
    }
};