# Alerting and Notifications Configuration - DirectFanz AWS Infrastructure

# SNS Topics for Different Alert Types
resource "aws_sns_topic" "critical_alerts" {
  name         = "${var.project_name}-critical-alerts"
  display_name = "DirectFanz Critical Alerts"

  kms_master_key_id = aws_kms_key.main.arn

  tags = {
    Environment = var.environment
    AlertType   = "critical"
  }
}

resource "aws_sns_topic" "warning_alerts" {
  name         = "${var.project_name}-warning-alerts"
  display_name = "DirectFanz Warning Alerts"

  kms_master_key_id = aws_kms_key.main.arn

  tags = {
    Environment = var.environment
    AlertType   = "warning"
  }
}

resource "aws_sns_topic" "info_alerts" {
  name         = "${var.project_name}-info-alerts"
  display_name = "DirectFanz Info Alerts"

  kms_master_key_id = aws_kms_key.main.arn

  tags = {
    Environment = var.environment
    AlertType   = "info"
  }
}

# SNS Topic Subscriptions (Email endpoints)
resource "aws_sns_topic_subscription" "critical_email" {
  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = var.critical_alert_email

  confirmation_timeout_in_minutes = 5
}

resource "aws_sns_topic_subscription" "warning_email" {
  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "email"
  endpoint  = var.warning_alert_email

  confirmation_timeout_in_minutes = 5
}

# CloudWatch Alarms for Critical Thresholds

# Application Load Balancer - High Error Rate
resource "aws_cloudwatch_metric_alarm" "alb_high_error_rate" {
  alarm_name          = "${var.project_name}-alb-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High 5XX error rate on ALB"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Environment = var.environment
    Severity    = "critical"
  }
}

# Application Load Balancer - High Response Time
resource "aws_cloudwatch_metric_alarm" "alb_high_response_time" {
  alarm_name          = "${var.project_name}-alb-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2.0"
  alarm_description   = "High response time on ALB"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Environment = var.environment
    Severity    = "warning"
  }
}

# RDS - High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  alarm_name          = "${var.project_name}-rds-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "High CPU utilization on RDS"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Environment = var.environment
    Severity    = "critical"
  }
}

# RDS - High Database Connections
resource "aws_cloudwatch_metric_alarm" "rds_high_connections" {
  alarm_name          = "${var.project_name}-rds-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "High database connections on RDS"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Environment = var.environment
    Severity    = "warning"
  }
}

# RDS - Low Free Storage Space
resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  alarm_name          = "${var.project_name}-rds-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "2147483648" # 2GB in bytes
  alarm_description   = "Low free storage space on RDS"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Environment = var.environment
    Severity    = "critical"
  }
}

# ElastiCache - High CPU Utilization
resource "aws_cloudwatch_metric_alarm" "elasticache_high_cpu" {
  alarm_name          = "${var.project_name}-elasticache-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "High CPU utilization on ElastiCache"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = {
    Environment = var.environment
    Severity    = "warning"
  }
}

# ElastiCache - High Memory Utilization
resource "aws_cloudwatch_metric_alarm" "elasticache_high_memory" {
  alarm_name          = "${var.project_name}-elasticache-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "High memory utilization on ElastiCache"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.id
  }

  tags = {
    Environment = var.environment
    Severity    = "critical"
  }
}

# ECS Service - Task Count Below Minimum
resource "aws_cloudwatch_metric_alarm" "ecs_web_app_low_task_count" {
  alarm_name          = "${var.project_name}-ecs-web-app-low-task-count"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.web_app_min_capacity
  alarm_description   = "Web app service running below minimum task count"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.info_alerts.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    ServiceName = aws_ecs_service.web_app.name
    ClusterName = aws_ecs_cluster.main.name
  }

  tags = {
    Environment = var.environment
    Severity    = "critical"
  }
}

# Custom Business Metrics Alarms

# Low User Registration Rate
resource "aws_cloudwatch_metric_alarm" "low_user_registration_rate" {
  alarm_name          = "${var.project_name}-low-user-registration-rate"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "UserRegistrations"
  namespace           = "DirectFanz/Business"
  period              = "3600" # 1 hour
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Low user registration rate"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Environment = var.environment
    Severity    = "warning"
    Type        = "business"
  }
}

# High Payment Failure Rate
resource "aws_cloudwatch_metric_alarm" "high_payment_failure_rate" {
  alarm_name          = "${var.project_name}-high-payment-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "PaymentFailureRate"
  namespace           = "DirectFanz/Business"
  period              = "900" # 15 minutes
  statistic           = "Average"
  threshold           = "10" # 10% failure rate
  alarm_description   = "High payment failure rate"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Environment = var.environment
    Severity    = "critical"
    Type        = "business"
  }
}

# Low Stream Quality Score
resource "aws_cloudwatch_metric_alarm" "low_stream_quality_score" {
  alarm_name          = "${var.project_name}-low-stream-quality-score"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StreamQualityScore"
  namespace           = "DirectFanz/Streaming"
  period              = "300"
  statistic           = "Average"
  threshold           = "7.0" # Quality score out of 10
  alarm_description   = "Low stream quality score"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Environment = var.environment
    Severity    = "warning"
    Type        = "streaming"
  }
}

# CloudWatch Composite Alarms for Complex Scenarios

# Application Health Composite Alarm
resource "aws_cloudwatch_composite_alarm" "application_health" {
  alarm_name        = "${var.project_name}-application-health"
  alarm_description = "Overall application health based on multiple metrics"

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.alb_high_error_rate.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.rds_high_cpu.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.ecs_web_app_low_task_count.alarm_name})"
  ])

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.info_alerts.arn]

  tags = {
    Environment = var.environment
    Type        = "composite"
    Severity    = "critical"
  }
}

# Infrastructure Health Composite Alarm
resource "aws_cloudwatch_composite_alarm" "infrastructure_health" {
  alarm_name        = "${var.project_name}-infrastructure-health"
  alarm_description = "Overall infrastructure health based on multiple metrics"

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.rds_low_storage.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.elasticache_high_memory.alarm_name})"
  ])

  alarm_actions = [aws_sns_topic.critical_alerts.arn]
  ok_actions    = [aws_sns_topic.info_alerts.arn]

  tags = {
    Environment = var.environment
    Type        = "composite"
    Severity    = "critical"
  }
}

# Alert Escalation Lambda Function
resource "aws_lambda_function" "alert_escalation" {
  filename         = "alert_escalation.zip"
  function_name    = "${var.project_name}-alert-escalation"
  role            = aws_iam_role.alert_escalation_lambda.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      CRITICAL_TOPIC_ARN = aws_sns_topic.critical_alerts.arn
      WARNING_TOPIC_ARN  = aws_sns_topic.warning_alerts.arn
      ESCALATION_DELAY   = "1800" # 30 minutes
    }
  }

  tags = {
    Environment = var.environment
  }
}

# IAM Role for Alert Escalation Lambda
resource "aws_iam_role" "alert_escalation_lambda" {
  name = "${var.project_name}-alert-escalation-lambda-role"

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
    Environment = var.environment
  }
}

# IAM Policy for Alert Escalation Lambda
resource "aws_iam_role_policy" "alert_escalation_lambda" {
  name = "${var.project_name}-alert-escalation-lambda-policy"
  role = aws_iam_role.alert_escalation_lambda.id

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
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.critical_alerts.arn,
          aws_sns_topic.warning_alerts.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetMetricStatistics"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Event Rule for Alert Escalation
resource "aws_cloudwatch_event_rule" "alert_escalation" {
  name        = "${var.project_name}-alert-escalation"
  description = "Trigger alert escalation for unresolved critical alarms"

  schedule_expression = "rate(30 minutes)"

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Event Target for Alert Escalation
resource "aws_cloudwatch_event_target" "alert_escalation" {
  rule      = aws_cloudwatch_event_rule.alert_escalation.name
  target_id = "AlertEscalationLambdaTarget"
  arn       = aws_lambda_function.alert_escalation.arn
}

# Lambda Permission for CloudWatch Events
resource "aws_lambda_permission" "allow_cloudwatch_alert_escalation" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_escalation.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.alert_escalation.arn
}

# Alert Escalation Lambda Function Code
data "archive_file" "alert_escalation_zip" {
  type        = "zip"
  output_path = "alert_escalation.zip"
  
  source {
    content = <<EOF
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();
const sns = new AWS.SNS();

exports.handler = async (event) => {
    console.log('Alert escalation check started');
    
    try {
        // Get all alarms in ALARM state
        const params = {
            StateValue: 'ALARM',
            MaxRecords: 100
        };
        
        const alarms = await cloudwatch.describeAlarms(params).promise();
        
        for (const alarm of alarms.MetricAlarms) {
            // Check if alarm has been in ALARM state for more than escalation delay
            const alarmAge = Date.now() - new Date(alarm.StateUpdatedTimestamp).getTime();
            const escalationDelay = parseInt(process.env.ESCALATION_DELAY) * 1000; // Convert to milliseconds
            
            if (alarmAge > escalationDelay) {
                // Escalate the alarm
                const message = {
                    AlarmName: alarm.AlarmName,
                    AlarmDescription: alarm.AlarmDescription,
                    StateReason: alarm.StateReason,
                    StateUpdatedTimestamp: alarm.StateUpdatedTimestamp,
                    EscalationReason: `Alarm has been in ALARM state for ${Math.round(alarmAge / 60000)} minutes`
                };
                
                await sns.publish({
                    TopicArn: process.env.CRITICAL_TOPIC_ARN,
                    Subject: `ESCALATED: ${alarm.AlarmName}`,
                    Message: JSON.stringify(message, null, 2)
                }).promise();
                
                console.log(`Escalated alarm: ${alarm.AlarmName}`);
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Alert escalation check completed' })
        };
    } catch (error) {
        console.error('Error in alert escalation:', error);
        throw error;
    }
};
EOF
    filename = "index.js"
  }
}

# Variables for alert configuration
variable "critical_alert_email" {
  description = "Email address for critical alerts"
  type        = string
  default     = "admin@directfanz.com"
}

variable "warning_alert_email" {
  description = "Email address for warning alerts"
  type        = string
  default     = "ops@directfanz.com"
}