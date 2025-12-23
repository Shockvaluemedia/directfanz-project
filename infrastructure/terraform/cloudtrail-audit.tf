# CloudTrail for Audit Logging - DirectFanz AWS Infrastructure

# S3 bucket for CloudTrail logs
resource "aws_s3_bucket" "cloudtrail_logs" {
  bucket        = "${var.project_name}-${var.environment}-cloudtrail-logs-${random_string.cloudtrail_suffix.result}"
  force_destroy = var.environment != "prod"

  tags = {
    Name        = "${var.project_name}-cloudtrail-logs"
    Environment = var.environment
  }
}

resource "random_string" "cloudtrail_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 bucket versioning for CloudTrail logs
resource "aws_s3_bucket_versioning" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption for CloudTrail logs
resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.cloudtrail_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block for CloudTrail logs
resource "aws_s3_bucket_public_access_block" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket policy for CloudTrail
resource "aws_s3_bucket_policy" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail_logs.arn
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-cloudtrail"
          }
        }
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail_logs.arn}/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
            "AWS:SourceArn" = "arn:aws:cloudtrail:${var.aws_region}:${data.aws_caller_identity.current.account_id}:trail/${var.project_name}-cloudtrail"
          }
        }
      }
    ]
  })
}

# S3 bucket lifecycle configuration for CloudTrail logs
resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail_logs" {
  bucket = aws_s3_bucket.cloudtrail_logs.id

  rule {
    id     = "cloudtrail_log_lifecycle"
    status = "Enabled"

    # Transition to IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Transition to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Transition to Deep Archive after 365 days
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    # Delete after 7 years (2555 days)
    expiration {
      days = 2555
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CloudWatch Log Group for CloudTrail
resource "aws_cloudwatch_log_group" "cloudtrail" {
  name              = "/aws/cloudtrail/${var.project_name}"
  retention_in_days = 90
  kms_key_id        = aws_kms_key.app_key.arn

  tags = {
    Name        = "${var.project_name}-cloudtrail-logs"
    Environment = var.environment
  }
}

# IAM role for CloudTrail CloudWatch Logs
resource "aws_iam_role" "cloudtrail_cloudwatch_role" {
  name = "${var.project_name}-cloudtrail-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-cloudtrail-cloudwatch-role"
  }
}

# IAM policy for CloudTrail CloudWatch Logs
resource "aws_iam_role_policy" "cloudtrail_cloudwatch_policy" {
  name = "${var.project_name}-cloudtrail-cloudwatch-policy"
  role = aws_iam_role.cloudtrail_cloudwatch_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
      }
    ]
  })
}

# CloudTrail
resource "aws_cloudtrail" "main" {
  name           = "${var.project_name}-cloudtrail"
  s3_bucket_name = aws_s3_bucket.cloudtrail_logs.bucket
  s3_key_prefix  = "cloudtrail-logs"

  # Enable CloudWatch Logs
  cloud_watch_logs_group_arn = "${aws_cloudwatch_log_group.cloudtrail.arn}:*"
  cloud_watch_logs_role_arn  = aws_iam_role.cloudtrail_cloudwatch_role.arn

  # Enable log file encryption
  kms_key_id = aws_kms_key.cloudtrail_key.arn

  # Enable log file validation
  enable_log_file_validation = true

  # Include global service events
  include_global_service_events = true
  is_multi_region_trail         = true

  # Event selectors for data events
  event_selector {
    read_write_type                 = "All"
    include_management_events       = true

    # Log S3 data events
    data_resource {
      type   = "AWS::S3::Object"
      values = ["${aws_s3_bucket.app_storage.arn}/*"]
    }

    data_resource {
      type   = "AWS::S3::Bucket"
      values = [aws_s3_bucket.app_storage.arn]
    }
  }

  # Advanced event selectors for more granular logging
  advanced_event_selector {
    name = "Log all management events"
    field_selector {
      field  = "eventCategory"
      equals = ["Management"]
    }
  }

  advanced_event_selector {
    name = "Log S3 data events for application bucket"
    field_selector {
      field  = "eventCategory"
      equals = ["Data"]
    }
    field_selector {
      field  = "resources.type"
      equals = ["AWS::S3::Object"]
    }
    field_selector {
      field  = "resources.ARN"
      starts_with = ["${aws_s3_bucket.app_storage.arn}/"]
    }
  }

  tags = {
    Name        = "${var.project_name}-cloudtrail"
    Environment = var.environment
  }

  depends_on = [
    aws_s3_bucket_policy.cloudtrail_logs
  ]
}

# CloudWatch metric filter for failed logins
resource "aws_cloudwatch_log_metric_filter" "failed_logins" {
  name           = "${var.project_name}-failed-logins"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.errorCode = \"*UnauthorizedOperation\") || ($.errorCode = \"AccessDenied*\") }"

  metric_transformation {
    name      = "FailedLoginAttempts"
    namespace = "${var.project_name}/Security"
    value     = "1"
  }
}

# CloudWatch alarm for failed logins
resource "aws_cloudwatch_metric_alarm" "failed_logins" {
  alarm_name          = "${var.project_name}-failed-logins"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FailedLoginAttempts"
  namespace           = "${var.project_name}/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors failed login attempts"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Name        = "${var.project_name}-failed-logins-alarm"
    Environment = var.environment
  }
}

# CloudWatch metric filter for root account usage
resource "aws_cloudwatch_log_metric_filter" "root_usage" {
  name           = "${var.project_name}-root-usage"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ $.userIdentity.type = \"Root\" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != \"AwsServiceEvent\" }"

  metric_transformation {
    name      = "RootAccountUsage"
    namespace = "${var.project_name}/Security"
    value     = "1"
  }
}

# CloudWatch alarm for root account usage
resource "aws_cloudwatch_metric_alarm" "root_usage" {
  alarm_name          = "${var.project_name}-root-usage"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "RootAccountUsage"
  namespace           = "${var.project_name}/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors root account usage"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Name        = "${var.project_name}-root-usage-alarm"
    Environment = var.environment
  }
}

# CloudWatch metric filter for IAM policy changes
resource "aws_cloudwatch_log_metric_filter" "iam_policy_changes" {
  name           = "${var.project_name}-iam-policy-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventName = DeleteGroupPolicy) || ($.eventName = DeleteRolePolicy) || ($.eventName = DeleteUserPolicy) || ($.eventName = PutGroupPolicy) || ($.eventName = PutRolePolicy) || ($.eventName = PutUserPolicy) || ($.eventName = CreatePolicy) || ($.eventName = DeletePolicy) || ($.eventName = CreatePolicyVersion) || ($.eventName = DeletePolicyVersion) || ($.eventName = AttachRolePolicy) || ($.eventName = DetachRolePolicy) || ($.eventName = AttachUserPolicy) || ($.eventName = DetachUserPolicy) || ($.eventName = AttachGroupPolicy) || ($.eventName = DetachGroupPolicy) }"

  metric_transformation {
    name      = "IAMPolicyChanges"
    namespace = "${var.project_name}/Security"
    value     = "1"
  }
}

# CloudWatch alarm for IAM policy changes
resource "aws_cloudwatch_metric_alarm" "iam_policy_changes" {
  alarm_name          = "${var.project_name}-iam-policy-changes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "IAMPolicyChanges"
  namespace           = "${var.project_name}/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors IAM policy changes"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Name        = "${var.project_name}-iam-policy-changes-alarm"
    Environment = var.environment
  }
}

# CloudWatch metric filter for security group changes
resource "aws_cloudwatch_log_metric_filter" "security_group_changes" {
  name           = "${var.project_name}-security-group-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventName = AuthorizeSecurityGroupIngress) || ($.eventName = AuthorizeSecurityGroupEgress) || ($.eventName = RevokeSecurityGroupIngress) || ($.eventName = RevokeSecurityGroupEgress) || ($.eventName = CreateSecurityGroup) || ($.eventName = DeleteSecurityGroup) }"

  metric_transformation {
    name      = "SecurityGroupChanges"
    namespace = "${var.project_name}/Security"
    value     = "1"
  }
}

# CloudWatch alarm for security group changes
resource "aws_cloudwatch_metric_alarm" "security_group_changes" {
  alarm_name          = "${var.project_name}-security-group-changes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "SecurityGroupChanges"
  namespace           = "${var.project_name}/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors security group changes"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Name        = "${var.project_name}-security-group-changes-alarm"
    Environment = var.environment
  }
}

# CloudWatch metric filter for console sign-in without MFA
resource "aws_cloudwatch_log_metric_filter" "console_signin_without_mfa" {
  name           = "${var.project_name}-console-signin-without-mfa"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventName = \"ConsoleLogin\") && ($.additionalEventData.MFAUsed != \"Yes\") }"

  metric_transformation {
    name      = "ConsoleSigninWithoutMFA"
    namespace = "${var.project_name}/Security"
    value     = "1"
  }
}

# CloudWatch alarm for console sign-in without MFA
resource "aws_cloudwatch_metric_alarm" "console_signin_without_mfa" {
  alarm_name          = "${var.project_name}-console-signin-without-mfa"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "ConsoleSigninWithoutMFA"
  namespace           = "${var.project_name}/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors console sign-ins without MFA"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Name        = "${var.project_name}-console-signin-without-mfa-alarm"
    Environment = var.environment
  }
}

# CloudWatch metric filter for CloudTrail configuration changes
resource "aws_cloudwatch_log_metric_filter" "cloudtrail_config_changes" {
  name           = "${var.project_name}-cloudtrail-config-changes"
  log_group_name = aws_cloudwatch_log_group.cloudtrail.name
  pattern        = "{ ($.eventName = CreateTrail) || ($.eventName = UpdateTrail) || ($.eventName = DeleteTrail) || ($.eventName = StartLogging) || ($.eventName = StopLogging) }"

  metric_transformation {
    name      = "CloudTrailConfigChanges"
    namespace = "${var.project_name}/Security"
    value     = "1"
  }
}

# CloudWatch alarm for CloudTrail configuration changes
resource "aws_cloudwatch_metric_alarm" "cloudtrail_config_changes" {
  alarm_name          = "${var.project_name}-cloudtrail-config-changes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "CloudTrailConfigChanges"
  namespace           = "${var.project_name}/Security"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors CloudTrail configuration changes"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  tags = {
    Name        = "${var.project_name}-cloudtrail-config-changes-alarm"
    Environment = var.environment
  }
}