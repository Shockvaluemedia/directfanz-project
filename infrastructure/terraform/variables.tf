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

# Alert Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}