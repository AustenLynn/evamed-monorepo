# Automated dev deploy (CD) — design

**Date:** 2026-09-24
**Status:** Approved in brainstorming; awaiting spec review
**Builds on:** `docs/superpowers/plans/2026-09-19-github-actions-ci.md` ("After this plan", item 3)

## Goal

Every push to `main` that passes both CI test jobs deploys itself to the Lightsail dev box, and anyone with repo access can redeploy `main` from the Actions "Run workflow" button. No long-lived AWS credentials live in GitHub, and SSH stays closed to the internet.

## Context

- CI (`.github/workflows/tests.yml`) runs `backend` and `frontend` jobs on every push and PR. It is green on `feat/ci-tests`, which is not merged yet.
- Deploys are manual: `deploy/deploy.sh` streams `git archive HEAD` over SSH to `/opt/evamed/src`, runs `docker compose up -d --build` on the box, and health-checks `https://$EVAMED_DEV_HOST/api/health/` for 3 minutes.
- The Lightsail firewall (`aws_lightsail_instance_public_ports.app` in `infra/dev/main.tf`) allows port 22 only from `var.ssh_allowed_cidrs`, which may not contain `0.0.0.0/0`. GitHub-hosted runners come from very wide, changing IP ranges.
- The instance carries the provider `default_tags` `Project=evamed`, `Environment=dev`.
- Replacing `aws_lightsail_instance.app` wipes the database; `user_data` and `key_pair_name` are in `ignore_changes`.

## Decisions

| # | Decision | Choice | Rejected alternatives |
|---|---|---|---|
| D1 | How the runner reaches the box | Open port 22 for the runner's own `/32` for the duration of the job, then close it | Box polls GitHub and deploys itself (deploy lags, logs stay on the box); self-hosted runner on the box (fork-PR code could run on the server of a public repo; competes for 2 GB of RAM) |
| D2 | Trigger | Automatic on a green push to `main`, plus `workflow_dispatch` | Auto only; manual only; auto with required-reviewer approval |
| D3 | Where the job lives | A `deploy` job in `tests.yml` with `needs: [backend, frontend]` | A separate `deploy.yml` on `workflow_run` (harder to follow; cross-workflow event) |
| D4 | AWS auth | GitHub OIDC → IAM role, trusted only for the `dev` environment of this repo | Stored access keys |
| D5 | Deploy mechanics | Existing `deploy/deploy.sh`, unchanged | Build images in CI and pull on the box (worth it later if box builds get too slow; out of scope) |
| D6 | Rollback | None automatic; revert on `main` to redeploy the previous code | Automatic rollback (the script can't restore old containers today) |

## Design

### Workflow (`.github/workflows/tests.yml`)

- Add `workflow_dispatch:` to `on:`. A manual run re-runs both test jobs, then deploys.
- Change the workflow-level concurrency to `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. Otherwise a second push to `main` would cancel the first run *including its deploy job* mid-rebuild. Runs on `main` now queue; other branches still cancel superseded runs.
- New job `deploy`:
  - `needs: [backend, frontend]`
  - `if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')`
  - `environment: dev`
  - `concurrency: { group: deploy-dev, cancel-in-progress: false }`. Deploys queue; one is never cancelled mid-rebuild or before the port closes. The workflow-level group still cancels superseded *test* runs.
  - `permissions: { contents: read, id-token: write }`. `id-token` is granted only on this job.
  - `timeout-minutes: 30`. A first deploy restores the DB dump and can take ~10 minutes.
- Steps, in order:
  1. `actions/checkout` with the full commit available to `git archive HEAD`.
  2. `aws-actions/configure-aws-credentials` with `role-to-assume: ${{ vars.AWS_ROLE_ARN }}` and the region `us-east-1`.
  3. **Close stale holes.** Read `get-instance-port-states` for `evamed-dev`; for every port-22 CIDR not in the SSM parameter `/evamed/dev/ssh-allowed-cidrs` (written by Terraform from `ssh_allowed_cidrs`, so there's one source of truth), call `close-instance-public-ports`. This removes leftovers from a runner that died before step 7.
  4. **Open.** Get the runner's IPv4 from `https://checkip.amazonaws.com`, then `open-instance-public-ports` for port 22, `<ip>/32`. Save the CIDR to a step output.
  5. **SSH setup.** Write `secrets.DEPLOY_SSH_KEY` to `~/.ssh/id_ed25519` (mode 600) and `vars.DEPLOY_KNOWN_HOSTS` to `~/.ssh/known_hosts`. Wait until port 22 accepts connections: poll for up to 60 s, since the rule change isn't instant.
  6. **Deploy.** `EVAMED_DEV_HOST=${{ vars.EVAMED_DEV_HOST }} deploy/deploy.sh`. The script's exit code is the job result.
  7. **Close** (`if: always() && steps.open.outputs.cidr != ''`). `close-instance-public-ports` for that CIDR.

### AWS (`infra/dev/github-deploy.tf`, Terraform)

- **OIDC provider** `token.actions.githubusercontent.com`, client ID `sts.amazonaws.com`. If the account already has one, use a `data "aws_iam_openid_connect_provider"` lookup instead of creating a second one. The account is checked while planning.
- **Role** `evamed-dev-github-deploy`, `max_session_duration = 3600`.
  - Trust: `sts:AssumeRoleWithWebIdentity` from that provider, with `StringEquals` on `token.actions.githubusercontent.com:aud = sts.amazonaws.com` and `token.actions.githubusercontent.com:sub = repo:AustenLynn/evamed-monorepo:environment:dev`.
- **Inline policy:**
  - `lightsail:OpenInstancePublicPorts`, `lightsail:CloseInstancePublicPorts`, `lightsail:GetInstancePortStates` on `Resource: "*"` with `StringEquals` `aws:ResourceTag/Project = evamed` and `aws:ResourceTag/Environment = dev`.
  - The Lightsail API reference states that the open/close actions support tag-based access control. If `GetInstancePortStates` turns out not to, it gets its own read-only statement without the tag condition, and the plan records that.
- **SSM parameter** `/evamed/dev/ssh-allowed-cidrs` (String, space-separated `ssh_allowed_cidrs`). The role may `ssm:GetParameter` on that parameter only.
- **Output** `github_deploy_role_arn`.
- **Verified 2026-09-24:** the account (`339712712127`) has no OIDC provider yet, so Terraform creates it. `aws:ResourceTag` conditions are the documented form for Lightsail. `GetInstancePortStates` is not documented as supporting tag-based access, so it gets its own statement without the tag condition.
- Nothing here changes `aws_lightsail_instance.app`. `terraform plan` must show additions only.
- **Drift:** `aws_lightsail_instance_public_ports.app` owns the full port list, so a hole left open during a deploy shows as drift, and `terraform apply` removes it. Don't run `terraform apply` while a deploy is running.

### Credentials and configuration

- **Deploy key.** A new ed25519 key pair used only by CI (`evamed-dev-github-deploy`). The public half is appended by hand to `/home/ubuntu/.ssh/authorized_keys` on the box. This is a one-time runbook step: Terraform/user-data would force an instance replacement. Your personal key is unaffected.
- **GitHub environment `dev`,** with deployment branches limited to `main`:
  - Secret `DEPLOY_SSH_KEY`: the deploy private key.
  - Variables: `AWS_ROLE_ARN` (from the Terraform output), `EVAMED_DEV_HOST` (`dev.evamediber.click`), `DEPLOY_KNOWN_HOSTS` (from `ssh-keyscan -t ed25519 dev.evamediber.click`, checked against the key the box reports on the console).
- The environment, its branch policy, secret and variables are created with `gh` (authenticated as `AustenLynn` with `repo` and `workflow` scopes): `gh api -X PUT repos/AustenLynn/evamed-monorepo/environments/dev` with a custom branch policy for `main`, then `gh secret set --env dev` and `gh variable set --env dev`. The same commands go in the runbook so rotation is repeatable.
- The repo already has `Preview` and `Production` environments, created by the Vercel integration (`vercel[bot]` deployments). `dev` is a separate name and doesn't interact with them.

### Failure handling

- **Health check fails:** the job fails and the deploy shows red. The new containers stay up, as they do today (documented in `deploy/README.md`).
- **Any step fails or the run is cancelled after the port opened:** step 7 closes it.
- **Runner dies outright:** the next deploy's step 3, or the next `terraform apply`, closes the leftover `/32`. Exposure is port 22 to one GitHub-owned IP, with key-only auth.
- **Egress IP mismatch** (checkip IP ≠ the IP SSH leaves from): SSH times out at step 5, the job fails, and step 7 still runs. Revisit if it ever happens.

## Verification

1. `terraform plan` shows only the OIDC provider (or none), the role and its policy. `terraform apply`.
2. **Full path end to end.** `workflow_dispatch` only works once the workflow is on the default branch, so pre-merge testing uses *push*: a throwaway branch whose `deploy` condition names that branch, temporarily allowed in the `dev` environment's branch policy. Push it. Expect a deploy, the site healthy with the new `REVISION`, and afterwards `get-instance-port-states` listing only `ssh_allowed_cidrs` on port 22.
3. **Failure path.** Same branch, with `EVAMED_DEV_HOST` overridden to an unresolvable host. Expect a red job and the port closed afterwards.
4. **Stale-hole cleanup.** Manually open a fake `/32`, run again, and expect it closed by step 3.
5. Delete the throwaway branch, restore the environment rule to `main` only, merge `feat/ci-tests`, and confirm the first run on `main` deploys.

## Out of scope

- Building images in CI or a registry (D5).
- Automatic rollback (D6).
- Production or preview environments.
- Branch protection on `main`, which is still a manual UI step from the CI plan.
- Lint in CI.

## Docs to update

- `deploy/README.md`: automated deploys, the deploy key, the `dev` environment, how to rotate the key, "don't `terraform apply` during a deploy".
- `README.md` CI section (Spanish): the deploy job.

## Related cleanup

Vercel is no longer used (confirmed 2026-09-24) but its GitHub integration still creates `Preview` deployments. Disconnecting it is a follow-up, outside this pipeline.
