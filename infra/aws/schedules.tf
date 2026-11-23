# EventBridge calls the two cron routes on the public site with
# `Authorization: Bearer <CRON_SECRET>`, and forwards IVS stream start and end
# events to /api/webhooks/ivs over the same connection, so a party broadcast
# from OBS turns live and ended by itself. All of it is off until
# enable_schedules is true, which needs the site on https://directfanz.io.
#
# The connection is created with a placeholder value and Terraform never reads
# or writes the real one, so CRON_SECRET stays out of code and state. After
# apply, Demetrius copies the value from the app secret into the connection
# with one CLI command (README.md, step "Scheduled calls").

resource "aws_cloudwatch_event_connection" "cron" {
  count = var.enable_schedules ? 1 : 0

  name               = "${local.name}-cron"
  description        = "Bearer CRON_SECRET for the DirectFanz cron routes"
  authorization_type = "API_KEY"

  auth_parameters {
    api_key {
      key   = "Authorization"
      value = "Bearer set-me-outside-terraform"
    }
  }

  lifecycle {
    ignore_changes = [auth_parameters]
  }
}

locals {
  cron_jobs = {
    marketing-events = { path = "/api/cron/marketing-events", schedule = "rate(5 minutes)" }
    party-reminders  = { path = "/api/cron/party-reminders", schedule = "rate(10 minutes)" }
  }
}

resource "aws_cloudwatch_event_api_destination" "cron" {
  for_each = var.enable_schedules ? local.cron_jobs : {}

  name                             = "${local.name}-${each.key}"
  description                      = "POST ${each.value.path}"
  invocation_endpoint              = "https://${var.domain_name}${each.value.path}"
  http_method                      = "POST"
  invocation_rate_limit_per_second = 1
  connection_arn                   = aws_cloudwatch_event_connection.cron[0].arn
}

resource "aws_cloudwatch_event_rule" "cron" {
  for_each = var.enable_schedules ? local.cron_jobs : {}

  name                = "${local.name}-${each.key}"
  description         = "Call ${each.value.path}"
  schedule_expression = each.value.schedule
}

data "aws_iam_policy_document" "events_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [var.aws_account_id]
    }
  }
}

resource "aws_iam_role" "events" {
  count = var.enable_schedules ? 1 : 0

  name               = "${local.name}-cron-events"
  assume_role_policy = data.aws_iam_policy_document.events_assume.json
}

resource "aws_iam_role_policy" "events" {
  count = var.enable_schedules ? 1 : 0

  name = "invoke-api-destinations"
  role = aws_iam_role.events[0].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "events:InvokeApiDestination"
      Resource = concat(
        [for d in aws_cloudwatch_event_api_destination.cron : d.arn],
        [for d in aws_cloudwatch_event_api_destination.ivs_events : d.arn],
      )
    }]
  })
}

resource "aws_cloudwatch_event_target" "cron" {
  for_each = var.enable_schedules ? local.cron_jobs : {}

  rule     = aws_cloudwatch_event_rule.cron[each.key].name
  arn      = aws_cloudwatch_event_api_destination.cron[each.key].arn
  role_arn = aws_iam_role.events[0].arn

  # Each call is small and idempotent; don't pile up retries behind a slow one.
  retry_policy {
    maximum_retry_attempts       = 1
    maximum_event_age_in_seconds = 240
  }
}

# --- IVS stream state changes -> /api/webhooks/ivs -------------------------
# IVS sends "IVS Stream State Change" events to this region's default event
# bus. The whole event is posted unchanged; the app reads `resources` (the
# channel ARN) and `detail.event_name`, and ignores channels no party owns.
# The route accepts IVS_EVENTS_SECRET or, when that is unset, CRON_SECRET, so
# this reuses the cron connection.

resource "aws_cloudwatch_event_api_destination" "ivs_events" {
  count = var.enable_schedules ? 1 : 0

  name                             = "${local.name}-ivs-events"
  description                      = "POST /api/webhooks/ivs"
  invocation_endpoint              = "https://${var.domain_name}/api/webhooks/ivs"
  http_method                      = "POST"
  invocation_rate_limit_per_second = 5
  connection_arn                   = aws_cloudwatch_event_connection.cron[0].arn
}

resource "aws_cloudwatch_event_rule" "ivs_stream_state" {
  count = var.enable_schedules ? 1 : 0

  name        = "${local.name}-ivs-stream-state"
  description = "Party stream started or ended"
  event_pattern = jsonencode({
    source        = ["aws.ivs"]
    "detail-type" = ["IVS Stream State Change"]
    detail = {
      event_name = ["Stream Start", "Stream End"]
    }
  })
}

resource "aws_cloudwatch_event_target" "ivs_stream_state" {
  count = var.enable_schedules ? 1 : 0

  rule     = aws_cloudwatch_event_rule.ivs_stream_state[0].name
  arn      = aws_cloudwatch_event_api_destination.ivs_events[0].arn
  role_arn = aws_iam_role.events[0].arn

  # A missed "Stream End" leaves a party showing live, so keep retrying for a
  # while. Repeats are harmless: the app sets the same status again.
  retry_policy {
    maximum_retry_attempts       = 10
    maximum_event_age_in_seconds = 3600
  }
}
