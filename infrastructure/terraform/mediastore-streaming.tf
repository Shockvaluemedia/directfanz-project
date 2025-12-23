# AWS Elemental MediaStore Configuration for Stream Storage
# This configuration sets up MediaStore containers for stream segments
# with CORS policies and lifecycle management

# MediaStore Container for live streaming
resource "aws_mediastore_container" "streaming" {
  name = "${var.project_name}-streaming-${var.environment}"

  tags = {
    Name        = "${var.project_name}-streaming-container"
    Environment = var.environment
  }
}

# MediaStore Container Policy for access control
resource "aws_mediastore_container_policy" "streaming" {
  container_name = aws_mediastore_container.streaming.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "MediaStoreFullAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.medialive_role.arn
        }
        Action = [
          "mediastore:GetObject",
          "mediastore:PutObject",
          "mediastore:DeleteObject",
          "mediastore:ListItems"
        ]
        Resource = "${aws_mediastore_container.streaming.arn}/*"
      },
      {
        Sid    = "PublicReadAccess"
        Effect = "Allow"
        Principal = "*"
        Action = [
          "mediastore:GetObject"
        ]
        Resource = "${aws_mediastore_container.streaming.arn}/*"
        Condition = {
          StringEquals = {
            "mediastore:x-amz-content-sha256" = "UNSIGNED-PAYLOAD"
          }
        }
      }
    ]
  })
}

# CORS Configuration for MediaStore
resource "aws_mediastore_container_cors_policy" "streaming" {
  container_name = aws_mediastore_container.streaming.name

  cors_policy {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["x-amz-request-id", "x-amz-id-2"]
    max_age_seconds = 3000
  }
}

# Lifecycle Policy for MediaStore to clean up old segments
resource "aws_mediastore_container_lifecycle_policy" "streaming" {
  container_name = aws_mediastore_container.streaming.name

  lifecycle_policy = jsonencode({
    rules = [
      {
        definition = {
          path = [
            {
              wildcard = "live/*"
            }
          ]
          days_since_create = [
            {
              numeric = [">", 7]
            }
          ]
        }
        action = "EXPIRE"
      },
      {
        definition = {
          path = [
            {
              wildcard = "*.ts"
            }
          ]
          days_since_create = [
            {
              numeric = [">", 1]
            }
          ]
        }
        action = "EXPIRE"
      },
      {
        definition = {
          path = [
            {
              wildcard = "*.m3u8"
            }
          ]
          days_since_create = [
            {
              numeric = [">", 1]
            }
          ]
        }
        action = "EXPIRE"
      }
    ]
  })
}

# CloudWatch Metrics for MediaStore
resource "aws_cloudwatch_metric_alarm" "mediastore_request_count" {
  alarm_name          = "${var.project_name}-mediastore-high-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RequestCount"
  namespace           = "AWS/MediaStore"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1000"
  alarm_description   = "This metric monitors MediaStore request count"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ContainerName = aws_mediastore_container.streaming.name
  }

  tags = {
    Name        = "${var.project_name}-mediastore-requests-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "mediastore_error_rate" {
  alarm_name          = "${var.project_name}-mediastore-high-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorCount"
  namespace           = "AWS/MediaStore"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors MediaStore 4xx error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ContainerName = aws_mediastore_container.streaming.name
  }

  tags = {
    Name        = "${var.project_name}-mediastore-errors-alarm"
    Environment = var.environment
  }
}

# Systems Manager Parameters for MediaStore configuration
resource "aws_ssm_parameter" "mediastore_endpoint" {
  name  = "/${var.project_name}/mediastore/endpoint"
  type  = "String"
  value = aws_mediastore_container.streaming.endpoint

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "mediastore_container_name" {
  name  = "/${var.project_name}/mediastore/container_name"
  type  = "String"
  value = aws_mediastore_container.streaming.name

  tags = {
    Environment = var.environment
  }
}

# IAM Role for application to access MediaStore
resource "aws_iam_role" "mediastore_access_role" {
  name = "${var.project_name}-mediastore-access-role"

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
    Name        = "${var.project_name}-mediastore-access-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "mediastore_access_policy" {
  name = "${var.project_name}-mediastore-access-policy"
  role = aws_iam_role.mediastore_access_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mediastore:GetObject",
          "mediastore:PutObject",
          "mediastore:DeleteObject",
          "mediastore:ListItems",
          "mediastore:DescribeContainer"
        ]
        Resource = [
          aws_mediastore_container.streaming.arn,
          "${aws_mediastore_container.streaming.arn}/*"
        ]
      }
    ]
  })
}

# Update the main app role to include MediaStore access
resource "aws_iam_role_policy_attachment" "app_mediastore_access" {
  role       = aws_iam_role.app_role.name
  policy_arn = aws_iam_policy.mediastore_access.arn
}

resource "aws_iam_policy" "mediastore_access" {
  name        = "${var.project_name}-mediastore-access"
  description = "Policy for accessing MediaStore containers"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mediastore:GetObject",
          "mediastore:PutObject",
          "mediastore:DeleteObject",
          "mediastore:ListItems",
          "mediastore:DescribeContainer"
        ]
        Resource = [
          aws_mediastore_container.streaming.arn,
          "${aws_mediastore_container.streaming.arn}/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-mediastore-access-policy"
    Environment = var.environment
  }
}