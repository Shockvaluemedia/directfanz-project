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

output "ecs_tasks_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

output "ecs_web_app_security_group_id" {
  description = "Security group ID for ECS web app"
  value       = aws_security_group.ecs_web_app.id
}

output "ecs_websocket_security_group_id" {
  description = "Security group ID for ECS WebSocket"
  value       = aws_security_group.ecs_websocket.id
}

# ECS outputs
output "ecs_cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

# ECR outputs
output "ecr_web_app_repository_url" {
  description = "ECR repository URL for web app"
  value       = aws_ecr_repository.web_app.repository_url
}

output "ecr_websocket_repository_url" {
  description = "ECR repository URL for websocket"
  value       = aws_ecr_repository.websocket.repository_url
}

output "ecr_streaming_repository_url" {
  description = "ECR repository URL for streaming"
  value       = aws_ecr_repository.streaming.repository_url
}

# ECS Service outputs
output "ecs_web_app_service_name" {
  description = "ECS web app service name"
  value       = aws_ecs_service.web_app.name
}

output "ecs_websocket_service_name" {
  description = "ECS websocket service name"
  value       = aws_ecs_service.websocket.name
}

output "ecs_streaming_service_name" {
  description = "ECS streaming service name"
  value       = aws_ecs_service.streaming.name
}

# Target Group outputs
output "web_app_target_group_arn" {
  description = "Web app target group ARN"
  value       = aws_lb_target_group.web_app.arn
}

output "websocket_target_group_arn" {
  description = "WebSocket target group ARN"
  value       = aws_lb_target_group.websocket.arn
}

output "streaming_target_group_arn" {
  description = "Streaming target group ARN"
  value       = aws_lb_target_group.streaming.arn
}

# Service Discovery outputs
output "service_discovery_namespace_id" {
  description = "Service discovery namespace ID"
  value       = aws_service_discovery_private_dns_namespace.main.id
}

output "service_discovery_namespace_name" {
  description = "Service discovery namespace name"
  value       = aws_service_discovery_private_dns_namespace.main.name
}

# Auto Scaling outputs
output "web_app_autoscaling_target_arn" {
  description = "Web app auto scaling target ARN"
  value       = aws_appautoscaling_target.web_app.arn
}

output "websocket_autoscaling_target_arn" {
  description = "WebSocket auto scaling target ARN"
  value       = aws_appautoscaling_target.websocket.arn
}

output "streaming_autoscaling_target_arn" {
  description = "Streaming auto scaling target ARN"
  value       = aws_appautoscaling_target.streaming.arn
}

# CloudWatch Alarm outputs
output "web_app_cpu_alarm_arn" {
  description = "Web app CPU alarm ARN"
  value       = aws_cloudwatch_metric_alarm.web_app_high_cpu.arn
}

output "web_app_memory_alarm_arn" {
  description = "Web app memory alarm ARN"
  value       = aws_cloudwatch_metric_alarm.web_app_high_memory.arn
}

output "websocket_cpu_alarm_arn" {
  description = "WebSocket CPU alarm ARN"
  value       = aws_cloudwatch_metric_alarm.websocket_high_cpu.arn
}

output "websocket_memory_alarm_arn" {
  description = "WebSocket memory alarm ARN"
  value       = aws_cloudwatch_metric_alarm.websocket_high_memory.arn
}

output "streaming_cpu_alarm_arn" {
  description = "Streaming CPU alarm ARN"
  value       = aws_cloudwatch_metric_alarm.streaming_high_cpu.arn
}

output "streaming_memory_alarm_arn" {
  description = "Streaming memory alarm ARN"
  value       = aws_cloudwatch_metric_alarm.streaming_high_memory.arn
}

# CodeDeploy outputs
output "codedeploy_app_name" {
  description = "CodeDeploy application name"
  value       = aws_codedeploy_app.ecs_app.name
}

output "codedeploy_app_id" {
  description = "CodeDeploy application ID"
  value       = aws_codedeploy_app.ecs_app.id
}

output "codedeploy_service_role_arn" {
  description = "CodeDeploy service role ARN"
  value       = aws_iam_role.codedeploy_service_role.arn
}

output "web_app_deployment_group_name" {
  description = "Web app deployment group name"
  value       = aws_codedeploy_deployment_group.web_app.deployment_group_name
}

output "websocket_deployment_group_name" {
  description = "WebSocket deployment group name"
  value       = aws_codedeploy_deployment_group.websocket.deployment_group_name
}

output "streaming_deployment_group_name" {
  description = "Streaming deployment group name"
  value       = aws_codedeploy_deployment_group.streaming.deployment_group_name
}

output "deployment_notifications_topic_arn" {
  description = "Deployment notifications SNS topic ARN"
  value       = aws_sns_topic.deployment_notifications.arn
}

output "deployment_hook_lambda_arn" {
  description = "Deployment hook Lambda function ARN"
  value       = var.enable_deployment_hooks ? aws_lambda_function.deployment_hook[0].arn : null
}
# S3 Content Storage outputs
output "content_storage_bucket_name" {
  description = "S3 content storage bucket name"
  value       = aws_s3_bucket.content_storage.bucket
}

output "content_storage_bucket_arn" {
  description = "S3 content storage bucket ARN"
  value       = aws_s3_bucket.content_storage.arn
}

output "content_storage_bucket_domain_name" {
  description = "S3 content storage bucket domain name"
  value       = aws_s3_bucket.content_storage.bucket_domain_name
}

output "static_assets_bucket_name" {
  description = "S3 static assets bucket name"
  value       = aws_s3_bucket.static_assets.bucket
}

output "static_assets_bucket_arn" {
  description = "S3 static assets bucket ARN"
  value       = aws_s3_bucket.static_assets.arn
}

output "static_assets_bucket_domain_name" {
  description = "S3 static assets bucket domain name"
  value       = aws_s3_bucket.static_assets.bucket_domain_name
}

output "content_backup_bucket_name" {
  description = "S3 content backup bucket name"
  value       = var.environment == "prod" ? aws_s3_bucket.content_backup[0].bucket : null
}

output "content_backup_bucket_arn" {
  description = "S3 content backup bucket ARN"
  value       = var.environment == "prod" ? aws_s3_bucket.content_backup[0].arn : null
}

output "content_processor_lambda_arn" {
  description = "Content processor Lambda function ARN"
  value       = aws_lambda_function.content_processor.arn
}

output "content_processor_lambda_name" {
  description = "Content processor Lambda function name"
  value       = aws_lambda_function.content_processor.function_name
}

output "s3_replication_role_arn" {
  description = "S3 replication IAM role ARN"
  value       = var.environment == "prod" ? aws_iam_role.replication[0].arn : null
}
# CloudFront CDN outputs
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "cloudfront_distribution_status" {
  description = "CloudFront distribution status"
  value       = aws_cloudfront_distribution.main.status
}

output "cloudfront_origin_access_control_content_id" {
  description = "CloudFront Origin Access Control ID for content storage"
  value       = aws_cloudfront_origin_access_control.content_storage_oac.id
}

output "cloudfront_origin_access_control_static_id" {
  description = "CloudFront Origin Access Control ID for static assets"
  value       = aws_cloudfront_origin_access_control.static_assets_oac.id
}

output "cloudfront_key_group_id" {
  description = "CloudFront key group ID for signed URLs"
  value       = aws_cloudfront_key_group.content_signing.id
}

output "cloudfront_public_key_id" {
  description = "CloudFront public key ID for signed URLs"
  value       = aws_cloudfront_public_key.content_signing.id
}

output "cloudfront_security_headers_function_arn" {
  description = "CloudFront security headers function ARN"
  value       = aws_cloudfront_function.security_headers.arn
}

output "cloudfront_logs_bucket_name" {
  description = "CloudFront logs S3 bucket name"
  value       = aws_s3_bucket.cloudfront_logs.bucket
}

output "cloudfront_logs_bucket_arn" {
  description = "CloudFront logs S3 bucket ARN"
  value       = aws_s3_bucket.cloudfront_logs.arn
}

output "cdn_urls" {
  description = "CDN URLs for different content types"
  value = {
    main_domain    = "https://${var.domain_name}"
    www_domain     = "https://www.${var.domain_name}"
    cdn_domain     = "https://cdn.${var.domain_name}"
    assets_domain  = "https://assets.${var.domain_name}"
    cloudfront_url = "https://${aws_cloudfront_distribution.main.domain_name}"
  }
}

# Streaming Infrastructure Outputs
output "medialive_input_url" {
  description = "MediaLive RTMP input URL for streaming"
  value       = aws_medialive_input.rtmp_input.destinations[0].url
  sensitive   = true
}

output "medialive_channel_id" {
  description = "MediaLive channel ID"
  value       = aws_medialive_channel.main.id
}

output "medialive_channel_arn" {
  description = "MediaLive channel ARN"
  value       = aws_medialive_channel.main.arn
}

output "mediastore_endpoint" {
  description = "MediaStore container endpoint for HLS playback"
  value       = aws_mediastore_container.streaming.endpoint
}

output "mediastore_container_name" {
  description = "MediaStore container name"
  value       = aws_mediastore_container.streaming.name
}

output "mediastore_container_arn" {
  description = "MediaStore container ARN"
  value       = aws_mediastore_container.streaming.arn
}

output "streaming_recordings_bucket" {
  description = "S3 bucket for stream recordings"
  value       = aws_s3_bucket.streaming_recordings.bucket
}

output "streaming_recordings_bucket_arn" {
  description = "S3 bucket ARN for stream recordings"
  value       = aws_s3_bucket.streaming_recordings.arn
}

output "vod_content_bucket" {
  description = "S3 bucket for VOD content"
  value       = aws_s3_bucket.vod_content.bucket
}

output "vod_content_bucket_arn" {
  description = "S3 bucket ARN for VOD content"
  value       = aws_s3_bucket.vod_content.arn
}

output "mediaconvert_role_arn" {
  description = "IAM role ARN for MediaConvert jobs"
  value       = aws_iam_role.mediaconvert_role.arn
}

output "mediaconvert_trigger_lambda_arn" {
  description = "Lambda function ARN for triggering MediaConvert jobs"
  value       = aws_lambda_function.mediaconvert_trigger.arn
}

output "streaming_urls" {
  description = "Streaming-related URLs and endpoints"
  value = {
    mediastore_endpoint = aws_mediastore_container.streaming.endpoint
    hls_base_url       = "${aws_mediastore_container.streaming.endpoint}/live/"
    rtmp_input_url     = aws_medialive_input.rtmp_input.destinations[0].url
  }
  sensitive = true
}
# KMS Key outputs
output "app_kms_key_id" {
  description = "ID of the application KMS key"
  value       = aws_kms_key.app_key.key_id
}

output "app_kms_key_arn" {
  description = "ARN of the application KMS key"
  value       = aws_kms_key.app_key.arn
}

output "rds_kms_key_id" {
  description = "ID of the RDS KMS key"
  value       = aws_kms_key.rds_key.key_id
}

output "rds_kms_key_arn" {
  description = "ARN of the RDS KMS key"
  value       = aws_kms_key.rds_key.arn
}

output "elasticache_kms_key_id" {
  description = "ID of the ElastiCache KMS key"
  value       = aws_kms_key.elasticache_key.key_id
}

output "elasticache_kms_key_arn" {
  description = "ARN of the ElastiCache KMS key"
  value       = aws_kms_key.elasticache_key.arn
}

output "s3_content_kms_key_id" {
  description = "ID of the S3 content KMS key"
  value       = aws_kms_key.s3_content_key.key_id
}

output "s3_content_kms_key_arn" {
  description = "ARN of the S3 content KMS key"
  value       = aws_kms_key.s3_content_key.arn
}

output "secrets_kms_key_id" {
  description = "ID of the secrets KMS key"
  value       = aws_kms_key.secrets_key.key_id
}

output "secrets_kms_key_arn" {
  description = "ARN of the secrets KMS key"
  value       = aws_kms_key.secrets_key.arn
}

output "cloudtrail_kms_key_id" {
  description = "ID of the CloudTrail KMS key"
  value       = aws_kms_key.cloudtrail_key.key_id
}

output "cloudtrail_kms_key_arn" {
  description = "ARN of the CloudTrail KMS key"
  value       = aws_kms_key.cloudtrail_key.arn
}

output "sns_kms_key_id" {
  description = "ID of the SNS KMS key"
  value       = aws_kms_key.sns_key.key_id
}

output "sns_kms_key_arn" {
  description = "ARN of the SNS KMS key"
  value       = aws_kms_key.sns_key.arn
}

# Security outputs
output "security_alerts_topic_arn" {
  description = "ARN of the security alerts SNS topic"
  value       = aws_sns_topic.security_alerts.arn
}

output "cloudtrail_log_group_name" {
  description = "Name of the CloudTrail log group"
  value       = aws_cloudwatch_log_group.cloudtrail.name
}

output "cloudtrail_s3_bucket" {
  description = "Name of the CloudTrail S3 bucket"
  value       = aws_s3_bucket.cloudtrail_logs.bucket
}