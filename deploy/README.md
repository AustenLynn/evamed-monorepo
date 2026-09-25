# EVAmed dev on AWS Lightsail

One Lightsail instance runs `deploy/compose.aws.yml` (Postgres, Django, Angular, Caddy).
Infra lives in `infra/dev` (Terraform). Plan and decisions:
`docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`.

```bash
export AWS_PROFILE=evamed-dev
export EVAMED_DEV_HOST=dev.evamediber.click   # terraform -chdir=infra/dev output url
S=deploy/with-ssh.sh                          # opens port 22 for your IP while a command runs
```

## Deploy

Merging to `main` deploys automatically: the `deploy` job in `.github/workflows/tests.yml` runs after both test jobs pass. To redeploy `main` without a new commit, use **Actions → tests → Run workflow** on `main`, or run `gh workflow run tests.yml --ref main`.

The job assumes the `evamed-dev-github-deploy` role through GitHub OIDC (`infra/dev/github-deploy.tf`), so no AWS keys live in GitHub. It opens port 22 for the runner's own IP, runs `deploy/deploy.sh`, and closes the port again, even when the deploy fails. Before opening, it also closes any port-22 CIDR that isn't in `ssh_allowed_cidrs`, which cleans up after a crashed runner. That step also closes an opening held by `deploy/with-ssh.sh`: SSH sessions you already have should survive, but a new one needs the wrapper again.

Don't run `terraform apply` while a deploy is running: it resets the firewall and cuts the runner off mid-deploy.

You can still deploy by hand: commit, then run `$S deploy/deploy.sh`. It ships `HEAD` only; uncommitted changes are skipped with a warning.

If the health check never passes, `deploy.sh` exits 1, but the newly built containers stay running on the box. The old containers are already gone at that point, so the site is serving whatever the new containers manage, not the previous revision. Use `bash /opt/evamed/src/deploy/dc.sh ps` to see which containers are running and `bash /opt/evamed/src/deploy/dc.sh logs --tail=100` to troubleshoot. To roll back, revert the commit on `main`, which deploys the previous code.

### GitHub `dev` environment

Only `main` may deploy to it. It holds:

| Name | Kind | Value |
|---|---|---|
| `DEPLOY_SSH_KEY` | secret | Private half of the CI-only key `evamed-dev-github-deploy` |
| `AWS_ROLE_ARN` | variable | `terraform -chdir=infra/dev output -raw github_deploy_role_arn` |
| `EVAMED_DEV_HOST` | variable | `dev.evamediber.click` |
| `DEPLOY_KNOWN_HOSTS` | variable | `ssh-keyscan -t ed25519 dev.evamediber.click` without its `#` banner line, checked against the box's `/etc/ssh/ssh_host_ed25519_key.pub` |

**Rotate the deploy key:**

```bash
ssh-keygen -t ed25519 -N '' -C evamed-dev-github-deploy -f /tmp/deploy_key
$S ssh ubuntu@$EVAMED_DEV_HOST 'cat >> ~/.ssh/authorized_keys' < /tmp/deploy_key.pub
gh secret set DEPLOY_SSH_KEY --env dev < /tmp/deploy_key && shred -u /tmp/deploy_key
# then delete the old evamed-dev-github-deploy line from ~/.ssh/authorized_keys on the box
```

After replacing the instance, the host key changes: refresh `DEPLOY_KNOWN_HOSTS` and re-add the deploy key.

### Reaching the server by SSH

Port 22 is closed to everyone by default (`ssh_allowed_cidrs = []`). Prefix any command that needs SSH with `deploy/with-ssh.sh` (`$S` above). It opens port 22 for your current IP using your AWS credentials (`AWS_PROFILE=evamed-dev`), runs the command, and closes the port when the command exits, even when it fails. If a run is killed before it can close the port, the next CI deploy or `terraform apply` closes it.

For an address that should always be allowed, put it in `ssh_allowed_cidrs` in `infra/dev/terraform.tfvars` and run `terraform apply` (not during a deploy). Terraform replaces the whole firewall resource for this, so the site can be unreachable for a few seconds.

## Secrets

Edit `deploy/.env.aws` (gitignored), then
`EVAMED_FIREBASE_KEY=<admin-key.json> $S deploy/push-secrets.sh` and redeploy.
`DB_PASSWORD` only applies to a fresh DB volume. To change it on a live DB, first run
`bash /opt/evamed/src/deploy/dc.sh exec db psql -U myprojectuser -d evamed_total -c "ALTER USER myprojectuser PASSWORD '<new>'"`,
then push secrets and redeploy.

## Everyday commands (on the server)

```bash
$S ssh ubuntu@$EVAMED_DEV_HOST
bash /opt/evamed/src/deploy/dc.sh ps
bash /opt/evamed/src/deploy/dc.sh logs -f api          # or web, caddy, db
bash /opt/evamed/src/deploy/dc.sh exec api python manage.py shell
bash /opt/evamed/src/deploy/dc.sh exec api python manage.py ecoinvent_resolve --dry-run
```

## Django admin (not public)

```bash
$S ssh -L 8000:127.0.0.1:8000 ubuntu@$EVAMED_DEV_HOST
# then browse http://localhost:8000/admin/
# create a login once: bash /opt/evamed/src/deploy/dc.sh exec api python manage.py createsuperuser
```

## Reset the database to the seed dump

Destroys all dev data.

```bash
$S ssh ubuntu@$EVAMED_DEV_HOST 'bash /opt/evamed/src/deploy/dc.sh down && docker volume rm evamed_db_data && bash /opt/evamed/src/deploy/dc.sh up -d'
```

## Restore from a snapshot

Lightsail console → Instances → `evamed-dev` → Snapshots → pick an automatic snapshot →
"Create new instance". Then point Terraform at it: move the static IP to the new instance in the
console and `terraform import` the new instance, or simply use it to copy data out.
Snapshots are daily at 08:00 UTC; the last 7 are kept.

After any deliberate `terraform apply -replace=aws_lightsail_instance.app`, the static IP is detached by Lightsail. Terraform rebuilds the attachment in the same apply (thanks to the `lifecycle.replace_triggered_by` setting), but verify `terraform output static_ip` still matches `dig +short dev.evamediber.click` and that `aws lightsail get-static-ips` shows `isAttached: true` before assuming the site is back online. Note that a replacement wipes the instance disk, so the database is re-seeded from the dump on the next deploy.

## Kernel updates

Security patches install automatically. When `ssh` greets you with "System restart required",
run `sudo reboot`; the stack comes back on its own.

## Cost

About US$12/month for the instance, plus snapshot storage (~US$0.05/GB-month), Route 53 queries, and pennies for S3 state.
The pre-existing budgets alert at 80 % of US$25 gross usage (forecast), at 100 % (actual), and on the first post-credit dollar.

## Tear down

```bash
terraform -chdir=infra/dev destroy
```

This deletes the instance **and its database**. Automatic snapshots are deleted with the instance;
take a manual snapshot first if you want to keep one.
