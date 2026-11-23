variable "aws_account_id" {
  description = "AWS account the stack may run in (Shock Value)."
  type        = string
  default     = "958972795537"
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Short project name used in resource names."
  type        = string
  default     = "directfanz"
}

variable "environment" {
  description = "Environment name used in resource names."
  type        = string
  default     = "prod"
}

# --- Network ---------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the DirectFanz VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "availability_zones" {
  description = "Two availability zones for the subnets."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Give exactly two availability zones."
  }
}

# --- Domain, DNS and TLS ---------------------------------------------------

variable "domain_name" {
  description = "Apex domain. Registration stays at the current registrar; DNS moves to Route 53."
  type        = string
  default     = "directfanz.io"
}

variable "existing_dns_records" {
  description = <<-EOT
    Records copied from the current DNS host into the new Route 53 zone before the
    name servers are switched (mail, verification TXT, and, until cutover, the
    current site). Key is any unique label. Leave apex/www A or CNAME records out
    once site_on_aws is true. Values are public DNS data, not secrets.
  EOT
  type = map(object({
    name    = string # "" for the apex, or a label such as "www" or "em1234"
    type    = string
    ttl     = optional(number, 300)
    records = list(string)
  }))
  default = {}
}

variable "enable_https" {
  description = <<-EOT
    Phase switch. false: the load balancer serves plain HTTP on its own AWS address
    for the first test deploy. true: wait for the ACM certificate (needs the name
    servers switched to Route 53), serve HTTPS on 443, redirect HTTP to HTTPS.
  EOT
  type        = bool
  default     = false
}

variable "site_on_aws" {
  description = "Cutover switch. true points directfanz.io and www at the load balancer in Route 53."
  type        = bool
  default     = false
}

# --- App task --------------------------------------------------------------

variable "task_cpu" {
  description = "Fargate task CPU units (512 = 0.5 vCPU)."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Running copies of the app. Keep at 1 until socket.io has a Redis adapter."
  type        = number
  default     = 1
}

variable "image_tag" {
  description = "Image tag Terraform puts in the first task definition. The deploy workflow registers newer revisions."
  type        = string
  default     = "bootstrap"
}

variable "app_environment" {
  description = "Extra non-secret environment variables for the app task (for example FROM_EMAIL)."
  type        = map(string)
  default     = {}
}

variable "app_secret_keys" {
  description = <<-EOT
    JSON keys of the app secret in Secrets Manager, each injected as an env var of
    the same name. Every key listed must exist in the secret value (a placeholder is
    fine) or ECS refuses to start the task.
  EOT
  type        = list(string)
  default = [
    "NEXTAUTH_SECRET",
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "TOKEN_ENCRYPTION_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_CONNECT_WEBHOOK_SECRET",
    "SENDGRID_API_KEY",
    "CRON_SECRET",
    "MARKETING_WEBHOOK_SECRET",
    "SMS_INBOUND_TOKEN",
    "IVS_PLAYBACK_PRIVATE_KEY",
  ]
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the app."
  type        = number
  default     = 30
}

# --- Database and cache ----------------------------------------------------

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_engine_version" {
  description = "RDS PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "RDS storage autoscaling ceiling in GB."
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name."
  type        = string
  default     = "directfanz"
}

variable "db_username" {
  description = "Database master user name. The password is generated and kept by RDS in Secrets Manager."
  type        = string
  default     = "directfanz"
}

variable "db_backup_retention_days" {
  description = "Days of automated RDS backups."
  type        = number
  default     = 7
}

variable "cache_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

# --- Storage ---------------------------------------------------------------

variable "media_bucket_name" {
  description = "Private S3 bucket for music, video and art. Bucket names are global."
  type        = string
  default     = "directfanz-media-958972795537"
}

variable "media_cors_origins" {
  description = "Origins allowed to upload straight to the bucket with signed links."
  type        = list(string)
  default     = ["https://directfanz.io", "https://www.directfanz.io"]
}

# --- Listening parties (Amazon IVS) ----------------------------------------

variable "ivs_playback_key_pair_arn" {
  description = <<-EOT
    ARN of the IVS playback key pair Demetrius imports himself (public half into IVS,
    private half into the app secret as IVS_PLAYBACK_PRIVATE_KEY). Empty until then.
  EOT
  type        = string
  default     = ""
}

# --- Scheduled calls -------------------------------------------------------

variable "enable_schedules" {
  description = "Create the EventBridge schedules that call the cron routes, and the rule that forwards IVS stream start/end events to the app. Turn on once the site answers on HTTPS."
  type        = bool
  default     = false
}

# --- Alerts and budget -----------------------------------------------------

variable "alert_email" {
  description = "Email that receives budget and alarm notices. Required; AWS emails a confirmation link for alarms."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly AWS budget alert threshold for resources tagged Project=directfanz."
  type        = number
  default     = 100
}

# --- Deploys ---------------------------------------------------------------

variable "github_repository" {
  description = "GitHub owner/repo allowed to assume the deploy role."
  type        = string
  default     = "Shockvaluemedia/directfanz-project"
}

variable "github_deploy_environment" {
  description = "GitHub Actions environment whose jobs may assume the deploy role. Give it required reviewers."
  type        = string
  default     = "production"
}

# --- Move-day database tunnel (db-access.tf) -------------------------------

variable "db_access_image" {
  description = "Small public image the one-off tunnel task runs. It only needs `sleep`; ECS adds the SSM agent."
  type        = string
  default     = "public.ecr.aws/amazonlinux/amazonlinux:2023-minimal"
}

variable "db_access_max_seconds" {
  description = "Longest a tunnel task may live before it stops itself."
  type        = number
  default     = 14400

  validation {
    condition     = var.db_access_max_seconds >= 300 && var.db_access_max_seconds <= 28800
    error_message = "Between 5 minutes and 8 hours."
  }
}

variable "platform_fee_percent" {
  description = "Platform fee on every checkout, in percent (PLATFORM_FEE_PERCENT)."
  type        = number
  default     = 10

  validation {
    condition     = var.platform_fee_percent >= 0 && var.platform_fee_percent <= 50
    error_message = "Between 0 and 50, the range the app accepts."
  }
}
