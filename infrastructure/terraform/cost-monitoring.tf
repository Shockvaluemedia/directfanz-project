# Cost Monitoring and Alerting Infrastructure for DirectFanz Platform

# AWS Cost Budget for overall spending
resource "aws_budgets_budget" "monthly_cost_budget" {
  name         = "${var.project_name}-monthly-budget"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filters = {
    Service = [
      "Amazon Elastic Container Service",
      "Amazon Relational Database Service", 
      "Amazon ElastiCache",
      "Amazon Simple Storage Service",
      "Amazon CloudFront",
      "AWS Elemental MediaLive",
      "AWS Elemental MediaStore"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = var.cost_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.cost_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 120
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.cost_alert_emails
  }

  tags = {
    Environment = var.environment
    Purpose     = "cost-monitoring"
  }
}

# Service-specific budgets
resource "aws_budgets_budget" "ecs_budget" {
  name         = "${var.project_name}-ecs-budget"
  budget_type  = "COST"
  limit_amount = var.ecs_monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filters = {
    Service = ["Amazon Elastic Container Service"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 85
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.cost_alert_emails
  }

  tags = {
    Environment = var.environment
    Service     = "ecs"
  }
}

resource "aws_budgets_budget" "rds_budget" {
  name         = "${var.project_name}-rds-budget"
  budget_type  = "COST"
  limit_amount = var.rds_monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filters = {
    Service = ["Amazon Relational Database Service"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 85
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.cost_alert_emails
  }

  tags = {
    Environment = var.environment
    Service     = "rds"
  }
}

resource "aws_budgets_budget" "s3_budget" {
  name         = "${var.project_name}-s3-budget"
  budget_type  = "COST"
  limit_amount = var.s3_monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filters = {
    Service = ["Amazon Simple Storage Service"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 85
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.cost_alert_emails
  }

  tags = {
    Environment = var.environment
    Service     = "s3"
  }
}

# Cost Anomaly Detection
resource "aws_ce_anomaly_detector" "service_anomaly_detector" {
  name         = "${var.project_name}-service-anomaly-detector"
  monitor_type = "DIMENSIONAL"

  specification = jsonencode({
    Dimension = "SERVICE"
    MatchOptions = ["EQUALS"]
    Values = [
      "Amazon Elastic Container Service",
      "Amazon Relational Database Service",
      "Amazon ElastiCache",
      "Amazon Simple Storage Service",
      "Amazon CloudFront"
    ]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_ce_anomaly_subscription" "service_anomaly_subscription" {
  name      = "${var.project_name}-service-anomaly-subscription"
  frequency = "DAILY"
  
  monitor_arn_list = [
    aws_ce_anomaly_detector.service_anomaly_detector.arn
  ]
  
  subscriber {
    type    = "EMAIL"
    address = var.cost_anomaly_alert_email
  }

  threshold_expression {
    and {
      dimension {
        key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
        values        = [tostring(var.cost_anomaly_threshold)]
        match_options = ["GREATER_THAN_OR_EQUAL"]
      }
    }
  }

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Dashboard for Cost Monitoring
resource "aws_cloudwatch_dashboard" "cost_monitoring" {
  dashboard_name = "${var.project_name}-cost-monitoring"

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
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD"],
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD", "ServiceName", "AmazonECS"],
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD", "ServiceName", "AmazonRDS"],
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD", "ServiceName", "AmazonS3"],
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD", "ServiceName", "AmazonCloudFront"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Estimated Monthly Charges by Service"
          period  = 86400
          stat    = "Maximum"
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
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.web_app.name, "ClusterName", aws_ecs_cluster.main.name],
            ["AWS/ECS", "MemoryUtilization", "ServiceName", aws_ecs_service.web_app.name, "ClusterName", aws_ecs_cluster.main.name]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Resource Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.id],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.main.id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Performance Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.content.bucket, "StorageType", "StandardStorage"],
            ["AWS/S3", "NumberOfObjects", "BucketName", aws_s3_bucket.content.bucket, "StorageType", "AllStorageTypes"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "S3 Storage Metrics"
          period  = 86400
          stat    = "Average"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# Lambda function for cost optimization recommendations
resource "aws_lambda_function" "cost_optimizer" {
  filename         = "cost-optimizer.zip"
  function_name    = "${var.project_name}-cost-optimizer"
  role            = aws_iam_role.cost_optimizer_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.cost_optimizer_zip.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 300

  environment {
    variables = {
      PROJECT_NAME = var.project_name
      ENVIRONMENT  = var.environment
      SNS_TOPIC_ARN = aws_sns_topic.cost_optimization_recommendations.arn
    }
  }

  tags = {
    Environment = var.environment
  }
}

# Create the Lambda deployment package
data "archive_file" "cost_optimizer_zip" {
  type        = "zip"
  output_path = "cost-optimizer.zip"
  source {
    content = templatefile("${path.module}/functions/cost-optimizer.js", {
      project_name = var.project_name
      environment  = var.environment
    })
    filename = "index.js"
  }
}

# IAM role for cost optimizer Lambda
resource "aws_iam_role" "cost_optimizer_lambda" {
  name = "${var.project_name}-cost-optimizer-lambda-role"

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

resource "aws_iam_role_policy" "cost_optimizer_lambda_policy" {
  name = "${var.project_name}-cost-optimizer-lambda-policy"
  role = aws_iam_role.cost_optimizer_lambda.id

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
          "ce:GetCostAndUsage",
          "ce:GetUsageReport",
          "ce:GetReservationCoverage",
          "ce:GetReservationPurchaseRecommendation",
          "ce:GetReservationUtilization",
          "ce:ListCostCategoryDefinitions",
          "ce:GetRightsizingRecommendation"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:DescribeTasks"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.cost_optimization_recommendations.arn
      }
    ]
  })
}

# SNS topic for cost optimization recommendations
resource "aws_sns_topic" "cost_optimization_recommendations" {
  name = "${var.project_name}-cost-optimization-recommendations"

  tags = {
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "cost_optimization_email" {
  count     = var.cost_optimization_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cost_optimization_recommendations.arn
  protocol  = "email"
  endpoint  = var.cost_optimization_alert_email
}

# CloudWatch Event Rule to trigger cost optimizer weekly
resource "aws_cloudwatch_event_rule" "cost_optimizer_schedule" {
  name                = "${var.project_name}-cost-optimizer-schedule"
  description         = "Trigger cost optimizer Lambda weekly"
  schedule_expression = "rate(7 days)"

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "cost_optimizer_target" {
  rule      = aws_cloudwatch_event_rule.cost_optimizer_schedule.name
  target_id = "CostOptimizerTarget"
  arn       = aws_lambda_function.cost_optimizer.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_cost_optimizer" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cost_optimizer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.cost_optimizer_schedule.arn
}

# Cost optimization variables
variable "monthly_budget_limit" {
  description = "Monthly budget limit in USD"
  type        = string
  default     = "2000"
}

variable "ecs_monthly_budget_limit" {
  description = "ECS monthly budget limit in USD"
  type        = string
  default     = "800"
}

variable "rds_monthly_budget_limit" {
  description = "RDS monthly budget limit in USD"
  type        = string
  default     = "400"
}

variable "s3_monthly_budget_limit" {
  description = "S3 monthly budget limit in USD"
  type        = string
  default     = "200"
}

variable "cost_alert_emails" {
  description = "List of email addresses for cost alerts"
  type        = list(string)
  default     = []
}

variable "cost_anomaly_alert_email" {
  description = "Email address for cost anomaly alerts"
  type        = string
  default     = ""
}

variable "cost_anomaly_threshold" {
  description = "Cost anomaly threshold in USD"
  type        = number
  default     = 100
}

variable "cost_optimization_alert_email" {
  description = "Email address for cost optimization recommendations"
  type        = string
  default     = ""
}

# Outputs
output "cost_monitoring_dashboard_url" {
  description = "URL to the cost monitoring CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.cost_monitoring.dashboard_name}"
}

output "cost_budgets" {
  description = "Created cost budgets"
  value = {
    monthly_budget = aws_budgets_budget.monthly_cost_budget.name
    ecs_budget     = aws_budgets_budget.ecs_budget.name
    rds_budget     = aws_budgets_budget.rds_budget.name
    s3_budget      = aws_budgets_budget.s3_budget.name
  }
}