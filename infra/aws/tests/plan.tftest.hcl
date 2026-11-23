# Offline checks: `terraform test` with a mocked AWS provider. No credentials,
# no AWS calls, nothing created.

mock_provider "aws" {
  mock_data "aws_iam_openid_connect_provider" {
    defaults = {
      arn = "arn:aws:iam::958972795537:oidc-provider/token.actions.githubusercontent.com"
    }
  }
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
  mock_data "aws_partition" {
    defaults = {
      partition = "aws"
    }
  }
  mock_resource "aws_db_instance" {
    defaults = {
      address = "directfanz-prod-db.example.us-east-1.rds.amazonaws.com"
      port    = 5432
      master_user_secret = [{
        secret_arn    = "arn:aws:secretsmanager:us-east-1:958972795537:secret:rds!db-mock"
        kms_key_id    = "mock"
        secret_status = "active"
      }]
    }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:us-east-1:958972795537:certificate/mock"
      domain_validation_options = [
        {
          domain_name           = "directfanz.io"
          resource_record_name  = "_a.directfanz.io."
          resource_record_type  = "CNAME"
          resource_record_value = "_b.acm-validations.aws."
        },
        {
          domain_name           = "www.directfanz.io"
          resource_record_name  = "_c.www.directfanz.io."
          resource_record_type  = "CNAME"
          resource_record_value = "_d.acm-validations.aws."
        },
      ]
    }
  }
  mock_resource "aws_lb" {
    defaults = {
      arn      = "arn:aws:elasticloadbalancing:us-east-1:958972795537:loadbalancer/app/directfanz-prod-alb/mock"
      dns_name = "directfanz-prod-alb-123.us-east-1.elb.amazonaws.com"
      zone_id  = "Z35SXDOTRQ7X7K"
    }
  }
}

variables {
  alert_email = "alerts@example.com"
}

run "phase_1_test_address" {
  command = plan

  assert {
    condition     = length(aws_lb_listener.https) == 0
    error_message = "Phase 1 must not create the HTTPS listener."
  }
  assert {
    condition     = length(aws_route53_record.apex) == 0
    error_message = "Phase 1 must not point the domain at AWS."
  }
  assert {
    condition     = length(aws_cloudwatch_event_rule.cron) == 0
    error_message = "Schedules stay off until switched on."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.media.block_public_policy && aws_s3_bucket_public_access_block.media.restrict_public_buckets
    error_message = "Media bucket must block all public access."
  }
  assert {
    condition     = aws_db_instance.main.publicly_accessible == false && aws_db_instance.main.manage_master_user_password
    error_message = "Database must be private with an RDS-managed password."
  }
}

run "phase_2_https_and_cutover" {
  command = plan

  variables {
    enable_https     = true
    site_on_aws      = true
    enable_schedules = true
  }

  assert {
    condition     = length(aws_lb_listener.https) == 1
    error_message = "Phase 2 must serve HTTPS."
  }
  assert {
    condition     = length(aws_route53_record.apex) == 2 && length(aws_route53_record.www) == 2
    error_message = "Cutover must alias apex and www (A and AAAA)."
  }
  assert {
    condition     = length(aws_cloudwatch_event_rule.cron) == 2
    error_message = "Both cron schedules must exist."
  }
  assert {
    condition     = aws_cloudwatch_event_rule.cron["marketing-events"].schedule_expression == "rate(5 minutes)" && aws_cloudwatch_event_rule.cron["party-reminders"].schedule_expression == "rate(10 minutes)"
    error_message = "Cron cadence must match the plan."
  }
}
