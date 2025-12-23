# Resource Tagging Strategy for DirectFanz Platform
# Implements comprehensive tagging for cost allocation and resource management

# Common tags for all resources
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.resource_owner
    CostCenter  = var.cost_center
    CreatedDate = formatdate("YYYY-MM-DD", timestamp())
  }

  # Service-specific tags
  service_tags = {
    web_app = merge(local.common_tags, {
      Service     = "web-app"
      Component   = "frontend"
      Tier        = "presentation"
      Criticality = "high"
    })

    websocket = merge(local.common_tags, {
      Service     = "websocket"
      Component   = "realtime"
      Tier        = "application"
      Criticality = "high"
    })

    streaming = merge(local.common_tags, {
      Service     = "streaming"
      Component   = "media"
      Tier        = "application"
      Criticality = "medium"
    })

    database = merge(local.common_tags, {
      Service     = "database"
      Component   = "data"
      Tier        = "data"
      Criticality = "critical"
    })

    cache = merge(local.common_tags, {
      Service     = "cache"
      Component   = "data"
      Tier        = "data"
      Criticality = "high"
    })

    storage = merge(local.common_tags, {
      Service     = "storage"
      Component   = "data"
      Tier        = "data"
      Criticality = "medium"
    })

    cdn = merge(local.common_tags, {
      Service     = "cdn"
      Component   = "delivery"
      Tier        = "edge"
      Criticality = "high"
    })

    monitoring = merge(local.common_tags, {
      Service     = "monitoring"
      Component   = "observability"
      Tier        = "management"
      Criticality = "medium"
    })

    security = merge(local.common_tags, {
      Service     = "security"
      Component   = "protection"
      Tier        = "security"
      Criticality = "critical"
    })

    cicd = merge(local.common_tags, {
      Service     = "cicd"
      Component   = "deployment"
      Tier        = "management"
      Criticality = "medium"
    })
  }

  # Cost allocation tags
  cost_allocation_tags = {
    BillingTeam    = var.billing_team
    Department     = var.department
    BusinessUnit   = var.business_unit
    Application    = var.project_name
    CostOptimized  = "true"
  }

  # Compliance and governance tags
  compliance_tags = {
    DataClassification = var.data_classification
    ComplianceScope    = var.compliance_scope
    BackupRequired     = "true"
    MonitoringEnabled  = "true"
  }

  # Automation tags
  automation_tags = {
    AutoStart         = var.auto_start_enabled ? "true" : "false"
    AutoStop          = var.auto_stop_enabled ? "true" : "false"
    BackupSchedule    = var.backup_schedule
    PatchGroup        = var.patch_group
    MaintenanceWindow = var.maintenance_window
  }
}

# Tag all ECS resources
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.app_key.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(
    local.service_tags.web_app,
    local.cost_allocation_tags,
    local.compliance_tags,
    local.automation_tags,
    {
      ResourceType = "ecs-cluster"
      Purpose      = "container-orchestration"
    }
  )
}

# Apply tags to RDS instances
resource "aws_db_instance" "main" {
  # ... existing configuration ...

  tags = merge(
    local.service_tags.database,
    local.cost_allocation_tags,
    local.compliance_tags,
    local.automation_tags,
    {
      ResourceType    = "rds-instance"
      Purpose         = "primary-database"
      Engine          = "postgresql"
      EngineVersion   = var.db_engine_version
      InstanceClass   = var.db_instance_class_enhanced
      MultiAZ         = "true"
      BackupRetention = var.db_backup_retention_days
    }
  )
}

# Apply tags to ElastiCache resources
resource "aws_elasticache_replication_group" "main" {
  # ... existing configuration ...

  tags = merge(
    local.service_tags.cache,
    local.cost_allocation_tags,
    local.compliance_tags,
    local.automation_tags,
    {
      ResourceType  = "elasticache-replication-group"
      Purpose       = "application-cache"
      Engine        = "redis"
      EngineVersion = var.redis_engine_version
      NodeType      = var.redis_enhanced_node_type
      NumShards     = var.redis_num_shards
    }
  )
}

# Apply tags to S3 buckets
resource "aws_s3_bucket" "content" {
  bucket = "${var.project_name}-content-${var.environment}"

  tags = merge(
    local.service_tags.storage,
    local.cost_allocation_tags,
    local.compliance_tags,
    local.automation_tags,
    {
      ResourceType        = "s3-bucket"
      Purpose             = "content-storage"
      StorageClass        = "standard"
      LifecyclePolicies   = "enabled"
      IntelligentTiering  = "enabled"
      CrossRegionReplication = var.enable_cross_region_replication ? "enabled" : "disabled"
    }
  )
}

# Apply tags to CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  # ... existing configuration ...

  tags = merge(
    local.service_tags.cdn,
    local.cost_allocation_tags,
    local.compliance_tags,
    {
      ResourceType = "cloudfront-distribution"
      Purpose      = "content-delivery"
      PriceClass   = var.cloudfront_price_class
      Logging      = var.enable_cloudfront_logging ? "enabled" : "disabled"
    }
  )
}

# Apply tags to Lambda functions
resource "aws_lambda_function" "cost_optimizer" {
  # ... existing configuration ...

  tags = merge(
    local.service_tags.monitoring,
    local.cost_allocation_tags,
    local.automation_tags,
    {
      ResourceType = "lambda-function"
      Purpose      = "cost-optimization"
      Runtime      = "nodejs18.x"
      Schedule     = "weekly"
    }
  )
}

# Apply tags to CloudWatch resources
resource "aws_cloudwatch_dashboard" "cost_monitoring" {
  dashboard_name = "${var.project_name}-cost-monitoring"

  # ... existing configuration ...

  tags = merge(
    local.service_tags.monitoring,
    local.cost_allocation_tags,
    {
      ResourceType = "cloudwatch-dashboard"
      Purpose      = "cost-monitoring"
      UpdateFrequency = "real-time"
    }
  )
}

# Apply tags to SNS topics
resource "aws_sns_topic" "cost_alerts" {
  name = "${var.project_name}-cost-alerts"

  tags = merge(
    local.service_tags.monitoring,
    local.cost_allocation_tags,
    {
      ResourceType = "sns-topic"
      Purpose      = "cost-alerting"
      MessageType  = "cost-optimization"
    }
  )
}

# Apply tags to IAM roles
resource "aws_iam_role" "app_role" {
  name = "${var.project_name}-app-role"

  # ... existing configuration ...

  tags = merge(
    local.service_tags.security,
    local.compliance_tags,
    {
      ResourceType = "iam-role"
      Purpose      = "application-access"
      Scope        = "application-services"
    }
  )
}

# Apply tags to KMS keys
resource "aws_kms_key" "app_key" {
  description             = "KMS key for ${var.project_name} application encryption"
  deletion_window_in_days = 7

  tags = merge(
    local.service_tags.security,
    local.compliance_tags,
    {
      ResourceType = "kms-key"
      Purpose      = "application-encryption"
      KeyUsage     = "encrypt-decrypt"
    }
  )
}

# Apply tags to VPC resources
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    local.common_tags,
    local.cost_allocation_tags,
    local.compliance_tags,
    {
      Name         = "${var.project_name}-vpc"
      ResourceType = "vpc"
      Purpose      = "network-isolation"
      CIDR         = var.vpc_cidr
    }
  )
}

# Apply tags to security groups
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.project_name}-ecs-tasks"
  vpc_id      = aws_vpc.main.id

  # ... existing configuration ...

  tags = merge(
    local.service_tags.security,
    local.compliance_tags,
    {
      ResourceType = "security-group"
      Purpose      = "ecs-task-security"
      Scope        = "application-tier"
    }
  )
}

# Cost allocation report configuration
resource "aws_cur_report_definition" "cost_usage_report" {
  count                      = var.enable_cost_usage_report ? 1 : 0
  report_name                = "${var.project_name}-cost-usage-report"
  time_unit                  = "DAILY"
  format                     = "textORcsv"
  compression                = "GZIP"
  additional_schema_elements = ["RESOURCES"]
  s3_bucket                  = aws_s3_bucket.cost_reports[0].bucket
  s3_prefix                  = "cost-reports/"
  s3_region                  = var.aws_region
  additional_artifacts       = ["REDSHIFT", "ATHENA"]
  refresh_closed_reports     = true
  report_versioning          = "OVERWRITE_REPORT"
}

resource "aws_s3_bucket" "cost_reports" {
  count  = var.enable_cost_usage_report ? 1 : 0
  bucket = "${var.project_name}-cost-reports-${var.environment}"

  tags = merge(
    local.service_tags.monitoring,
    local.cost_allocation_tags,
    {
      ResourceType = "s3-bucket"
      Purpose      = "cost-reporting"
      ReportType   = "cost-usage-report"
    }
  )
}

# Tag enforcement policy
resource "aws_organizations_policy" "tag_enforcement" {
  count       = var.enable_tag_enforcement ? 1 : 0
  name        = "${var.project_name}-tag-enforcement"
  description = "Enforce required tags for cost allocation"
  type        = "TAG_POLICY"

  content = jsonencode({
    tags = {
      Project = {
        tag_key = "Project"
        enforced_for = {
          "@@assign" = ["all"]
        }
      }
      Environment = {
        tag_key = "Environment"
        enforced_for = {
          "@@assign" = ["all"]
        }
      }
      CostCenter = {
        tag_key = "CostCenter"
        enforced_for = {
          "@@assign" = ["all"]
        }
      }
      Owner = {
        tag_key = "Owner"
        enforced_for = {
          "@@assign" = ["all"]
        }
      }
    }
  })

  tags = merge(
    local.service_tags.security,
    local.compliance_tags,
    {
      ResourceType = "organizations-policy"
      Purpose      = "tag-enforcement"
      PolicyType   = "tag-policy"
    }
  )
}

# Resource tagging variables
variable "resource_owner" {
  description = "Owner of the resources"
  type        = string
  default     = "platform-team"
}

variable "cost_center" {
  description = "Cost center for billing allocation"
  type        = string
  default     = "engineering"
}

variable "billing_team" {
  description = "Team responsible for billing"
  type        = string
  default     = "finance"
}

variable "department" {
  description = "Department owning the resources"
  type        = string
  default     = "engineering"
}

variable "business_unit" {
  description = "Business unit for cost allocation"
  type        = string
  default     = "product"
}

variable "data_classification" {
  description = "Data classification level"
  type        = string
  default     = "internal"
  
  validation {
    condition     = contains(["public", "internal", "confidential", "restricted"], var.data_classification)
    error_message = "Data classification must be one of: public, internal, confidential, restricted."
  }
}

variable "compliance_scope" {
  description = "Compliance requirements scope"
  type        = string
  default     = "gdpr,ccpa"
}

variable "auto_start_enabled" {
  description = "Enable automatic resource start"
  type        = bool
  default     = false
}

variable "auto_stop_enabled" {
  description = "Enable automatic resource stop"
  type        = bool
  default     = false
}

variable "backup_schedule" {
  description = "Backup schedule for resources"
  type        = string
  default     = "daily"
}

variable "patch_group" {
  description = "Patch group for maintenance"
  type        = string
  default     = "production"
}

variable "maintenance_window" {
  description = "Maintenance window for updates"
  type        = string
  default     = "sun:03:00-sun:04:00"
}

variable "enable_cost_usage_report" {
  description = "Enable AWS Cost and Usage Report"
  type        = bool
  default     = true
}

variable "enable_tag_enforcement" {
  description = "Enable tag enforcement policy"
  type        = bool
  default     = false
}

# Outputs for tag validation
output "resource_tags_summary" {
  description = "Summary of resource tagging strategy"
  value = {
    common_tags         = local.common_tags
    service_tags_count  = length(local.service_tags)
    cost_allocation_tags = local.cost_allocation_tags
    compliance_tags     = local.compliance_tags
    automation_tags     = local.automation_tags
  }
}

output "cost_allocation_structure" {
  description = "Cost allocation tag structure for reporting"
  value = {
    project      = var.project_name
    environment  = var.environment
    cost_center  = var.cost_center
    department   = var.department
    business_unit = var.business_unit
    billing_team = var.billing_team
  }
}