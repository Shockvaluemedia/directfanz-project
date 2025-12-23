/**
 * AWS Lambda function for SSL certificate renewal notifications
 * Monitors certificate expiration and sends alerts
 */

const AWS = require('aws-sdk');

const acm = new AWS.ACM();
const sns = new AWS.SNS();

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const DOMAIN_NAME = process.env.DOMAIN_NAME;

exports.handler = async (event) => {
    console.log('Certificate renewal check started for domain:', DOMAIN_NAME);
    
    try {
        // List all certificates
        const certificates = await acm.listCertificates({
            CertificateStatuses: ['ISSUED']
        }).promise();
        
        const alerts = [];
        
        for (const cert of certificates.CertificateSummaryList) {
            // Get detailed certificate information
            const certDetails = await acm.describeCertificate({
                CertificateArn: cert.CertificateArn
            }).promise();
            
            const certificate = certDetails.Certificate;
            
            // Check if this certificate is for our domain
            const isDomainCert = certificate.DomainName === DOMAIN_NAME || 
                               certificate.SubjectAlternativeNames?.includes(DOMAIN_NAME) ||
                               certificate.SubjectAlternativeNames?.includes(`*.${DOMAIN_NAME}`);
            
            if (!isDomainCert) {
                continue;
            }
            
            // Calculate days until expiration
            const now = new Date();
            const expirationDate = new Date(certificate.NotAfter);
            const daysUntilExpiration = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
            
            console.log(`Certificate ${certificate.DomainName} expires in ${daysUntilExpiration} days`);
            
            // Check if certificate is expiring soon
            if (daysUntilExpiration <= 30) {
                alerts.push({
                    domain: certificate.DomainName,
                    arn: certificate.CertificateArn,
                    expirationDate: expirationDate.toISOString(),
                    daysUntilExpiration: daysUntilExpiration,
                    status: certificate.Status,
                    renewalEligibility: certificate.RenewalEligibility
                });
            }
        }
        
        // Send alerts if any certificates are expiring
        if (alerts.length > 0) {
            const message = {
                alert: 'SSL Certificate Expiration Warning',
                domain: DOMAIN_NAME,
                certificates: alerts,
                timestamp: new Date().toISOString(),
                action_required: 'Review certificate renewal status'
            };
            
            await sns.publish({
                TopicArn: SNS_TOPIC_ARN,
                Subject: `SSL Certificate Expiration Alert - ${DOMAIN_NAME}`,
                Message: JSON.stringify(message, null, 2)
            }).promise();
            
            console.log(`Sent expiration alert for ${alerts.length} certificates`);
        } else {
            console.log('All certificates are valid and not expiring soon');
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Certificate check completed',
                certificatesChecked: certificates.CertificateSummaryList.length,
                alertsSent: alerts.length,
                domain: DOMAIN_NAME
            })
        };
        
    } catch (error) {
        console.error('Error checking certificates:', error);
        
        // Send error notification
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `SSL Certificate Check Error - ${DOMAIN_NAME}`,
            Message: JSON.stringify({
                error: 'Certificate renewal check failed',
                domain: DOMAIN_NAME,
                errorMessage: error.message,
                timestamp: new Date().toISOString()
            }, null, 2)
        }).promise();
        
        throw error;
    }
};