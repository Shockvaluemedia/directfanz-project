# CloudWatch Monitoring Configuration - DirectFanz AWS Infrastructure
# Requirements: 7.1, 7.5, 7.6 - Comprehensive monitoring and observability

# CloudWatch Log Groups for different services
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/ecs/${var.project_name}/app"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.app_key.arn

  tags = {
    Name        = "${var.project_name}-app-logs"
    Environment = var.environment
    Service     = "application"
  }
}

resource "aws_cloudwatch_log_group" "websocket_logs" {
  name              = "/aws/ecs/${var.project_name}/websocket"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.app_key.arn

  tags = {
    Name        = "${var.project_name}-websocket-logs"
    Environment = var.environment
    Service     = "websocket"
  }
}

resource "aws_cloudwatch_log_group" "streaming_logs" {
  name              = "/aws/ecs/${var.project_name}/streaming"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.app_key.arn

  tags = {
    Name        = "${var.project_name}-streaming-logs"
    Environment = var.environment
    Service     = "streaming"
  }
}

resource "aws_cloudwatch_log_group" "alb_logs" {
  name              = "/aws/applicationloadbalancer/${var.project_name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.app_key.arn

  tags = {
    Name        = "${var.project_name}-alb-logs"
    Environment = var.environment
    Service     = "load-balancer"
  }
}

# Custom CloudWatch Metrics for Business KPIs
resource "aws_cloudwatch_log_metric_filter" "active_users" {
  name           = "${var.project_name}-active-users"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"USER_LOGIN\", user_id, ...]"

  metric_transformation {
    name      = "ActiveUsers"
    namespace = "${var.project_name}/Business"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "stream_starts" {
  name           = "${var.project_name}-stream-starts"
  log_group_name = aws_cloudwatch_log_group.streaming_logs.name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"STREAM_STARTED\", stream_id, ...]"

  metric_transformation {
    name      = "StreamStarts"
    namespace = "${var.project_name}/Business"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "revenue_events" {
  name           = "${var.project_name}-revenue-events"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"PAYMENT_COMPLETED\", amount, ...]"

  metric_transformation {
    name      = "RevenueEvents"
    namespace = "${var.project_name}/Business"
    value     = "$amount"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "content_uploads" {
  name           = "${var.project_name}-content-uploads"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"CONTENT_UPLOADED\", content_type, size, ...]"

  metric_transformation {
    name      = "ContentUploads"
    namespace = "${var.project_name}/Business"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "subscription_events" {
  name           = "${var.project_name}-subscription-events"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"INFO\", message=\"SUBSCRIPTION_CREATED\", user_id, creator_id, ...]"

  metric_transformation {
    name      = "NewSubscriptions"
    namespace = "${var.project_name}/Business"
    value     = "1"
    default_value = "0"
  }
}

# Application Performance Metrics
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "${var.project_name}-api-errors"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "APIErrors"
    namespace = "${var.project_name}/Application"
    value     = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "slow_queries" {
  name           = "${var.project_name}-slow-queries"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"WARN\", message=\"SLOW_QUERY\", duration, ...]"

  metric_transformation {
    name      = "SlowQueries"
    namespace = "${var.project_name}/Application"
    value     = "1"
    default_value = "0"
  }
}

# Comprehensive CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main_dashboard" {
  dashboard_name = "${var.project_name}-main-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Application Load Balancer Metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Load Balancer Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # ECS Service Metrics
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.project_name}-web-app", "ClusterName", "${var.project_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "CPUUtilization", "ServiceName", "${var.project_name}-websocket", "ClusterName", "${var.project_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Service Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # RDS Database Metrics
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.postgres_enhanced.id],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."],
            [".", "FreeableMemory", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Database Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # ElastiCache Redis Metrics
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${var.project_name}-redis-enhanced"],
            [".", "DatabaseMemoryUsagePercentage", ".", "."],
            [".", "CacheHits", ".", "."],
            [".", "CacheMisses", ".", "."],
            [".", "NetworkBytesIn", ".", "."],
            [".", "NetworkBytesOut", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ElastiCache Redis Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # Business KPIs
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/Business", "ActiveUsers"],
            [".", "StreamStarts"],
            [".", "NewSubscriptions"],
            [".", "ContentUploads"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Business KPIs"
          period  = 300
          stat    = "Sum"
        }
      },

      # Application Performance
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/Application", "APIErrors"],
            [".", "SlowQueries"],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Performance"
          period  = 300
          stat    = "Average"
        }
      },

      # CloudFront CDN Metrics
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.main.id],
            [".", "BytesDownloaded", ".", "."],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."],
            [".", "CacheHitRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"  # CloudFront metrics are always in us-east-1
          title   = "CloudFront CDN Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # S3 Storage Metrics
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.content_storage.bucket, "StorageType", "StandardStorage"],
            [".", "NumberOfObjects", ".", ".", ".", "AllStorageTypes"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "S3 Storage Metrics"
          period  = 86400  # Daily for storage metrics
          stat    = "Average"
        }
      }
    ]
  })
}

# Business KPIs Dashboard
resource "aws_cloudwatch_dashboard" "business_dashboard" {
  dashboard_name = "${var.project_name}-business-kpis"

  dashboard_body = jsonencode({
    widgets = [
      # Revenue Metrics
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/Business", "RevenueEvents"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Revenue Events"
          period  = 3600  # Hourly
          stat    = "Sum"
        }
      },

      # User Engagement
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/Business", "ActiveUsers"],
            [".", "NewSubscriptions"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "User Engagement"
          period  = 3600  # Hourly
          stat    = "Sum"
        }
      },

      # Content Metrics
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["${var.project_name}/Business", "ContentUploads"],
            [".", "StreamStarts"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Content Activity"
          period  = 3600  # Hourly
          stat    = "Sum"
        }
      }
    ]
  })
}

# Performance Dashboard
resource "aws_cloudwatch_dashboard" "performance_dashboard" {
  dashboard_name = "${var.project_name}-performance"

  dashboard_body = jsonencode({
    widgets = [
      # API Performance
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix],
            ["${var.project_name}/Application", "APIErrors"],
            [".", "SlowQueries"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Performance Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # Database Performance
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "ReadLatency", "DBInstanceIdentifier", aws_db_instance.postgres_enhanced.id],
            [".", "WriteLatency", ".", "."],
            [".", "DatabaseConnections", ".", "."],
            [".", "CPUUtilization", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Database Performance"
          period  = 300
          stat    = "Average"
        }
      },

      # Cache Performance
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CacheHits", "CacheClusterId", "${var.project_name}-redis-enhanced"],
            [".", "CacheMisses", ".", "."],
            [".", "CPUUtilization", ".", "."],
            [".", "DatabaseMemoryUsagePercentage", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Cache Performance"
          period  = 300
          stat    = "Average"
        }
      },

      # CDN Performance
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/CloudFront", "CacheHitRate", "DistributionId", aws_cloudfront_distribution.main.id],
            [".", "OriginLatency", ".", "."],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"  # CloudFront metrics are always in us-east-1
          title   = "CDN Performance"
          period  = 300
          stat    = "Average"
        }
      }
    ]
  })
}

# Infrastructure Dashboard
resource "aws_cloudwatch_dashboard" "infrastructure_dashboard" {
  dashboard_name = "${var.project_name}-infrastructure"

  dashboard_body = jsonencode({
    widgets = [
      # ECS Cluster Overview
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.project_name}-web-app", "ClusterName", "${var.project_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "RunningTaskCount", ".", ".", ".", "."],
            [".", "PendingTaskCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Web App Service"
          period  = 300
          stat    = "Average"
        }
      },

      # WebSocket Service
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.project_name}-websocket", "ClusterName", "${var.project_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."],
            [".", "RunningTaskCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS WebSocket Service"
          period  = 300
          stat    = "Average"
        }
      },

      # Auto Scaling Metrics
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationAutoScaling", "TargetValue", "ResourceId", "service/${var.project_name}-cluster/${var.project_name}-web-app"],
            [".", "ActualValue", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Auto Scaling Metrics"
          period  = 300
          stat    = "Average"
        }
      },

      # Network Metrics
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "ActiveConnectionCount", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "NewConnectionCount", ".", "."],
            [".", "ProcessedBytes", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Network Metrics"
          period  = 300
          stat    = "Sum"
        }
      }
    ]
  })
}

# Custom CloudWatch Alarms for Application Metrics
resource "aws_cloudwatch_metric_alarm" "high_api_error_rate" {
  alarm_name          = "${var.project_name}-high-api-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "APIErrors"
  namespace           = "${var.project_name}/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors API error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-high-api-error-rate"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "slow_database_queries" {
  alarm_name          = "${var.project_name}-slow-database-queries"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SlowQueries"
  namespace           = "${var.project_name}/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors slow database queries"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = {
    Name        = "${var.project_name}-slow-database-queries"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "low_cache_hit_rate" {
  alarm_name          = "${var.project_name}-low-cache-hit-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors cache hit rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    CacheClusterId = "${var.project_name}-redis-enhanced"
  }

  tags = {
    Name        = "${var.project_name}-low-cache-hit-rate"
    Environment = var.environment
  }
}