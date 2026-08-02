# Variables for DirectFanz.io Infrastructure

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "directfanz"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "staging"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "directfanz.io"
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

variable "enable_nat_gateway" {
  description = "Enable NAT Gateways for private ECS outbound traffic. Keep false for minimal-cost staging."
  type        = bool
  default     = false
}

# Application Configuration
variable "app_port" {
  description = "Port on which the application runs"
  type        = number
  default     = 3000
}

variable "websocket_port" {
  description = "Port on which the websocket service runs"
  type        = number
  default     = 3001
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS instance"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "directfanz"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "postgres"
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_clusters" {
  description = "Number of Redis cache nodes. Use 1 for minimal staging; raise for production HA."
  type        = number
  default     = 1
}

# ECS Configuration
variable "web_app_cpu" {
  description = "CPU units for web app task"
  type        = number
  default     = 512
}

variable "web_app_memory" {
  description = "Memory for web app task"
  type        = number
  default     = 1024
}

variable "web_app_desired_count" {
  description = "Desired number of web app tasks"
  type        = number
  default     = 1
}

variable "websocket_cpu" {
  description = "CPU units for websocket task"
  type        = number
  default     = 256
}

variable "websocket_memory" {
  description = "Memory for websocket task"
  type        = number
  default     = 512
}

variable "websocket_desired_count" {
  description = "Desired number of websocket tasks"
  type        = number
  default     = 0
}

# Monitoring
variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 7
}

variable "enable_rds_enhanced_monitoring" {
  description = "Enable RDS enhanced monitoring. Keep false for minimal-cost staging."
  type        = bool
  default     = false
}

variable "enable_rds_performance_insights" {
  description = "Enable RDS Performance Insights. Keep false for minimal-cost staging."
  type        = bool
  default     = false
}
