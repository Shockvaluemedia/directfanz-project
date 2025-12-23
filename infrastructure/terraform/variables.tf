# Variables for Direct Fan Platform Infrastructure

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "direct-fan-platform"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "database_subnets" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.5.0/24", "10.0.6.0/24"]
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS instance"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS instance"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "direct_fan_platform"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "postgres"
}

# Enhanced Database Configuration
variable "db_instance_class_enhanced" {
  description = "Enhanced RDS instance class for production workloads"
  type        = string
  default     = "db.r6g.large"
}

variable "db_allocated_storage_enhanced" {
  description = "Enhanced allocated storage for RDS instance"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage_enhanced" {
  description = "Enhanced maximum allocated storage for RDS instance"
  type        = number
  default     = 1000
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 30
}

variable "db_backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "db_maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "Mon:04:00-Mon:05:00"
}

variable "performance_insights_retention_days" {
  description = "Performance Insights retention period in days"
  type        = number
  default     = 7
}

variable "enable_read_replica" {
  description = "Enable read replica for database scaling"
  type        = bool
  default     = true
}

variable "db_read_replica_instance_class" {
  description = "Instance class for read replica"
  type        = string
  default     = "db.r6g.large"
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# PgBouncer Configuration
variable "pgbouncer_cpu" {
  description = "CPU units for PgBouncer task"
  type        = number
  default     = 256
}

variable "pgbouncer_memory" {
  description = "Memory for PgBouncer task"
  type        = number
  default     = 512
}

variable "pgbouncer_desired_count" {
  description = "Desired number of PgBouncer tasks"
  type        = number
  default     = 2
}

variable "pgbouncer_pool_mode" {
  description = "PgBouncer pool mode (session, transaction, statement)"
  type        = string
  default     = "transaction"
  
  validation {
    condition     = contains(["session", "transaction", "statement"], var.pgbouncer_pool_mode)
    error_message = "Pool mode must be one of: session, transaction, statement."
  }
}

variable "pgbouncer_max_client_conn" {
  description = "Maximum client connections"
  type        = number
  default     = 100
}

variable "pgbouncer_default_pool_size" {
  description = "Default pool size"
  type        = number
  default     = 20
}

variable "pgbouncer_min_pool_size" {
  description = "Minimum pool size"
  type        = number
  default     = 5
}

variable "pgbouncer_reserve_pool_size" {
  description = "Reserve pool size"
  type        = number
  default     = 5
}

variable "pgbouncer_server_lifetime" {
  description = "Server lifetime in seconds"
  type        = number
  default     = 3600
}

variable "pgbouncer_server_idle_timeout" {
  description = "Server idle timeout in seconds"
  type        = number
  default     = 600
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

# Enhanced Redis Configuration
variable "redis_enhanced_node_type" {
  description = "Enhanced ElastiCache Redis node type for cluster mode"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_shards" {
  description = "Number of shards in Redis cluster"
  type        = number
  default     = 3
}

variable "redis_replicas_per_shard" {
  description = "Number of replicas per shard"
  type        = number
  default     = 1
}

variable "redis_max_shards" {
  description = "Maximum number of shards for auto-scaling"
  type        = number
  default     = 6
}

variable "redis_cpu_target_value" {
  description = "Target CPU utilization for Redis auto-scaling"
  type        = number
  default     = 70
}

variable "redis_snapshot_retention_days" {
  description = "Number of days to retain Redis snapshots"
  type        = number
  default     = 5
}

variable "redis_snapshot_window" {
  description = "Daily time range for Redis snapshots"
  type        = string
  default     = "03:00-05:00"
}

variable "redis_maintenance_window" {
  description = "Weekly time range for Redis maintenance"
  type        = string
  default     = "sun:05:00-sun:09:00"
}

# Application Configuration
variable "app_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000
}

# ECS Configuration
variable "web_app_cpu" {
  description = "CPU units for web app task"
  type        = number
  default     = 1024
}

variable "web_app_memory" {
  description = "Memory for web app task"
  type        = number
  default     = 2048
}

variable "web_app_desired_count" {
  description = "Desired number of web app tasks"
  type        = number
  default     = 2
}

variable "web_app_min_capacity" {
  description = "Minimum number of web app tasks"
  type        = number
  default     = 2
}

variable "web_app_max_capacity" {
  description = "Maximum number of web app tasks"
  type        = number
  default     = 20
}

variable "websocket_cpu" {
  description = "CPU units for websocket task"
  type        = number
  default     = 512
}

variable "websocket_memory" {
  description = "Memory for websocket task"
  type        = number
  default     = 1024
}

variable "websocket_desired_count" {
  description = "Desired number of websocket tasks"
  type        = number
  default     = 2
}

variable "websocket_min_capacity" {
  description = "Minimum number of websocket tasks"
  type        = number
  default     = 2
}

variable "websocket_max_capacity" {
  description = "Maximum number of websocket tasks"
  type        = number
  default     = 10
}

variable "streaming_cpu" {
  description = "CPU units for streaming task"
  type        = number
  default     = 2048
}

variable "streaming_memory" {
  description = "Memory for streaming task"
  type        = number
  default     = 4096
}

variable "streaming_desired_count" {
  description = "Desired number of streaming tasks"
  type        = number
  default     = 1
}

variable "streaming_min_capacity" {
  description = "Minimum number of streaming tasks"
  type        = number
  default     = 1
}

variable "streaming_max_capacity" {
  description = "Maximum number of streaming tasks"
  type        = number
  default     = 5
}

# Monitoring and Alerting
variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "directfanz.io"
}

# Multi-region Configuration
variable "enable_multi_region" {
  description = "Enable multi-region deployment for DNS load balancing"
  type        = bool
  default     = false
}

variable "west_region_alb_dns" {
  description = "DNS name of the ALB in us-west-2 region"
  type        = string
  default     = ""
}

variable "west_region_alb_zone_id" {
  description = "Zone ID of the ALB in us-west-2 region"
  type        = string
  default     = ""
}

variable "eu_region_alb_dns" {
  description = "DNS name of the ALB in eu-west-1 region"
  type        = string
  default     = ""
}

variable "eu_region_alb_zone_id" {
  description = "Zone ID of the ALB in eu-west-1 region"
  type        = string
  default     = ""
}

# Blue-Green Deployment Configuration
variable "enable_deployment_hooks" {
  description = "Enable Lambda deployment hooks for blue-green deployments"
  type        = bool
  default     = true
}

variable "deployment_notification_email" {
  description = "Email address for deployment notifications"
  type        = string
  default     = ""
}

variable "blue_green_termination_wait_minutes" {
  description = "Wait time in minutes before terminating blue environment"
  type        = number
  default     = 5
  
  validation {
    condition     = var.blue_green_termination_wait_minutes >= 0 && var.blue_green_termination_wait_minutes <= 2880
    error_message = "Termination wait time must be between 0 and 2880 minutes (48 hours)."
  }
}

variable "deployment_config_name" {
  description = "CodeDeploy deployment configuration name"
  type        = string
  default     = "CodeDeployDefault.ECSAllAtOnceBlueGreen"
  
  validation {
    condition = contains([
      "CodeDeployDefault.ECSAllAtOnceBlueGreen",
      "CodeDeployDefault.ECSLinear10PercentEvery1Minutes",
      "CodeDeployDefault.ECSLinear10PercentEvery3Minutes",
      "CodeDeployDefault.ECSCanary10Percent5Minutes",
      "CodeDeployDefault.ECSCanary10Percent15Minutes"
    ], var.deployment_config_name)
    error_message = "Deployment config name must be a valid ECS CodeDeploy configuration."
  }
}

# Alert Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}

# CI/CD Configuration
variable "github_repository" {
  description = "GitHub repository in format owner/repo-name"
  type        = string
  default     = "directfanz/directfanz-project"
}

variable "github_branch" {
  description = "GitHub branch to monitor for changes"
  type        = string
  default     = "main"
}

variable "enable_pipeline_notifications" {
  description = "Enable pipeline notifications via SNS"
  type        = bool
  default     = true
}

variable "enable_codebuild_webhook" {
  description = "Enable CodeBuild webhook for GitHub integration"
  type        = bool
  default     = false
}

variable "enable_ecr_vulnerability_monitoring" {
  description = "Enable ECR vulnerability monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_ecr_scan_processing" {
  description = "Enable automated ECR scan result processing"
  type        = bool
  default     = true
}

# Deployment Approval Workflow Configuration
variable "slack_webhook_url" {
  description = "Slack webhook URL for approval notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "approval_timeout_hours" {
  description = "Timeout for manual approvals in hours"
  type        = number
  default     = 24
  
  validation {
    condition     = var.approval_timeout_hours >= 1 && var.approval_timeout_hours <= 168
    error_message = "Approval timeout must be between 1 and 168 hours (7 days)."
  }
}

variable "enable_approval_tracking" {
  description = "Enable detailed approval workflow tracking and notifications"
  type        = bool
  default     = true
}

variable "approval_notification_emails" {
  description = "List of email addresses for approval notifications"
  type        = list(string)
  default     = []
}
# S3 Content Storage Configuration
variable "enable_cross_region_replication" {
  description = "Enable cross-region replication for content storage"
  type        = bool
  default     = true
}

variable "content_backup_region" {
  description = "AWS region for content backup bucket"
  type        = string
  default     = "us-west-2"
}

variable "intelligent_tiering_archive_days" {
  description = "Days before transitioning to archive access tier"
  type        = number
  default     = 90
}

variable "intelligent_tiering_deep_archive_days" {
  description = "Days before transitioning to deep archive access tier"
  type        = number
  default     = 180
}

variable "content_lifecycle_ia_days" {
  description = "Days before transitioning content to Standard-IA"
  type        = number
  default     = 30
}

variable "content_lifecycle_glacier_days" {
  description = "Days before transitioning content to Glacier"
  type        = number
  default     = 90
}

variable "content_lifecycle_deep_archive_days" {
  description = "Days before transitioning content to Deep Archive"
  type        = number
  default     = 365
}

variable "content_version_retention_days" {
  description = "Days to retain non-current versions of content"
  type        = number
  default     = 365
}

variable "static_version_retention_days" {
  description = "Days to retain non-current versions of static assets"
  type        = number
  default     = 90
}

variable "temp_upload_cleanup_days" {
  description = "Days before cleaning up temporary uploads"
  type        = number
  default     = 1
}
# CloudFront CDN Configuration
variable "cloudfront_price_class" {
  description = "CloudFront distribution price class"
  type        = string
  default     = "PriceClass_100"
  
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200", 
      "PriceClass_100"
    ], var.cloudfront_price_class)
    error_message = "Price class must be PriceClass_All, PriceClass_200, or PriceClass_100."
  }
}

variable "cloudfront_minimum_protocol_version" {
  description = "Minimum SSL/TLS protocol version for CloudFront"
  type        = string
  default     = "TLSv1.2_2021"
}

variable "enable_cloudfront_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = true
}

variable "cloudfront_log_retention_days" {
  description = "Number of days to retain CloudFront logs"
  type        = number
  default     = 365
}

variable "cache_ttl_static_assets" {
  description = "TTL for static assets in seconds"
  type        = number
  default     = 31536000 # 1 year
}

variable "cache_ttl_images" {
  description = "TTL for images in seconds"
  type        = number
  default     = 604800 # 1 week
}

variable "cache_ttl_videos" {
  description = "TTL for videos in seconds"
  type        = number
  default     = 3600 # 1 hour
}

variable "cache_ttl_documents" {
  description = "TTL for documents in seconds"
  type        = number
  default     = 86400 # 1 day
}

variable "cache_ttl_streaming" {
  description = "TTL for streaming content in seconds"
  type        = number
  default     = 30 # 30 seconds
}

variable "cloudfront_error_rate_threshold" {
  description = "CloudFront 4xx error rate threshold for alarms"
  type        = number
  default     = 5
}

variable "cloudfront_cache_hit_rate_threshold" {
  description = "CloudFront cache hit rate threshold for alarms"
  type        = number
  default     = 85
}

variable "enable_signed_urls" {
  description = "Enable signed URLs for private content"
  type        = bool
  default     = true
}

variable "signed_url_expiration_hours" {
  description = "Default expiration time for signed URLs in hours"
  type        = number
  default     = 24
}

# WAF Security Configuration
variable "blocked_countries" {
  description = "List of country codes to block via WAF"
  type        = list(string)
  default     = []
}

variable "admin_whitelist_ips" {
  description = "List of IP addresses allowed to access admin endpoints"
  type        = list(string)
  default     = []
}

variable "waf_rate_limit_per_ip" {
  description = "Rate limit per IP address (requests per 5 minutes)"
  type        = number
  default     = 2000
}

variable "waf_api_rate_limit_per_ip" {
  description = "API rate limit per IP address (requests per 5 minutes)"
  type        = number
  default     = 500
}

variable "enable_waf_logging" {
  description = "Enable WAF request logging"
  type        = bool
  default     = true
}

variable "waf_log_retention_days" {
  description = "Number of days to retain WAF logs"
  type        = number
  default     = 30
}

# Migration Progress Tracking Configuration
variable "migration_alert_email" {
  description = "Email address for migration alerts"
  type        = string
  default     = ""
}

variable "migration_slack_webhook_url" {
  description = "Slack webhook URL for migration notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "migration_log_retention_days" {
  description = "Number of days to retain migration tracking logs"
  type        = number
  default     = 30
}

variable "enable_migration_monitoring" {
  description = "Enable comprehensive migration progress monitoring"
  type        = bool
  default     = true
}