# AWS IVS Streaming Infrastructure for DirectFanz
# Simplified live streaming solution with RTMP ingestion and HLS delivery

# IVS Channel for live streaming
resource "aws_ivs_channel" "streaming_channel" {
  name                        = "directfanz-streaming-channel"
  latency_mode                = "LOW"
  type                        = "STANDARD"
  authorized                  = false
  recording_configuration_arn = aws_ivs_recording_configuration.stream_recording.arn

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# IVS Stream Key
resource "aws_ivs_stream_key" "streaming_key" {
  channel_arn = aws_ivs_channel.streaming_channel.arn

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# S3 Bucket for stream recordings
resource "aws_s3_bucket" "stream_recordings" {
  bucket = "directfanz-stream-recordings-${random_string.bucket_suffix.result}"

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

resource "aws_s3_bucket_versioning" "stream_recordings_versioning" {
  bucket = aws_s3_bucket.stream_recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "stream_recordings_encryption" {
  bucket = aws_s3_bucket.stream_recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# IVS Recording Configuration
resource "aws_ivs_recording_configuration" "stream_recording" {
  name = "directfanz-recording-config"

  destination_configuration {
    s3 {
      bucket_name = aws_s3_bucket.stream_recordings.bucket
    }
  }

  thumbnail_configuration {
    recording_mode          = "INTERVAL"
    target_interval_seconds = 60
  }

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# CloudFront Distribution for HLS delivery
resource "aws_cloudfront_distribution" "streaming_cdn" {
  origin {
    domain_name = replace(aws_ivs_channel.streaming_channel.playback_url, "https://", "")
    origin_id   = "IVS-${aws_ivs_channel.streaming_channel.name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled = true
  comment = "DirectFanz Streaming CDN"

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "IVS-${aws_ivs_channel.streaming_channel.name}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 5
    max_ttl     = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# Outputs
output "rtmp_endpoint" {
  description = "RTMP endpoint for streaming"
  value       = aws_ivs_channel.streaming_channel.ingest_endpoint
}

output "stream_key" {
  description = "Stream key for RTMP streaming"
  value       = aws_ivs_stream_key.streaming_key.value
  sensitive   = true
}

output "hls_playback_url" {
  description = "HLS playback URL"
  value       = aws_ivs_channel.streaming_channel.playback_url
}

output "cdn_domain" {
  description = "CloudFront CDN domain for streaming"
  value       = aws_cloudfront_distribution.streaming_cdn.domain_name
}

output "stream_recordings_bucket" {
  description = "S3 bucket for stream recordings"
  value       = aws_s3_bucket.stream_recordings.bucket
}