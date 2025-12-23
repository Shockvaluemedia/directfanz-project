# Cost Monitoring and Alerting Setup Guide

## Overview

This guide explains the cost monitoring and alerting infrastructure implemented for the DirectFanz platform to track AWS spending and identify optimization opportunities.

## Components

### 1. AWS Budgets

#### Monthly Budget
- **Total Budget**: $2,000/month (configurable)
- **Alerts**: 80% (actual), 100% (forecasted), 120% (actual)
- **Scope**: All DirectFanz services

#### Service-Specific Budgets
- **ECS Budget**: $800/month
- **RDS Budget**: $400/month  
- **S3 Budget**: $200/month
- **Alerts**: 85% threshold for each service

### 2. Cost Anomaly Detection

#### Service Anomaly Detector
- **Monitors**: ECS, RDS, ElastiCache, S3, CloudFront
- **Threshold**: $100 anomaly detection
- **Frequency**: Daily notifications
- **Delivery**: Email alerts

#### Anomaly Types Detected
- Sudden cost spikes
- Unusual usage patterns
- Service cost deviations
- Resource provisioning anomalies

### 3. Cost Monitoring Dashboard

#### Widgets Include
- **Estimated Monthly Charges**: Overall and by service
- **ECS Resource Utilization**: CPU and memory usage
- **RDS Performance Metrics**: CPU and connections
- **S3 Storage Metrics**: Storage size and object count

#### Access
- CloudWatch Dashboard: `{project-name}-cost-monitoring`
- URL provided in Terraform outputs
- Real-time cost and usage visualization

### 4. Cost Optimization Lambda

#### Automated Analysis
- **Schedule**: Weekly execution
- **Analysis Areas**:
  - ECS Spot instance opportunities
  - RDS Reserved Instance recommendations
  - S3 storage optimization
  - AWS rightsizing suggestions

#### Recommendations Generated
- **High Priority**: Immediate cost savings (>$100/month)
- **Medium Priority**: Optimization opportunities (<$100/month)
- **Delivery**: Email notifications with detailed analysis

## Alert Configuration

### Budget Alerts
```hcl
# 80% of budget reached (actual spending)
notification {
  comparison_operator        = "GREATER_THAN"
  threshold                 = 80
  threshold_type            = "PERCENTAGE"
  notification_type          = "ACTUAL"
  subscriber_email_addresses = var.cost_alert_emails
}

# 100% of budget forecasted
notification {
  comparison_operator        = "GREATER_THAN"
  threshold                 = 100
  threshold_type            = "PERCENTAGE"
  notification_type          = "FORECASTED"
  subscriber_email_addresses = var.cost_alert_emails
}

# 120% of budget exceeded (actual spending)
notification {
  comparison_operator        = "GREATER_THAN"
  threshold                 = 120
  threshold_type            = "PERCENTAGE"
  notification_type          = "ACTUAL"
  subscriber_email_addresses = var.cost_alert_emails
}
```

### Anomaly Detection Alerts
```hcl
threshold_expression {
  and {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = [tostring(var.cost_anomaly_threshold)]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }
}
```

## Cost Optimization Recommendations

### ECS Optimization
- **Spot Instance Usage**: 60-70% cost reduction
- **Right-sizing**: CPU/memory optimization
- **Capacity Planning**: Usage-based scaling

### RDS Optimization
- **Reserved Instances**: 30-60% savings
- **Storage Optimization**: GP3 migration
- **Multi-AZ Review**: Non-production optimization

### S3 Optimization
- **Intelligent Tiering**: Automatic cost optimization
- **Lifecycle Policies**: Archive old content
- **Storage Class Analysis**: Usage pattern optimization

### General Recommendations
- **AWS Rightsizing**: Instance type optimization
- **Reserved Capacity**: Long-term commitment savings
- **Resource Tagging**: Cost allocation tracking

## Implementation Steps

### 1. Deploy Infrastructure
```bash
# Deploy cost monitoring infrastructure
terraform apply -target=aws_budgets_budget.monthly_cost_budget
terraform apply -target=aws_ce_anomaly_detector.service_anomaly_detector
terraform apply -target=aws_cloudwatch_dashboard.cost_monitoring
terraform apply -target=aws_lambda_function.cost_optimizer
```

### 2. Configure Email Notifications
```hcl
# Set email addresses for alerts
cost_alert_emails = [
  "ops-team@directfanz.io",
  "finance@directfanz.io"
]

cost_anomaly_alert_email = "alerts@directfanz.io"
cost_optimization_alert_email = "optimization@directfanz.io"
```

### 3. Set Budget Limits
```hcl
# Adjust budget limits based on expected usage
monthly_budget_limit = "2000"
ecs_monthly_budget_limit = "800"
rds_monthly_budget_limit = "400"
s3_monthly_budget_limit = "200"
```

### 4. Enable Cost Optimization
```hcl
# Enable automated cost optimization features
enable_cost_optimization = true
cost_anomaly_threshold = 100
```

## Monitoring Best Practices

### Daily Monitoring
- Review cost anomaly alerts
- Check budget utilization
- Monitor service-specific spending

### Weekly Analysis
- Review cost optimization recommendations
- Analyze spending trends
- Identify cost spikes or anomalies

### Monthly Review
- Compare actual vs. budgeted costs
- Assess cost optimization impact
- Adjust budgets and thresholds
- Plan for upcoming cost changes

## Cost Optimization Workflow

### 1. Alert Reception
- Budget threshold alerts
- Anomaly detection notifications
- Weekly optimization recommendations

### 2. Analysis
- Review cost breakdown by service
- Identify root causes of cost increases
- Evaluate optimization opportunities

### 3. Implementation
- Implement high-priority recommendations
- Test cost optimization changes
- Monitor impact on performance

### 4. Validation
- Verify cost reductions
- Ensure service performance maintained
- Document lessons learned

## Expected Cost Savings

### Spot Instances
- **Background Tasks**: 60-70% reduction
- **Mixed Workloads**: 15-20% reduction
- **Overall Platform**: 25-35% reduction

### Reserved Instances
- **RDS**: 30-60% savings
- **ElastiCache**: 30-50% savings
- **Long-term commitment required**

### Storage Optimization
- **S3 Intelligent Tiering**: 20-40% savings
- **Lifecycle Policies**: 50-80% for archived data
- **CloudFront Optimization**: 10-20% savings

### Total Expected Savings
- **Monthly**: $500-700 (25-35% of $2,000 budget)
- **Annual**: $6,000-8,400
- **ROI**: 300-400% return on optimization effort

## Troubleshooting

### Common Issues

#### Budget Alerts Not Received
- Verify email addresses in budget configuration
- Check SNS topic subscriptions
- Confirm email subscription acceptance

#### Anomaly Detection False Positives
- Adjust anomaly threshold
- Review detection sensitivity
- Exclude known cost variations

#### Lambda Function Errors
- Check CloudWatch logs for cost optimizer
- Verify IAM permissions
- Review function timeout settings

#### Dashboard Not Loading
- Verify CloudWatch dashboard permissions
- Check metric availability
- Confirm region settings

### Support Contacts
- **AWS Support**: For billing and cost explorer issues
- **Operations Team**: For infrastructure and monitoring
- **Finance Team**: For budget and cost approval