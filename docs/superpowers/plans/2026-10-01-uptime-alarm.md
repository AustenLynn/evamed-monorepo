# Uptime Alarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `https://dev.evamediber.click/api/health/` stops answering, someone gets an email within about 5 minutes, and another when it recovers.

**Architecture:** Terraform in `infra/dev` adds:
- a Route 53 HTTPS health check on `/api/health/`;
- a CloudWatch alarm on its `HealthCheckStatus` metric;
- an SNS topic with an email subscription.

The alarm notifies on both ALARM and OK. Nothing changes on the instance or the app.

**Tech Stack:** Terraform ≥ 1.10, AWS provider ~> 6.0 (as in `infra/dev/versions.tf`), Route 53 health checks, CloudWatch, SNS.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 9. This plan covers the uptime half. Frontend error reporting is deferred, see `2026-10-01-deferred-pagination-and-revocation.md`.

## Global Constraints

- **Region `us-east-1`.** That's the provider's region, and Route 53 health-check metrics are published there.
- **Health check:**
  - `type = "HTTPS"`, `fqdn = var.domain_name`, `port = 443`, `resource_path = "/api/health/"`;
  - `request_interval = 30`, `failure_threshold = 3`.
  - Route 53 HTTPS checks don't validate the certificate; a cert problem is caught by the deploy job's health check instead.
- **Alarm:** namespace `AWS/Route53`, metric `HealthCheckStatus`, dimension `HealthCheckId`, statistic `Minimum`, `period = 60`, `evaluation_periods = 3`, `threshold = 1`, `comparison_operator = "LessThanThreshold"`, `treat_missing_data = "breaching"`. Both `alarm_actions` and `ok_actions` go to the SNS topic.
- **Recipient:** `var.alert_email`. It's set in the gitignored `infra/dev/terraform.tfvars` and never committed. SNS email subscriptions must be confirmed by clicking the link AWS sends, which Terraform can't do.
- **Cost:** Route 53 charges $0.50 per month for a basic check of an AWS endpoint and $0.75 for a non-AWS one, plus $1/$2 per optional feature; HTTPS is one. Up to 50 basic checks on AWS endpoints in your own account are free. A Lightsail static IP *should* count as an AWS endpoint, but that's unconfirmed, so expect about **$1–2.75 per month**. CloudWatch and SNS email at this volume are within the free tier. The existing budgets alert at US$25.
- **The plan must show only additions:** `4 to add, 0 to change, 0 to destroy`. Anything touching `aws_lightsail_*` means stop.
- **Commands run from the repo root with `AWS_PROFILE=evamed-dev`.**

## Review Focus

- **Nobody confirmed the SNS subscription.** Then alerts go nowhere. Task 1 Step 6 requires the confirmed status before calling it done.
- **The site is down for under 90 seconds** (a deploy rebuild). Three failed 30-second checks must not page anyone. The alarm needs 3 consecutive bad minutes, so a short deploy blip stays quiet; Step 7 records how long a deploy takes.
- **The health check itself has no data** (just created, or Route 53 hiccups). `treat_missing_data = "breaching"` means silence counts as down. That's intended: a silent monitor is worse than a false alarm.
- **Recovery.** `ok_actions` sends a second email, so nobody has to check by hand whether it came back. Exercised in Step 7.
- **A domain change.** The check follows `var.domain_name`, the same variable the DNS record uses.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `infra/dev/monitoring.tf` | Create | Health check, alarm, SNS topic and subscription |
| `infra/dev/variables.tf` | Modify | `alert_email` |
| `infra/dev/terraform.tfvars.example` | Modify | Example `alert_email` |
| `infra/dev/outputs.tf` | Modify | `health_check_id` |
| `deploy/README.md` | Modify | A "Monitoring" section |

---

### Task 1: Health check, alarm and email

**Files:**
- Create: `infra/dev/monitoring.tf`
- Modify: `infra/dev/variables.tf`, `infra/dev/terraform.tfvars.example`, `infra/dev/outputs.tf`, `deploy/README.md`

- [ ] **Step 1: Prove there's no monitoring today (the failing check)**

Run (AWS MCP `run_script` or the CLI):

```bash
AWS_PROFILE=evamed-dev aws route53 list-health-checks --query 'HealthChecks[].HealthCheckConfig.FullyQualifiedDomainName'
AWS_PROFILE=evamed-dev aws cloudwatch describe-alarms --region us-east-1 --alarm-name-prefix evamed-dev --query 'MetricAlarms[].AlarmName'
```

Expected: both print `[]`.

- [ ] **Step 2: Write the Terraform**

`infra/dev/monitoring.tf`:

```hcl
# Uptime: Route 53 checks /api/health/ every 30 s; three bad minutes in a row
# email var.alert_email, and a second email says when it's back.

resource "aws_route53_health_check" "api" {
  type              = "HTTPS"
  fqdn              = var.domain_name
  port              = 443
  resource_path     = "/api/health/"
  request_interval  = 30
  failure_threshold = 3

  tags = {
    Name = "${local.name}-api-health"
  }
}

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
}

# AWS emails a confirmation link; alerts only arrive after it's clicked.
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "api_down" {
  alarm_name          = "${local.name}-api-down"
  alarm_description   = "https://${var.domain_name}/api/health/ failed for 3 minutes in a row"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.api.id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
```

Append to `infra/dev/variables.tf`:

```hcl

variable "alert_email" {
  description = "Where uptime alerts are emailed (confirm the SNS subscription link once)."
  type        = string
}
```

Append to `infra/dev/outputs.tf`:

```hcl

output "health_check_id" {
  value = aws_route53_health_check.api.id
}
```

Append to `infra/dev/terraform.tfvars.example`:

```hcl
alert_email = "you@example.com" # uptime alerts; confirm the email AWS sends
```

Add your real address as `alert_email = "…"` to `infra/dev/terraform.tfvars`. That file is gitignored: don't `git add` it.

- [ ] **Step 3: Format, validate, plan**

```bash
cd infra/dev
terraform fmt
AWS_PROFILE=evamed-dev terraform validate
AWS_PROFILE=evamed-dev terraform plan -out=dev.tfplan
```

Expected: `Success! The configuration is valid.` and `Plan: 4 to add, 0 to change, 0 to destroy.` If anything else is in the plan, especially `aws_lightsail_*`, stop and report.

- [ ] **Step 4: CHECKPOINT: apply**

Get the user's go-ahead, then run `AWS_PROFILE=evamed-dev terraform apply dev.tfplan`. Expected: `Apply complete! Resources: 4 added, 0 changed, 0 destroyed.`

- [ ] **Step 5: Confirm the subscription**

The recipient clicks **Confirm subscription** in the email from `AWS Notifications`. Then run:

```bash
AWS_PROFILE=evamed-dev aws sns list-subscriptions-by-topic --region us-east-1 --topic-arn "$(AWS_PROFILE=evamed-dev aws sns list-topics --region us-east-1 --query "Topics[?ends_with(TopicArn, ':evamed-dev-alerts')].TopicArn | [0]" --output text)" --query 'Subscriptions[].SubscriptionArn'
```

Expected: a full ARN, not `PendingConfirmation`.

- [ ] **Step 6: The check sees the site as healthy**

Wait about 3 minutes after the apply, then run:

```bash
AWS_PROFILE=evamed-dev aws route53 get-health-check-status --health-check-id "$(terraform -chdir=infra/dev output -raw health_check_id)" --query 'HealthCheckObservations[].StatusReport.Status' --output text
AWS_PROFILE=evamed-dev aws cloudwatch describe-alarms --region us-east-1 --alarm-names evamed-dev-api-down --query 'MetricAlarms[0].StateValue' --output text
```

Expected: the observations read `Success: HTTP Status Code 200, OK` (one per checker region), and the alarm state is `OK`. It starts as `INSUFFICIENT_DATA` or `ALARM` until the first data arrives; that's expected for the first few minutes.

- [ ] **Step 7: Prove an alert arrives (without breaking the site)**

Run:

```bash
AWS_PROFILE=evamed-dev aws cloudwatch set-alarm-state --region us-east-1 --alarm-name evamed-dev-api-down --state-value ALARM --state-reason "Plan test: alert delivery"
```

Expected:
- within a minute, an `ALARM: "evamed-dev-api-down"` email arrives;
- at the next evaluation, CloudWatch returns the alarm to `OK` on its own (the site is healthy), and an `OK` email arrives.

Also look at the next real deploy's duration in the Actions log. If the `Deploy` step's rebuild regularly takes the API down for more than 3 minutes, raise `evaluation_periods` to 5 in a follow-up rather than tolerating false alarms.

- [ ] **Step 8: Document and commit**

Add to `deploy/README.md`, before `## Cost`:

```markdown
## Monitoring

Route 53 checks `https://dev.evamediber.click/api/health/` every 30 seconds (`infra/dev/monitoring.tf`). After 3 failing minutes, CloudWatch emails `alert_email` (in `terraform.tfvars`), and it emails again when the site recovers. The recipient must confirm the SNS subscription once. To test delivery without touching the site:
`aws cloudwatch set-alarm-state --region us-east-1 --alarm-name evamed-dev-api-down --state-value ALARM --state-reason test`.
```

In the `## Cost` section, add `, Route 53 health check (~US$1–2.75/month)` after `Route 53 queries`.

```bash
git add infra/dev/monitoring.tf infra/dev/variables.tf infra/dev/terraform.tfvars.example infra/dev/outputs.tf deploy/README.md
git commit -m "feat(infra): email when the dev API health check fails

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
