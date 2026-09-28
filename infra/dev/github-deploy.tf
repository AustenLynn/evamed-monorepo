# GitHub Actions deploys (.github/workflows/tests.yml, job `deploy`).
# The job assumes this role via OIDC, opens port 22 for its own /32,
# runs deploy/deploy.sh, and closes the port again.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only jobs running in the `dev` environment, which only `main` may use.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:dev"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${local.name}-github-deploy"
  description          = "GitHub Actions deploys to the evamed-dev Lightsail instance"
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_trust.json
  max_session_duration = 3600
}

# The deploy job reads this to tell Terraform's SSH openings from ones a
# crashed runner left behind.
resource "aws_ssm_parameter" "ssh_allowed_cidrs" {
  name = "/evamed/dev/ssh-allowed-cidrs"
  type = "String"
  # SSM rejects an empty value; "none" matches no CIDR.
  value = length(var.ssh_allowed_cidrs) > 0 ? join(" ", var.ssh_allowed_cidrs) : "none"
}

data "aws_iam_policy_document" "github_deploy" {
  # Tags come from the provider's default_tags (versions.tf).
  statement {
    sid       = "ToggleSshOnDevInstance"
    actions   = ["lightsail:OpenInstancePublicPorts", "lightsail:CloseInstancePublicPorts"]
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = ["evamed"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Environment"
      values   = ["dev"]
    }
  }

  # Read-only; not documented as supporting tag-based conditions.
  statement {
    sid       = "ReadPortStates"
    actions   = ["lightsail:GetInstancePortStates"]
    resources = ["*"]
  }

  statement {
    sid       = "ReadAllowedCidrs"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.ssh_allowed_cidrs.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy-dev"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
