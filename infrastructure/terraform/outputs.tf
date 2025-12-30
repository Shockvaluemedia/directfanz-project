# Terraform Outputs

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}

# Route 53 Outputs
output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "Route 53 name servers (use these in Hostinger)"
  value       = aws_route53_zone.main.name_servers
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

# CloudFront Outputs (commented out until CloudFront is deployed)
/*
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}
*/

# Database Outputs
output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

# Redis Outputs
output "redis_primary_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

# S3 Outputs
output "content_storage_bucket_name" {
  description = "S3 content storage bucket name"
  value       = aws_s3_bucket.content_storage.bucket
}

output "static_assets_bucket_name" {
  description = "S3 static assets bucket name"
  value       = aws_s3_bucket.static_assets.bucket
}

# ECS Outputs
output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecr_web_app_repository_url" {
  description = "ECR repository URL for web app"
  value       = aws_ecr_repository.web_app.repository_url
}

# SSL Certificate Outputs (commented out until certificates are deployed)
/*
output "ssl_certificate_arn" {
  description = "ARN of the main SSL certificate"
  value       = aws_acm_certificate.main.arn
}

output "ssl_certificate_status" {
  description = "Status of the main SSL certificate"
  value       = aws_acm_certificate.main.status
}
*/

# Domain Information
output "domain_urls" {
  description = "All configured domain URLs"
  value = {
    main_domain    = "http://${var.domain_name}"  # HTTP until SSL is configured
    www_domain     = "http://www.${var.domain_name}"
    api_domain     = "http://api.${var.domain_name}"
    alb_url        = "http://${aws_lb.main.dns_name}"
  }
}

# Secrets Manager Outputs
output "db_secret_arn" {
  description = "ARN of the database secret in Secrets Manager"
  value       = aws_secretsmanager_secret.db_password.arn
  sensitive   = true
}

output "redis_secret_arn" {
  description = "ARN of the Redis secret in Secrets Manager"
  value       = aws_secretsmanager_secret.redis_auth_token.arn
  sensitive   = true
}