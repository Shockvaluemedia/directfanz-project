# ECS Fargate Cluster and Services - DirectFanz AWS Infrastructure

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.main.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project_name}-cluster"
    Environment = var.environment
  }
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }

  default_capacity_provider_strategy {
    base              = 0
    weight            = 0
    capacity_provider = "FARGATE_SPOT"
  }
}

# CloudWatch Log Groups for ECS
resource "aws_cloudwatch_log_group" "web_app" {
  name              = "/ecs/${var.project_name}/web-app"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

resource "aws_cloudwatch_log_group" "websocket" {
  name              = "/ecs/${var.project_name}/websocket"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

resource "aws_cloudwatch_log_group" "streaming" {
  name              = "/ecs/${var.project_name}/streaming"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs/${var.project_name}/exec"
  retention_in_days = 7

  tags = {
    Environment = var.environment
  }
}

# ECR Repositories
resource "aws_ecr_repository" "web_app" {
  name                 = "${var.project_name}/web-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

resource "aws_ecr_repository" "websocket" {
  name                 = "${var.project_name}/websocket"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

resource "aws_ecr_repository" "streaming" {
  name                 = "${var.project_name}/streaming"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# ECR Lifecycle Policies
resource "aws_ecr_lifecycle_policy" "web_app" {
  repository = aws_ecr_repository.web_app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "websocket" {
  repository = aws_ecr_repository.websocket.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "streaming" {
  repository = aws_ecr_repository.streaming.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Task Execution Role
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-ecs-task-execution-role"

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
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional permissions for task execution role
resource "aws_iam_role_policy" "ecs_task_execution_additional" {
  name = "${var.project_name}-ecs-task-execution-additional"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          aws_kms_key.main.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.web_app.arn}:*",
          "${aws_cloudwatch_log_group.websocket.arn}:*",
          "${aws_cloudwatch_log_group.streaming.arn}:*"
        ]
      }
    ]
  })
}

# Task Definition for Web App
resource "aws_ecs_task_definition" "web_app" {
  family                   = "${var.project_name}-web-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_app_cpu
  memory                   = var.web_app_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.app_role.arn

  container_definitions = jsonencode([
    {
      name  = "web-app"
      image = "${aws_ecr_repository.web_app.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "prod" ? "production" : var.environment
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "AWS_XRAY_TRACING_NAME"
          value = "${var.project_name}-web-app"
        },
        {
          name  = "AWS_XRAY_DAEMON_ADDRESS"
          value = "xray-daemon:2000"
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
        },
        {
          name      = "S3_BUCKET_NAME"
          valueFrom = aws_ssm_parameter.s3_bucket_name.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web_app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3000/api/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
      
      dependsOn = [
        {
          containerName = "xray-daemon"
          condition     = "START"
        }
      ]
    },
    {
      name  = "xray-daemon"
      image = "amazon/aws-xray-daemon:latest"
      
      portMappings = [
        {
          containerPort = 2000
          protocol      = "udp"
        }
      ]

      environment = [
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web_app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "xray-daemon"
        }
      }

      essential = false
      cpu       = 32
      memory    = 256
    }
  ])

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# Task Definition for WebSocket Server
resource "aws_ecs_task_definition" "websocket" {
  family                   = "${var.project_name}-websocket"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.websocket_cpu
  memory                   = var.websocket_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.app_role.arn

  container_definitions = jsonencode([
    {
      name  = "websocket"
      image = "${aws_ecr_repository.websocket.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "prod" ? "production" : var.environment
        },
        {
          name  = "PORT"
          value = "3001"
        },
        {
          name  = "AWS_XRAY_TRACING_NAME"
          value = "${var.project_name}-websocket"
        },
        {
          name  = "AWS_XRAY_DAEMON_ADDRESS"
          value = "xray-daemon:2000"
        }
      ]

      secrets = [
        {
          name      = "REDIS_URL"
          valueFrom = aws_ssm_parameter.redis_url.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.websocket.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3001/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
      
      dependsOn = [
        {
          containerName = "xray-daemon"
          condition     = "START"
        }
      ]
    },
    {
      name  = "xray-daemon"
      image = "amazon/aws-xray-daemon:latest"
      
      portMappings = [
        {
          containerPort = 2000
          protocol      = "udp"
        }
      ]

      environment = [
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.websocket.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "xray-daemon"
        }
      }

      essential = false
      cpu       = 32
      memory    = 256
    }
  ])

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

# Task Definition for Streaming Service
resource "aws_ecs_task_definition" "streaming" {
  family                   = "${var.project_name}-streaming"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.streaming_cpu
  memory                   = var.streaming_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.app_role.arn

  container_definitions = jsonencode([
    {
      name  = "streaming"
      image = "${aws_ecr_repository.streaming.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3002
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment == "prod" ? "production" : var.environment
        },
        {
          name  = "PORT"
          value = "3002"
        },
        {
          name  = "AWS_XRAY_TRACING_NAME"
          value = "${var.project_name}-streaming"
        },
        {
          name  = "AWS_XRAY_DAEMON_ADDRESS"
          value = "xray-daemon:2000"
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
          "awslogs-group"         = aws_cloudwatch_log_group.streaming.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "curl -f http://localhost:3002/health || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
      
      dependsOn = [
        {
          containerName = "xray-daemon"
          condition     = "START"
        }
      ]
    },
    {
      name  = "xray-daemon"
      image = "amazon/aws-xray-daemon:latest"
      
      portMappings = [
        {
          containerPort = 2000
          protocol      = "udp"
        }
      ]

      environment = [
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.streaming.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "xray-daemon"
        }
      }

      essential = false
      cpu       = 32
      memory    = 256
    }
  ])

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# ECS Service for Web App
resource "aws_ecs_service" "web_app" {
  name            = "${var.project_name}-web-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web_app.arn
  desired_count   = var.web_app_desired_count
  launch_type     = "FARGATE"

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

  # Enable CodeDeploy for blue-green deployments
  deployment_controller {
    type = "CODE_DEPLOY"
  }

  # Enable service discovery
  service_registries {
    registry_arn = aws_service_discovery_service.web_app.arn
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy_attachment.ecs_task_execution_role_policy
  ]

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# ECS Service for WebSocket
resource "aws_ecs_service" "websocket" {
  name            = "${var.project_name}-websocket"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.websocket.arn
  desired_count   = var.websocket_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.websocket.arn
    container_name   = "websocket"
    container_port   = 3001
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
    
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  # Enable CodeDeploy for blue-green deployments
  deployment_controller {
    type = "CODE_DEPLOY"
  }

  # Enable service discovery
  service_registries {
    registry_arn = aws_service_discovery_service.websocket.arn
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy_attachment.ecs_task_execution_role_policy
  ]

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

# ECS Service for Streaming
resource "aws_ecs_service" "streaming" {
  name            = "${var.project_name}-streaming"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.streaming.arn
  desired_count   = var.streaming_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
    
    deployment_circuit_breaker {
      enable   = true
      rollback = true
    }
  }

  # Enable service discovery
  service_registries {
    registry_arn = aws_service_discovery_service.streaming.arn
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution_role_policy
  ]

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# Service Discovery
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.project_name}.local"
  description = "Service discovery namespace for ${var.project_name}"
  vpc         = module.vpc.vpc_id

  tags = {
    Environment = var.environment
  }
}

resource "aws_service_discovery_service" "web_app" {
  name = "web-app"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_grace_period_seconds = 30

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

resource "aws_service_discovery_service" "websocket" {
  name = "websocket"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_grace_period_seconds = 30

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

resource "aws_service_discovery_service" "streaming" {
  name = "streaming"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_grace_period_seconds = 30

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# Auto Scaling Configuration for ECS Services

# Auto Scaling Target for Web App
resource "aws_appautoscaling_target" "web_app" {
  max_capacity       = var.web_app_max_capacity
  min_capacity       = var.web_app_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.web_app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  depends_on = [aws_ecs_service.web_app]

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# Auto Scaling Policy for Web App - CPU
resource "aws_appautoscaling_policy" "web_app_cpu" {
  name               = "${var.project_name}-web-app-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web_app.resource_id
  scalable_dimension = aws_appautoscaling_target.web_app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web_app.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }

  depends_on = [aws_appautoscaling_target.web_app]
}

# Auto Scaling Policy for Web App - Memory
resource "aws_appautoscaling_policy" "web_app_memory" {
  name               = "${var.project_name}-web-app-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.web_app.resource_id
  scalable_dimension = aws_appautoscaling_target.web_app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.web_app.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }

  depends_on = [aws_appautoscaling_target.web_app]
}

# Auto Scaling Target for WebSocket
resource "aws_appautoscaling_target" "websocket" {
  max_capacity       = var.websocket_max_capacity
  min_capacity       = var.websocket_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.websocket.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  depends_on = [aws_ecs_service.websocket]

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

# Auto Scaling Policy for WebSocket - CPU
resource "aws_appautoscaling_policy" "websocket_cpu" {
  name               = "${var.project_name}-websocket-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.websocket.resource_id
  scalable_dimension = aws_appautoscaling_target.websocket.scalable_dimension
  service_namespace  = aws_appautoscaling_target.websocket.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }

  depends_on = [aws_appautoscaling_target.websocket]
}

# Auto Scaling Policy for WebSocket - Memory
resource "aws_appautoscaling_policy" "websocket_memory" {
  name               = "${var.project_name}-websocket-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.websocket.resource_id
  scalable_dimension = aws_appautoscaling_target.websocket.scalable_dimension
  service_namespace  = aws_appautoscaling_target.websocket.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }

  depends_on = [aws_appautoscaling_target.websocket]
}

# Auto Scaling Target for Streaming
resource "aws_appautoscaling_target" "streaming" {
  max_capacity       = var.streaming_max_capacity
  min_capacity       = var.streaming_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.streaming.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  depends_on = [aws_ecs_service.streaming]

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# Auto Scaling Policy for Streaming - CPU
resource "aws_appautoscaling_policy" "streaming_cpu" {
  name               = "${var.project_name}-streaming-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.streaming.resource_id
  scalable_dimension = aws_appautoscaling_target.streaming.scalable_dimension
  service_namespace  = aws_appautoscaling_target.streaming.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }

  depends_on = [aws_appautoscaling_target.streaming]
}

# Auto Scaling Policy for Streaming - Memory
resource "aws_appautoscaling_policy" "streaming_memory" {
  name               = "${var.project_name}-streaming-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.streaming.resource_id
  scalable_dimension = aws_appautoscaling_target.streaming.scalable_dimension
  service_namespace  = aws_appautoscaling_target.streaming.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }

  depends_on = [aws_appautoscaling_target.streaming]
}

# CloudWatch Alarms for Auto Scaling

# High CPU Alarm for Web App
resource "aws_cloudwatch_metric_alarm" "web_app_high_cpu" {
  alarm_name          = "${var.project_name}-web-app-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors web app CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.web_app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# High Memory Alarm for Web App
resource "aws_cloudwatch_metric_alarm" "web_app_high_memory" {
  alarm_name          = "${var.project_name}-web-app-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors web app memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.web_app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Service     = "web-app"
  }
}

# High CPU Alarm for WebSocket
resource "aws_cloudwatch_metric_alarm" "websocket_high_cpu" {
  alarm_name          = "${var.project_name}-websocket-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors websocket CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.websocket.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

# High Memory Alarm for WebSocket
resource "aws_cloudwatch_metric_alarm" "websocket_high_memory" {
  alarm_name          = "${var.project_name}-websocket-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors websocket memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.websocket.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Service     = "websocket"
  }
}

# High CPU Alarm for Streaming
resource "aws_cloudwatch_metric_alarm" "streaming_high_cpu" {
  alarm_name          = "${var.project_name}-streaming-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors streaming CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.streaming.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}

# High Memory Alarm for Streaming
resource "aws_cloudwatch_metric_alarm" "streaming_high_memory" {
  alarm_name          = "${var.project_name}-streaming-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors streaming memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.streaming.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Service     = "streaming"
  }
}