# Migration Progress Monitoring Infrastructure
# CloudWatch dashboards and alarms for migration tracking
# Implements Requirements 11.6

resource "aws_cloudwatch_dashboard" "migration_dashboard" {
  dashboard_name = "DirectFanz-Migration-Progress"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["DirectFanz/Migration", "MigrationInitialized"],
            [".", "PhaseStarted"],
            [".", "PhaseCompleted"],
            [".", "PhaseFailed"],
            [".", "SubTaskStarted"],
            [".", "SubTaskCompleted"],
            [".", "SubTaskFailed"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Migration Events"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["DirectFanz/Migration", "PhaseProgress", "PhaseId", "infrastructure-setup"],
            [".", ".", ".", "database-migration"],
            [".", ".", ".", "caching-layer"],
            [".", ".", ".", "container-orchestration"],
            [".", ".", ".", "content-storage"],
            [".", ".", ".", "streaming-infrastructure"],
            [".", ".", ".", "application-migration"],
            [".", ".", ".", "security-implementation"],
            [".", ".", ".", "monitoring-observability"],
            [".", ".", ".", "final-validation"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Phase Progress"
          period  = 300
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["DirectFanz/Migration", "TotalDataMigrated"],
            [".", "MigrationSpeed"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Data Migration Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["DirectFanz/Migration", "ErrorRate"],
            [".", "AlertCreated", "AlertType", "error"],
            [".", ".", ".", "critical"],
            [".", ".", ".", "warning"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Error Metrics and Alerts"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["DirectFanz/Migration", "MigrationPaused"],
            [".", "MigrationResumed"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Migration Control Events"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/lambda/migration-tracker'\n| fields @timestamp, @message\n| filter @message like /Migration/\n| sort @timestamp desc\n| limit 100"
          region  = var.aws_region
          title   = "Migration Logs"
          view    = "table"
        }
      }
    ]
  })
}

# CloudWatch Alarms for Migration Monitoring
resource "aws_cloudwatch_metric_alarm" "migration_phase_failure" {
  alarm_name          = "migration-phase-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "PhaseFailed"
  namespace           = "DirectFanz/Migration"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors migration phase failures"
  alarm_actions       = [aws_sns_topic.migration_alerts.arn]

  tags = {
    Name        = "Migration Phase Failure Alarm"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

resource "aws_cloudwatch_metric_alarm" "migration_high_error_rate" {
  alarm_name          = "migration-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRate"
  namespace           = "DirectFanz/Migration"
  period              = "300"
  statistic           = "Average"
  threshold           = "10"
  alarm_description   = "This metric monitors high error rates during migration"
  alarm_actions       = [aws_sns_topic.migration_alerts.arn]

  tags = {
    Name        = "Migration High Error Rate Alarm"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

resource "aws_cloudwatch_metric_alarm" "migration_stalled" {
  alarm_name          = "migration-stalled"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "PhaseProgress"
  namespace           = "DirectFanz/Migration"
  period              = "900"
  statistic           = "Maximum"
  threshold           = "1"
  alarm_description   = "This metric detects when migration progress has stalled"
  alarm_actions       = [aws_sns_topic.migration_alerts.arn]
  treat_missing_data  = "breaching"

  tags = {
    Name        = "Migration Stalled Alarm"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# SNS Topic for Migration Alerts
resource "aws_sns_topic" "migration_alerts" {
  name = "directfanz-migration-alerts"

  tags = {
    Name        = "Migration Alerts Topic"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

resource "aws_sns_topic_subscription" "migration_alerts_email" {
  count     = var.migration_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.migration_alerts.arn
  protocol  = "email"
  endpoint  = var.migration_alert_email
}

# Lambda function for processing migration alerts
resource "aws_lambda_function" "migration_alert_processor" {
  filename         = "migration-alert-processor.zip"
  function_name    = "directfanz-migration-alert-processor"
  role            = aws_iam_role.migration_alert_processor_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.migration_slack_webhook_url
      ENVIRONMENT      = var.environment
    }
  }

  tags = {
    Name        = "Migration Alert Processor"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# IAM role for the alert processor Lambda
resource "aws_iam_role" "migration_alert_processor_role" {
  name = "directfanz-migration-alert-processor-role"

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
    Name        = "Migration Alert Processor Role"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

resource "aws_iam_role_policy_attachment" "migration_alert_processor_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.migration_alert_processor_role.name
}

# SNS subscription for Lambda
resource "aws_sns_topic_subscription" "migration_alerts_lambda" {
  topic_arn = aws_sns_topic.migration_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.migration_alert_processor.arn
}

resource "aws_lambda_permission" "allow_sns_invoke" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.migration_alert_processor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.migration_alerts.arn
}

# Store alert topic ARN in Parameter Store
resource "aws_ssm_parameter" "migration_alert_topic_arn" {
  name  = "/migration/alert-topic-arn"
  type  = "String"
  value = aws_sns_topic.migration_alerts.arn

  tags = {
    Name        = "Migration Alert Topic ARN"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# CloudWatch Log Group for migration tracking
resource "aws_cloudwatch_log_group" "migration_tracking" {
  name              = "/aws/lambda/migration-tracker"
  retention_in_days = var.migration_log_retention_days

  tags = {
    Name        = "Migration Tracking Logs"
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# Output values
output "migration_dashboard_url" {
  description = "URL to the CloudWatch migration dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.migration_dashboard.dashboard_name}"
}

output "migration_alert_topic_arn" {
  description = "ARN of the SNS topic for migration alerts"
  value       = aws_sns_topic.migration_alerts.arn
}

output "migration_log_group_name" {
  description = "Name of the CloudWatch log group for migration tracking"
  value       = aws_cloudwatch_log_group.migration_tracking.name
}