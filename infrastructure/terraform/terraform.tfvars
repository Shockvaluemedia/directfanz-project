# DirectFanz.io Minimal AWS Staging Configuration

# Project Configuration
project_name = "directfanz"
environment  = "staging"
aws_region   = "us-east-1"

# Domain Configuration
domain_name = "directfanz.io"

# VPC Configuration
vpc_cidr           = "10.0.0.0/16"
public_subnets     = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnets    = ["10.0.3.0/24", "10.0.4.0/24"]
database_subnets   = ["10.0.5.0/24", "10.0.6.0/24"]
enable_nat_gateway = false

# Database Configuration
db_instance_class               = "db.t4g.micro"
db_allocated_storage            = 20
db_name                         = "directfanz"
db_username                     = "postgres"
enable_rds_enhanced_monitoring  = false
enable_rds_performance_insights = false

# Redis Configuration
redis_node_type          = "cache.t4g.micro"
redis_num_cache_clusters = 1

# ECS Configuration
web_app_cpu             = 512
web_app_memory          = 1024
web_app_desired_count   = 1
websocket_cpu           = 256
websocket_memory        = 512
websocket_desired_count = 0

# Application Configuration
app_port = 3000

# Monitoring Configuration
log_retention_days = 7
