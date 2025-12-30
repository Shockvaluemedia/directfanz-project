# DirectFanz.io Production Configuration

# Project Configuration
project_name = "directfanz"
environment  = "prod"
aws_region   = "us-east-1"

# Domain Configuration
domain_name = "directfanz.io"

# VPC Configuration
vpc_cidr           = "10.0.0.0/16"
public_subnets     = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnets    = ["10.0.3.0/24", "10.0.4.0/24"]
database_subnets   = ["10.0.5.0/24", "10.0.6.0/24"]

# Database Configuration
db_instance_class    = "db.t3.medium"
db_allocated_storage = 100
db_name              = "directfanz"
db_username          = "postgres"

# Redis Configuration
redis_node_type = "cache.t3.medium"

# ECS Configuration
web_app_cpu           = 1024
web_app_memory        = 2048
web_app_desired_count = 2

# Application Configuration
app_port = 3000

# Monitoring Configuration
log_retention_days = 30