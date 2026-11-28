# Route 53 zone for directfanz.io. Registration stays at the current registrar;
# only the name servers change there (by hand, after this zone holds copies of
# the current records). See README.md for the order of steps.

resource "aws_route53_zone" "main" {
  name    = var.domain_name
  comment = "DirectFanz. Name servers set at the registrar by hand."
}

# Copies of the records that exist at the current DNS host today.
resource "aws_route53_record" "existing" {
  for_each = var.existing_dns_records

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name == "" ? var.domain_name : "${each.value.name}.${var.domain_name}"
  type    = each.value.type
  ttl     = each.value.ttl
  records = each.value.records
}

# --- Certificate -----------------------------------------------------------

resource "aws_acm_certificate" "site" {
  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Validation records go in the zone right away; ACM can only see them once the
# registrar points the domain at Route 53's name servers.
locals {
  cert_domains = [var.domain_name, "www.${var.domain_name}"]
  cert_dvo     = { for o in aws_acm_certificate.site.domain_validation_options : o.domain_name => o }
}

resource "aws_route53_record" "cert_validation" {
  # Keys are known at plan time; values come from ACM.
  for_each = toset(local.cert_domains)

  zone_id         = aws_route53_zone.main.zone_id
  name            = local.cert_dvo[each.key].resource_record_name
  type            = local.cert_dvo[each.key].resource_record_type
  ttl             = 300
  records         = [local.cert_dvo[each.key].resource_record_value]
  allow_overwrite = true
}

# Only waited on in phase 2, so phase 1 never blocks on DNS.
resource "aws_acm_certificate_validation" "site" {
  count = var.enable_https ? 1 : 0

  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# --- Cutover: point the site at the load balancer --------------------------

resource "aws_route53_record" "apex" {
  for_each = var.site_on_aws ? toset(["A", "AAAA"]) : toset([])

  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = each.key

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "www" {
  for_each = var.site_on_aws ? toset(["A", "AAAA"]) : toset([])

  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = each.key

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# CAA: only Amazon may issue certificates for the domain.
resource "aws_route53_record" "caa" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "CAA"
  ttl     = 3600
  records = [
    "0 issue \"amazon.com\"",
    "0 issue \"amazontrust.com\"",
    "0 issue \"awstrust.com\"",
    "0 issue \"amazonaws.com\"",
  ]
}
