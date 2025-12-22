# KMS Keys for Encryption - DirectFanz AWS Infrastructure

# Main application KMS key
resource "aws_kms_key" "app_key" {
  description             = "KMS key for ${var.project_name} application encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS tasks to use the key"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.app_role.arn,
            aws_iam_role.ecs_task_execution_role.arn
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs to use the key"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-app-key"
    Environment = var.environment
  }
}

# KMS key alias
resource "aws_kms_alias" "app_key_alias" {
  name          = "alias/${var.project_name}-app-key"
  target_key_id = aws_kms_key.app_key.key_id
}

# KMS key for CloudTrail
resource "aws_kms_key" "cloudtrail_key" {
  description             = "KMS key for ${var.project_name} CloudTrail encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudTrail to encrypt logs"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudTrail to decrypt logs"
        Effect = "Allow"
        Principal = {
          Service = "cloudtrail.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:ReEncryptFrom"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-cloudtrail-key"
    Environment = var.environment
  }
}

# KMS key alias for CloudTrail
resource "aws_kms_alias" "cloudtrail_key_alias" {
  name          = "alias/${var.project_name}-cloudtrail-key"
  target_key_id = aws_kms_key.cloudtrail_key.key_id
}

# Update S3 bucket encryption to use KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "app_storage_kms" {
  bucket = aws_s3_bucket.app_storage.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.app_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}