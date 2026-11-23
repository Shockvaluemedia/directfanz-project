# The app: one always-on ARM Fargate task behind an application load balancer.

# --- Secrets ---------------------------------------------------------------

# App secret: one JSON object whose keys are var.app_secret_keys. Terraform
# creates the empty container only. Demetrius saves the values himself (see
# README.md), so no secret value is ever in code or Terraform state.
resource "aws_secretsmanager_secret" "app" {
  name        = "${local.name}/app"
  description = "DirectFanz app secrets (JSON). Values are set outside Terraform."
}

locals {
  db_secret_arn = aws_db_instance.main.master_user_secret[0].secret_arn

  app_secrets = concat(
    [for key in var.app_secret_keys : {
      name      = key
      valueFrom = "${aws_secretsmanager_secret.app.arn}:${key}::"
    }],
    [
      # RDS-managed login; docker/entrypoint.sh builds DATABASE_URL from these.
      { name = "DB_USERNAME", valueFrom = "${local.db_secret_arn}:username::" },
      { name = "DB_PASSWORD", valueFrom = "${local.db_secret_arn}:password::" },
    ],
  )

  site_url = var.enable_https ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"

  app_env = merge(
    {
      NODE_ENV           = "production"
      PORT               = "3000"
      HOSTNAME           = "0.0.0.0"
      NEXTAUTH_URL       = local.site_url
      AWS_REGION         = var.aws_region
      DB_HOST            = aws_db_instance.main.address
      DB_PORT            = tostring(aws_db_instance.main.port)
      DB_NAME            = var.db_name
      REDIS_URL          = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
      AWS_S3_BUCKET_NAME = aws_s3_bucket.media.bucket
      S3_BUCKET_NAME     = aws_s3_bucket.media.bucket
      USE_LOCAL_STORAGE  = "false"
    },
    var.ivs_playback_key_pair_arn == "" ? {} : {
      IVS_PLAYBACK_KEY_PAIR_ARN = var.ivs_playback_key_pair_arn
    },
    var.app_environment,
  )
}

# --- Logs, cluster ---------------------------------------------------------

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled" # saves money; basic ECS metrics still feed the alarms
  }
}

# --- IAM -------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:${data.aws_partition.current.partition}:ecs:${var.aws_region}:${var.aws_account_id}:*"]
    }
  }
}

# Execution role: ECS uses it to pull the image, write logs and read secrets.
resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid       = "ReadAppAndDatabaseSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app.arn, local.db_secret_arn]
  }
  # The RDS-managed secret is encrypted with the AWS-managed Secrets Manager key.
  statement {
    sid       = "DecryptViaSecretsManager"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# Task role: what the running app may do in AWS.
resource "aws_iam_role" "task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

data "aws_iam_policy_document" "task" {
  statement {
    sid       = "MediaObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }
  statement {
    sid       = "MediaBucket"
    actions   = ["s3:ListBucket", "s3:ListBucketMultipartUploads"]
    resources = [aws_s3_bucket.media.arn]
  }

  # Listening parties: the app creates one private IVS channel per party and
  # may only touch channels and stream keys tagged Project=directfanz.
  statement {
    sid       = "IvsCreateTagged"
    actions   = ["ivs:CreateChannel", "ivs:TagResource"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/Project"
      values   = [var.project]
    }
  }
  statement {
    sid = "IvsManageOwnChannels"
    actions = [
      "ivs:GetChannel",
      "ivs:UpdateChannel",
      "ivs:DeleteChannel",
      "ivs:GetStream",
      "ivs:StopStream",
      "ivs:GetStreamKey",
      "ivs:CreateStreamKey",
      "ivs:DeleteStreamKey",
      "ivs:ListStreamKeys",
      "ivs:ListStreamSessions",
      "ivs:GetStreamSession",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = [var.project]
    }
  }
  statement {
    sid       = "IvsList"
    actions   = ["ivs:ListChannels", "ivs:ListStreams", "ivs:GetPlaybackKeyPair"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "app"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# --- Task definition and service --------------------------------------------

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name      = "app"
    image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{ containerPort = 3000, protocol = "tcp" }]

    environment = [for k, v in local.app_env : { name = k, value = v }]
    secrets     = local.app_secrets

    stopTimeout = 30

    linuxParameters = { initProcessEnabled = true }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "app"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  name            = "${local.name}-app"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Rolling deploy that keeps the one running copy up until the new one is healthy.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 120

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true # no NAT gateway; inbound is still only from the ALB
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  # The deploy workflow registers new task definition revisions; don't roll
  # them back on the next terraform apply.
  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [aws_lb_listener.http]
}

# --- Load balancer ---------------------------------------------------------

resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Keep chat (socket.io) connections open.
  idle_timeout               = 300
  drop_invalid_header_fields = true
  enable_deletion_protection = true
}

resource "aws_lb_target_group" "app" {
  name                 = "${local.name}-app"
  port                 = 3000
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # socket.io long-polling needs each client to stick to one task if a second
  # copy is ever added.
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }
}

# Phase 1 (enable_https = false): plain HTTP straight to the app, on the
# load balancer's own AWS address, for the first test deploy.
# Phase 2 (enable_https = true): HTTP only redirects to HTTPS.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = var.enable_https ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.app.arn
    }
  }

  dynamic "default_action" {
    for_each = var.enable_https ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.site[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# www redirects to the bare domain.
resource "aws_lb_listener_rule" "www_redirect" {
  count = var.enable_https ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  condition {
    host_header {
      values = ["www.${var.domain_name}"]
    }
  }

  action {
    type = "redirect"
    redirect {
      host        = var.domain_name
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
