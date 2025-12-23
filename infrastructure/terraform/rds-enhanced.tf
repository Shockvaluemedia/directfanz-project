# Enhanced RDS PostgreSQL Configuration for AWS Conversion
# This file provides Multi-AZ, Performance Insights, automated backups, and read replicas

# Enhanced RDS PostgreSQL Database with Multi-AZ
resource "aws_db_instance" "postgres_enhanced" {
  identifier = "${var.project_name}-postgres-enhanced"

  # Engine Configuration
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class_enhanced

  # Storage Configuration
  allocated_storage     = var.db_allocated_storage_enhanced
  max_allocated_storage = var.db_max_allocated_storage_enhanced
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds_key.arn

  # Database Configuration
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password_enhanced.result

  # Network Configuration
  vpc_security_group_ids = [aws_security_group.rds_enhanced.id]
  db_subnet_group_name   = aws_db_subnet_group.enhanced.name
  publicly_accessible    = false

  # Multi-AZ Configuration for High Availability
  multi_az = true

  # Backup Configuration
  backup_retention_period   = var.db_backup_retention_days
  backup_window            = var.db_backup_window
  maintenance_window       = var.db_maintenance_window
  delete_automated_backups = false

  # Point-in-time Recovery
  copy_tags_to_snapshot = true
  skip_final_snapshot   = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-postgres-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  deletion_protection   = var.environment == "prod"

  # Performance Insights Configuration
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_days
  performance_insights_kms_key_id      = aws_kms_key.rds_key.arn

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Parameter Group for Optimization
  parameter_group_name = aws_db_parameter_group.postgres_enhanced.name

  # Option Group (if needed for extensions)
  option_group_name = aws_db_option_group.postgres_enhanced.name

  # Auto Minor Version Upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  tags = {
    Name        = "${var.project_name}-postgres-enhanced"
    Environment = var.environment
    Backup      = "required"
    MultiAZ     = "enabled"
  }

  depends_on = [
    aws_cloudwatch_log_group.rds_logs
  ]
}

# Enhanced Database Subnet Group
resource "aws_db_subnet_group" "enhanced" {
  name       = "${var.project_name}-db-subnet-group-enhanced"
  subnet_ids = module.vpc.database_subnets

  tags = {
    Name = "${var.project_name} Enhanced DB subnet group"
  }
}

# Enhanced Security Group for RDS
resource "aws_security_group" "rds_enhanced" {
  name_prefix = "${var.project_name}-rds-enhanced"
  vpc_id      = module.vpc.vpc_id
  description = "Enhanced security group for RDS PostgreSQL"

  # Allow PostgreSQL access from application subnets
  ingress {
    description = "PostgreSQL from application subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.private_subnets
  }

  # Allow PostgreSQL access from ECS tasks
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
    Name = "${var.project_name}-rds-enhanced-sg"
  }
}

# Security Group for ECS Tasks (referenced above)
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for ECS tasks"

  # Allow HTTP traffic from ALB
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow WebSocket traffic from ALB
  ingress {
    description     = "WebSocket from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-tasks-sg"
  }
}

# Security Group for Application Load Balancer
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for Application Load Balancer"

  # Allow HTTP traffic from internet
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow HTTPS traffic from internet
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# Random password for enhanced database
resource "random_password" "db_password_enhanced" {
  length  = 32
  special = true
}

# Database Parameter Group for Performance Optimization
resource "aws_db_parameter_group" "postgres_enhanced" {
  family = "postgres15"
  name   = "${var.project_name}-postgres15-enhanced"

  # Connection and Memory Parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking longer than 1 second
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Performance Parameters
  parameter {
    name  = "effective_cache_size"
    value = "1GB" # Adjust based on instance size
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "256MB"
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  parameter {
    name  = "wal_buffers"
    value = "16MB"
  }

  parameter {
    name  = "default_statistics_target"
    value = "100"
  }

  tags = {
    Name = "${var.project_name}-postgres-enhanced-params"
  }
}

# Database Option Group
resource "aws_db_option_group" "postgres_enhanced" {
  name                 = "${var.project_name}-postgres15-enhanced"
  option_group_description = "Enhanced option group for PostgreSQL 15"
  engine_name          = "postgres"
  major_engine_version = "15"

  tags = {
    Name = "${var.project_name}-postgres-enhanced-options"
  }
}

# Read Replica for Scaling
resource "aws_db_instance" "postgres_read_replica" {
  count = var.enable_read_replica ? 1 : 0

  identifier = "${var.project_name}-postgres-read-replica"

  # Replica Configuration
  replicate_source_db = aws_db_instance.postgres_enhanced.identifier

  # Instance Configuration
  instance_class = var.db_read_replica_instance_class
  
  # Network Configuration
  vpc_security_group_ids = [aws_security_group.rds_enhanced.id]
  publicly_accessible    = false

  # Performance Insights for Read Replica
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_days
  performance_insights_kms_key_id      = aws_kms_key.rds_encryption.arn

  # Enhanced Monitoring for Read Replica
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Auto Minor Version Upgrade
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  tags = {
    Name        = "${var.project_name}-postgres-read-replica"
    Environment = var.environment
    Type        = "read-replica"
  }
}

# Enhanced IAM Role for RDS Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${var.project_name}-rds-enhanced-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-rds-enhanced-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Log Group for RDS Logs
resource "aws_cloudwatch_log_group" "rds_logs" {
  name              = "/aws/rds/instance/${var.project_name}-postgres-enhanced/postgresql"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-rds-logs"
    Environment = var.environment
  }
}

# Systems Manager Parameters for Enhanced Database
resource "aws_ssm_parameter" "db_url_enhanced" {
  name  = "/${var.project_name}/database/url_enhanced"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.postgres_enhanced.username}:${random_password.db_password_enhanced.result}@${aws_db_instance.postgres_enhanced.endpoint}/${aws_db_instance.postgres_enhanced.db_name}"

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "db_read_replica_url" {
  count = var.enable_read_replica ? 1 : 0
  
  name  = "/${var.project_name}/database/read_replica_url"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.postgres_enhanced.username}:${random_password.db_password_enhanced.result}@${aws_db_instance.postgres_read_replica[0].endpoint}/${aws_db_instance.postgres_enhanced.db_name}"

  tags = {
    Environment = var.environment
  }
}

# Database Connection Information
resource "aws_ssm_parameter" "db_host" {
  name  = "/${var.project_name}/database/host"
  type  = "String"
  value = aws_db_instance.postgres_enhanced.address

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "db_port" {
  name  = "/${var.project_name}/database/port"
  type  = "String"
  value = tostring(aws_db_instance.postgres_enhanced.port)

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "db_name_param" {
  name  = "/${var.project_name}/database/name"
  type  = "String"
  value = aws_db_instance.postgres_enhanced.db_name

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "db_username_param" {
  name  = "/${var.project_name}/database/username"
  type  = "String"
  value = aws_db_instance.postgres_enhanced.username

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "db_password_param" {
  name  = "/${var.project_name}/database/password"
  type  = "SecureString"
  value = random_password.db_password_enhanced.result

  tags = {
    Environment = var.environment
  }
}