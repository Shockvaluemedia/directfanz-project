# Short-lived route to the private database, for the data copy on move day.
#
# Nothing here runs or listens by itself. `scripts/db-tunnel.sh` starts one
# small Fargate task from this definition with ECS Exec on, opens an SSM port
# forward through it to RDS (127.0.0.1:5432 on the operator's machine), and
# stops the task when the forward ends. The task also stops itself after
# `sleep` runs out, so a forgotten tunnel can't stay open.
#
# Why this and not ECS Exec on the app service: the app container holds every
# secret and serves the public site; a shell into it would be standing access
# to all of that. This task has no secrets, no app code, a role that can only
# carry SSM session traffic, and its own security group whose one way in to
# anything private is Postgres.

resource "aws_security_group" "db_access" {
  name        = "${local.name}-db-access"
  description = "One-off database tunnel task: no inbound, Postgres and SSM out"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_egress_rule" "db_access_https" {
  security_group_id = aws_security_group.db_access.id
  description       = "SSM session channel and image pull"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "db_access_db" {
  security_group_id            = aws_security_group.db_access.id
  description                  = "Postgres"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_db_access" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from the one-off tunnel task"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.db_access.id
}

# Task role: only what ECS Exec's SSM agent needs to carry a session.
resource "aws_iam_role" "db_access" {
  name               = "${local.name}-db-access-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy" "db_access" {
  name = "ssm-session-channel"
  role = aws_iam_role.db_access.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_ecs_task_definition" "db_access" {
  family                   = "${local.name}-db-access"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.db_access.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name      = "tunnel"
    image     = var.db_access_image
    essential = true
    # scripts/db-tunnel.sh sets a shorter time per run, never longer than this.
    command         = ["sleep", tostring(var.db_access_max_seconds)]
    linuxParameters = { initProcessEnabled = true }
  }])
}
