# AWS WAF Configuration for DirectFanz Platform Security

# WAF Web ACL for Application Protection
resource "aws_wafv2_web_acl" "directfanz_waf" {
  name  = "${var.project_name}-waf-acl"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rule 1: Rate Limiting per IP
  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: AWS Managed Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: SQL Injection Protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Geographic Restrictions (configurable)
  rule {
    name     = "GeographicRestriction"
    priority = 5

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = var.blocked_countries
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeographicRestrictionMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 6: Custom DirectFanz Platform Rules
  rule {
    name     = "DirectFanzCustomRules"
    priority = 6

    action {
      block {}
    }

    statement {
      or_statement {
        statement {
          # Block requests with suspicious user agents
          byte_match_statement {
            search_string = "bot"
            field_to_match {
              single_header {
                name = "user-agent"
              }
            }
            text_transformation {
              priority = 1
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }

        statement {
          # Block requests to admin paths from non-admin IPs
          and_statement {
            statement {
              byte_match_statement {
                search_string = "/admin"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 1
                  type     = "LOWERCASE"
                }
                positional_constraint = "STARTS_WITH"
              }
            }

            statement {
              not_statement {
                statement {
                  ip_set_reference_statement {
                    arn = aws_wafv2_ip_set.admin_whitelist.arn
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "DirectFanzCustomRulesMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 7: API Rate Limiting
  rule {
    name     = "APIRateLimitRule"
    priority = 7

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 500
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string = "/api/"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 1
              type     = "LOWERCASE"
            }
            positional_constraint = "STARTS_WITH"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "APIRateLimitMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "DirectFanzWAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "${var.project_name}-waf-acl"
    Environment = var.environment
    Project     = var.project_name
  }
}

# IP Set for Admin Whitelist
resource "aws_wafv2_ip_set" "admin_whitelist" {
  name  = "${var.project_name}-admin-whitelist"
  scope = "CLOUDFRONT"

  ip_address_version = "IPV4"
  addresses          = var.admin_whitelist_ips

  tags = {
    Name        = "${var.project_name}-admin-whitelist"
    Environment = var.environment
    Project     = var.project_name
  }
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "directfanz_waf_logging" {
  resource_arn            = aws_wafv2_web_acl.directfanz_waf.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# CloudWatch Log Group for WAF Logs
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/wafv2/${var.project_name}"
  retention_in_days = 30

  tags = {
    Name        = "${var.project_name}-waf-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Alarms for WAF Metrics
resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  alarm_name          = "${var.project_name}-waf-blocked-requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "100"
  alarm_description   = "This metric monitors blocked requests by WAF"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  dimensions = {
    WebACL = aws_wafv2_web_acl.directfanz_waf.name
    Region = "CloudFront"
  }

  tags = {
    Name        = "${var.project_name}-waf-blocked-requests-alarm"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudwatch_metric_alarm" "waf_rate_limit_triggered" {
  alarm_name          = "${var.project_name}-waf-rate-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RateLimitRule"
  namespace           = "AWS/WAFV2"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors rate limiting triggers"
  alarm_actions       = [aws_sns_topic.security_alerts.arn]

  dimensions = {
    WebACL = aws_wafv2_web_acl.directfanz_waf.name
    Region = "CloudFront"
  }

  tags = {
    Name        = "${var.project_name}-waf-rate-limit-alarm"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Output WAF ARN for CloudFront association
output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.directfanz_waf.arn
}

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.directfanz_waf.id
}