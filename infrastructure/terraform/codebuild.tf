# AWS CodeBuild Configuration - DirectFanz AWS Infrastructure

# CodeBuild project for building and testing
resource "aws_codebuild_project" "main" {
  name          = "${var.project_name}-${var.environment}-build"
  description   = "Build and test project for ${var.project_name}"
  service_role  = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_MEDIUM"
    image                      = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                       = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode            = true # Required for Docker builds

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }

    environment_variable {
      name  = "IMAGE_REPO_NAME_WEB_APP"
      value = aws_ecr_repository.web_app.name
    }

    environment_variable {
      name  = "IMAGE_REPO_NAME_WEBSOCKET"
      value = aws_ecr_repository.websocket.name
    }

    environment_variable {
      name  = "IMAGE_REPO_NAME_STREAMING"
      value = aws_ecr_repository.streaming.name
    }

    environment_variable {
      name  = "IMAGE_TAG"
      value = "latest"
    }

    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }

    environment_variable {
      name  = "PROJECT_NAME"
      value = var.project_name
    }
  }

  source {
    type = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  vpc_config {
    vpc_id = module.vpc.vpc_id

    subnets = module.vpc.private_subnets

    security_group_ids = [
      aws_security_group.codebuild.id
    ]
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild.name
      stream_name = "build-log"
    }

    s3_logs {
      status   = "ENABLED"
      location = "${aws_s3_bucket.codepipeline_artifacts.bucket}/build-logs"
    }
  }

  tags = {
    Name        = "${var.project_name}-codebuild"
    Environment = var.environment
  }
}

# Security group for CodeBuild
resource "aws_security_group" "codebuild" {
  name        = "${var.project_name}-codebuild-sg"
  description = "Security group for CodeBuild project"
  vpc_id      = module.vpc.vpc_id

  # Outbound rules for package downloads and ECR access
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP outbound for package downloads"
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound for package downloads and AWS services"
  }

  # DNS resolution
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "DNS resolution"
  }

  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "DNS resolution"
  }

  tags = {
    Name        = "${var.project_name}-codebuild-sg"
    Environment = var.environment
  }
}

# CloudWatch log group for CodeBuild
resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/aws/codebuild/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-codebuild-logs"
    Environment = var.environment
  }
}

# CodeBuild project for testing only (separate from main build)
resource "aws_codebuild_project" "test" {
  name          = "${var.project_name}-${var.environment}-test"
  description   = "Test-only project for ${var.project_name}"
  service_role  = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                      = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                       = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode            = false

    environment_variable {
      name  = "NODE_ENV"
      value = "test"
    }

    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }

    environment_variable {
      name  = "PROJECT_NAME"
      value = var.project_name
    }
  }

  source {
    type = "CODEPIPELINE"
    buildspec = "buildspec-test.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild_test.name
      stream_name = "test-log"
    }
  }

  tags = {
    Name        = "${var.project_name}-codebuild-test"
    Environment = var.environment
  }
}

# CloudWatch log group for test CodeBuild
resource "aws_cloudwatch_log_group" "codebuild_test" {
  name              = "/aws/codebuild/${var.project_name}-test"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-codebuild-test-logs"
    Environment = var.environment
  }
}

# CodeBuild webhook for GitHub integration (optional)
resource "aws_codebuild_webhook" "main" {
  count        = var.enable_codebuild_webhook ? 1 : 0
  project_name = aws_codebuild_project.main.name
  build_type   = "BUILD"

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PUSH"
    }

    filter {
      type    = "HEAD_REF"
      pattern = "^refs/heads/${var.github_branch}$"
    }
  }

  filter_group {
    filter {
      type    = "EVENT"
      pattern = "PULL_REQUEST_CREATED,PULL_REQUEST_UPDATED,PULL_REQUEST_REOPENED"
    }

    filter {
      type    = "BASE_REF"
      pattern = "^refs/heads/${var.github_branch}$"
    }
  }
}

# CloudWatch alarms for CodeBuild monitoring
resource "aws_cloudwatch_metric_alarm" "codebuild_failed_builds" {
  alarm_name          = "${var.project_name}-codebuild-failed-builds"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FailedBuilds"
  namespace           = "AWS/CodeBuild"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors failed CodeBuild builds"
  alarm_actions       = [aws_sns_topic.deployment_notifications.arn]

  dimensions = {
    ProjectName = aws_codebuild_project.main.name
  }

  tags = {
    Name        = "${var.project_name}-codebuild-failed-builds-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "codebuild_build_duration" {
  alarm_name          = "${var.project_name}-codebuild-build-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/CodeBuild"
  period              = "300"
  statistic           = "Average"
  threshold           = "1800" # 30 minutes
  alarm_description   = "This metric monitors CodeBuild build duration"
  alarm_actions       = [aws_sns_topic.deployment_notifications.arn]

  dimensions = {
    ProjectName = aws_codebuild_project.main.name
  }

  tags = {
    Name        = "${var.project_name}-codebuild-duration-alarm"
    Environment = var.environment
  }
}

# CodeBuild report groups for test results
resource "aws_codebuild_report_group" "test_reports" {
  name = "${var.project_name}-test-reports"
  type = "TEST"

  export_config {
    type = "S3"
    s3_destination {
      bucket                 = aws_s3_bucket.codepipeline_artifacts.bucket
      path                   = "/test-reports"
      encryption_disabled    = false
      encryption_key         = aws_kms_key.app_key.arn
      packaging              = "ZIP"
    }
  }

  tags = {
    Name        = "${var.project_name}-test-reports"
    Environment = var.environment
  }
}

resource "aws_codebuild_report_group" "coverage_reports" {
  name = "${var.project_name}-coverage-reports"
  type = "CODE_COVERAGE"

  export_config {
    type = "S3"
    s3_destination {
      bucket                 = aws_s3_bucket.codepipeline_artifacts.bucket
      path                   = "/coverage-reports"
      encryption_disabled    = false
      encryption_key         = aws_kms_key.app_key.arn
      packaging              = "ZIP"
    }
  }

  tags = {
    Name        = "${var.project_name}-coverage-reports"
    Environment = var.environment
  }
}