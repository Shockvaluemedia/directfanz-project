# Route 53 DNS Configuration for directfanz.io

# Route 53 Hosted Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name = "${var.project_name}-hosted-zone"
  }
}

# A record for main domain pointing to ALB
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

# A record for www subdomain
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

# A record for API subdomain
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

# A record for CDN subdomain pointing to CloudFront (commented out until CloudFront is deployed)
/*
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
*/

# Health check for main domain
resource "aws_route53_health_check" "main" {
  fqdn                    = var.domain_name
  port                    = 80  # Use HTTP port since we don't have SSL yet
  type                    = "HTTP"
  resource_path           = "/api/health"
  failure_threshold       = "3"
  request_interval        = "30"
  cloudwatch_alarm_region = var.aws_region
  cloudwatch_alarm_name   = "${var.project_name}-health-check-alarm"

  tags = {
    Name = "${var.project_name}-health-check"
  }
}