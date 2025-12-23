# Enhanced Security Groups for DirectFanz AWS Infrastructure

# Security Group for Application Load Balancer
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb"
  description = "Security group for Application Load Balancer"
  vpc_id      = module.vpc.vpc_id

  # Allow HTTP from anywhere
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTP traffic"
  }

  # Allow HTTPS from anywhere
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS traffic"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for ECS Tasks (Unified)
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks"
  description = "Security group for all ECS tasks"
  vpc_id      = module.vpc.vpc_id

  # Allow traffic from ALB on port 3000 (web app)
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow web app traffic from ALB"
  }

  # Allow traffic from ALB on port 3001 (websocket)
  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow WebSocket traffic from ALB"
  }

  # Allow traffic on port 3002 (streaming service)
  ingress {
    from_port   = 3002
    to_port     = 3002
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Allow streaming service traffic from VPC"
  }

  # Allow inter-service communication
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Allow inter-service communication"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-ecs-tasks-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for ECS Tasks (Web App)
resource "aws_security_group" "ecs_web_app" {
  name_prefix = "${var.project_name}-ecs-web"
  description = "Security group for ECS web application tasks"
  vpc_id      = module.vpc.vpc_id

  # Allow traffic from ALB on port 3000
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow traffic from ALB"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-ecs-web-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for ECS Tasks (WebSocket Server)
resource "aws_security_group" "ecs_websocket" {
  name_prefix = "${var.project_name}-ecs-ws"
  description = "Security group for ECS WebSocket server tasks"
  vpc_id      = module.vpc.vpc_id

  # Allow traffic from ALB on port 3001
  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow WebSocket traffic from ALB"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-ecs-websocket-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Security Group for VPC Endpoints
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${var.project_name}-vpc-endpoints"
  description = "Security group for VPC endpoints"
  vpc_id      = module.vpc.vpc_id

  # Allow HTTPS from VPC
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Allow HTTPS from VPC"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.project_name}-vpc-endpoints-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Update RDS security group to allow traffic from ECS tasks
resource "aws_security_group_rule" "rds_from_ecs_tasks" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.rds.id
  description              = "Allow PostgreSQL from ECS tasks"
}

resource "aws_security_group_rule" "rds_from_ecs_web" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_web_app.id
  security_group_id        = aws_security_group.rds.id
  description              = "Allow PostgreSQL from ECS web app"
}

resource "aws_security_group_rule" "rds_from_ecs_websocket" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_websocket.id
  security_group_id        = aws_security_group.rds.id
  description              = "Allow PostgreSQL from ECS WebSocket"
}

# Update Redis security group to allow traffic from ECS tasks
resource "aws_security_group_rule" "redis_from_ecs_tasks" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_tasks.id
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis from ECS tasks"
}

resource "aws_security_group_rule" "redis_from_ecs_web" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_web_app.id
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis from ECS web app"
}

resource "aws_security_group_rule" "redis_from_ecs_websocket" {
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.ecs_websocket.id
  security_group_id        = aws_security_group.redis.id
  description              = "Allow Redis from ECS WebSocket"
}
