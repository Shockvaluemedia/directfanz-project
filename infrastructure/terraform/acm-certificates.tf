# AWS Certificate Manager (ACM) Configuration - DirectFanz AWS Infrastructure

# Primary SSL certificate for the main domain and all subdomains
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = [
    "*.${var.domain_name}",
    "www.${var.domain_name}",
    "api.${var.domain_name}",
    "ws.${var.domain_name}",
    "stream.${var.domain_name}",
    "cdn.${var.domain_name}",
    "admin.${var.domain_name}",
    "mobile-api.${var.domain_name}",
    "assets.${var.domain_name}",
    "media.${var.domain_name}"
  ]
  
  validation_method = "DNS"
  
  # Add staging and dev subdomains if not in production
  subject_alternative_names = concat(
    [
      "*.${var.domain_name}",
      "www.${var.domain_name}",
      "api.${var.domain_name}",
      "ws.${var.domain_name}",
      "stream.${var.domain_name}",
      "cdn.${var.domain_name}",
      "admin.${var.domain_name}",
      "mobile-api.${var.domain_name}",
      "assets.${var.domain_name}",
      "media.${var.domain_name}"
    ],
    var.environment != "prod" ? ["staging.${var.domain_name}"] : [],
    var.environment == "dev" ? ["dev.${var.domain_name}"] : []
  )

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-ssl-certificate"
    Environment = var.environment
    Domain      = var.domain_name
  }
}

# CloudFront SSL certificate (must be in us-east-1 region)
resource "aws_acm_certificate" "cloudfront" {
  provider                  = aws.us_east_1
  domain_name               = var.domain_name
  subject_alternative_names = [
    "*.${var.domain_name}",
    "cdn.${var.domain_name}",
    "assets.${var.domain_name}"
  ]
  
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-ssl-certificate"
    Environment = var.environment
    Domain      = var.domain_name
    Purpose     = "CloudFront"
  }
}

# DNS validation records for the main certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# DNS validation records for the CloudFront certificate
resource "aws_route53_record" "cloudfront_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cloudfront.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Certificate validation for the main certificate
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Certificate validation for the CloudFront certificate
resource "aws_acm_certificate_validation" "cloudfront" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for record in aws_route53_record.cloudfront_cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Certificate expiration monitoring
resource "aws_cloudwatch_metric_alarm" "certificate_expiration" {
  alarm_name          = "${var.project_name}-certificate-expiration"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DaysToExpiry"
  namespace           = "AWS/CertificateManager"
  period              = "86400" # 24 hours
  statistic           = "Minimum"
  threshold           = "30" # Alert 30 days before expiration
  alarm_description   = "This metric monitors SSL certificate expiration"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    CertificateArn = aws_acm_certificate.main.arn
  }

  tags = {
    Name = "${var.project_name}-certificate-expiration-alarm"
  }
}

# CloudFront certificate expiration monitoring
resource "aws_cloudwatch_metric_alarm" "cloudfront_certificate_expiration" {
  provider            = aws.us_east_1
  alarm_name          = "${var.project_name}-cloudfront-certificate-expiration"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DaysToExpiry"
  namespace           = "AWS/CertificateManager"
  period              = "86400" # 24 hours
  statistic           = "Minimum"
  threshold           = "30" # Alert 30 days before expiration
  alarm_description   = "This metric monitors CloudFront SSL certificate expiration"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    CertificateArn = aws_acm_certificate.cloudfront.arn
  }

  tags = {
    Name = "${var.project_name}-cloudfront-certificate-expiration-alarm"
  }
}

# Lambda function for certificate renewal notifications
resource "aws_lambda_function" "certificate_renewal_notifier" {
  filename         = "certificate-renewal-notifier.zip"
  function_name    = "${var.project_name}-certificate-renewal-notifier"
  role            = aws_iam_role.certificate_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.certificate_lambda_zip.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 60

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
      DOMAIN_NAME   = var.domain_name
    }
  }

  tags = {
    Name = "${var.project_name}-certificate-renewal-notifier"
  }
}

# Lambda function code archive
data "archive_file" "certificate_lambda_zip" {
  type        = "zip"
  output_path = "certificate-renewal-notifier.zip"
  source {
    content = templatefile("${path.module}/functions/certificate-renewal-notifier.js", {
      domain_name = var.domain_name
    })
    filename = "index.js"
  }
}

# IAM role for certificate Lambda function
resource "aws_iam_role" "certificate_lambda_role" {
  name = "${var.project_name}-certificate-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-certificate-lambda-role"
  }
}

# IAM policy for certificate Lambda function
resource "aws_iam_role_policy" "certificate_lambda_policy" {
  name = "${var.project_name}-certificate-lambda-policy"
  role = aws_iam_role.certificate_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "acm:DescribeCertificate",
          "acm:ListCertificates"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# EventBridge rule for certificate expiration checks
resource "aws_cloudwatch_event_rule" "certificate_check" {
  name                = "${var.project_name}-certificate-check"
  description         = "Trigger certificate expiration check"
  schedule_expression = "rate(7 days)" # Check weekly

  tags = {
    Name = "${var.project_name}-certificate-check"
  }
}

# EventBridge target for certificate Lambda
resource "aws_cloudwatch_event_target" "certificate_lambda_target" {
  rule      = aws_cloudwatch_event_rule.certificate_check.name
  target_id = "CertificateLambdaTarget"
  arn       = aws_lambda_function.certificate_renewal_notifier.arn
}

# Lambda permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_certificate" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.certificate_renewal_notifier.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.certificate_check.arn
}

# Provider for us-east-1 region (required for CloudFront certificates)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}