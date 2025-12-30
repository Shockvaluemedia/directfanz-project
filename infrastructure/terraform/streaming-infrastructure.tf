# AWS Streaming Infrastructure for DirectFanz
# Complete live streaming solution with RTMP ingestion, transcoding, and CDN delivery
# TEMPORARILY COMMENTED OUT - NEEDS FIXES FOR TERRAFORM COMPATIBILITY

/*

# MediaLive Input for RTMP streams
resource "aws_medialive_input" "rtmp_input" {
  name                  = "directfanz-rtmp-input"
  type                  = "RTMP_PUSH"
  input_security_groups = [aws_medialive_input_security_group.rtmp_sg.id]

  destinations {
    stream_name = "live/stream"
  }

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# Security group for MediaLive input
resource "aws_medialive_input_security_group" "rtmp_sg" {
  whitelist_rules {
    cidr = "0.0.0.0/0"
  }

  tags = {
    Name = "directfanz-medialive-sg"
  }
}

# MediaLive Channel for transcoding
resource "aws_medialive_channel" "streaming_channel" {
  name          = "directfanz-streaming-channel"
  channel_class = "SINGLE_PIPELINE"
  role_arn      = aws_iam_role.medialive_role.arn

  input_attachments {
    input_attachment_name = "rtmp-input"
    input_id              = aws_medialive_input.rtmp_input.id
  }

  destinations {
    id = "hls-destination"
    settings {
      hls_settings {
        name_modifier = "_hls"
        segment_modifier = "_seg"
      }
    }
    media_package_settings {
      channel_id = aws_media_package_channel.streaming_channel.id
    }
  }

  encoder_settings {
    timecode_config {
      source = "EMBEDDED"
    }

    video_descriptions {
      name = "video_1080p"
      codec_settings {
        h264_settings {
          adaptive_quantization = "HIGH"
          bitrate               = 5000000
          framerate_control     = "SPECIFIED"
          framerate_numerator   = 30
          framerate_denominator = 1
          gop_b_reference       = "DISABLED"
          gop_closed_cadence    = 1
          gop_num_b_frames      = 2
          gop_size              = 90
          gop_size_units        = "FRAMES"
          level                 = "H264_LEVEL_4_1"
          look_ahead_rate_control = "HIGH"
          max_bitrate           = 5000000
          num_ref_frames        = 1
          par_control           = "SPECIFIED"
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          syntax                = "DEFAULT"
        }
      }
      height = 1080
      width  = 1920
    }

    video_descriptions {
      name = "video_720p"
      codec_settings {
        h264_settings {
          adaptive_quantization = "HIGH"
          bitrate               = 3000000
          framerate_control     = "SPECIFIED"
          framerate_numerator   = 30
          framerate_denominator = 1
          gop_b_reference       = "DISABLED"
          gop_closed_cadence    = 1
          gop_num_b_frames      = 2
          gop_size              = 90
          gop_size_units        = "FRAMES"
          level                 = "H264_LEVEL_4_1"
          look_ahead_rate_control = "HIGH"
          max_bitrate           = 3000000
          num_ref_frames        = 1
          par_control           = "SPECIFIED"
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          syntax                = "DEFAULT"
        }
      }
      height = 720
      width  = 1280
    }

    video_descriptions {
      name = "video_480p"
      codec_settings {
        h264_settings {
          adaptive_quantization = "HIGH"
          bitrate               = 1500000
          framerate_control     = "SPECIFIED"
          framerate_numerator   = 30
          framerate_denominator = 1
          gop_b_reference       = "DISABLED"
          gop_closed_cadence    = 1
          gop_num_b_frames      = 2
          gop_size              = 90
          gop_size_units        = "FRAMES"
          level                 = "H264_LEVEL_4_1"
          look_ahead_rate_control = "HIGH"
          max_bitrate           = 1500000
          num_ref_frames        = 1
          par_control           = "SPECIFIED"
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          syntax                = "DEFAULT"
        }
      }
      height = 480
      width  = 854
    }

    audio_descriptions {
      name = "audio_1"
      codec_settings {
        aac_settings {
          bitrate         = 128000
          coding_mode     = "CODING_MODE_2_0"
          input_type      = "NORMAL"
          profile         = "LC"
          rate_control_mode = "CBR"
          raw_format      = "NONE"
          sample_rate     = 48000
          spec            = "MPEG4"
        }
      }
    }

    output_groups {
      name = "hls_group"
      output_group_settings {
        hls_group_settings {
          destination {
            destination_ref_id = "hls-destination"
          }
          hls_cdn_settings {
            hls_basic_put_settings {
              connection_retry_interval = 30
              filecache_duration        = 300
              num_retries              = 10
            }
          }
          manifest_duration_format = "INTEGER"
          segment_length           = 6
          segments_per_subdirectory = 10000
        }
      }

      outputs {
        output_name = "1080p"
        video_description_name = "video_1080p"
        audio_description_names = ["audio_1"]
        output_settings {
          hls_output_settings {
            name_modifier = "_1080p"
            hls_settings {
              standard_hls_settings {
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids           = "492-498"
                  pcr_control          = "PCR_EVERY_PES_PACKET"
                  pcr_period           = 80
                  pcr_pid              = "481"
                  pmt_interval         = 0
                  pmt_pid              = "480"
                  program_num          = 1
                  scte35_behavior      = "NO_PASSTHROUGH"
                  scte35_pid           = "500"
                  transport_stream_id  = 1
                  video_pid            = "481"
                }
              }
            }
          }
        }
      }

      outputs {
        output_name = "720p"
        video_description_name = "video_720p"
        audio_description_names = ["audio_1"]
        output_settings {
          hls_output_settings {
            name_modifier = "_720p"
            hls_settings {
              standard_hls_settings {
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids           = "492-498"
                  pcr_control          = "PCR_EVERY_PES_PACKET"
                  pcr_period           = 80
                  pcr_pid              = "481"
                  pmt_interval         = 0
                  pmt_pid              = "480"
                  program_num          = 1
                  scte35_behavior      = "NO_PASSTHROUGH"
                  scte35_pid           = "500"
                  transport_stream_id  = 1
                  video_pid            = "481"
                }
              }
            }
          }
        }
      }

      outputs {
        output_name = "480p"
        video_description_name = "video_480p"
        audio_description_names = ["audio_1"]
        output_settings {
          hls_output_settings {
            name_modifier = "_480p"
            hls_settings {
              standard_hls_settings {
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids           = "492-498"
                  pcr_control          = "PCR_EVERY_PES_PACKET"
                  pcr_period           = 80
                  pcr_pid              = "481"
                  pmt_interval         = 0
                  pmt_pid              = "480"
                  program_num          = 1
                  scte35_behavior      = "NO_PASSTHROUGH"
                  scte35_pid           = "500"
                  transport_stream_id  = 1
                  video_pid            = "481"
                }
              }
            }
          }
        }
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# MediaPackage Channel for HLS delivery
resource "aws_media_package_channel" "streaming_channel" {
  channel_id  = "directfanz-streaming"
  description = "DirectFanz Live Streaming Channel"

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# MediaPackage Origin Endpoint for HLS
resource "aws_media_package_origin_endpoint" "hls_endpoint" {
  channel_id = aws_media_package_channel.streaming_channel.id
  endpoint_id = "directfanz-hls"
  description = "HLS endpoint for DirectFanz streaming"

  hls_package {
    ad_markers              = "NONE"
    include_iframe_only_stream = false
    playlist_type          = "EVENT"
    playlist_window_seconds = 60
    program_date_time_interval_seconds = 0
    segment_duration_seconds = 6
  }

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# CloudFront Distribution for streaming
resource "aws_cloudfront_distribution" "streaming_cdn" {
  origin {
    domain_name = replace(aws_media_package_origin_endpoint.hls_endpoint.url, "https://", "")
    origin_id   = "MediaPackage-${aws_media_package_origin_endpoint.hls_endpoint.endpoint_id}"

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
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "MediaPackage-${aws_media_package_origin_endpoint.hls_endpoint.endpoint_id}"
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
    default_ttl = 86400
    max_ttl     = 31536000
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

# IAM Role for MediaLive
resource "aws_iam_role" "medialive_role" {
  name = "directfanz-medialive-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "medialive.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = "DirectFanz"
  }
}

# IAM Policy for MediaLive
resource "aws_iam_role_policy" "medialive_policy" {
  name = "directfanz-medialive-policy"
  role = aws_iam_role.medialive_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mediapackage:*",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = "*"
      }
    ]
  })
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

# Random string for unique bucket naming (using existing one from s3.tf)

# Outputs
output "rtmp_endpoint" {
  description = "RTMP endpoint for streaming"
  value       = "rtmp://medialive-input-endpoint/live/stream"
}

output "hls_playback_url" {
  description = "HLS playback URL"
  value       = aws_media_package_origin_endpoint.hls_endpoint.url
}

output "cdn_domain" {
  description = "CloudFront CDN domain for streaming"
  value       = aws_cloudfront_distribution.streaming_cdn.domain_name
}

output "stream_recordings_bucket" {
  description = "S3 bucket for stream recordings"
  value       = aws_s3_bucket.stream_recordings.bucket
}
*/