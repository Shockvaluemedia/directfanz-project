output "route53_name_servers" {
  description = "Set these four as the name servers for directfanz.io at the registrar (after copying records)."
  value       = aws_route53_zone.main.name_servers
}

output "load_balancer_url" {
  description = "Test address for phase 1, before the domain points here."
  value       = "http://${aws_lb.main.dns_name}"
}

output "site_url" {
  description = "Address the app is configured with (NEXTAUTH_URL)."
  value       = local.site_url
}

output "ecr_repository_url" {
  description = "Where the deploy workflow pushes images."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "task_definition_family" {
  value = aws_ecs_task_definition.app.family
}

output "app_subnet_ids" {
  description = "Subnets the deploy workflow runs the migration task in."
  value       = aws_subnet.public[*].id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "app_secret_arn" {
  description = "Secret to fill with the app values (JSON keys listed in app_secret_keys)."
  value       = aws_secretsmanager_secret.app.arn
}

output "media_bucket_name" {
  value = aws_s3_bucket.media.bucket
}

output "github_deploy_role_arn" {
  description = "Save as the GitHub variable AWS_DEPLOY_ROLE_ARN in the production environment."
  value       = aws_iam_role.deploy.arn
}

output "cron_connection_name" {
  description = "EventBridge connection whose Bearer value is set by hand (README.md)."
  value       = var.enable_schedules ? aws_cloudwatch_event_connection.cron[0].name : null
}
