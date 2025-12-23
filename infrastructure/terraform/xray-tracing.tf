# AWS X-Ray Configuration for Distributed Tracing
# Requirements: 7.2 - AWS X-Ray for distributed tracing

# X-Ray service map and tracing configuration is handled through:
# 1. ECS task definitions with X-Ray daemon sidecar
# 2. Application instrumentation
# 3. IAM permissions for X-Ray

# IAM role for X-Ray daemon
resource "aws_iam_role" "xray_daemon_role" {
  name = "${var.project_name}-xray-daemon-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-xray-daemon-role"
    Environment = var.environment
  }
}

# IAM policy for X-Ray daemon
resource "aws_iam_role_policy" "xray_daemon_policy" {
  name = "${var.project_name}-xray-daemon-policy"
  role = aws_iam_role.xray_daemon_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      }
    ]
  })
}

# Update ECS task execution role to include X-Ray permissions
resource "aws_iam_role_policy_attachment" "ecs_task_xray_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Update application role to include X-Ray permissions
resource "aws_iam_role_policy_attachment" "app_xray_policy" {
  role       = aws_iam_role.app_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# X-Ray sampling rule for the application
resource "aws_xray_sampling_rule" "app_sampling_rule" {
  rule_name      = "${var.project_name}-app-sampling"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "${var.project_name}-*"
  resource_arn   = "*"

  tags = {
    Name        = "${var.project_name}-app-sampling"
    Environment = var.environment
  }
}

# X-Ray sampling rule for API endpoints (higher sampling rate)
resource "aws_xray_sampling_rule" "api_sampling_rule" {
  rule_name      = "${var.project_name}-api-sampling"
  priority       = 8000
  version        = 1
  reservoir_size = 2
  fixed_rate     = 0.2
  url_path       = "/api/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "${var.project_name}-*"
  resource_arn   = "*"

  tags = {
    Name        = "${var.project_name}-api-sampling"
    Environment = var.environment
  }
}

# X-Ray sampling rule for streaming endpoints (lower sampling rate)
resource "aws_xray_sampling_rule" "streaming_sampling_rule" {
  rule_name      = "${var.project_name}-streaming-sampling"
  priority       = 7000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.05
  url_path       = "/stream/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "${var.project_name}-*"
  resource_arn   = "*"

  tags = {
    Name        = "${var.project_name}-streaming-sampling"
    Environment = var.environment
  }
}

# CloudWatch alarms for X-Ray metrics
resource "aws_cloudwatch_metric_alarm" "xray_high_error_rate" {
  alarm_name          = "${var.project_name}-xray-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorRate"
  namespace           = "AWS/X-Ray"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.05" # 5% error rate
  alarm_description   = "This metric monitors X-Ray error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = "${var.project_name}-web-app"
  }

  tags = {
    Name        = "${var.project_name}-xray-high-error-rate"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "xray_high_response_time" {
  alarm_name          = "${var.project_name}-xray-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "ResponseTime"
  namespace           = "AWS/X-Ray"
  period              = "300"
  statistic           = "Average"
  threshold           = "2000" # 2 seconds
  alarm_description   = "This metric monitors X-Ray response time"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = "${var.project_name}-web-app"
  }

  tags = {
    Name        = "${var.project_name}-xray-high-response-time"
    Environment = var.environment
  }
}

# X-Ray service map dashboard widget (to be added to main dashboard)
resource "aws_cloudwatch_dashboard" "xray_dashboard" {
  dashboard_name = "${var.project_name}-xray-tracing"

  dashboard_body = jsonencode({
    widgets = [
      # Service Map (Note: Service maps are not directly available in CloudWatch dashboards)
      # This would typically be viewed in the X-Ray console
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 2

        properties = {
          markdown = "# X-Ray Distributed Tracing Dashboard\n\nFor detailed service maps and trace analysis, visit the [AWS X-Ray Console](https://console.aws.amazon.com/xray/home?region=${var.aws_region}#/service-map)"
        }
      },

      # X-Ray Service Statistics
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/X-Ray", "TracesReceived"],
            [".", "TracesProcessed"],
            [".", "LatencyHigh", "ServiceName", "${var.project_name}-web-app"],
            [".", "ErrorRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "X-Ray Service Statistics"
          period  = 300
          stat    = "Average"
        }
      },

      # Response Time Distribution
      {
        type   = "metric"
        x      = 12
        y      = 2
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/X-Ray", "ResponseTime", "ServiceName", "${var.project_name}-web-app"],
            [".", "ResponseTime", "ServiceName", "${var.project_name}-websocket"],
            [".", "ResponseTime", "ServiceName", "${var.project_name}-streaming"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Service Response Times"
          period  = 300
          stat    = "Average"
        }
      },

      # Error Analysis
      {
        type   = "metric"
        x      = 0
        y      = 8
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/X-Ray", "ErrorRate", "ServiceName", "${var.project_name}-web-app"],
            [".", "ErrorRate", "ServiceName", "${var.project_name}-websocket"],
            [".", "ErrorRate", "ServiceName", "${var.project_name}-streaming"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Service Error Rates"
          period  = 300
          stat    = "Average"
        }
      },

      # Throughput Analysis
      {
        type   = "metric"
        x      = 12
        y      = 8
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/X-Ray", "RequestCount", "ServiceName", "${var.project_name}-web-app"],
            [".", "RequestCount", "ServiceName", "${var.project_name}-websocket"],
            [".", "RequestCount", "ServiceName", "${var.project_name}-streaming"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Service Request Counts"
          period  = 300
          stat    = "Sum"
        }
      }
    ]
  })
}

# Output X-Ray configuration for application use
output "xray_daemon_role_arn" {
  description = "ARN of the X-Ray daemon IAM role"
  value       = aws_iam_role.xray_daemon_role.arn
}

output "xray_sampling_rules" {
  description = "X-Ray sampling rules configuration"
  value = {
    app_rule       = aws_xray_sampling_rule.app_sampling_rule.rule_name
    api_rule       = aws_xray_sampling_rule.api_sampling_rule.rule_name
    streaming_rule = aws_xray_sampling_rule.streaming_sampling_rule.rule_name
  }
}