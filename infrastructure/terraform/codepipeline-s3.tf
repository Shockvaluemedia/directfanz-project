# S3 Bucket for CodePipeline Artifacts - DirectFanz AWS Infrastructure

# S3 bucket for CodePipeline artifacts
resource "aws_s3_bucket" "codepipeline_artifacts" {
  bucket        = "${var.project_name}-${var.environment}-codepipeline-artifacts-${random_string.codepipeline_suffix.result}"
  force_destroy = var.environment != "prod"

  tags = {
    Name        = "${var.project_name}-codepipeline-artifacts"
    Environment = var.environment
  }
}

resource "random_string" "codepipeline_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 bucket versioning for CodePipeline artifacts
resource "aws_s3_bucket_versioning" "codepipeline_artifacts" {
  bucket = aws_s3_bucket.codepipeline_artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption for CodePipeline artifacts
resource "aws_s3_bucket_server_side_encryption_configuration" "codepipeline_artifacts" {
  bucket = aws_s3_bucket.codepipeline_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.app_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# S3 bucket public access block for CodePipeline artifacts
resource "aws_s3_bucket_public_access_block" "codepipeline_artifacts" {
  bucket = aws_s3_bucket.codepipeline_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configuration for CodePipeline artifacts
resource "aws_s3_bucket_lifecycle_configuration" "codepipeline_artifacts" {
  bucket = aws_s3_bucket.codepipeline_artifacts.id

  rule {
    id     = "codepipeline_artifacts_lifecycle"
    status = "Enabled"

    # Delete artifacts after 30 days
    expiration {
      days = 30
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    # Delete non-current versions after 7 days
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}