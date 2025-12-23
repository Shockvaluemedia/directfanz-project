# Cost Optimization Configuration for DirectFanz AWS Infrastructure

# Spot Instance Configuration for ECS Services
# Update capacity provider strategy to use Spot instances for cost savings

# Enhanced ECS Cluster Capacity Providers with Spot instances
resource "aws_ecs_cluster_capacity_providers" "cost_optimized" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  # Primary strategy for production workloads
  default_capacity_provider_strategy {
    base              = 1
    weight            = 70
    capacity_provider = "FARGATE"
  }

  # Secondary strategy using Spot instances for cost savings
  default_capacity_provider_strategy {
    base              = 0
    weight            = 30
    capacity_provider = "FARGATE_SPOT"
  }

  depends_on = [aws_ecs_cluster.main]
}

# Cost-optimized ECS Service for Web App with mixed capacity
resource "aws_ecs_service" "web_app_cost_optimized" {
  count           = var.enable_cost_optimization ? 1 : 0
  name            = "${var.project_name}-web-app-cost-optimized"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web_app.arn
  desired_count   = var.web_app_desired_count

  # Use capacity provider strategy instead of launch_type
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 70
    base             = 1
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = 30
    base             = 0
  }

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web_app.arn
    container_name   = "web-app"
    container_port   = 3000
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
    
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  deployment_controller {
    type = "CODE_DEPLOY"
  }

  service_registries {
    registry_arn = aws_service_discovery_service.web_app.arn
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy_attachment.ecs_task_execution_role_policy
  ]

  tags = {
    Environment      = var.environment
    Service         = "web-app"
    CostOptimized   = "true"
    SpotEnabled     = "true"
  }
}

# Spot-only ECS Service for non-critical background tasks
resource "aws_ecs_task_definition" "background_tasks" {
  count                    = var.enable_cost_optimization ? 1 : 0
  family                   = "${var.project_name}-background-tasks"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.app_role.arn

  container_definitions = jsonencode([
    {
      name  = "background-tasks"
      image = "${aws_ecr_repository.web_app.repository_url}:latest"
      
      command = ["npm", "run", "background-tasks"]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "prod" ? "production" : var.environment
        },
        {
          name  = "TASK_TYPE"
          value = "background"
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_ssm_parameter.db_url.arn
        },
        {
          name      = "REDIS_URL"
          valueFrom = aws_ssm_parameter.redis_url.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.background_tasks[0].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = {
    Environment    = var.environment
    Service       = "background-tasks"
    CostOptimized = "true"
    SpotOnly      = "true"
  }
}

resource "aws_cloudwatch_log_group" "background_tasks" {
  count             = var.enable_cost_optimization ? 1 : 0
  name              = "/ecs/${var.project_name}/background-tasks"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Service     = "background-tasks"
  }
}

resource "aws_ecs_service" "background_tasks" {
  count           = var.enable_cost_optimization ? 1 : 0
  name            = "${var.project_name}-background-tasks"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.background_tasks[0].arn
  desired_count   = var.background_tasks_desired_count

  # Use only Spot instances for background tasks
  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight           = 100
    base             = 1
  }

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 50  # Lower for cost savings
    
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  tags = {
    Environment    = var.environment
    Service       = "background-tasks"
    CostOptimized = "true"
    SpotOnly      = "true"
  }
}

# Spot instance interruption handling
resource "aws_cloudwatch_event_rule" "spot_interruption" {
  count       = var.enable_cost_optimization ? 1 : 0
  name        = "${var.project_name}-spot-interruption"
  description = "Capture Spot instance interruption warnings"

  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Spot Instance Interruption Warning"]
  })

  tags = {
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "spot_interruption_sns" {
  count     = var.enable_cost_optimization ? 1 : 0
  rule      = aws_cloudwatch_event_rule.spot_interruption[0].name
  target_id = "SpotInterruptionSNSTarget"
  arn       = aws_sns_topic.cost_alerts[0].arn
}

# SNS topic for cost optimization alerts
resource "aws_sns_topic" "cost_alerts" {
  count = var.enable_cost_optimization ? 1 : 0
  name  = "${var.project_name}-cost-alerts"

  tags = {
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "cost_alerts_email" {
  count     = var.enable_cost_optimization && var.cost_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.cost_alerts[0].arn
  protocol  = "email"
  endpoint  = var.cost_alert_email
}

# CloudWatch alarms for Spot instance interruptions
resource "aws_cloudwatch_metric_alarm" "spot_interruption_rate" {
  count               = var.enable_cost_optimization ? 1 : 0
  alarm_name          = "${var.project_name}-spot-interruption-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SpotInstanceInterruptions"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors Spot instance interruption rate"
  alarm_actions       = [aws_sns_topic.cost_alerts[0].arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
  }
}

# Cost optimization variables
variable "enable_cost_optimization" {
  description = "Enable cost optimization features including Spot instances"
  type        = bool
  default     = true
}

variable "background_tasks_desired_count" {
  description = "Desired number of background task instances"
  type        = number
  default     = 1
}

variable "cost_alert_email" {
  description = "Email address for cost optimization alerts"
  type        = string
  default     = ""
}

# Workload identification for Spot instance suitability
locals {
  spot_suitable_workloads = {
    # Suitable for Spot instances (fault-tolerant, flexible timing)
    background_tasks = {
      description = "Background processing tasks (email sending, data cleanup, analytics)"
      spot_suitable = true
      interruption_tolerance = "high"
    }
    
    batch_processing = {
      description = "Batch data processing and ETL jobs"
      spot_suitable = true
      interruption_tolerance = "high"
    }
    
    development_testing = {
      description = "Development and testing environments"
      spot_suitable = true
      interruption_tolerance = "high"
    }
    
    # Not suitable for Spot instances (critical, real-time)
    web_app_primary = {
      description = "Primary web application serving user requests"
      spot_suitable = false
      interruption_tolerance = "low"
      reason = "Critical user-facing service requiring high availability"
    }
    
    websocket_primary = {
      description = "Primary WebSocket service for real-time communication"
      spot_suitable = false
      interruption_tolerance = "low"
      reason = "Real-time communication requires consistent connectivity"
    }
    
    streaming_live = {
      description = "Live streaming service"
      spot_suitable = false
      interruption_tolerance = "low"
      reason = "Live streaming cannot tolerate interruptions"
    }
    
    database_connections = {
      description = "Database connection pooling services"
      spot_suitable = false
      interruption_tolerance = "low"
      reason = "Database connections require stability"
    }
  }
}

# Output workload analysis for documentation
output "spot_instance_workload_analysis" {
  description = "Analysis of workloads suitable for Spot instances"
  value = {
    suitable_workloads = {
      for k, v in local.spot_suitable_workloads : k => v
      if v.spot_suitable == true
    }
    unsuitable_workloads = {
      for k, v in local.spot_suitable_workloads : k => v
      if v.spot_suitable == false
    }
    cost_savings_estimate = "30-70% cost reduction for suitable workloads"
    implementation_strategy = "Mixed capacity provider strategy with 70% On-Demand, 30% Spot for web services"
  }
}