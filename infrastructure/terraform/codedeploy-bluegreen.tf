# CodeDeploy Blue-Green Deployment Configuration for ECS

# CodeDeploy Application
resource "aws_codedeploy_app" "ecs_app" {
  compute_platform = "ECS"
  name             = "${var.project_name}-ecs-app"

  tags = {
    Environment = var.environment
  }
}

# CodeDeploy Service Role
resource "aws_iam_role" "codedeploy_service_role" {
  name = "${var.project_name}-codedeploy-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# Attach the required policy for ECS deployments
resource "aws_iam_role_policy_attachment" "codedeploy_service_role_policy" {
  role       = aws_iam_role.codedeploy_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

# Additional permissions for CodeDeploy
resource "aws_iam_role_policy" "codedeploy_additional_permissions" {
  name = "${var.project_name}-codedeploy-additional"
  role = aws_iam_role.codedeploy_service_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:CreateTaskSet",
          "ecs:UpdateTaskSet",
          "ecs:DeleteTaskSet",
          "ecs:DescribeTaskSets",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:ModifyRule",
          "lambda:InvokeFunction",
          "cloudwatch:DescribeAlarms",
          "sns:Publish",
          "s3:GetObject",
          "s3:GetObjectVersion"
        ]
        Resource = "*"
      }
    ]
  })
}

# CodeDeploy Deployment Group for Web App
resource "aws_codedeploy_deployment_group" "web_app" {
  app_name               = aws_codedeploy_app.ecs_app.name
  deployment_group_name  = "${var.project_name}-web-app-dg"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnceBlueGreen"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = true
    alarms  = [aws_cloudwatch_metric_alarm.web_app_high_cpu.alarm_name]
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                         = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.web_app.name
  }

  load_balancer_info {
    target_group_info {
      name = aws_lb_target_group.web_app.name
    }
  }

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# CodeDeploy Deployment Group for WebSocket
resource "aws_codedeploy_deployment_group" "websocket" {
  app_name               = aws_codedeploy_app.ecs_app.name
  deployment_group_name  = "${var.project_name}-websocket-dg"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnceBlueGreen"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = true
    alarms  = [aws_cloudwatch_metric_alarm.websocket_high_cpu.alarm_name]
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                         = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.websocket.name
  }

  load_balancer_info {
    target_group_info {
      name = aws_lb_target_group.websocket.name
    }
  }

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

# CodeDeploy Deployment Group for Streaming
resource "aws_codedeploy_deployment_group" "streaming" {
  app_name               = aws_codedeploy_app.ecs_app.name
  deployment_group_name  = "${var.project_name}-streaming-dg"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnceBlueGreen"

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  alarm_configuration {
    enabled = true
    alarms  = [aws_cloudwatch_metric_alarm.streaming_high_cpu.alarm_name]
  }

  blue_green_deployment_config {
    terminate_blue_instances_on_deployment_success {
      action                         = "TERMINATE"
      termination_wait_time_in_minutes = 5
    }

    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }

    green_fleet_provisioning_option {
      action = "COPY_AUTO_SCALING_GROUP"
    }
  }

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.streaming.name
  }

  # Streaming service doesn't use load balancer, so no load_balancer_info block

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# Custom Deployment Configuration for faster rollbacks
resource "aws_codedeploy_deployment_config" "ecs_canary" {
  deployment_config_name = "${var.project_name}-ECSCanary10Percent5Minutes"
  compute_platform       = "ECS"

  traffic_routing_config {
    type = "TimeBasedCanary"

    time_based_canary {
      canary_percentage = 10
      canary_interval   = 5
    }
  }
}

# Lambda function for deployment hooks (optional)
resource "aws_lambda_function" "deployment_hook" {
  count = var.enable_deployment_hooks ? 1 : 0

  filename         = "deployment-hook.zip"
  function_name    = "${var.project_name}-deployment-hook"
  role            = aws_iam_role.lambda_deployment_hook[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.deployment_hook_zip[0].output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 60

  environment {
    variables = {
      CLUSTER_NAME = aws_ecs_cluster.main.name
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
    }
  }

  tags = {
    Environment = var.environment
  }
}

# Create deployment hook zip file
data "archive_file" "deployment_hook_zip" {
  count = var.enable_deployment_hooks ? 1 : 0

  type        = "zip"
  output_path = "deployment-hook.zip"
  
  source {
    content = templatefile("${path.module}/deployment-hook.js", {
      cluster_name = aws_ecs_cluster.main.name
    })
    filename = "index.js"
  }
}

# IAM role for Lambda deployment hook
resource "aws_iam_role" "lambda_deployment_hook" {
  count = var.enable_deployment_hooks ? 1 : 0

  name = "${var.project_name}-lambda-deployment-hook"

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

# IAM policy for Lambda deployment hook
resource "aws_iam_role_policy" "lambda_deployment_hook" {
  count = var.enable_deployment_hooks ? 1 : 0

  name = "${var.project_name}-lambda-deployment-hook"
  role = aws_iam_role.lambda_deployment_hook[0].id

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
          "ecs:DescribeServices",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "cloudwatch:GetMetricStatistics",
          "sns:Publish"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:PutLifecycleEventHookExecutionStatus"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for deployment activities
resource "aws_cloudwatch_log_group" "codedeploy_logs" {
  name              = "/aws/codedeploy/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
  }
}

# SNS Topic for deployment notifications (if not already created)
resource "aws_sns_topic" "deployment_notifications" {
  name = "${var.project_name}-deployment-notifications"

  tags = {
    Environment = var.environment
  }
}

# SNS Topic Subscription for deployment notifications
resource "aws_sns_topic_subscription" "deployment_email" {
  count = var.deployment_notification_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.deployment_notifications.arn
  protocol  = "email"
  endpoint  = var.deployment_notification_email
}

# CloudWatch Event Rule for deployment state changes
resource "aws_cloudwatch_event_rule" "deployment_state_change" {
  name        = "${var.project_name}-deployment-state-change"
  description = "Capture deployment state changes"

  event_pattern = jsonencode({
    source      = ["aws.codedeploy"]
    detail-type = ["CodeDeploy Deployment State-change Notification"]
    detail = {
      application-name = [aws_codedeploy_app.ecs_app.name]
    }
  })

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Event Target for deployment notifications
resource "aws_cloudwatch_event_target" "deployment_sns" {
  rule      = aws_cloudwatch_event_rule.deployment_state_change.name
  target_id = "DeploymentSNSTarget"
  arn       = aws_sns_topic.deployment_notifications.arn

  input_transformer {
    input_paths = {
      application = "$.detail.application-name"
      deployment  = "$.detail.deployment-id"
      state       = "$.detail.state"
    }
    input_template = "\"Deployment <deployment> for application <application> has changed state to <state>\""
  }
}