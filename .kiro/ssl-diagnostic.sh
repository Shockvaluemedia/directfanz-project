#!/bin/bash

echo "=== SSL Certificate Diagnostic ==="
echo "Domain: directfanz.io"
echo "Error: ERR_SSL_VERSION_OR_CIPHER_MISMATCH"
echo

# Check certificate status
echo "1. Certificate Check:"
openssl s_client -connect directfanz.io:443 -servername directfanz.io < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -E "(Subject:|DNS:|Not After)"

echo
echo "2. Load Balancer Check:"
# Check if ALB is configured with correct certificate
aws elbv2 describe-listeners --region us-east-1 --query 'Listeners[?Port==`443`].[Certificates[0].CertificateArn]' --output text

echo
echo "3. Certificate Manager Check:"
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?DomainName==`directfanz.io` || DomainName==`*.directfanz.io`].[DomainName,Status,CertificateArn]' --output table

echo
echo "Fix Required: Update ALB listener to use correct certificate"