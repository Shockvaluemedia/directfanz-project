# Route 53 DNS Management - DirectFanz AWS Infrastructure

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name        = "${var.project_name}-hosted-zone"
    Environment = var.environment
  }
}

# Primary A record for the main domain pointing to ALB
resource "aws_route53_record" "main_primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  set_identifier = "primary"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.main_primary.id
}

# Failover A record for the main domain (points to CloudFront for static content)
resource "aws_route53_record" "main_failover" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  set_identifier = "failover"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }

  failover_routing_policy {
    type = "SECONDARY"
  }
}

# Primary A record for www subdomain
resource "aws_route53_record" "www_primary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  set_identifier = "primary"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.www_primary.id
}

# Failover A record for www subdomain
resource "aws_route53_record" "www_failover" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  set_identifier = "failover"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }

  failover_routing_policy {
    type = "SECONDARY"
  }
}

# API subdomain for API endpoints
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# WebSocket subdomain for real-time connections
resource "aws_route53_record" "ws" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "ws.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Streaming subdomain for live streaming
resource "aws_route53_record" "stream" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "stream.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# CDN subdomain for static content
resource "aws_route53_record" "cdn" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "cdn.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# Health check for the main domain primary endpoint
resource "aws_route53_health_check" "main_primary" {
  fqdn                            = var.domain_name
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-main-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-main-health-check"
    Type = "Primary"
  }
}

# Health check for www subdomain primary endpoint
resource "aws_route53_health_check" "www_primary" {
  fqdn                            = "www.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-www-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-www-health-check"
    Type = "Primary"
  }
}

# Health check for API subdomain
resource "aws_route53_health_check" "api" {
  fqdn                            = "api.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-api-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-api-health-check"
    Type = "API"
  }
}

# Health check for WebSocket subdomain
resource "aws_route53_health_check" "websocket" {
  fqdn                            = "ws.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-ws-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-websocket-health-check"
    Type = "WebSocket"
  }
}

# Health check for streaming subdomain
resource "aws_route53_health_check" "streaming" {
  fqdn                            = "stream.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/streaming/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-stream-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-streaming-health-check"
    Type = "Streaming"
  }
}

# CloudWatch alarms for Route 53 health checks
resource "aws_cloudwatch_metric_alarm" "route53_main_health_check" {
  alarm_name          = "${var.project_name}-main-health-check-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the main domain health check status"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.main_primary.id
  }

  tags = {
    Name = "${var.project_name}-main-health-check-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "route53_www_health_check" {
  alarm_name          = "${var.project_name}-www-health-check-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the www subdomain health check status"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.www_primary.id
  }

  tags = {
    Name = "${var.project_name}-www-health-check-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "route53_api_health_check" {
  alarm_name          = "${var.project_name}-api-health-check-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the API subdomain health check status"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.api.id
  }

  tags = {
    Name = "${var.project_name}-api-health-check-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "route53_websocket_health_check" {
  alarm_name          = "${var.project_name}-ws-health-check-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the WebSocket subdomain health check status"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.websocket.id
  }

  tags = {
    Name = "${var.project_name}-websocket-health-check-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "route53_streaming_health_check" {
  alarm_name          = "${var.project_name}-stream-health-check-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the streaming subdomain health check status"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.streaming.id
  }

  tags = {
    Name = "${var.project_name}-streaming-health-check-alarm"
  }
}

# MX record for email (if needed)
# resource "aws_route53_record" "mx" {
#   zone_id = aws_route53_zone.main.zone_id
#   name    = var.domain_name
#   type    = "MX"
#   ttl     = "300"
#   records = ["10 mail.${var.domain_name}"]
# }

# TXT record for domain verification (if needed)
# resource "aws_route53_record" "txt" {
#   zone_id = aws_route53_zone.main.zone_id
#   name    = var.domain_name
#   type    = "TXT"
#   ttl     = "300"
#   records = ["v=spf1 include:_spf.google.com ~all"]
# }

# Weighted routing for API load balancing across regions
resource "aws_route53_record" "api_us_east" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  set_identifier = "us-east-1"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  weighted_routing_policy {
    weight = 70 # 70% of traffic to primary region
  }

  health_check_id = aws_route53_health_check.api.id
}

resource "aws_route53_record" "api_us_west" {
  count   = var.enable_multi_region ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"
  set_identifier = "us-west-2"

  alias {
    name                   = var.enable_multi_region ? var.west_region_alb_dns : aws_lb.main.dns_name
    zone_id                = var.enable_multi_region ? var.west_region_alb_zone_id : aws_lb.main.zone_id
    evaluate_target_health = true
  }

  weighted_routing_policy {
    weight = 30 # 30% of traffic to secondary region
  }

  health_check_id = var.enable_multi_region ? aws_route53_health_check.api_west[0].id : aws_route53_health_check.api.id
}

# Geolocation routing for streaming based on user location
resource "aws_route53_record" "stream_us" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "stream.${var.domain_name}"
  type    = "A"
  set_identifier = "US"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  geolocation_routing_policy {
    country = "US"
  }

  health_check_id = aws_route53_health_check.streaming.id
}

resource "aws_route53_record" "stream_eu" {
  count   = var.enable_multi_region ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "stream.${var.domain_name}"
  type    = "A"
  set_identifier = "EU"

  alias {
    name                   = var.enable_multi_region ? var.eu_region_alb_dns : aws_lb.main.dns_name
    zone_id                = var.enable_multi_region ? var.eu_region_alb_zone_id : aws_lb.main.zone_id
    evaluate_target_health = true
  }

  geolocation_routing_policy {
    continent = "EU"
  }

  health_check_id = var.enable_multi_region ? aws_route53_health_check.streaming_eu[0].id : aws_route53_health_check.streaming.id
}

resource "aws_route53_record" "stream_default" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "stream.${var.domain_name}"
  type    = "A"
  set_identifier = "Default"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  geolocation_routing_policy {
    country = "*" # Default for all other locations
  }

  health_check_id = aws_route53_health_check.streaming.id
}

# Latency-based routing for WebSocket connections
resource "aws_route53_record" "ws_us_east" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "ws.${var.domain_name}"
  type    = "A"
  set_identifier = "us-east-1-latency"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }

  latency_routing_policy {
    region = var.aws_region
  }

  health_check_id = aws_route53_health_check.websocket.id
}

resource "aws_route53_record" "ws_us_west" {
  count   = var.enable_multi_region ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "ws.${var.domain_name}"
  type    = "A"
  set_identifier = "us-west-2-latency"

  alias {
    name                   = var.enable_multi_region ? var.west_region_alb_dns : aws_lb.main.dns_name
    zone_id                = var.enable_multi_region ? var.west_region_alb_zone_id : aws_lb.main.zone_id
    evaluate_target_health = true
  }

  latency_routing_policy {
    region = "us-west-2"
  }

  health_check_id = var.enable_multi_region ? aws_route53_health_check.websocket_west[0].id : aws_route53_health_check.websocket.id
}

# Service-specific subdomains for different environments
resource "aws_route53_record" "admin" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "admin.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "staging" {
  count   = var.environment != "prod" ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "staging.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "dev" {
  count   = var.environment == "dev" ? 1 : 0
  zone_id = aws_route53_zone.main.zone_id
  name    = "dev.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Mobile API subdomain with specific routing
resource "aws_route53_record" "mobile_api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "mobile-api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Assets subdomain pointing to CloudFront
resource "aws_route53_record" "assets" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "assets.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# Media subdomain for media processing
resource "aws_route53_record" "media" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "media.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Additional health checks for multi-region setup
resource "aws_route53_health_check" "api_west" {
  count                           = var.enable_multi_region ? 1 : 0
  fqdn                            = "api.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = "us-west-2"
  cloudwatch_alarm_name           = "${var.project_name}-api-west-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name   = "${var.project_name}-api-west-health-check"
    Type   = "API"
    Region = "us-west-2"
  }
}

resource "aws_route53_health_check" "streaming_eu" {
  count                           = var.enable_multi_region ? 1 : 0
  fqdn                            = "stream.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/streaming/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = "eu-west-1"
  cloudwatch_alarm_name           = "${var.project_name}-stream-eu-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name   = "${var.project_name}-streaming-eu-health-check"
    Type   = "Streaming"
    Region = "eu-west-1"
  }
}

resource "aws_route53_health_check" "websocket_west" {
  count                           = var.enable_multi_region ? 1 : 0
  fqdn                            = "ws.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = "us-west-2"
  cloudwatch_alarm_name           = "${var.project_name}-ws-west-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name   = "${var.project_name}-websocket-west-health-check"
    Type   = "WebSocket"
    Region = "us-west-2"
  }
}