# ECS Cluster and Services

locals {
  ecs_service_subnets          = var.enable_nat_gateway ? aws_subnet.private[*].id : aws_subnet.public[*].id
  ecs_assign_public_ip_enabled = var.enable_nat_gateway ? false : true

  app_secret_parameter_names = {
    DATABASE_URL          = "/directfanz/database/url"
    REDIS_URL             = "/directfanz/redis/url"
    NEXTAUTH_SECRET       = "/directfanz/auth/nextauth-secret"
    STRIPE_SECRET_KEY     = "/directfanz/stripe/secret-key"
    OPENAI_API_KEY        = "/directfanz/openai/api-key"
    SENDGRID_API_KEY      = "/directfanz/sendgrid/api-key"
    SENTRY_DSN            = "/directfanz/sentry/dsn"
    ENCRYPTION_KEY        = "/directfanz/security/encryption-key"
    JWT_SECRET            = "/directfanz/security/jwt-secret"
    STRIPE_WEBHOOK_SECRET = "/directfanz/stripe/webhook-secret"
    AWS_ACCESS_KEY_ID     = "/directfanz/aws/access-key-id"
    AWS_SECRET_ACCESS_KEY = "/directfanz/aws/secret-access-key"
  }

  app_secret_parameter_arns = {
    for key, name in local.app_secret_parameter_names :
    key => "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${name}"
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-logs"
  }
}

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
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_parameter_policy" {
  name = "${var.project_name}-ecs-task-execution-parameter-policy"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = values(local.app_secret_parameter_arns)
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-ecs-task-role"

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
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${var.project_name}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.content_storage.arn}/*",
          "${aws_s3_bucket.static_assets.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = values(local.app_secret_parameter_arns)
      }
    ]
  })
}

resource "aws_ecr_repository" "web" {
  name                 = "${var.project_name}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-web-repo"
  }
}

resource "aws_ecr_repository" "websocket" {
  name                 = "${var.project_name}-websocket"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-websocket-repo"
  }
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.project_name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_app_cpu
  memory                   = var.web_app_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "${var.project_name}-web"
      image = "${aws_ecr_repository.web.repository_url}:latest"

      portMappings = [
        {
          containerPort = var.app_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = tostring(var.app_port)
        },
        {
          name  = "HOSTNAME"
          value = "0.0.0.0"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "AWS_S3_BUCKET_NAME"
          value = aws_s3_bucket.content_storage.bucket
        },
        {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://www.${var.domain_name}"
        },
        {
          name  = "NEXTAUTH_URL"
          value = "https://www.${var.domain_name}"
        },
        {
          name  = "NEXT_PUBLIC_WEBSOCKET_URL"
          value = "wss://www.${var.domain_name}"
        }
      ]

      secrets = [
        for name, value_from in local.app_secret_parameter_arns : {
          name      = name
          valueFrom = value_from
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "web"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.app_port}/api/health?source=alb || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      essential = true
    }
  ])

  tags = {
    Name = "${var.project_name}-web-task"
  }
}

resource "aws_ecs_task_definition" "websocket" {
  family                   = "${var.project_name}-websocket"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.websocket_cpu
  memory                   = var.websocket_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "${var.project_name}-websocket"
      image = "${aws_ecr_repository.websocket.repository_url}:latest"

      portMappings = [
        {
          containerPort = var.websocket_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = tostring(var.websocket_port)
        },
        {
          name  = "WEBSOCKET_PORT"
          value = tostring(var.websocket_port)
        },
        {
          name  = "HOSTNAME"
          value = "0.0.0.0"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]

      secrets = [
        for name in ["DATABASE_URL", "REDIS_URL"] : {
          name      = name
          valueFrom = local.app_secret_parameter_arns[name]
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "websocket"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.websocket_port}/health?source=alb || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      essential = true
    }
  ])

  tags = {
    Name = "${var.project_name}-websocket-task"
  }
}

resource "aws_ecs_service" "web" {
  name            = "${var.project_name}-web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_app_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = local.ecs_service_subnets
    assign_public_ip = local.ecs_assign_public_ip_enabled
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web_app.arn
    container_name   = "${var.project_name}-web"
    container_port   = var.app_port
  }

  depends_on = [aws_lb_listener.web_app_https]

  tags = {
    Name = "${var.project_name}-web-service"
  }
}

resource "aws_ecs_service" "websocket" {
  name            = "${var.project_name}-websocket"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.websocket.arn
  desired_count   = var.websocket_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = local.ecs_service_subnets
    assign_public_ip = local.ecs_assign_public_ip_enabled
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.websocket.arn
    container_name   = "${var.project_name}-websocket"
    container_port   = var.websocket_port
  }

  depends_on = [aws_lb_listener_rule.websocket]

  tags = {
    Name = "${var.project_name}-websocket-service"
  }
}
