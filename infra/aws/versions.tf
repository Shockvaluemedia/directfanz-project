terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  # Remote state in S3 with native lock files (Terraform 1.10+). Partial config:
  # copy backend.hcl.example to backend.hcl and run
  #   terraform init -backend-config=backend.hcl
  # The state bucket must exist first; see README.md.
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  # Refuse to run against any account but Shock Value.
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = local.tags
  }
}

locals {
  name = "${var.project}-${var.environment}"

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "Shockvaluemedia/directfanz-project"
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
