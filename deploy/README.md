# EVAmed dev on AWS Lightsail

One Lightsail instance runs `deploy/compose.aws.yml` (Postgres, Django, Angular, Caddy).
Infra lives in `infra/dev` (Terraform). Plan and decisions:
`docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`.

```bash
export AWS_PROFILE=evamed-dev
export EVAMED_DEV_HOST=dev.evamediber.click   # terraform -chdir=infra/dev output url
```

## Deploy

Commit, then run `deploy/deploy.sh`. It ships `HEAD` only; uncommitted changes are skipped with a warning.

If the health check never passes, `deploy.sh` exits 1, but the newly built containers stay running on the box. The old containers are already gone at that point, so the site is serving whatever the new containers manage, not the previous revision. Use `bash /opt/evamed/src/deploy/dc.sh ps` to see which containers are running and `bash /opt/evamed/src/deploy/dc.sh logs --tail=100` to troubleshoot.

## Secrets

Edit `deploy/.env.aws` (gitignored), then
`EVAMED_FIREBASE_KEY=<admin-key.json> deploy/push-secrets.sh` and redeploy.
`DB_PASSWORD` only applies to a fresh DB volume. To change it on a live DB, first run
`bash /opt/evamed/src/deploy/dc.sh exec db psql -U myprojectuser -d evamed_total -c "ALTER USER myprojectuser PASSWORD '<new>'"`,
then push secrets and redeploy.

## Everyday commands (on the server)

```bash
ssh ubuntu@$EVAMED_DEV_HOST
bash /opt/evamed/src/deploy/dc.sh ps
bash /opt/evamed/src/deploy/dc.sh logs -f api          # or web, caddy, db
bash /opt/evamed/src/deploy/dc.sh exec api python manage.py shell
bash /opt/evamed/src/deploy/dc.sh exec api python manage.py ecoinvent_resolve --dry-run
```

## Django admin (not public)

```bash
ssh -L 8000:127.0.0.1:8000 ubuntu@$EVAMED_DEV_HOST
# then browse http://localhost:8000/admin/
# create a login once: bash /opt/evamed/src/deploy/dc.sh exec api python manage.py createsuperuser
```

## Reset the database to the seed dump

Destroys all dev data.

```bash
ssh ubuntu@$EVAMED_DEV_HOST 'bash /opt/evamed/src/deploy/dc.sh down && docker volume rm evamed_db_data && bash /opt/evamed/src/deploy/dc.sh up -d'
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
