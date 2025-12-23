# S3 Content Storage Configuration - DirectFanz AWS Infrastructure
# This configuration implements Requirements 4.1, 4.5, 4.7

# Random suffix for bucket names to ensure uniqueness
resource "random_string" "content_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Primary content storage bucket
resource "aws_s3_bucket" "content_storage" {
  bucket        = "${var.project_name}-${var.environment}-content-${random_string.content_suffix.result}"
  force_destroy = var.environment != "prod"

  tags = {
    Name        = "${var.project_name}-content-storage"
    Environment = var.environment
    Purpose     = "User generated content storage"
  }
}

# Static assets bucket for application files
resource "aws_s3_bucket" "static_assets" {
  bucket        = "${var.project_name}-${var.environment}-static-${random_string.content_suffix.result}"
  force_destroy = var.environment != "prod"

  tags = {
    Name        = "${var.project_name}-static-assets"
    Environment = var.environment
    Purpose     = "Application static files"
  }
}

# Backup bucket for cross-region replication
resource "aws_s3_bucket" "content_backup" {
  count         = var.environment == "prod" ? 1 : 0
  bucket        = "${var.project_name}-${var.environment}-backup-${random_string.content_suffix.result}"
  force_destroy = false

  tags = {
    Name        = "${var.project_name}-content-backup"
    Environment = var.environment
    Purpose     = "Cross-region backup storage"
  }
}

# Versioning configuration for content storage
resource "aws_s3_bucket_versioning" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Versioning configuration for static assets
resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Versioning configuration for backup bucket
resource "aws_s3_bucket_versioning" "content_backup" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.content_backup[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption for content storage
resource "aws_s3_bucket_server_side_encryption_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_content_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Server-side encryption for static assets
resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_content_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Server-side encryption for backup bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "content_backup" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.content_backup[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_content_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Public access block for content storage
resource "aws_s3_bucket_public_access_block" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Public access block for static assets
resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Public access block for backup bucket
resource "aws_s3_bucket_public_access_block" "content_backup" {
  count  = var.environment == "prod" ? 1 : 0
  bucket = aws_s3_bucket.content_backup[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Intelligent tiering configuration for content storage
resource "aws_s3_bucket_intelligent_tiering_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id
  name   = "content-intelligent-tiering"

  # Apply to all objects
  filter {
    prefix = ""
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  status = "Enabled"
}

# Lifecycle configuration for content storage
resource "aws_s3_bucket_lifecycle_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  rule {
    id     = "content_lifecycle"
    status = "Enabled"

    # Transition to Standard-IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Transition to Glacier after 90 days
    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    # Transition to Deep Archive after 365 days
    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    # Delete incomplete multipart uploads after 7 days
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    # Delete non-current versions after 30 days
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER"
    }

    # Delete non-current versions after 1 year
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }

  # Separate rule for temporary uploads
  rule {
    id     = "temp_uploads_cleanup"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 1
    }
  }
}

# Lifecycle configuration for static assets
resource "aws_s3_bucket_lifecycle_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    id     = "static_assets_lifecycle"
    status = "Enabled"

    # Keep current versions indefinitely but clean up old versions
    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# Cross-region replication configuration for production
resource "aws_s3_bucket_replication_configuration" "content_replication" {
  count  = var.environment == "prod" ? 1 : 0
  role   = aws_iam_role.replication[0].arn
  bucket = aws_s3_bucket.content_storage.id

  rule {
    id     = "content_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.content_backup[0].arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.app_key.arn
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.content_storage]
}

# IAM role for S3 replication
resource "aws_iam_role" "replication" {
  count = var.environment == "prod" ? 1 : 0
  name  = "${var.project_name}-${var.environment}-s3-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-s3-replication-role"
    Environment = var.environment
  }
}

# IAM policy for S3 replication
resource "aws_iam_role_policy" "replication" {
  count = var.environment == "prod" ? 1 : 0
  name  = "${var.project_name}-${var.environment}-s3-replication-policy"
  role  = aws_iam_role.replication[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = "${aws_s3_bucket.content_storage.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.content_storage.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = "${aws_s3_bucket.content_backup[0].arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.app_key.arn
      }
    ]
  })
}

# CORS configuration for content storage
resource "aws_s3_bucket_cors_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://${var.domain_name}",
      "https://www.${var.domain_name}",
      "https://app.${var.domain_name}",
      "https://api.${var.domain_name}"
    ]
    expose_headers  = ["ETag", "x-amz-meta-*"]
    max_age_seconds = 3000
  }
}

# CORS configuration for static assets
resource "aws_s3_bucket_cors_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = [
      "https://${var.domain_name}",
      "https://www.${var.domain_name}",
      "https://app.${var.domain_name}",
      "https://cdn.${var.domain_name}"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 86400
  }
}

# Notification configuration for content storage
resource "aws_s3_bucket_notification" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  # Lambda function notifications for content processing
  lambda_function {
    lambda_function_arn = aws_lambda_function.content_processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
    filter_suffix       = ""
  }

  depends_on = [aws_lambda_permission.content_processor_s3]
}

# Lambda function for content processing
resource "aws_lambda_function" "content_processor" {
  filename         = "content_processor.zip"
  function_name    = "${var.project_name}-${var.environment}-content-processor"
  role            = aws_iam_role.content_processor_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.content_processor.output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 300

  environment {
    variables = {
      CONTENT_BUCKET = aws_s3_bucket.content_storage.bucket
      ENVIRONMENT    = var.environment
    }
  }

  tags = {
    Name        = "${var.project_name}-content-processor"
    Environment = var.environment
  }
}

# Archive file for Lambda function
data "archive_file" "content_processor" {
  type        = "zip"
  output_path = "content_processor.zip"
  source {
    content = <<EOF
exports.handler = async (event) => {
    console.log('Content processing event:', JSON.stringify(event, null, 2));
    
    // Process S3 event records
    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        
        console.log(`Processing file: ${key} from bucket: ${bucket}`);
        
        // Add content processing logic here
        // - Image optimization
        // - Video transcoding
        // - Metadata extraction
        // - Virus scanning
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify('Content processing completed')
    };
};
EOF
    filename = "index.js"
  }
}

# IAM role for Lambda function
resource "aws_iam_role" "content_processor_lambda" {
  name = "${var.project_name}-${var.environment}-content-processor-lambda"

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
    Name        = "${var.project_name}-content-processor-lambda"
    Environment = var.environment
  }
}

# IAM policy for Lambda function
resource "aws_iam_role_policy" "content_processor_lambda" {
  name = "${var.project_name}-${var.environment}-content-processor-policy"
  role = aws_iam_role.content_processor_lambda.id

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
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.content_storage.arn}/*",
          "${aws_s3_bucket.static_assets.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.app_key.arn
      }
    ]
  })
}

# Lambda permission for S3 to invoke function
resource "aws_lambda_permission" "content_processor_s3" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.content_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.content_storage.arn
}

# CloudWatch log group for Lambda function
resource "aws_cloudwatch_log_group" "content_processor" {
  name              = "/aws/lambda/${aws_lambda_function.content_processor.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name        = "${var.project_name}-content-processor-logs"
    Environment = var.environment
  }
}