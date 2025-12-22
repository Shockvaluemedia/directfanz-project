# Route 53 DNS Management - DirectFanz AWS Infrastructure

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name        = "${var.project_name}-hosted-zone"
    Environment = var.environment
  }
}

# A record for the main domain pointing to ALB
resource "aws_route53_record" "main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# A record for www subdomain pointing to ALB
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Health check for the main domain
resource "aws_route53_health_check" "main" {
  fqdn                            = var.domain_name
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/api/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-health-check-alarm"
  insufficient_data_health_status = "Failure"

  tags = {
    Name = "${var.project_name}-health-check"
  }
}

# CloudWatch alarm for Route 53 health check
resource "aws_cloudwatch_metric_alarm" "route53_health_check" {
  alarm_name          = "${var.project_name}-health-check-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors the health check status"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.main.id
  }

  tags = {
    Name = "${var.project_name}-health-check-alarm"
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