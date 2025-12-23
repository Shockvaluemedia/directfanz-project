# AWS Elemental MediaConvert Configuration for VOD Processing
# This configuration sets up MediaConvert for processing recorded streams into VOD content

# IAM Role for MediaConvert
resource "aws_iam_role" "mediaconvert_role" {
  name = "${var.project_name}-mediaconvert-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "mediaconvert.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-mediaconvert-role"
    Environment = var.environment
  }
}

# IAM Policy for MediaConvert to access S3 and other services
resource "aws_iam_role_policy" "mediaconvert_policy" {
  name = "${var.project_name}-mediaconvert-policy"
  role = aws_iam_role.mediaconvert_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.streaming_recordings.arn,
          "${aws_s3_bucket.streaming_recordings.arn}/*",
          aws_s3_bucket.vod_content.arn,
          "${aws_s3_bucket.vod_content.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# S3 Bucket for VOD content output
resource "aws_s3_bucket" "vod_content" {
  bucket = "${var.project_name}-${var.environment}-vod-content-${random_string.vod_bucket_suffix.result}"

  tags = {
    Name        = "${var.project_name}-vod-content"
    Environment = var.environment
  }
}

resource "random_string" "vod_bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket_versioning" "vod_content" {
  bucket = aws_s3_bucket.vod_content.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "vod_content" {
  bucket = aws_s3_bucket.vod_content.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "vod_content" {
  bucket = aws_s3_bucket.vod_content.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for VOD content
resource "aws_s3_bucket_lifecycle_configuration" "vod_content" {
  bucket = aws_s3_bucket.vod_content.id

  rule {
    id     = "vod_content_lifecycle"
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

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Lambda function for triggering MediaConvert jobs
resource "aws_lambda_function" "mediaconvert_trigger" {
  filename         = "mediaconvert_trigger.zip"
  function_name    = "${var.project_name}-mediaconvert-trigger"
  role            = aws_iam_role.lambda_mediaconvert_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.mediaconvert_trigger_zip.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 300

  environment {
    variables = {
      MEDIACONVERT_ROLE_ARN = aws_iam_role.mediaconvert_role.arn
      VOD_OUTPUT_BUCKET     = aws_s3_bucket.vod_content.bucket
      PROJECT_NAME          = var.project_name
    }
  }

  tags = {
    Name        = "${var.project_name}-mediaconvert-trigger"
    Environment = var.environment
  }
}

# Create the Lambda function code
resource "local_file" "mediaconvert_trigger_js" {
  content = <<EOF
const AWS = require('aws-sdk');
const mediaconvert = new AWS.MediaConvert();

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    // Parse S3 event
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Only process .ts files (stream recordings)
    if (!key.endsWith('.ts')) {
        console.log('Skipping non-TS file:', key);
        return;
    }
    
    const inputUri = `s3://$${bucket}/$${key}`;
    const outputUri = `s3://$${process.env.VOD_OUTPUT_BUCKET}/`;
    
    // Create MediaConvert job
    const jobSettings = {
        Role: process.env.MEDIACONVERT_ROLE_ARN,
        Settings: {
            Inputs: [{
                FileInput: inputUri,
                AudioSelectors: {
                    "Audio Selector 1": {
                        DefaultSelection: "DEFAULT"
                    }
                },
                VideoSelector: {}
            }],
            OutputGroups: [{
                Name: "HLS Output Group",
                OutputGroupSettings: {
                    Type: "HLS_GROUP_SETTINGS",
                    HlsGroupSettings: {
                        Destination: outputUri + key.replace('.ts', '/'),
                        SegmentLength: 6,
                        MinSegmentLength: 0
                    }
                },
                Outputs: [{
                    NameModifier: "_1080p",
                    VideoDescription: {
                        CodecSettings: {
                            Codec: "H_264",
                            H264Settings: {
                                Bitrate: 5000000,
                                RateControlMode: "CBR",
                                CodecProfile: "HIGH",
                                CodecLevel: "LEVEL_4_1"
                            }
                        },
                        Width: 1920,
                        Height: 1080
                    },
                    AudioDescriptions: [{
                        CodecSettings: {
                            Codec: "AAC",
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: "CODING_MODE_2_0",
                                SampleRate: 48000
                            }
                        }
                    }]
                }, {
                    NameModifier: "_720p",
                    VideoDescription: {
                        CodecSettings: {
                            Codec: "H_264",
                            H264Settings: {
                                Bitrate: 3000000,
                                RateControlMode: "CBR",
                                CodecProfile: "HIGH",
                                CodecLevel: "LEVEL_4_1"
                            }
                        },
                        Width: 1280,
                        Height: 720
                    },
                    AudioDescriptions: [{
                        CodecSettings: {
                            Codec: "AAC",
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: "CODING_MODE_2_0",
                                SampleRate: 48000
                            }
                        }
                    }]
                }, {
                    NameModifier: "_480p",
                    VideoDescription: {
                        CodecSettings: {
                            Codec: "H_264",
                            H264Settings: {
                                Bitrate: 1500000,
                                RateControlMode: "CBR",
                                CodecProfile: "HIGH",
                                CodecLevel: "LEVEL_3_1"
                            }
                        },
                        Width: 854,
                        Height: 480
                    },
                    AudioDescriptions: [{
                        CodecSettings: {
                            Codec: "AAC",
                            AacSettings: {
                                Bitrate: 128000,
                                CodingMode: "CODING_MODE_2_0",
                                SampleRate: 48000
                            }
                        }
                    }]
                }]
            }]
        }
    };
    
    try {
        const result = await mediaconvert.createJob(jobSettings).promise();
        console.log('MediaConvert job created:', result.Job.Id);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'MediaConvert job created successfully',
                jobId: result.Job.Id
            })
        };
    } catch (error) {
        console.error('Error creating MediaConvert job:', error);
        throw error;
    }
};
EOF
  filename = "${path.module}/mediaconvert_trigger.js"
}

# Create ZIP file for Lambda
data "archive_file" "mediaconvert_trigger_zip" {
  type        = "zip"
  source_file = local_file.mediaconvert_trigger_js.filename
  output_path = "${path.module}/mediaconvert_trigger.zip"
  depends_on  = [local_file.mediaconvert_trigger_js]
}

# IAM Role for Lambda function
resource "aws_iam_role" "lambda_mediaconvert_role" {
  name = "${var.project_name}-lambda-mediaconvert-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-mediaconvert-role"
    Environment = var.environment
  }
}

# IAM Policy for Lambda to access MediaConvert and S3
resource "aws_iam_role_policy" "lambda_mediaconvert_policy" {
  name = "${var.project_name}-lambda-mediaconvert-policy"
  role = aws_iam_role.lambda_mediaconvert_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "mediaconvert:CreateJob",
          "mediaconvert:GetJob",
          "mediaconvert:ListJobs"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = aws_iam_role.mediaconvert_role.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.streaming_recordings.arn}/*"
      }
    ]
  })
}

# S3 Event notification to trigger Lambda
resource "aws_s3_bucket_notification" "streaming_recordings_notification" {
  bucket = aws_s3_bucket.streaming_recordings.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.mediaconvert_trigger.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".ts"
  }

  depends_on = [aws_lambda_permission.allow_s3_invoke]
}

# Lambda permission for S3 to invoke the function
resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mediaconvert_trigger.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.streaming_recordings.arn
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "mediaconvert_trigger_logs" {
  name              = "/aws/lambda/${aws_lambda_function.mediaconvert_trigger.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-mediaconvert-trigger-logs"
    Environment = var.environment
  }
}

# Systems Manager Parameters for MediaConvert configuration
resource "aws_ssm_parameter" "mediaconvert_role_arn" {
  name  = "/${var.project_name}/mediaconvert/role_arn"
  type  = "String"
  value = aws_iam_role.mediaconvert_role.arn

  tags = {
    Environment = var.environment
  }
}

resource "aws_ssm_parameter" "vod_content_bucket" {
  name  = "/${var.project_name}/vod/content_bucket"
  type  = "String"
  value = aws_s3_bucket.vod_content.bucket

  tags = {
    Environment = var.environment
  }
}