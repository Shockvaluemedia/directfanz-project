# Enhanced ECR Configuration - DirectFanz AWS Infrastructure

# ECR repository policies for secure access
resource "aws_ecr_repository_policy" "web_app" {
  repository = aws_ecr_repository.web_app.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCodeBuildAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.codebuild_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:GetAuthorizationToken"
        ]
      },
      {
        Sid    = "AllowECSAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_execution_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
      },
      {
        Sid    = "AllowCodePipelineAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.codepipeline_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

resource "aws_ecr_repository_policy" "websocket" {
  repository = aws_ecr_repository.websocket.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCodeBuildAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.codebuild_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:GetAuthorizationToken"
        ]
      },
      {
        Sid    = "AllowECSAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_execution_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
      },
      {
        Sid    = "AllowCodePipelineAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.codepipeline_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

resource "aws_ecr_repository_policy" "streaming" {
  repository = aws_ecr_repository.streaming.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCodeBuildAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.codebuild_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:GetAuthorizationToken"
        ]
      },
      {
        Sid    = "AllowECSAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_execution_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
      },
      {
        Sid    = "AllowCodePipelineAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.codepipeline_role.arn
        }
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

# CloudWatch alarms for ECR scanning results
resource "aws_cloudwatch_metric_alarm" "ecr_high_severity_vulnerabilities" {
  count               = var.enable_ecr_vulnerability_monitoring ? 1 : 0
  alarm_name          = "${var.project_name}-ecr-high-severity-vulnerabilities"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HighSeverityVulnerabilityCount"
  namespace           = "AWS/ECR"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "5"
  alarm_description   = "This metric monitors high severity vulnerabilities in ECR images"
  alarm_actions       = [aws_sns_topic.deployment_notifications.arn]

  dimensions = {
    RepositoryName = aws_ecr_repository.web_app.name
  }

  tags = {
    Name        = "${var.project_name}-ecr-vulnerability-alarm"
    Environment = var.environment
  }
}

# Lambda function for ECR scan result processing
resource "aws_lambda_function" "ecr_scan_processor" {
  count            = var.enable_ecr_scan_processing ? 1 : 0
  filename         = "ecr-scan-processor.zip"
  function_name    = "${var.project_name}-ecr-scan-processor"
  role            = aws_iam_role.ecr_scan_processor_role[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.ecr_scan_processor[0].output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 60

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.deployment_notifications.arn
      PROJECT_NAME  = var.project_name
    }
  }

  tags = {
    Name        = "${var.project_name}-ecr-scan-processor"
    Environment = var.environment
  }
}

# Archive for Lambda function
data "archive_file" "ecr_scan_processor" {
  count       = var.enable_ecr_scan_processing ? 1 : 0
  type        = "zip"
  output_path = "ecr-scan-processor.zip"
  
  source {
    content = templatefile("${path.module}/functions/ecr-scan-processor.js", {
      sns_topic_arn = aws_sns_topic.deployment_notifications.arn
      project_name  = var.project_name
    })
    filename = "index.js"
  }
}

# IAM role for ECR scan processor Lambda
resource "aws_iam_role" "ecr_scan_processor_role" {
  count = var.enable_ecr_scan_processing ? 1 : 0
  name  = "${var.project_name}-ecr-scan-processor-role"

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
    Name        = "${var.project_name}-ecr-scan-processor-role"
    Environment = var.environment
  }
}

# IAM policy for ECR scan processor Lambda
resource "aws_iam_role_policy" "ecr_scan_processor_policy" {
  count = var.enable_ecr_scan_processing ? 1 : 0
  name  = "${var.project_name}-ecr-scan-processor-policy"
  role  = aws_iam_role.ecr_scan_processor_role[0].id

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
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:DescribeImageScanFindings",
          "ecr:GetRepositoryPolicy",
          "ecr:DescribeRepositories"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.deployment_notifications.arn
      }
    ]
  })
}

# EventBridge rule for ECR scan completion
resource "aws_cloudwatch_event_rule" "ecr_scan_complete" {
  count       = var.enable_ecr_scan_processing ? 1 : 0
  name        = "${var.project_name}-ecr-scan-complete"
  description = "Trigger when ECR image scan completes"

  event_pattern = jsonencode({
    source      = ["aws.ecr"]
    detail-type = ["ECR Image Scan"]
    detail = {
      scan-status = ["COMPLETE"]
      repository-name = [
        aws_ecr_repository.web_app.name,
        aws_ecr_repository.websocket.name,
        aws_ecr_repository.streaming.name
      ]
    }
  })

  tags = {
    Name        = "${var.project_name}-ecr-scan-complete"
    Environment = var.environment
  }
}

# EventBridge target for ECR scan completion
resource "aws_cloudwatch_event_target" "ecr_scan_processor" {
  count     = var.enable_ecr_scan_processing ? 1 : 0
  rule      = aws_cloudwatch_event_rule.ecr_scan_complete[0].name
  target_id = "ECRScanProcessor"
  arn       = aws_lambda_function.ecr_scan_processor[0].arn
}

# Lambda permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge_ecr" {
  count         = var.enable_ecr_scan_processing ? 1 : 0
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ecr_scan_processor[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.ecr_scan_complete[0].arn
}