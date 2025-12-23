# AWS Elemental MediaLive Configuration for Live Streaming
# This configuration sets up MediaLive channels for live video processing
# with adaptive bitrate streaming profiles

# MediaLive Input Security Group
resource "aws_medialive_input_security_group" "main" {
  whitelist_rules {
    cidr = "0.0.0.0/0"
  }

  tags = {
    Name        = "${var.project_name}-medialive-input-sg"
    Environment = var.environment
  }
}

# MediaLive Input for RTMP streams
resource "aws_medialive_input" "rtmp_input" {
  name                  = "${var.project_name}-rtmp-input"
  input_security_groups = [aws_medialive_input_security_group.main.id]
  type                  = "RTMP_PUSH"

  destinations {
    stream_name = "live"
  }

  tags = {
    Name        = "${var.project_name}-rtmp-input"
    Environment = var.environment
  }
}

# IAM Role for MediaLive
resource "aws_iam_role" "medialive_role" {
  name = "${var.project_name}-medialive-role"

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
    Name        = "${var.project_name}-medialive-role"
    Environment = var.environment
  }
}

# IAM Policy for MediaLive to access MediaStore and S3
resource "aws_iam_role_policy" "medialive_policy" {
  name = "${var.project_name}-medialive-policy"
  role = aws_iam_role.medialive_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mediastore:PutObject",
          "mediastore:GetObject",
          "mediastore:DeleteObject",
          "mediastore:ListContainers",
          "mediastore:DescribeContainer"
        ]
        Resource = [
          aws_mediastore_container.streaming.arn,
          "${aws_mediastore_container.streaming.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.streaming_recordings.arn,
          "${aws_s3_bucket.streaming_recordings.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# MediaLive Channel with adaptive bitrate streaming
resource "aws_medialive_channel" "main" {
  name          = "${var.project_name}-live-channel"
  channel_class = "SINGLE_PIPELINE"
  role_arn      = aws_iam_role.medialive_role.arn

  input_specification {
    codec            = "AVC"
    input_resolution = "HD"
    maximum_bitrate  = "MAX_10_MBPS"
  }

  input_attachments {
    input_attachment_name = "main-input"
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

    media_store_settings {
      container_name = aws_mediastore_container.streaming.name
    }
  }

  destinations {
    id = "recording-destination"
    
    settings {
      archive_settings {
        name_modifier = "_archive"
      }
    }

    s3_settings {
      bucket_name = aws_s3_bucket.streaming_recordings.bucket
    }
  }

  encoder_settings {
    timecode_config {
      source = "EMBEDDED"
    }

    # Audio descriptions
    audio_descriptions {
      audio_selector_name = "default"
      name                = "audio_1"
      
      codec_settings {
        aac_settings {
          bitrate         = 128000
          coding_mode     = "CODING_MODE_2_0"
          input_type      = "BROADCASTER_MIXED_AD"
          profile         = "LC"
          rate_control_mode = "CBR"
          raw_format      = "NONE"
          sample_rate     = 48000
          spec            = "MPEG4"
        }
      }
    }

    # Video descriptions for adaptive bitrate
    video_descriptions {
      name = "video_1080p"
      
      codec_settings {
        h264_settings {
          adaptive_quantization = "HIGH"
          bitrate               = 5000000
          entropy_encoding      = "CABAC"
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
          num_ref_frames        = 3
          par_control           = "SPECIFIED"
          par_numerator         = 1
          par_denominator       = 1
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          scene_change_detect   = "ENABLED"
          syntax_control        = "DEFAULT"
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
          entropy_encoding      = "CABAC"
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
          num_ref_frames        = 3
          par_control           = "SPECIFIED"
          par_numerator         = 1
          par_denominator       = 1
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          scene_change_detect   = "ENABLED"
          syntax_control        = "DEFAULT"
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
          entropy_encoding      = "CABAC"
          framerate_control     = "SPECIFIED"
          framerate_numerator   = 30
          framerate_denominator = 1
          gop_b_reference       = "DISABLED"
          gop_closed_cadence    = 1
          gop_num_b_frames      = 2
          gop_size              = 90
          gop_size_units        = "FRAMES"
          level                 = "H264_LEVEL_3_1"
          look_ahead_rate_control = "HIGH"
          max_bitrate           = 1500000
          num_ref_frames        = 3
          par_control           = "SPECIFIED"
          par_numerator         = 1
          par_denominator       = 1
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          scene_change_detect   = "ENABLED"
          syntax_control        = "DEFAULT"
        }
      }

      height = 480
      width  = 854
    }

    video_descriptions {
      name = "video_240p"
      
      codec_settings {
        h264_settings {
          adaptive_quantization = "HIGH"
          bitrate               = 800000
          entropy_encoding      = "CABAC"
          framerate_control     = "SPECIFIED"
          framerate_numerator   = 30
          framerate_denominator = 1
          gop_b_reference       = "DISABLED"
          gop_closed_cadence    = 1
          gop_num_b_frames      = 2
          gop_size              = 90
          gop_size_units        = "FRAMES"
          level                 = "H264_LEVEL_3_0"
          look_ahead_rate_control = "HIGH"
          max_bitrate           = 800000
          num_ref_frames        = 3
          par_control           = "SPECIFIED"
          par_numerator         = 1
          par_denominator       = 1
          profile               = "HIGH"
          rate_control_mode     = "CBR"
          scene_change_detect   = "ENABLED"
          syntax_control        = "DEFAULT"
        }
      }

      height = 240
      width  = 426
    }

    # Output groups for HLS streaming
    output_groups {
      name = "hls_output_group"
      
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

          ad_markers                = ["ELEMENTAL"]
          base_url_content         = ""
          base_url_manifest        = ""
          caption_language_mappings = []
          caption_language_setting = "OMIT"
          client_cache             = "ENABLED"
          codec_specification      = "RFC_4281"
          constant_iv              = ""
          directory_structure      = "SINGLE_DIRECTORY"
          encryption_type          = "NONE"
          hls_id3_segment_tagging  = "DISABLED"
          i_frame_only_playlists   = "DISABLED"
          index_n_segments         = 10
          input_loss_action        = "EMIT_OUTPUT"
          iv_in_manifest           = "INCLUDE"
          iv_source                = "FOLLOWS_SEGMENT_NUMBER"
          keep_segments            = 21
          key_format               = ""
          key_format_versions      = ""
          key_provider_settings    = []
          manifest_compression     = "NONE"
          manifest_duration_format = "FLOATING_POINT"
          min_segment_length       = 0
          mode                     = "LIVE"
          output_selection         = "MANIFESTS_AND_SEGMENTS"
          program_date_time        = "INCLUDE"
          program_date_time_period = 600
          redundant_manifest       = "DISABLED"
          segment_length           = 6
          segmentation_mode        = "USE_SEGMENT_DURATION"
          segments_per_subdirectory = 10000
          stream_inf_resolution    = "INCLUDE"
          timed_metadata_id3_frame = "NONE"
          timed_metadata_id3_period = 10
          timestamp_delta_milliseconds = 0
          ts_file_mode            = "SEGMENTED_FILES"
        }
      }

      outputs {
        audio_description_names = ["audio_1"]
        output_name            = "1080p"
        video_description_name = "video_1080p"
        
        output_settings {
          hls_output_settings {
            name_modifier = "_1080p"
            hls_settings {
              standard_hls_settings {
                audio_rendition_sets = ""
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids          = "492-498"
                  ecm_pid             = ""
                  nielsen_id3_behavior = "NO_PASSTHROUGH"
                  pat_interval        = 0
                  pcr_control         = "PCR_EVERY_PES_PACKET"
                  pcr_period          = 80
                  pcr_pid             = "481"
                  pmt_interval        = 0
                  pmt_pid             = "480"
                  program_num         = 1
                  scte35_behavior     = "NO_PASSTHROUGH"
                  scte35_pid          = ""
                  timed_metadata_behavior = "NO_PASSTHROUGH"
                  timed_metadata_pid  = ""
                  transport_stream_id = 1
                  video_pid           = "481"
                }
              }
            }
          }
        }
      }

      outputs {
        audio_description_names = ["audio_1"]
        output_name            = "720p"
        video_description_name = "video_720p"
        
        output_settings {
          hls_output_settings {
            name_modifier = "_720p"
            hls_settings {
              standard_hls_settings {
                audio_rendition_sets = ""
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids          = "492-498"
                  ecm_pid             = ""
                  nielsen_id3_behavior = "NO_PASSTHROUGH"
                  pat_interval        = 0
                  pcr_control         = "PCR_EVERY_PES_PACKET"
                  pcr_period          = 80
                  pcr_pid             = "481"
                  pmt_interval        = 0
                  pmt_pid             = "480"
                  program_num         = 1
                  scte35_behavior     = "NO_PASSTHROUGH"
                  scte35_pid          = ""
                  timed_metadata_behavior = "NO_PASSTHROUGH"
                  timed_metadata_pid  = ""
                  transport_stream_id = 1
                  video_pid           = "481"
                }
              }
            }
          }
        }
      }

      outputs {
        audio_description_names = ["audio_1"]
        output_name            = "480p"
        video_description_name = "video_480p"
        
        output_settings {
          hls_output_settings {
            name_modifier = "_480p"
            hls_settings {
              standard_hls_settings {
                audio_rendition_sets = ""
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids          = "492-498"
                  ecm_pid             = ""
                  nielsen_id3_behavior = "NO_PASSTHROUGH"
                  pat_interval        = 0
                  pcr_control         = "PCR_EVERY_PES_PACKET"
                  pcr_period          = 80
                  pcr_pid             = "481"
                  pmt_interval        = 0
                  pmt_pid             = "480"
                  program_num         = 1
                  scte35_behavior     = "NO_PASSTHROUGH"
                  scte35_pid          = ""
                  timed_metadata_behavior = "NO_PASSTHROUGH"
                  timed_metadata_pid  = ""
                  transport_stream_id = 1
                  video_pid           = "481"
                }
              }
            }
          }
        }
      }

      outputs {
        audio_description_names = ["audio_1"]
        output_name            = "240p"
        video_description_name = "video_240p"
        
        output_settings {
          hls_output_settings {
            name_modifier = "_240p"
            hls_settings {
              standard_hls_settings {
                audio_rendition_sets = ""
                m3u8_settings {
                  audio_frames_per_pes = 4
                  audio_pids          = "492-498"
                  ecm_pid             = ""
                  nielsen_id3_behavior = "NO_PASSTHROUGH"
                  pat_interval        = 0
                  pcr_control         = "PCR_EVERY_PES_PACKET"
                  pcr_period          = 80
                  pcr_pid             = "481"
                  pmt_interval        = 0
                  pmt_pid             = "480"
                  program_num         = 1
                  scte35_behavior     = "NO_PASSTHROUGH"
                  scte35_pid          = ""
                  timed_metadata_behavior = "NO_PASSTHROUGH"
                  timed_metadata_pid  = ""
                  transport_stream_id = 1
                  video_pid           = "481"
                }
              }
            }
          }
        }
      }
    }

    # Output group for recording/archiving
    output_groups {
      name = "archive_output_group"
      
      output_group_settings {
        archive_group_settings {
          destination {
            destination_ref_id = "recording-destination"
          }
          
          archive_cdn_settings {
            archive_s3_settings {
              canned_acl = "BUCKET_OWNER_FULL_CONTROL"
            }
          }
        }
      }

      outputs {
        audio_description_names = ["audio_1"]
        output_name            = "archive_output"
        video_description_name = "video_1080p"
        
        output_settings {
          archive_output_settings {
            name_modifier = "_archive"
            container_settings {
              m2ts_settings {
                absent_input_audio_behavior = "DROP_SILENCE_IN_PIPELINE"
                arib                       = "DISABLED"
                arib_captions_pid          = ""
                arib_captions_pid_control  = "AUTO"
                audio_buffer_model         = "DVB"
                audio_frames_per_pes       = 4
                audio_pids                 = "492-498"
                audio_stream_type          = "DVB"
                bitrate                    = 1000000
                buffer_model               = "MULTIPLEX"
                cc_descriptor              = "DISABLED"
                dvb_nit_settings {
                  network_id   = 1
                  network_name = "DirectFanz"
                  rep_interval = 5000
                }
                dvb_sdt_settings {
                  output_sdt       = "SDT_FOLLOW"
                  rep_interval     = 5000
                  service_name     = "DirectFanz"
                  service_provider_name = "DirectFanz"
                }
                dvb_sub_pids              = ""
                dvb_tdt_settings {
                  rep_interval = 5000
                }
                dvb_teletext_pid          = ""
                ebif                      = "NONE"
                ebp_audio_interval        = "VIDEO_AND_FIXED_INTERVALS"
                ebp_lookahead_ms          = 3000
                ebp_placement             = "VIDEO_AND_AUDIO_PIDS"
                ecm_pid                   = ""
                es_rate_in_pes            = "EXCLUDE"
                etv_platform_pid          = ""
                etv_signal_pid            = ""
                fragment_time             = 3
                klv                       = "NONE"
                klv_data_pids             = ""
                nielsen_id3_behavior      = "NO_PASSTHROUGH"
                null_packet_bitrate       = 0
                pat_interval              = 0
                pcr_control               = "PCR_EVERY_PES_PACKET"
                pcr_period                = 80
                pcr_pid                   = "481"
                pmt_interval              = 0
                pmt_pid                   = "480"
                program_num               = 1
                rate_mode                 = "VBR"
                scte27_pids               = ""
                scte35_control            = "NO_PASSTHROUGH"
                scte35_pid                = ""
                segmentation_markers      = "NONE"
                segmentation_style        = "MAINTAIN_CADENCE"
                segmentation_time         = 2
                timed_metadata_behavior   = "NO_PASSTHROUGH"
                timed_metadata_pid        = ""
                transport_stream_id       = 1
                video_pid                 = "481"
              }
            }
          }
        }
      }
    }
  }

  tags = {
    Name        = "${var.project_name}-live-channel"
    Environment = var.environment
  }
}

# S3 Bucket for stream recordings
resource "aws_s3_bucket" "streaming_recordings" {
  bucket = "${var.project_name}-${var.environment}-streaming-recordings-${random_string.streaming_bucket_suffix.result}"

  tags = {
    Name        = "${var.project_name}-streaming-recordings"
    Environment = var.environment
  }
}

resource "random_string" "streaming_bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket_versioning" "streaming_recordings" {
  bucket = aws_s3_bucket.streaming_recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "streaming_recordings" {
  bucket = aws_s3_bucket.streaming_recordings.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "streaming_recordings" {
  bucket = aws_s3_bucket.streaming_recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for streaming recordings
resource "aws_s3_bucket_lifecycle_configuration" "streaming_recordings" {
  bucket = aws_s3_bucket.streaming_recordings.id

  rule {
    id     = "streaming_recordings_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# CloudWatch Log Group for MediaLive
resource "aws_cloudwatch_log_group" "medialive" {
  name              = "/aws/medialive/${var.project_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-medialive-logs"
    Environment = var.environment
  }
}

# Systems Manager Parameters for MediaLive configuration
resource "aws_ssm_parameter" "medialive_input_url" {
  name  = "/${var.project_name}/medialive/input_url"
  type  = "String"
  value = aws_medialive_input.rtmp_input.destinations[0].url

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "medialive_channel_id" {
  name  = "/${var.project_name}/medialive/channel_id"
  type  = "String"
  value = aws_medialive_channel.main.id

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "streaming_recordings_bucket" {
  name  = "/${var.project_name}/streaming/recordings_bucket"
  type  = "String"
  value = aws_s3_bucket.streaming_recordings.bucket

  tags = {
    Environment = var.environment
  }
}