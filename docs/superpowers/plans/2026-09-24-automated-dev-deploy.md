# Automated Dev Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every green push to `main` (and every manual "Run workflow" on `main`) deploys itself to the Lightsail dev box, with no stored AWS keys and SSH closed to the internet.

**Architecture:** A `deploy` job is added to `.github/workflows/tests.yml` and runs after `backend` and `frontend` pass. It assumes an IAM role through GitHub OIDC, opens Lightsail port 22 for the runner's own `/32`, runs the unchanged `deploy/deploy.sh`, and always closes the port again. Terraform in `infra/dev` owns the OIDC provider, the role, and an SSM parameter holding the allowed SSH CIDRs. `gh` owns the GitHub `dev` environment.

**Tech Stack:** GitHub Actions (`actions/checkout@v7`, `aws-actions/configure-aws-credentials@v6`), Terraform 1.16 with AWS provider `~> 6.0`, AWS CLI v2 (preinstalled on `ubuntu-latest`), `gh` 2.x, OpenSSH.

**Spec:** `docs/superpowers/specs/2026-09-24-automated-dev-deploy-design.md`

## Global Constraints

- **AWS account `339712712127`, region `us-east-1`, profile `evamed-dev`.** Lightsail instance `evamed-dev`, tagged `Project=evamed`, `Environment=dev`, `ManagedBy=terraform`.
- **Repo `AustenLynn/evamed-monorepo`; GitHub environment `dev`; host `dev.evamediber.click`.**
- **OIDC trust `sub` is exactly `repo:AustenLynn/evamed-monorepo:environment:dev`**, and `aud` is `sts.amazonaws.com`.
- **Never modify `aws_lightsail_instance.app`.** Replacing it wipes the database. Every `terraform plan` in this plan must show `0 to destroy`, and the only change allowed to an existing resource is the port-22 CIDR list on `aws_lightsail_instance_public_ports.app`.
- **SSH is never opened to `0.0.0.0/0`.**
- **The deploy private key lives only in the GitHub secret.** Delete the local copy after uploading it. It is never committed and never printed.
- **`deploy/deploy.sh` is not modified.**
- **CHECKPOINT steps change shared or live systems.** Before each one, stop and get the user's explicit go-ahead: `terraform apply`, the box's `authorized_keys`, GitHub environment settings, `git push`, AWS firewall changes, and merging.
- **Work on `feat/ci-tests`.** No force-pushes, and no pushing to `main` except by merging the PR in Task 6.
- **AWS reads/probes go through the AWS MCP server** (`run_script`) where possible. `terraform` and `aws` CLI commands use `AWS_PROFILE=evamed-dev`.

## Facts verified while planning (2026-09-24)

- The account has **no** IAM OIDC providers and no GitHub roles, so Terraform creates both.
- Port 22 is currently open to `192.100.192.101/32`, but the user's current IP is `192.100.192.118`. So the user can't SSH until Task 2 updates `ssh_allowed_cidrs`.
- The Lightsail API reference states that `OpenInstancePublicPorts` supports tag-based access control. `GetInstancePortStates` does not say so, so it gets an unconditioned read-only statement. Lightsail's example policies use `aws:ResourceTag/<key>`.
- Latest majors: `aws-actions/configure-aws-credentials` **v6** (v6.3.0, runs on node24), `actions/checkout` **v7**.
- `workflow_dispatch` only works for workflows on the default branch. `tests.yml` is not on `main` yet, so pre-merge verification (Task 5) uses `push` on a throwaway branch.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `infra/dev/github-deploy.tf` | Create | OIDC provider, deploy role and its policy, the SSM parameter with allowed CIDRs |
| `infra/dev/variables.tf` | Modify | `github_repository` variable |
| `infra/dev/outputs.tf` | Modify | `github_deploy_role_arn` output |
| `infra/dev/terraform.tfvars` | Modify (gitignored) | `ssh_allowed_cidrs` updated to the user's current IP |
| `.github/workflows/tests.yml` | Modify | `workflow_dispatch`, `main`-safe concurrency, the `deploy` job |
| `deploy/README.md` | Modify | Automated deploys, the deploy key, rotation, "no `terraform apply` during a deploy" |
| `README.md` | Modify | Spanish CI section describes the deploy job |

---

### Task 1: Probe Lightsail's port-open/close semantics

The workflow relies on two assumptions:
- Opening port 22 for a new CIDR *adds* it to the existing rule.
- Closing port 22 for one CIDR removes *only that CIDR*.

If closing removed the whole port-22 rule, every deploy would lock the user out. This task proves both assumptions first, using `203.0.113.7/32` (TEST-NET-3, which is never routable).

**Files:** none.

- [ ] **Step 1: CHECKPOINT.** Tell the user you are about to add and then remove a firewall rule for `203.0.113.7/32` on port 22, and wait for a yes.

- [ ] **Step 2: Open, read, close, read (AWS MCP `run_script`)**

```python
name = "evamed-dev"
pi = {"fromPort": 22, "toPort": 22, "protocol": "tcp", "cidrs": ["203.0.113.7/32"]}
async def port22():
    r = await call_boto3(service_name="lightsail", operation_name="GetInstancePortStates",
                         region_name="us-east-1", params={"instanceName": name})
    return [p for p in r["portStates"] if p["fromPort"] == 22]
before = await port22()
await call_boto3(service_name="lightsail", operation_name="OpenInstancePublicPorts",
                 region_name="us-east-1", params={"instanceName": name, "portInfo": pi})
opened = await port22()
await call_boto3(service_name="lightsail", operation_name="CloseInstancePublicPorts",
                 region_name="us-east-1", params={"instanceName": name, "portInfo": pi})
closed = await port22()
result = {"before": before, "opened": opened, "closed": closed}
result
```

Expected:
- `before`: port 22 with `cidrs: ["192.100.192.101/32"]`.
- `opened`: port 22 with both `192.100.192.101/32` and `203.0.113.7/32`.
- `closed`: identical to `before`.

If `closed` lacks `192.100.192.101/32`, or `opened` shows a replaced list instead of an added one, **stop**. Restore the firewall with `terraform -chdir=infra/dev apply -target=aws_lightsail_instance_public_ports.app` (CHECKPOINT) and report to the user: the workflow design needs rethinking.

---

### Task 2: Terraform — OIDC provider, deploy role, allowed-CIDR parameter

**Files:**
- Create: `infra/dev/github-deploy.tf`
- Modify: `infra/dev/variables.tf` (append), `infra/dev/outputs.tf` (append), `infra/dev/terraform.tfvars` (gitignored)

**Interfaces:**
- Produces:
  - IAM role `evamed-dev-github-deploy`; its ARN is output `github_deploy_role_arn`, which becomes GitHub variable `AWS_ROLE_ARN` in Task 3.
  - SSM parameter `/evamed/dev/ssh-allowed-cidrs`, a space-separated String, which Task 4's "Close stale SSH openings" step reads.

- [ ] **Step 1: Write `infra/dev/github-deploy.tf`**

```hcl
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
  name  = "/evamed/dev/ssh-allowed-cidrs"
  type  = "String"
  value = join(" ", var.ssh_allowed_cidrs)
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
```

- [ ] **Step 2: Append the variable to `infra/dev/variables.tf`**

```hcl

variable "github_repository" {
  description = "owner/name of the repo whose `dev` environment may deploy."
  type        = string
  default     = "AustenLynn/evamed-monorepo"
}
```

- [ ] **Step 3: Append the output to `infra/dev/outputs.tf`**

```hcl

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
```

- [ ] **Step 4: Update the allowed SSH CIDR**

Run `curl -s https://checkip.amazonaws.com` and ask the user whether `ssh_allowed_cidrs` should be that address as a `/32`, or something wider. Their IP moved from `.101` to `.118` within `192.100.192.0/24`. Edit `infra/dev/terraform.tfvars` to their answer. This file is gitignored: do not `git add` it.

- [ ] **Step 5: Format, validate, plan**

```bash
cd /home/maikolkali/evamed-monorepo/infra/dev
terraform fmt
AWS_PROFILE=evamed-dev terraform init -backend-config=backend.hcl -input=false
AWS_PROFILE=evamed-dev terraform validate
AWS_PROFILE=evamed-dev terraform plan -out=dev.tfplan
```

Expected:
- `Success! The configuration is valid.`
- The plan says **`4 to add, 1 to change, 0 to destroy`**:
  - The 4 additions: `aws_iam_openid_connect_provider.github`, `aws_iam_role.github_deploy`, `aws_iam_role_policy.github_deploy`, `aws_ssm_parameter.ssh_allowed_cidrs`.
  - The 1 change: `aws_lightsail_instance_public_ports.app`, updated in place with the new port-22 CIDR only.

If the plan shows anything else (especially any change to `aws_lightsail_instance.app`, or anything to destroy), **stop and report**.

- [ ] **Step 6: CHECKPOINT → apply**

Show the user the plan summary and wait for a yes. Then:

```bash
AWS_PROFILE=evamed-dev terraform apply dev.tfplan
AWS_PROFILE=evamed-dev terraform output -raw github_deploy_role_arn
```

Expected: `Apply complete! Resources: 4 added, 1 changed, 0 destroyed.`, and the role ARN `arn:aws:iam::339712712127:role/evamed-dev-github-deploy`.

If the apply fails with `AccessDenied` on an `iam:` or `ssm:` action, the `evamed-dev` IAM user lacks that permission. **Stop and report**; do not widen the user's permissions yourself.

- [ ] **Step 7: Verify SSH access for the user and the trust policy**

```bash
ssh -o BatchMode=yes ubuntu@dev.evamediber.click 'cat /opt/evamed/src/REVISION'
AWS_PROFILE=evamed-dev aws iam get-role --role-name evamed-dev-github-deploy --query 'Role.AssumeRolePolicyDocument' --output json
```

Expected: the ssh command prints a short revision. The trust policy shows `repo:AustenLynn/evamed-monorepo:environment:dev` and `sts.amazonaws.com`.

- [ ] **Step 8: Commit**

```bash
cd /home/maikolkali/evamed-monorepo
git add infra/dev/github-deploy.tf infra/dev/variables.tf infra/dev/outputs.tf
git commit -m "feat(infra): OIDC deploy role for GitHub Actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Deploy key on the box, GitHub `dev` environment

**Files:** none in the repo. Scratch files go in `$SCRATCH` (this session's scratchpad directory).

**Interfaces:**
- Consumes: `github_deploy_role_arn` from Task 2.
- Produces, in GitHub environment `dev`:
  - Secret `DEPLOY_SSH_KEY`.
  - Variables `AWS_ROLE_ARN`, `EVAMED_DEV_HOST`, `DEPLOY_KNOWN_HOSTS`.
  - A deployment-branch policy allowing only `main`.

- [ ] **Step 1: Generate the key pair in scratch**

```bash
ssh-keygen -t ed25519 -N '' -C evamed-dev-github-deploy -f "$SCRATCH/deploy_key"
```

- [ ] **Step 2: CHECKPOINT → authorize the public key on the box**

Wait for a yes, then:

```bash
ssh ubuntu@dev.evamediber.click 'cat >> ~/.ssh/authorized_keys' < "$SCRATCH/deploy_key.pub"
ssh -i "$SCRATCH/deploy_key" -o IdentitiesOnly=yes -o BatchMode=yes ubuntu@dev.evamediber.click 'echo deploy-key-ok'
```

Expected: `deploy-key-ok`.

- [ ] **Step 3: Capture and cross-check the host key**

```bash
ssh-keyscan -t ed25519 dev.evamediber.click 2>/dev/null > "$SCRATCH/known_hosts"
cat "$SCRATCH/known_hosts"
ssh ubuntu@dev.evamediber.click 'cat /etc/ssh/ssh_host_ed25519_key.pub'
```

Expected: the key material (the second field onwards) of both lines is identical. If it differs, **stop**: something sits between you and the box.

- [ ] **Step 4: CHECKPOINT → create the environment with a `main`-only branch policy**

Wait for a yes, then:

```bash
R=repos/AustenLynn/evamed-monorepo
gh api -X PUT $R/environments/dev --input - <<'JSON'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
gh api -X POST $R/environments/dev/deployment-branch-policies -f name=main -f type=branch
gh api $R/environments/dev/deployment-branch-policies --jq '.branch_policies[].name'
```

Expected: the last command prints `main`.

- [ ] **Step 5: Set the secret and variables, then delete the local private key**

```bash
gh secret set DEPLOY_SSH_KEY --env dev --repo AustenLynn/evamed-monorepo < "$SCRATCH/deploy_key"
gh variable set AWS_ROLE_ARN --env dev --repo AustenLynn/evamed-monorepo \
  --body "$(AWS_PROFILE=evamed-dev terraform -chdir=infra/dev output -raw github_deploy_role_arn)"
gh variable set EVAMED_DEV_HOST --env dev --repo AustenLynn/evamed-monorepo --body dev.evamediber.click
gh variable set DEPLOY_KNOWN_HOSTS --env dev --repo AustenLynn/evamed-monorepo < "$SCRATCH/known_hosts"
shred -u "$SCRATCH/deploy_key"
gh secret list --env dev --repo AustenLynn/evamed-monorepo
gh variable list --env dev --repo AustenLynn/evamed-monorepo
```

Expected:
- The secret list shows `DEPLOY_SSH_KEY`.
- The variable list shows `AWS_ROLE_ARN`, `DEPLOY_KNOWN_HOSTS` and `EVAMED_DEV_HOST`.
- `$SCRATCH/deploy_key` no longer exists.

---

### Task 4: The `deploy` job

**Files:**
- Modify: `.github/workflows/tests.yml`

**Interfaces:**
- Consumes:
  - From Task 3: `vars.AWS_ROLE_ARN`, `vars.EVAMED_DEV_HOST`, `vars.DEPLOY_KNOWN_HOSTS`, `secrets.DEPLOY_SSH_KEY`.
  - From Task 2: the SSM parameter `/evamed/dev/ssh-allowed-cidrs`.
- Produces: job id `deploy`, job name `deploy (Lightsail dev)`, step id `open` with output `cidr`.

- [ ] **Step 1: Add `workflow_dispatch` and make `main` runs queue instead of cancel**

Replace the `on:` block and the `concurrency:` block at the top of `.github/workflows/tests.yml` with:

```yaml
on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

# A newer push to the same branch makes the older run pointless, except on
# main, where cancelling would kill a deploy mid-rebuild; those runs queue.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

(`permissions:` is unchanged; it's shown for position.)

- [ ] **Step 2: Append the job at the end of the file**

```yaml

  deploy:
    name: deploy (Lightsail dev)
    needs: [backend, frontend]
    if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment:
      name: dev
      url: https://${{ vars.EVAMED_DEV_HOST }}
    # Deploys queue; one is never cancelled mid-rebuild.
    concurrency:
      group: deploy-dev
      cancel-in-progress: false
    permissions:
      contents: read
      id-token: write
    env:
      INSTANCE: evamed-dev
      EVAMED_DEV_HOST: ${{ vars.EVAMED_DEV_HOST }}

    steps:
      - uses: actions/checkout@v7

      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: us-east-1

      # A runner that died mid-deploy can leave its /32 open. Close any
      # port-22 CIDR that Terraform (infra/dev, ssh_allowed_cidrs) didn't set.
      - name: Close stale SSH openings
        run: |
          allowed=" $(aws ssm get-parameter --name /evamed/dev/ssh-allowed-cidrs \
            --query Parameter.Value --output text) "
          for cidr in $(aws lightsail get-instance-port-states --instance-name "$INSTANCE" \
              --query 'portStates[?fromPort==`22`].cidrs[]' --output text); do
            case "$allowed" in
              *" $cidr "*) ;;
              *)
                echo "closing stale $cidr"
                aws lightsail close-instance-public-ports --instance-name "$INSTANCE" \
                  --port-info "fromPort=22,toPort=22,protocol=tcp,cidrs=$cidr" >/dev/null
                ;;
            esac
          done

      - name: Open SSH for this runner
        id: open
        run: |
          cidr="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"
          aws lightsail open-instance-public-ports --instance-name "$INSTANCE" \
            --port-info "fromPort=22,toPort=22,protocol=tcp,cidrs=$cidr" >/dev/null
          echo "cidr=$cidr" >> "$GITHUB_OUTPUT"

      # deploy.sh uses accept-new, which still rejects a changed host key.
      - name: Install the deploy key
        env:
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ vars.DEPLOY_KNOWN_HOSTS }}
        run: |
          install -d -m 700 ~/.ssh
          printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts

      # Lightsail firewall changes take a few seconds to apply.
      - name: Wait for port 22
        run: |
          for _ in $(seq 1 12); do
            timeout 5 bash -c "</dev/tcp/$EVAMED_DEV_HOST/22" 2>/dev/null && exit 0
            sleep 5
          done
          echo "port 22 on $EVAMED_DEV_HOST never opened for this runner" >&2
          exit 1

      - name: Deploy
        run: deploy/deploy.sh

      - name: Close SSH for this runner
        if: always() && steps.open.outputs.cidr != ''
        run: |
          aws lightsail close-instance-public-ports --instance-name "$INSTANCE" \
            --port-info "fromPort=22,toPort=22,protocol=tcp,cidrs=${{ steps.open.outputs.cidr }}" >/dev/null
```

- [ ] **Step 3: Lint the workflow**

```bash
cd /home/maikolkali/evamed-monorepo
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/tests.yml
```

Expected: no output and exit code 0. actionlint also runs shellcheck on each `run:` block. Fix anything it reports, except warnings about the unknown `vars` context keys, which it can't see; report those to the user rather than ignoring them silently.

- [ ] **Step 4: Commit (no push yet)**

```bash
git add .github/workflows/tests.yml
git commit -m "ci: deploy green main to the Lightsail dev box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Prove it end to end before merging

Run this on the throwaway branch `ci-deploy-check`, which is deleted at the end. Two runs:
- **Happy path**, which also proves stale-hole cleanup.
- **Failure path**, which proves the port closes anyway.

**Files:** only on the throwaway branch.

- [ ] **Step 1: CHECKPOINT → push `feat/ci-tests` and create the throwaway branch**

Wait for a yes, then:

```bash
cd /home/maikolkali/evamed-monorepo
git push origin feat/ci-tests
git switch -c ci-deploy-check
sed -i "s|if: github.ref == 'refs/heads/main' \&\& (github.event_name|if: github.ref == 'refs/heads/ci-deploy-check' \&\& (github.event_name|" .github/workflows/tests.yml
grep -n "refs/heads/ci-deploy-check" .github/workflows/tests.yml
git commit -am "ci: TEMP deploy from ci-deploy-check (branch will be deleted)"
```

Expected: `grep` prints exactly one line, which is the `deploy` job's `if:`.

- [ ] **Step 2: CHECKPOINT → allow the branch in `dev`, and plant a fake stale hole**

Wait for a yes, then:

```bash
gh api -X POST repos/AustenLynn/evamed-monorepo/environments/dev/deployment-branch-policies -f name=ci-deploy-check -f type=branch --jq .id
```

Save the printed id as `$TMP_POLICY_ID`. Then open `203.0.113.7/32` using the Task 1 Step 2 script without its close call. It stands in for a crashed runner.

- [ ] **Step 3: Push and watch the happy path**

```bash
git push -u origin ci-deploy-check
sleep 10
RUN=$(gh run list --branch ci-deploy-check --workflow tests.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --exit-status
gh run view "$RUN" --log --job "$(gh run view "$RUN" --json jobs --jq '.jobs[] | select(.name=="deploy (Lightsail dev)") | .databaseId')" | grep -E "closing stale|ok: .* is live"
```

Expected:
- The run succeeds.
- The log shows `closing stale 203.0.113.7/32` and `ok: <rev> is live at https://dev.evamediber.click`.
- `ssh ubuntu@dev.evamediber.click cat /opt/evamed/src/REVISION` matches `git rev-parse --short HEAD`.
- `GetInstancePortStates` shows port 22 with **only** the Task 2 CIDR(s).

- [ ] **Step 4: Failure path**

```bash
sed -i 's|EVAMED_DEV_HOST: ${{ vars.EVAMED_DEV_HOST }}|EVAMED_DEV_HOST: nonexistent.invalid|' .github/workflows/tests.yml
git commit -am "ci: TEMP point deploy at a bogus host"
git push
sleep 10
RUN=$(gh run list --branch ci-deploy-check --workflow tests.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN"; gh run view "$RUN" --json jobs --jq '.jobs[] | {name, conclusion, steps: [.steps[] | {name, conclusion}]}'
```

Expected:
- The `deploy` job concludes `failure` at `Wait for port 22`.
- `Close SSH for this runner` concludes `success`.
- `GetInstancePortStates` again shows only the Task 2 CIDR(s) on port 22.
- The site is still healthy: `curl -fsS https://dev.evamediber.click/api/health/` succeeds.

- [ ] **Step 5: CHECKPOINT → clean up**

Wait for a yes, then:

```bash
gh api -X DELETE repos/AustenLynn/evamed-monorepo/environments/dev/deployment-branch-policies/$TMP_POLICY_ID
gh api repos/AustenLynn/evamed-monorepo/environments/dev/deployment-branch-policies --jq '.branch_policies[].name'
git switch feat/ci-tests
git push origin --delete ci-deploy-check
git branch -D ci-deploy-check
```

Expected: the policy list prints only `main`. The dev box keeps running the `ci-deploy-check` revision until the first deploy from `main`. That's harmless, because the code is `feat/ci-tests` plus a CI-only change.

---

### Task 6: Docs, merge, first real deploy

**Files:**
- Modify: `deploy/README.md`, `README.md`

- [ ] **Step 1: Replace the `## Deploy` section of `deploy/README.md`**

````markdown
## Deploy

Merging to `main` deploys automatically: the `deploy` job in `.github/workflows/tests.yml` runs after both test jobs pass. To redeploy `main` without a new commit, use **Actions → tests → Run workflow** on `main`, or run `gh workflow run tests.yml --ref main`.

The job assumes the `evamed-dev-github-deploy` role through GitHub OIDC (`infra/dev/github-deploy.tf`), so no AWS keys live in GitHub. It opens port 22 for the runner's own IP, runs `deploy/deploy.sh`, and closes the port again, even when the deploy fails. Before opening, it also closes any port-22 CIDR that isn't in `ssh_allowed_cidrs`, which cleans up after a crashed runner. The first step therefore also closes anything you open by hand in the Lightsail console: put permanent openings in `terraform.tfvars` instead.

Don't run `terraform apply` while a deploy is running: it resets the firewall and cuts the runner off mid-deploy.

You can still deploy by hand: commit, then run `deploy/deploy.sh`. It ships `HEAD` only; uncommitted changes are skipped with a warning.

If the health check never passes, `deploy.sh` exits 1, but the newly built containers stay running on the box. The old containers are already gone at that point, so the site is serving whatever the new containers manage, not the previous revision. Use `bash /opt/evamed/src/deploy/dc.sh ps` to see which containers are running and `bash /opt/evamed/src/deploy/dc.sh logs --tail=100` to troubleshoot. To roll back, revert the commit on `main`, which deploys the previous code.

### GitHub `dev` environment

Only `main` may deploy to it. It holds:

| Name | Kind | Value |
|---|---|---|
| `DEPLOY_SSH_KEY` | secret | Private half of the CI-only key `evamed-dev-github-deploy` |
| `AWS_ROLE_ARN` | variable | `terraform -chdir=infra/dev output -raw github_deploy_role_arn` |
| `EVAMED_DEV_HOST` | variable | `dev.evamediber.click` |
| `DEPLOY_KNOWN_HOSTS` | variable | `ssh-keyscan -t ed25519 dev.evamediber.click`, checked against the box's `/etc/ssh/ssh_host_ed25519_key.pub` |

**Rotate the deploy key:**

```bash
ssh-keygen -t ed25519 -N '' -C evamed-dev-github-deploy -f /tmp/deploy_key
ssh ubuntu@$EVAMED_DEV_HOST 'cat >> ~/.ssh/authorized_keys' < /tmp/deploy_key.pub
gh secret set DEPLOY_SSH_KEY --env dev < /tmp/deploy_key && shred -u /tmp/deploy_key
# then delete the old evamed-dev-github-deploy line from ~/.ssh/authorized_keys on the box
```

After replacing the instance, the host key changes: refresh `DEPLOY_KNOWN_HOSTS` and re-add the deploy key.

### Your IP changed

`ssh` times out when your IP no longer matches `ssh_allowed_cidrs`. Update `infra/dev/terraform.tfvars` and run `terraform apply` (not during a deploy).
````

- [ ] **Step 2: Update the Spanish CI section in `README.md`**

Replace the paragraph that starts with `No usan ningún secreto` with:

```markdown
Las pruebas no usan ningún secreto: simulan Firebase. El estado de cada
ejecución se ve en la pestaña **Actions** del repositorio.

Cuando ambos trabajos pasan en `main`, un tercer trabajo, **deploy**, despliega
automáticamente al servidor de desarrollo (`dev.evamediber.click`). También se
puede redesplegar `main` a mano con **Actions → tests → Run workflow**. Detalles
en `deploy/README.md`.
```

- [ ] **Step 3: Commit**

```bash
git add deploy/README.md README.md
git commit -m "docs: automated deploys from main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Final branch review**

Use superpowers:finishing-a-development-branch.
- The PR merges `feat/ci-tests` into `main`, with a body summarizing the CI and CD work and ending with the attribution line.
- **CHECKPOINT** before creating the PR, and again before merging it.

- [ ] **Step 5: Watch the first real deploy**

After the merge:

```bash
sleep 10
RUN=$(gh run list --branch main --workflow tests.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --exit-status
ssh ubuntu@dev.evamediber.click cat /opt/evamed/src/REVISION
git rev-parse --short origin/main
```

Expected:
- The run succeeds.
- `REVISION` equals the short SHA of `origin/main`.
- Port 22 shows only the Task 2 CIDR(s).

Then prove the manual button:

```bash
gh workflow run tests.yml --ref main
```

Watch that run the same way; it should also succeed.

---

## After this plan (not tasks here)

1. **Branch protection on `main`:** require `backend (Django 5.2, PostgreSQL 17)` and `frontend (Angular 22, Vitest)` (carried over from the CI plan).
2. **Disconnect Vercel** (unused since the move to Lightsail). Remove the project in the Vercel dashboard, or uninstall the Vercel GitHub app for this repo. Then delete the stale `Preview` and `Production` environments with `gh api -X DELETE repos/AustenLynn/evamed-monorepo/environments/<name>`.
3. **The `add-claude-github-actions-…` branch** from the GitHub App installer still needs its own PR.

## Self-review notes

- **Spec coverage:**
  - Workflow shape and triggers (D2, D3): Task 4.
  - OIDC and IAM (D4): Task 2.
  - Firewall open/close and stale cleanup: Tasks 1 and 4.
  - Deploy key and pinned host key: Task 3.
  - Failure handling: Task 5 Step 4.
  - Verification list: Tasks 5 and 6.
  - Docs: Task 6.
  - `deploy.sh` is unchanged (D5), and there's no rollback (D6).
- **Deviations from the spec's first draft**, already folded back into the spec:
  - The allowed CIDRs come from an SSM parameter instead of a hand-maintained GitHub variable, so there's one source of truth.
  - Workflow-level cancellation is off for `main`, so a second push can't kill a running deploy.
  - Pre-merge verification uses `push`, because `workflow_dispatch` needs the workflow on the default branch.
- **Names used across tasks:**
  - Role `evamed-dev-github-deploy`, output `github_deploy_role_arn`.
  - SSM parameter `/evamed/dev/ssh-allowed-cidrs`.
  - Environment `dev`; secret `DEPLOY_SSH_KEY`; variables `AWS_ROLE_ARN`, `EVAMED_DEV_HOST`, `DEPLOY_KNOWN_HOSTS`.
  - Job `deploy` / `deploy (Lightsail dev)`, step id `open`, output `cidr`.
  - Throwaway branch `ci-deploy-check`; probe CIDR `203.0.113.7/32`.
