# KMS Keys for Encryption - DirectFanz AWS Infrastructure
# Comprehensive encryption implementation for Requirements 6.4, 2.6, 3.3

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
    Purpose     = "Application-level encryption"
  }
}

# KMS key alias
resource "aws_kms_alias" "app_key_alias" {
  name          = "alias/${var.project_name}-app-key"
  target_key_id = aws_kms_key.app_key.key_id
}

# KMS key for RDS encryption
resource "aws_kms_key" "rds_key" {
  description             = "KMS key for ${var.project_name} RDS encryption"
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
        Sid    = "Allow RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow application access to RDS key"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.app_role.arn,
            aws_iam_role.ecs_task_execution_role.arn
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-rds-key"
    Environment = var.environment
    Purpose     = "RDS database encryption"
  }
}

# KMS key alias for RDS
resource "aws_kms_alias" "rds_key_alias" {
  name          = "alias/${var.project_name}-rds-key"
  target_key_id = aws_kms_key.rds_key.key_id
}

# KMS key for ElastiCache encryption
resource "aws_kms_key" "elasticache_key" {
  description             = "KMS key for ${var.project_name} ElastiCache encryption"
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
        Sid    = "Allow ElastiCache to use the key"
        Effect = "Allow"
        Principal = {
          Service = "elasticache.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow application access to ElastiCache key"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.app_role.arn,
            aws_iam_role.ecs_task_execution_role.arn
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-elasticache-key"
    Environment = var.environment
    Purpose     = "ElastiCache encryption"
  }
}

# KMS key alias for ElastiCache
resource "aws_kms_alias" "elasticache_key_alias" {
  name          = "alias/${var.project_name}-elasticache-key"
  target_key_id = aws_kms_key.elasticache_key.key_id
}

# KMS key for S3 content storage
resource "aws_kms_key" "s3_content_key" {
  description             = "KMS key for ${var.project_name} S3 content storage encryption"
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
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow application access to S3 key"
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
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudFront to use the key"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-s3-content-key"
    Environment = var.environment
    Purpose     = "S3 content storage encryption"
  }
}

# KMS key alias for S3 content
resource "aws_kms_alias" "s3_content_key_alias" {
  name          = "alias/${var.project_name}-s3-content-key"
  target_key_id = aws_kms_key.s3_content_key.key_id
}

# KMS key for ECS secrets and parameters
resource "aws_kms_key" "secrets_key" {
  description             = "KMS key for ${var.project_name} secrets and parameters encryption"
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
        Sid    = "Allow Secrets Manager to use the key"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow Systems Manager to use the key"
        Effect = "Allow"
        Principal = {
          Service = "ssm.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow ECS tasks to decrypt secrets"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.app_role.arn,
            aws_iam_role.ecs_task_execution_role.arn
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-secrets-key"
    Environment = var.environment
    Purpose     = "Secrets and parameters encryption"
  }
}

# KMS key alias for secrets
resource "aws_kms_alias" "secrets_key_alias" {
  name          = "alias/${var.project_name}-secrets-key"
  target_key_id = aws_kms_key.secrets_key.key_id
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
        Condition = {
          StringLike = {
            "kms:EncryptionContext:aws:cloudtrail:arn" = "arn:aws:cloudtrail:*:${data.aws_caller_identity.current.account_id}:trail/*"
          }
        }
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
        Condition = {
          StringLike = {
            "kms:EncryptionContext:aws:cloudtrail:arn" = "arn:aws:cloudtrail:*:${data.aws_caller_identity.current.account_id}:trail/*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-cloudtrail-key"
    Environment = var.environment
    Purpose     = "CloudTrail audit log encryption"
  }
}

# KMS key alias for CloudTrail
resource "aws_kms_alias" "cloudtrail_key_alias" {
  name          = "alias/${var.project_name}-cloudtrail-key"
  target_key_id = aws_kms_key.cloudtrail_key.key_id
}

# KMS key for SNS notifications
resource "aws_kms_key" "sns_key" {
  description             = "KMS key for ${var.project_name} SNS encryption"
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
        Sid    = "Allow SNS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-sns-key"
    Environment = var.environment
    Purpose     = "SNS notifications encryption"
  }
}

# KMS key alias for SNS
resource "aws_kms_alias" "sns_key_alias" {
  name          = "alias/${var.project_name}-sns-key"
  target_key_id = aws_kms_key.sns_key.key_id
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