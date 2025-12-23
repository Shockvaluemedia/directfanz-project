# CloudFront CDN Configuration - DirectFanz AWS Infrastructure
# This configuration implements Requirements 4.2, 4.4, 4.6

# CloudFront Origin Access Control for S3 buckets
resource "aws_cloudfront_origin_access_control" "content_storage_oac" {
  name                              = "${var.project_name}-${var.environment}-content-oac"
  description                       = "Origin Access Control for content storage bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "static_assets_oac" {
  name                              = "${var.project_name}-${var.environment}-static-oac"
  description                       = "Origin Access Control for static assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution for content delivery
resource "aws_cloudfront_distribution" "main" {
  # Content storage origin (private content with signed URLs)
  origin {
    domain_name              = aws_s3_bucket.content_storage.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.content_storage.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.content_storage_oac.id
  }

  # Static assets origin (public content)
  origin {
    domain_name              = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.static_assets.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.static_assets_oac.id
  }

  # Application Load Balancer origin (dynamic content)
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB-${aws_lb.main.name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "DirectFanz CDN Distribution"
  default_root_object = "index.html"

  # Aliases for custom domain
  aliases = [
    var.domain_name,
    "www.${var.domain_name}",
    "cdn.${var.domain_name}",
    "assets.${var.domain_name}"
  ]

  # Default cache behavior for dynamic content (ALB)
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "ALB-${aws_lb.main.name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Host", "Authorization", "CloudFront-Forwarded-Proto", "User-Agent", "Referer"]

      cookies {
        forward = "all"
      }
    }

    # Short TTL for dynamic content
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 86400 # 1 day

    # Function associations for security headers
    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
  }

  # Cache behavior for static assets (long TTL)
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-${aws_s3_bucket.static_assets.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    # Long TTL for static assets
    min_ttl     = 31536000 # 1 year
    default_ttl = 31536000 # 1 year
    max_ttl     = 31536000 # 1 year
  }

  # Cache behavior for images (medium TTL)
  ordered_cache_behavior {
    path_pattern           = "/images/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-${aws_s3_bucket.content_storage.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true # For image transformations
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    # Medium TTL for images
    min_ttl     = 86400   # 1 day
    default_ttl = 604800  # 1 week
    max_ttl     = 2592000 # 30 days

    # Trusted key groups for signed URLs
    trusted_key_groups = [aws_cloudfront_key_group.content_signing.id]
  }

  # Cache behavior for videos (short TTL, signed URLs)
  ordered_cache_behavior {
    path_pattern           = "/videos/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-${aws_s3_bucket.content_storage.bucket}"
    compress               = false # Don't compress videos
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Range", "Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    # Short TTL for videos (premium content)
    min_ttl     = 0
    default_ttl = 3600  # 1 hour
    max_ttl     = 86400 # 1 day

    # Trusted key groups for signed URLs
    trusted_key_groups = [aws_cloudfront_key_group.content_signing.id]
  }

  # Cache behavior for documents (signed URLs required)
  ordered_cache_behavior {
    path_pattern           = "/documents/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-${aws_s3_bucket.content_storage.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    # Medium TTL for documents
    min_ttl     = 3600   # 1 hour
    default_ttl = 86400  # 1 day
    max_ttl     = 604800 # 1 week

    # Trusted key groups for signed URLs
    trusted_key_groups = [aws_cloudfront_key_group.content_signing.id]
  }

  # Cache behavior for API endpoints (no caching)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "ALB-${aws_lb.main.name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    # No caching for API endpoints
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Cache behavior for streaming content (HLS/DASH)
  ordered_cache_behavior {
    path_pattern           = "/stream/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "ALB-${aws_lb.main.name}"
    compress               = false
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      headers      = ["Range", "Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "whitelist"
        whitelisted_names = ["session-id", "auth-token"]
      }
    }

    # Short TTL for live streaming
    min_ttl     = 0
    default_ttl = 30   # 30 seconds
    max_ttl     = 300  # 5 minutes
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL certificate configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error pages
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/error/403.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/error/404.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code         = 500
    response_code      = 200
    response_page_path = "/error/500.html"
    error_caching_min_ttl = 0
  }

  # Logging configuration
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = "cloudfront-logs/"
  }

  # Price class for cost optimization
  price_class = var.environment == "prod" ? "PriceClass_All" : "PriceClass_100"

  tags = {
    Name        = "${var.project_name}-cloudfront-distribution"
    Environment = var.environment
  }
}

# CloudFront public key for signed URLs
resource "aws_cloudfront_public_key" "content_signing" {
  comment     = "Public key for DirectFanz content signing"
  encoded_key = file("${path.module}/keys/cloudfront-public-key.pem")
  name        = "${var.project_name}-${var.environment}-content-signing-key"
}

# CloudFront key group for signed URLs
resource "aws_cloudfront_key_group" "content_signing" {
  comment = "Key group for DirectFanz content signing"
  items   = [aws_cloudfront_public_key.content_signing.id]
  name    = "${var.project_name}-${var.environment}-content-signing-group"
}

# CloudFront function for security headers
resource "aws_cloudfront_function" "security_headers" {
  name    = "${var.project_name}-${var.environment}-security-headers"
  runtime = "cloudfront-js-1.0"
  comment = "Add security headers to responses"
  publish = true
  code    = file("${path.module}/functions/security-headers.js")
}

# S3 bucket for CloudFront logs
resource "aws_s3_bucket" "cloudfront_logs" {
  bucket        = "${var.project_name}-${var.environment}-cloudfront-logs-${random_string.content_suffix.result}"
  force_destroy = var.environment != "prod"

  tags = {
    Name        = "${var.project_name}-cloudfront-logs"
    Environment = var.environment
  }
}

# S3 bucket versioning for CloudFront logs
resource "aws_s3_bucket_versioning" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption for CloudFront logs
resource "aws_s3_bucket_server_side_encryption_configuration" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.app_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block for CloudFront logs
resource "aws_s3_bucket_public_access_block" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle for CloudFront logs
resource "aws_s3_bucket_lifecycle_configuration" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  rule {
    id     = "cloudfront_logs_lifecycle"
    status = "Enabled"

    # Transition to IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Transition to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Delete logs after 1 year
    expiration {
      days = 365
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# S3 bucket policy for CloudFront to write logs
resource "aws_s3_bucket_policy" "cloudfront_logs" {
  bucket = aws_s3_bucket.cloudfront_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudfront_logs.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# S3 bucket policy for content storage (CloudFront access)
resource "aws_s3_bucket_policy" "content_storage_cloudfront" {
  bucket = aws_s3_bucket.content_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.content_storage.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# S3 bucket policy for static assets (CloudFront access)
resource "aws_s3_bucket_policy" "static_assets_cloudfront" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# CloudWatch alarms for CloudFront monitoring
resource "aws_cloudwatch_metric_alarm" "cloudfront_error_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-cloudfront-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "5"
  alarm_description   = "This metric monitors CloudFront 4xx error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-error-rate-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_cache_hit_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-cloudfront-cache-hit-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CacheHitRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors CloudFront cache hit rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-cache-hit-rate-alarm"
    Environment = var.environment
  }
}

# Route 53 records for CloudFront distribution
resource "aws_route53_record" "cloudfront_main" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "cloudfront_www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "cloudfront_cdn" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "cdn.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "cloudfront_assets" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "assets.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}