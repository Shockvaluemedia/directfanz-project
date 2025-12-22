# Enhanced ElastiCache Redis Configuration for DirectFanz Platform
# Requirements: 3.1, 3.3, 3.4, 3.5

# ElastiCache subnet group for Redis cluster
resource "aws_elasticache_subnet_group" "redis_enhanced" {
  name       = "${var.project_name}-redis-enhanced-subnet"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name        = "${var.project_name}-redis-enhanced-subnet"
    Environment = var.environment
  }
}

# Parameter group for Redis 7.0 with cluster mode
resource "aws_elasticache_parameter_group" "redis_cluster" {
  family = "redis7"
  name   = "${var.project_name}-redis-cluster-params"

  parameter {
    name  = "cluster-enabled"
    value = "yes"
  }

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name        = "${var.project_name}-redis-cluster-params"
    Environment = var.environment
  }
}

# Enhanced Redis replication group with cluster mode
resource "aws_elasticache_replication_group" "redis_enhanced" {
  replication_group_id         = "${var.project_name}-redis-enhanced"
  description                  = "Enhanced Redis cluster for ${var.project_name} with cluster mode"

  # Cluster configuration
  node_type                    = var.redis_enhanced_node_type
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis_cluster.name
  
  # Cluster mode configuration - multiple shards for scalability
  num_cache_clusters           = null # Not used in cluster mode
  num_node_groups              = var.redis_num_shards
  replicas_per_node_group      = var.redis_replicas_per_shard

  # Network and security
  subnet_group_name            = aws_elasticache_subnet_group.redis_enhanced.name
  security_group_ids           = [aws_security_group.redis_enhanced.id]

  # Encryption - Requirements 3.3
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token                   = random_password.redis_enhanced_auth_token.result
  auth_token_update_strategy   = "ROTATE"

  # High availability and failover - Requirements 3.4
  automatic_failover_enabled   = true
  multi_az_enabled            = true

  # Backup and maintenance
  snapshot_retention_limit     = var.redis_snapshot_retention_days
  snapshot_window             = var.redis_snapshot_window
  maintenance_window          = var.redis_maintenance_window
  
  # Auto-scaling preparation - Requirements 3.5
  apply_immediately           = false
  auto_minor_version_upgrade  = true

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name        = "${var.project_name}-redis-enhanced"
    Environment = var.environment
    Purpose     = "caching-session-storage"
  }

  depends_on = [
    aws_cloudwatch_log_group.redis_slow_log
  ]
}

# Enhanced security group for Redis cluster
resource "aws_security_group" "redis_enhanced" {
  name_prefix = "${var.project_name}-redis-enhanced"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for enhanced Redis cluster"

  # Allow Redis traffic from application subnets
  ingress {
    description = "Redis traffic from application"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.private_subnets
  }

  # Allow Redis traffic from ECS tasks
  ingress {
    description     = "Redis traffic from ECS tasks"
    from_port       = 6379
    to_port         = 6379
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
    Name        = "${var.project_name}-redis-enhanced-sg"
    Environment = var.environment
  }
}

# Security group for ECS tasks (referenced above)
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for ECS tasks"

  # HTTP traffic from ALB
  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # WebSocket traffic from ALB
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
    Name        = "${var.project_name}-ecs-tasks-sg"
    Environment = var.environment
  }
}

# Security group for Application Load Balancer
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-alb"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for Application Load Balancer"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
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
    Name        = "${var.project_name}-alb-sg"
    Environment = var.environment
  }
}

# Random password for Redis authentication
resource "random_password" "redis_enhanced_auth_token" {
  length  = 32
  special = false # ElastiCache auth tokens cannot contain special characters
  upper   = true
  lower   = true
  numeric = true
}

# CloudWatch log group for Redis slow logs
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/redis/${var.project_name}/slow-log"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-redis-slow-log"
    Environment = var.environment
  }
}

# CloudWatch log group for Redis engine logs
resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/redis/${var.project_name}/engine-log"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-redis-engine-log"
    Environment = var.environment
  }
}

# Auto Scaling Target for Redis cluster - Requirements 3.5
resource "aws_appautoscaling_target" "redis_target" {
  max_capacity       = var.redis_max_shards
  min_capacity       = var.redis_num_shards
  resource_id        = "replication-group/${aws_elasticache_replication_group.redis_enhanced.replication_group_id}"
  scalable_dimension = "elasticache:replication-group:NodeGroups"
  service_namespace  = "elasticache"

  tags = {
    Name        = "${var.project_name}-redis-autoscaling-target"
    Environment = var.environment
  }
}

# Auto Scaling Policy for Redis cluster - scale up
resource "aws_appautoscaling_policy" "redis_scale_up" {
  name               = "${var.project_name}-redis-scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.redis_target.resource_id
  scalable_dimension = aws_appautoscaling_target.redis_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.redis_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ElastiCacheReplicationGroupCPUUtilization"
    }
    target_value       = var.redis_cpu_target_value
    scale_out_cooldown = 300
    scale_in_cooldown  = 300
  }

  depends_on = [aws_appautoscaling_target.redis_target]
}

# CloudWatch alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${var.project_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors redis cpu utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis_enhanced.replication_group_id
  }

  tags = {
    Name        = "${var.project_name}-redis-cpu-high"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${var.project_name}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors redis memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis_enhanced.replication_group_id
  }

  tags = {
    Name        = "${var.project_name}-redis-memory-high"
    Environment = var.environment
  }
}

# SSM Parameter for Redis connection string
resource "aws_ssm_parameter" "redis_enhanced_url" {
  name  = "/${var.project_name}/redis/enhanced/url"
  type  = "SecureString"
  value = "rediss://:${random_password.redis_enhanced_auth_token.result}@${aws_elasticache_replication_group.redis_enhanced.configuration_endpoint_address}:${aws_elasticache_replication_group.redis_enhanced.port}"

  tags = {
    Environment = var.environment
    Purpose     = "redis-connection"
  }
}

# SSM Parameter for Redis auth token
resource "aws_ssm_parameter" "redis_enhanced_auth_token" {
  name  = "/${var.project_name}/redis/enhanced/auth_token"
  type  = "SecureString"
  value = random_password.redis_enhanced_auth_token.result

  tags = {
    Environment = var.environment
    Purpose     = "redis-auth"
  }
}

# Output values for other modules
output "redis_enhanced_endpoint" {
  description = "Redis cluster configuration endpoint"
  value       = aws_elasticache_replication_group.redis_enhanced.configuration_endpoint_address
}

output "redis_enhanced_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_replication_group.redis_enhanced.port
}

output "redis_enhanced_auth_token_ssm_parameter" {
  description = "SSM parameter name for Redis auth token"
  value       = aws_ssm_parameter.redis_enhanced_auth_token.name
}