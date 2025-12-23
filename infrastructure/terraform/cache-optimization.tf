# Cache Optimization Configuration for DirectFanz Platform
# Implements advanced caching strategies to improve performance and reduce costs

# CloudFront Cache Optimization
resource "aws_cloudfront_cache_policy" "optimized_static_assets" {
  name        = "${var.project_name}-optimized-static-assets"
  comment     = "Optimized cache policy for static assets"
  default_ttl = var.cache_ttl_static_assets
  max_ttl     = var.cache_ttl_static_assets * 2
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "none"
    }

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["CloudFront-Viewer-Country", "CloudFront-Is-Mobile-Viewer"]
      }
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudfront_cache_policy" "optimized_images" {
  name        = "${var.project_name}-optimized-images"
  comment     = "Optimized cache policy for images with WebP support"
  default_ttl = var.cache_ttl_images
  max_ttl     = var.cache_ttl_images * 2
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["w", "h", "q", "format"] # Width, height, quality, format parameters
      }
    }

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept", "CloudFront-Viewer-Country"]
      }
    }

    cookies_config {
      cookie_behavior = "none"
    }
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudfront_cache_policy" "optimized_api" {
  name        = "${var.project_name}-optimized-api"
  comment     = "Optimized cache policy for API responses"
  default_ttl = 300  # 5 minutes
  max_ttl     = 3600 # 1 hour
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    query_strings_config {
      query_string_behavior = "all"
    }

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = [
          "Authorization",
          "Accept",
          "Content-Type",
          "User-Agent",
          "CloudFront-Viewer-Country"
        ]
      }
    }

    cookies_config {
      cookie_behavior = "whitelist"
      cookies {
        items = ["session-token", "user-id"]
      }
    }
  }

  tags = {
    Environment = var.environment
  }
}

# Cache Warming Lambda Function
resource "aws_lambda_function" "cache_warmer" {
  filename         = "cache-warmer.zip"
  function_name    = "${var.project_name}-cache-warmer"
  role            = aws_iam_role.cache_warmer_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.cache_warmer_zip.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 300

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT  = var.environment
      CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.main.id
      CACHE_WARMING_URLS = jsonencode(var.cache_warming_urls)
    }
  }

  tags = {
    Environment = var.environment
  }
}

# Create the cache warmer deployment package
data "archive_file" "cache_warmer_zip" {
  type        = "zip"
  output_path = "cache-warmer.zip"
  source {
    content = templatefile("${path.module}/functions/cache-warmer.js", {
      project_name = var.project_name
      environment  = var.environment
    })
    filename = "index.js"
  }
}

# IAM role for cache warmer Lambda
resource "aws_iam_role" "cache_warmer_lambda" {
  name = "${var.project_name}-cache-warmer-lambda-role"

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
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "cache_warmer_lambda_policy" {
  name = "${var.project_name}-cache-warmer-lambda-policy"
  role = aws_iam_role.cache_warmer_lambda.id

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
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule to trigger cache warming
resource "aws_cloudwatch_event_rule" "cache_warmer_schedule" {
  name                = "${var.project_name}-cache-warmer-schedule"
  description         = "Trigger cache warmer Lambda"
  schedule_expression = var.cache_warming_schedule

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "cache_warmer_target" {
  rule      = aws_cloudwatch_event_rule.cache_warmer_schedule.name
  target_id = "CacheWarmerTarget"
  arn       = aws_lambda_function.cache_warmer.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_cache_warmer" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cache_warmer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cache_warmer_schedule.arn
}

# Cache Hit Rate Monitoring
resource "aws_cloudwatch_metric_alarm" "cache_hit_rate_low" {
  alarm_name          = "${var.project_name}-cache-hit-rate-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cloudfront_cache_hit_rate_threshold
  alarm_description   = "This metric monitors CloudFront cache hit rate"
  alarm_actions       = [aws_sns_topic.cache_optimization_alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "origin_latency_high" {
  alarm_name          = "${var.project_name}-origin-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "OriginLatency"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = 1000 # 1 second
  alarm_description   = "This metric monitors CloudFront origin latency"
  alarm_actions       = [aws_sns_topic.cache_optimization_alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = {
    Environment = var.environment
  }
}

# SNS topic for cache optimization alerts
resource "aws_sns_topic" "cache_optimization_alerts" {
  name = "${var.project_name}-cache-optimization-alerts"

  tags = {
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "cache_optimization_email" {
  count     = var.cache_optimization_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cache_optimization_alerts.arn
  protocol  = "email"
  endpoint  = var.cache_optimization_alert_email
}

# ElastiCache Optimization
resource "aws_elasticache_parameter_group" "optimized_redis" {
  family = "redis7.x"
  name   = "${var.project_name}-optimized-redis"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }

  parameter {
    name  = "maxclients"
    value = "10000"
  }

  tags = {
    Environment = var.environment
  }
}

# Cache Analytics Lambda Function
resource "aws_lambda_function" "cache_analytics" {
  filename         = "cache-analytics.zip"
  function_name    = "${var.project_name}-cache-analytics"
  role            = aws_iam_role.cache_analytics_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.cache_analytics_zip.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 300

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT  = var.environment
      CLOUDFRONT_DISTRIBUTION_ID = aws_cloudfront_distribution.main.id
      SNS_TOPIC_ARN = aws_sns_topic.cache_optimization_alerts.arn
    }
  }

  tags = {
    Environment = var.environment
  }
}

# Create the cache analytics deployment package
data "archive_file" "cache_analytics_zip" {
  type        = "zip"
  output_path = "cache-analytics.zip"
  source {
    content = templatefile("${path.module}/functions/cache-analytics.js", {
      project_name = var.project_name
      environment  = var.environment
    })
    filename = "index.js"
  }
}

# IAM role for cache analytics Lambda
resource "aws_iam_role" "cache_analytics_lambda" {
  name = "${var.project_name}-cache-analytics-lambda-role"

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
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "cache_analytics_lambda_policy" {
  name = "${var.project_name}-cache-analytics-lambda-policy"
  role = aws_iam_role.cache_analytics_lambda.id

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
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.cache_optimization_alerts.arn
      }
    ]
  })
}

# CloudWatch Event Rule to trigger cache analytics
resource "aws_cloudwatch_event_rule" "cache_analytics_schedule" {
  name                = "${var.project_name}-cache-analytics-schedule"
  description         = "Trigger cache analytics Lambda daily"
  schedule_expression = "rate(1 day)"

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "cache_analytics_target" {
  rule      = aws_cloudwatch_event_rule.cache_analytics_schedule.name
  target_id = "CacheAnalyticsTarget"
  arn       = aws_lambda_function.cache_analytics.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_cache_analytics" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cache_analytics.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cache_analytics_schedule.arn
}

# Cache optimization variables
variable "cache_warming_urls" {
  description = "List of URLs to warm in cache"
  type        = list(string)
  default = [
    "/",
    "/api/health",
    "/api/user/profile",
    "/static/css/main.css",
    "/static/js/main.js"
  ]
}

variable "cache_warming_schedule" {
  description = "Schedule expression for cache warming"
  type        = string
  default     = "rate(6 hours)"
}

variable "enable_cache_warming" {
  description = "Enable automatic cache warming"
  type        = bool
  default     = true
}

variable "cache_optimization_alert_email" {
  description = "Email address for cache optimization alerts"
  type        = string
  default     = ""
}

# Outputs
output "cache_policies" {
  description = "Created CloudFront cache policies"
  value = {
    static_assets = aws_cloudfront_cache_policy.optimized_static_assets.id
    images        = aws_cloudfront_cache_policy.optimized_images.id
    api           = aws_cloudfront_cache_policy.optimized_api.id
  }
}

output "cache_optimization_functions" {
  description = "Cache optimization Lambda functions"
  value = {
    cache_warmer   = aws_lambda_function.cache_warmer.function_name
    cache_analytics = aws_lambda_function.cache_analytics.function_name
  }
}