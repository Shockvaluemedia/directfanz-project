# Outputs for Direct Fan Platform Infrastructure

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = module.vpc.database_subnets
}

# Database outputs
output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.postgres.id
}

# Enhanced Database outputs
output "db_enhanced_instance_endpoint" {
  description = "Enhanced RDS instance endpoint"
  value       = aws_db_instance.postgres_enhanced.endpoint
  sensitive   = true
}

output "db_enhanced_instance_port" {
  description = "Enhanced RDS instance port"
  value       = aws_db_instance.postgres_enhanced.port
}

output "db_enhanced_instance_id" {
  description = "Enhanced RDS instance ID"
  value       = aws_db_instance.postgres_enhanced.id
}

output "db_enhanced_instance_arn" {
  description = "Enhanced RDS instance ARN"
  value       = aws_db_instance.postgres_enhanced.arn
}

output "db_read_replica_endpoint" {
  description = "RDS read replica endpoint"
  value       = var.enable_read_replica ? aws_db_instance.postgres_read_replica[0].endpoint : null
  sensitive   = true
}

output "db_read_replica_id" {
  description = "RDS read replica ID"
  value       = var.enable_read_replica ? aws_db_instance.postgres_read_replica[0].id : null
}

output "db_parameter_group_name" {
  description = "Database parameter group name"
  value       = aws_db_parameter_group.postgres_enhanced.name
}

output "db_option_group_name" {
  description = "Database option group name"
  value       = aws_db_option_group.postgres_enhanced.name
}

output "db_subnet_group_name" {
  description = "Database subnet group name"
  value       = aws_db_subnet_group.enhanced.name
}

# Redis outputs
output "redis_primary_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

# S3 outputs
output "s3_bucket_name" {
  description = "S3 bucket name for application storage"
  value       = aws_s3_bucket.app_storage.bucket
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.app_storage.arn
}

# IAM outputs
output "app_role_arn" {
  description = "ARN of the application IAM role"
  value       = aws_iam_role.app_role.arn
}

# CloudWatch outputs
output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app_logs.name
}

# SSM Parameter outputs
output "ssm_db_url_parameter" {
  description = "SSM parameter name for database URL"
  value       = aws_ssm_parameter.db_url.name
  sensitive   = true
}

output "ssm_redis_url_parameter" {
  description = "SSM parameter name for Redis URL"
  value       = aws_ssm_parameter.redis_url.name
  sensitive   = true
}

output "ssm_s3_bucket_parameter" {
  description = "SSM parameter name for S3 bucket"
  value       = aws_ssm_parameter.s3_bucket_name.name
}

# Load Balancer outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

# Route 53 outputs
output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "Route 53 name servers"
  value       = aws_route53_zone.main.name_servers
}

# KMS outputs
output "app_kms_key_id" {
  description = "KMS key ID for application encryption"
  value       = aws_kms_key.app_key.key_id
}

output "app_kms_key_arn" {
  description = "KMS key ARN for application encryption"
  value       = aws_kms_key.app_key.arn
}

# SNS outputs
output "alerts_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "notifications_topic_arn" {
  description = "SNS topic ARN for notifications"
  value       = aws_sns_topic.notifications.arn
}

# Security Group outputs
output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = aws_security_group.alb.id
}

output "ecs_web_app_security_group_id" {
  description = "Security group ID for ECS web app"
  value       = aws_security_group.ecs_web_app.id
}

output "ecs_websocket_security_group_id" {
  description = "Security group ID for ECS WebSocket"
  value       = aws_security_group.ecs_websocket.id
}