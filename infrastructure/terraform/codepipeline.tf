# AWS CodePipeline Configuration - DirectFanz AWS Infrastructure

# GitHub connection for source integration
resource "aws_codestarconnections_connection" "github" {
  name          = "${var.project_name}-github-connection"
  provider_type = "GitHub"

  tags = {
    Name        = "${var.project_name}-github-connection"
    Environment = var.environment
  }
}

# CodePipeline for automated deployments
resource "aws_codepipeline" "main" {
  name     = "${var.project_name}-${var.environment}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = aws_s3_bucket.codepipeline_artifacts.bucket
    type     = "S3"

    encryption_key {
      id   = aws_kms_key.app_key.arn
      type = "KMS"
    }
  }

  # Source stage - GitHub integration
  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = aws_codestarconnections_connection.github.arn
        FullRepositoryId = var.github_repository
        BranchName       = var.github_branch
        OutputArtifactFormat = "CODE_ZIP"
      }
    }
  }

  # Build and Test stage
  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]

      configuration = {
        ProjectName = aws_codebuild_project.main.name
      }
    }
  }

  # Deploy to Staging stage
  stage {
    name = "DeployStaging"

    action {
      name            = "DeployWebApp"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeployToECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ApplicationName                = aws_codedeploy_app.web_app.name
        DeploymentGroupName           = aws_codedeploy_deployment_group.web_app_staging.deployment_group_name
        TaskDefinitionTemplateArtifact = "build_output"
        TaskDefinitionTemplatePath     = "taskdef-webapp.json"
        AppSpecTemplateArtifact        = "build_output"
        AppSpecTemplatePath           = "appspec-webapp.yaml"
      }
    }

    action {
      name            = "DeployWebSocket"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeployToECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ApplicationName                = aws_codedeploy_app.websocket.name
        DeploymentGroupName           = aws_codedeploy_deployment_group.websocket_staging.deployment_group_name
        TaskDefinitionTemplateArtifact = "build_output"
        TaskDefinitionTemplatePath     = "taskdef-websocket.json"
        AppSpecTemplateArtifact        = "build_output"
        AppSpecTemplatePath           = "appspec-websocket.yaml"
      }
    }
  }

  # Manual approval for production
  stage {
    name = "ApprovalForProduction"

    action {
      name     = "ManualApproval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"

      configuration = {
        NotificationArn    = aws_sns_topic.deployment_notifications.arn
        CustomData         = jsonencode({
          message = "Production Deployment Approval Required"
          details = {
            staging_url = "https://staging.${var.domain_name}"
            production_url = "https://${var.domain_name}"
            build_info = "#{codebuild.BUILD_ID}"
            commit_info = "#{codebuild.RESOLVED_SOURCE_VERSION}"
            approval_timeout = "24 hours"
            checklist = [
              "Staging deployment verified and tested",
              "All automated tests passed",
              "Performance metrics within acceptable range",
              "Security scan results reviewed",
              "Database migration scripts validated (if applicable)",
              "Rollback plan confirmed and ready"
            ]
          }
        })
        ExternalEntityLink = "https://staging.${var.domain_name}"
      }

      # Approval timeout configuration
      timeout_in_minutes = var.approval_timeout_hours * 60
    }
  }

  # Deploy to Production stage
  stage {
    name = "DeployProduction"

    action {
      name            = "DeployWebApp"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeployToECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ApplicationName                = aws_codedeploy_app.web_app.name
        DeploymentGroupName           = aws_codedeploy_deployment_group.web_app_production.deployment_group_name
        TaskDefinitionTemplateArtifact = "build_output"
        TaskDefinitionTemplatePath     = "taskdef-webapp.json"
        AppSpecTemplateArtifact        = "build_output"
        AppSpecTemplatePath           = "appspec-webapp.yaml"
      }
    }

    action {
      name            = "DeployWebSocket"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeployToECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ApplicationName                = aws_codedeploy_app.websocket.name
        DeploymentGroupName           = aws_codedeploy_deployment_group.websocket_production.deployment_group_name
        TaskDefinitionTemplateArtifact = "build_output"
        TaskDefinitionTemplatePath     = "taskdef-websocket.json"
        AppSpecTemplateArtifact        = "build_output"
        AppSpecTemplatePath           = "appspec-websocket.yaml"
      }
    }
  }

  tags = {
    Name        = "${var.project_name}-pipeline"
    Environment = var.environment
  }
}

# CloudWatch Event Rule for pipeline triggers
resource "aws_cloudwatch_event_rule" "pipeline_trigger" {
  name        = "${var.project_name}-pipeline-trigger"
  description = "Trigger CodePipeline on repository changes"

  event_pattern = jsonencode({
    source      = ["aws.codecommit"]
    detail-type = ["CodeCommit Repository State Change"]
    resources   = [aws_codestarconnections_connection.github.arn]
    detail = {
      event = ["referenceCreated", "referenceUpdated"]
      referenceType = ["branch"]
      referenceName = [var.github_branch]
    }
  })

  tags = {
    Name        = "${var.project_name}-pipeline-trigger"
    Environment = var.environment
  }
}

# CloudWatch Event Rule for approval workflow events
resource "aws_cloudwatch_event_rule" "approval_events" {
  name        = "${var.project_name}-approval-events"
  description = "Track approval workflow events in CodePipeline"

  event_pattern = jsonencode({
    source      = ["aws.codepipeline"]
    detail-type = ["CodePipeline Pipeline Execution State Change"]
    detail = {
      pipeline = [aws_codepipeline.main.name]
      stage    = ["ApprovalForProduction"]
      state    = ["STARTED", "SUCCEEDED", "FAILED"]
    }
  })

  tags = {
    Name        = "${var.project_name}-approval-events"
    Environment = var.environment
  }
}

# CloudWatch Event Rule for approval timeout events
resource "aws_cloudwatch_event_rule" "approval_timeout" {
  name        = "${var.project_name}-approval-timeout"
  description = "Track approval timeout events"

  event_pattern = jsonencode({
    source      = ["aws.codepipeline"]
    detail-type = ["CodePipeline Stage Execution State Change"]
    detail = {
      pipeline = [aws_codepipeline.main.name]
      stage    = ["ApprovalForProduction"]
      state    = ["FAILED"]
      "action-execution-result" = {
        "external-execution-summary" = ["Manual approval timed out"]
      }
    }
  })

  tags = {
    Name        = "${var.project_name}-approval-timeout"
    Environment = var.environment
  }
}

# CloudWatch Event Target for pipeline
resource "aws_cloudwatch_event_target" "pipeline" {
  rule      = aws_cloudwatch_event_rule.pipeline_trigger.name
  target_id = "TriggerPipeline"
  arn       = aws_codepipeline.main.arn
  role_arn  = aws_iam_role.pipeline_event_role.arn
}

# CloudWatch Event Target for approval events
resource "aws_cloudwatch_event_target" "approval_notifications" {
  rule      = aws_cloudwatch_event_rule.approval_events.name
  target_id = "ApprovalNotifications"
  arn       = aws_sns_topic.approval_status.arn

  input_transformer {
    input_paths = {
      pipeline = "$.detail.pipeline"
      stage    = "$.detail.stage"
      state    = "$.detail.state"
      time     = "$.time"
    }
    input_template = jsonencode({
      message = "Approval workflow event for pipeline <pipeline>"
      details = {
        pipeline = "<pipeline>"
        stage    = "<stage>"
        state    = "<state>"
        timestamp = "<time>"
        action_required = "Check CodePipeline console for details"
      }
    })
  }
}

# CloudWatch Event Target for approval timeout
resource "aws_cloudwatch_event_target" "approval_timeout_notifications" {
  rule      = aws_cloudwatch_event_rule.approval_timeout.name
  target_id = "ApprovalTimeoutNotifications"
  arn       = aws_sns_topic.approval_status.arn

  input_transformer {
    input_paths = {
      pipeline = "$.detail.pipeline"
      stage    = "$.detail.stage"
      time     = "$.time"
    }
    input_template = jsonencode({
      message = "URGENT: Approval timeout for pipeline <pipeline>"
      details = {
        pipeline = "<pipeline>"
        stage    = "<stage>"
        timestamp = "<time>"
        action_required = "Manual approval timed out. Pipeline execution stopped."
        next_steps = "Review and restart pipeline if needed"
      }
    })
  }
}

# IAM role for CloudWatch Events to trigger pipeline
resource "aws_iam_role" "pipeline_event_role" {
  name = "${var.project_name}-pipeline-event-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-pipeline-event-role"
    Environment = var.environment
  }
}

# IAM policy for pipeline event role
resource "aws_iam_role_policy" "pipeline_event_policy" {
  name = "${var.project_name}-pipeline-event-policy"
  role = aws_iam_role.pipeline_event_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "codepipeline:StartPipelineExecution"
        ]
        Resource = aws_codepipeline.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.deployment_notifications.arn,
          aws_sns_topic.approval_requests.arn,
          aws_sns_topic.approval_status.arn
        ]
      }
    ]
  })
}

# SNS topic for deployment notifications
resource "aws_sns_topic" "deployment_notifications" {
  name = "${var.project_name}-deployment-notifications"

  tags = {
    Name        = "${var.project_name}-deployment-notifications"
    Environment = var.environment
  }
}

# SNS topic for approval requests
resource "aws_sns_topic" "approval_requests" {
  name = "${var.project_name}-approval-requests"

  tags = {
    Name        = "${var.project_name}-approval-requests"
    Environment = var.environment
  }
}

# SNS topic for approval status updates
resource "aws_sns_topic" "approval_status" {
  name = "${var.project_name}-approval-status"

  tags = {
    Name        = "${var.project_name}-approval-status"
    Environment = var.environment
  }
}

# SNS topic subscription for deployment notifications
resource "aws_sns_topic_subscription" "deployment_email" {
  count     = var.deployment_notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.deployment_notifications.arn
  protocol  = "email"
  endpoint  = var.deployment_notification_email
}

# SNS topic subscription for approval requests
resource "aws_sns_topic_subscription" "approval_email" {
  count     = var.deployment_notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.approval_requests.arn
  protocol  = "email"
  endpoint  = var.deployment_notification_email
}

# SNS topic subscription for approval status updates
resource "aws_sns_topic_subscription" "approval_status_email" {
  count     = var.deployment_notification_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.approval_status.arn
  protocol  = "email"
  endpoint  = var.deployment_notification_email
}

# SNS topic subscription for Slack notifications (if configured)
resource "aws_sns_topic_subscription" "approval_slack" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.approval_requests.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url
}

# CloudWatch alarms for pipeline monitoring
resource "aws_cloudwatch_metric_alarm" "pipeline_failed" {
  alarm_name          = "${var.project_name}-pipeline-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "PipelineExecutionFailure"
  namespace           = "AWS/CodePipeline"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors pipeline failures"
  alarm_actions       = [aws_sns_topic.deployment_notifications.arn]

  dimensions = {
    PipelineName = aws_codepipeline.main.name
  }

  tags = {
    Name        = "${var.project_name}-pipeline-failed-alarm"
    Environment = var.environment
  }
}

# CloudWatch alarm for approval timeout
resource "aws_cloudwatch_metric_alarm" "approval_timeout" {
  alarm_name          = "${var.project_name}-approval-timeout"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ActionExecutionFailure"
  namespace           = "AWS/CodePipeline"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors approval timeouts"
  alarm_actions       = [aws_sns_topic.approval_status.arn]

  dimensions = {
    PipelineName = aws_codepipeline.main.name
    StageName    = "ApprovalForProduction"
    ActionName   = "ManualApproval"
  }

  tags = {
    Name        = "${var.project_name}-approval-timeout-alarm"
    Environment = var.environment
  }
}

# CloudWatch alarm for pending approvals
resource "aws_cloudwatch_metric_alarm" "pending_approval" {
  alarm_name          = "${var.project_name}-pending-approval"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ActionExecutionTime"
  namespace           = "AWS/CodePipeline"
  period              = "3600"  # 1 hour
  statistic           = "Maximum"
  threshold           = "7200"  # 2 hours
  alarm_description   = "This metric monitors long-pending approvals"
  alarm_actions       = [aws_sns_topic.approval_requests.arn]

  dimensions = {
    PipelineName = aws_codepipeline.main.name
    StageName    = "ApprovalForProduction"
    ActionName   = "ManualApproval"
  }

  tags = {
    Name        = "${var.project_name}-pending-approval-alarm"
    Environment = var.environment
  }
}

# Pipeline execution history retention
resource "aws_cloudwatch_log_group" "pipeline_logs" {
  name              = "/aws/codepipeline/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-pipeline-logs"
    Environment = var.environment
  }
}