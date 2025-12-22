# PgBouncer Configuration for Connection Pooling
# This file sets up PgBouncer as an ECS service for database connection pooling

# ECR Repository for PgBouncer
resource "aws_ecr_repository" "pgbouncer" {
  name                 = "direct-fan-platform-pgbouncer"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project_name}-pgbouncer-ecr"
    Environment = var.environment
  }
}

resource "aws_ecr_lifecycle_policy" "pgbouncer" {
  repository = aws_ecr_repository.pgbouncer.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["latest"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ECS Cluster for PgBouncer
resource "aws_ecs_cluster" "pgbouncer" {
  name = "${var.project_name}-pgbouncer-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project_name}-pgbouncer-cluster"
    Environment = var.environment
  }
}

# ECS Task Definition for PgBouncer
resource "aws_ecs_task_definition" "pgbouncer" {
  family                   = "${var.project_name}-pgbouncer"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.pgbouncer_cpu
  memory                   = var.pgbouncer_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.pgbouncer_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "pgbouncer"
      image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/direct-fan-platform-pgbouncer:latest"
      
      portMappings = [
        {
          containerPort = 5432
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "DATABASES_HOST"
          value = aws_db_instance.postgres_enhanced.address
        },
        {
          name  = "DATABASES_PORT"
          value = tostring(aws_db_instance.postgres_enhanced.port)
        },
        {
          name  = "DATABASES_USER"
          value = aws_db_instance.postgres_enhanced.username
        },
        {
          name  = "DATABASES_DBNAME"
          value = aws_db_instance.postgres_enhanced.db_name
        },
        {
          name  = "POOL_MODE"
          value = var.pgbouncer_pool_mode
        },
        {
          name  = "MAX_CLIENT_CONN"
          value = tostring(var.pgbouncer_max_client_conn)
        },
        {
          name  = "DEFAULT_POOL_SIZE"
          value = tostring(var.pgbouncer_default_pool_size)
        },
        {
          name  = "MIN_POOL_SIZE"
          value = tostring(var.pgbouncer_min_pool_size)
        },
        {
          name  = "RESERVE_POOL_SIZE"
          value = tostring(var.pgbouncer_reserve_pool_size)
        },
        {
          name  = "SERVER_LIFETIME"
          value = tostring(var.pgbouncer_server_lifetime)
        },
        {
          name  = "SERVER_IDLE_TIMEOUT"
          value = tostring(var.pgbouncer_server_idle_timeout)
        }
      ]

      secrets = [
        {
          name      = "DATABASES_PASSWORD"
          valueFrom = aws_ssm_parameter.db_password_param.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.pgbouncer.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "pg_isready -h localhost -p 5432 || exit 1"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name        = "${var.project_name}-pgbouncer-task"
    Environment = var.environment
  }
}

# ECS Service for PgBouncer
resource "aws_ecs_service" "pgbouncer" {
  name            = "${var.project_name}-pgbouncer"
  cluster         = aws_ecs_cluster.pgbouncer.id
  task_definition = aws_ecs_task_definition.pgbouncer.arn
  desired_count   = var.pgbouncer_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.pgbouncer.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.pgbouncer.arn
  }

  depends_on = [
    aws_db_instance.postgres_enhanced
  ]

  tags = {
    Name        = "${var.project_name}-pgbouncer-service"
    Environment = var.environment
  }
}

# Security Group for PgBouncer
resource "aws_security_group" "pgbouncer" {
  name_prefix = "${var.project_name}-pgbouncer"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for PgBouncer connection pooler"

  # Allow PostgreSQL connections from application subnets
  ingress {
    description = "PostgreSQL from application subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.private_subnets
  }

  # Allow PostgreSQL connections from ECS tasks
  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-pgbouncer-sg"
  }
}

# Service Discovery for PgBouncer
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.project_name}.local"
  description = "Private DNS namespace for ${var.project_name}"
  vpc         = module.vpc.vpc_id

  tags = {
    Name        = "${var.project_name}-dns-namespace"
    Environment = var.environment
  }
}

resource "aws_service_discovery_service" "pgbouncer" {
  name = "pgbouncer"

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
    Name        = "${var.project_name}-pgbouncer-discovery"
    Environment = var.environment
  }
}

# IAM Role for PgBouncer Task
resource "aws_iam_role" "pgbouncer_task_role" {
  name = "${var.project_name}-pgbouncer-task-role"

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
    Name        = "${var.project_name}-pgbouncer-task-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "pgbouncer_task_policy" {
  name = "${var.project_name}-pgbouncer-task-policy"
  role = aws_iam_role.pgbouncer_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          aws_ssm_parameter.db_password_param.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.pgbouncer.arn}:*"
      }
    ]
  })
}

# ECS Execution Role (if not already defined)
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-ecs-execution-role"

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
    Name        = "${var.project_name}-ecs-execution-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_ssm_policy" {
  name = "${var.project_name}-ecs-execution-ssm-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/*"
        ]
      }
    ]
  })
}

# CloudWatch Log Group for PgBouncer
resource "aws_cloudwatch_log_group" "pgbouncer" {
  name              = "/aws/ecs/${var.project_name}-pgbouncer"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-pgbouncer-logs"
    Environment = var.environment
  }
}

# SSM Parameter for PgBouncer Connection String
resource "aws_ssm_parameter" "pgbouncer_url" {
  name  = "/${var.project_name}/database/pgbouncer_url"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.postgres_enhanced.username}:${random_password.db_password_enhanced.result}@pgbouncer.${var.project_name}.local:5432/${aws_db_instance.postgres_enhanced.db_name}"

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Alarms for PgBouncer Monitoring
resource "aws_cloudwatch_metric_alarm" "pgbouncer_cpu_high" {
  alarm_name          = "${var.project_name}-pgbouncer-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors PgBouncer CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.pgbouncer.name
    ClusterName = aws_ecs_cluster.pgbouncer.name
  }

  tags = {
    Name        = "${var.project_name}-pgbouncer-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "pgbouncer_memory_high" {
  alarm_name          = "${var.project_name}-pgbouncer-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors PgBouncer memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = aws_ecs_service.pgbouncer.name
    ClusterName = aws_ecs_cluster.pgbouncer.name
  }

  tags = {
    Name        = "${var.project_name}-pgbouncer-memory-alarm"
    Environment = var.environment
  }
}