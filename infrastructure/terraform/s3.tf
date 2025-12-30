# S3 Buckets for DirectFanz.io

# Random suffix for bucket names
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Content Storage Bucket
resource "aws_s3_bucket" "content_storage" {
  bucket = "${var.project_name}-content-${random_string.bucket_suffix.result}"

  tags = {
    Name = "${var.project_name}-content-storage"
    Type = "Content"
  }
}

resource "aws_s3_bucket_versioning" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Static Assets Bucket
resource "aws_s3_bucket" "static_assets" {
  bucket = "${var.project_name}-static-${random_string.bucket_suffix.result}"

  tags = {
    Name = "${var.project_name}-static-assets"
    Type = "Static"
  }
}

resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle configuration for content storage
resource "aws_s3_bucket_lifecycle_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  rule {
    id     = "content_lifecycle"
    status = "Enabled"

    filter {
      prefix = ""
    }

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

    # Delete old versions after 365 days
    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS configuration for content storage
resource "aws_s3_bucket_cors_configuration" "content_storage" {
  bucket = aws_s3_bucket.content_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["https://${var.domain_name}", "https://www.${var.domain_name}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}