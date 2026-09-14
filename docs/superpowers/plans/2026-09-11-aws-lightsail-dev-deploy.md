# AWS Lightsail Dev Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the EVAmed stack (Postgres + Django API + Angular frontend) as a single, HTTPS-served dev environment on one AWS Lightsail instance, provisioned with Terraform and deployed with one script.

**Architecture:** Terraform creates a 2 GB Lightsail instance with a static IP, a firewall, daily snapshots, a Route 53 `A` record and a cost budget. On the box, a dedicated `deploy/compose.aws.yml` runs the existing `db`/`api`/`web` containers behind Caddy. Caddy terminates TLS with an automatic Let's Encrypt certificate and routes `/api*` to Django and everything else to the frontend. Because both are served from one origin, CORS is not involved. `deploy/deploy.sh` ships the committed `HEAD` with `git archive` over SSH and runs `docker compose up --build` on the box. Secrets never enter Terraform state or git.

**Tech Stack:** Terraform ≥ 1.10 (or OpenTofu ≥ 1.10, same files), AWS provider `~> 6.0`, AWS Lightsail, Route 53, AWS Budgets, S3 (state), Ubuntu 24.04, Docker + Compose v2, Caddy 2, the existing Django 2.2 / Angular 19 images.

**Spec:** None separate. The decisions below are the spec.

## Global Constraints

- Environment is **dev only**. It holds seeded catalogue data from `backend/evamed-api/backup` and must never receive a copy of production user data.
- AWS region: `us-east-1` (variable `region`). Lightsail has no Mexico region; `us-east-1` has the most Lightsail capacity and the lowest latency to Mexico among Lightsail regions.
- Lightsail bundle `small_3_0` (2 GB RAM, 2 vCPU, 60 GB SSD, ~US$12/month), blueprint `ubuntu_24_04`. Verify both IDs in Task 0; AWS renames bundles occasionally.
- Monthly budget alert: **US$25**, emailed at 80 % forecasted and 100 % actual.
- No secret (Django key, DB password, Firebase Admin key, ecoinvent credentials) may appear in git, in Terraform code, or in Terraform state.
- Public inbound ports: 80 and 443 only. SSH (22) is open only to `ssh_allowed_cidrs`. Postgres (5432), API (8000) and web (8080) are never exposed on the internet.
- Deploys ship **committed** code only (`git archive HEAD`).
- Local `docker-compose.yml` stays unchanged; `docker compose up` locally must keep working.

---

## Decisions

### Made (by you)

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Hosting shape | One Lightsail VM running Docker Compose | Closest to the local setup, cheapest (~$12/mo vs ~$30/mo for container service + managed DB), and the dump restore keeps working unchanged. |
| D2 | IaC tool | **Terraform** (OpenTofu works with the same files) | Readable `plan` diffs; can later manage non-AWS pieces (GitHub secrets, Firebase, DNS elsewhere) from the same code; skills transfer to ECS/RDS when this grows up. The cost is one S3 bucket for state, bootstrapped in Task 3. CloudFormation would avoid the state bucket but stays AWS-only and more verbose. Its Lightsail coverage is equivalent, so it was not a deciding factor. |
| D3 | DNS | Route 53 record `dev.<your-domain>` created by Terraform | Real hostname means a real Let's Encrypt cert and a stable Firebase authorized domain. |
| D4 | Deploy trigger | Manual `deploy/deploy.sh` | Zero CI setup. A GitHub Actions job can call the same script later. |

### Made in this plan (defaults — override before starting if you disagree)

| # | Decision | Default | Consequence / alternative |
|---|---|---|---|
| D5 | Build location | Images are built **on the instance** during deploy | Simple, no registry. Needs the 2 GB swap file (Task 3) because `ng build` peaks above 2 GB. Deploys take ~5–8 min. Alternative: build in CI and push to ECR, then run a 1 GB instance. |
| D6 | Single origin | Caddy serves the SPA and proxies `/api/*`, `/api-projects/*`, `/api-profiles/*` to Django | No CORS changes and no second hostname. The frontend gets a new `awsdev` build configuration whose API base is the relative path `/api-projects`. |
| D7 | Django admin | **Not** exposed publicly; reach it through an SSH tunnel (`deploy/README.md`) | The SPA already owns the `/admin` route, so the path would collide. Keeping admin off the internet is also safer. |
| D8 | Backups | Lightsail automatic daily snapshot at 08:00 UTC (02:00 Mexico City), last 7 kept | Whole-disk, crash-consistent. Fine for disposable dev data. Restoring means creating a new instance from the snapshot (runbook in Task 5). |
| D9 | Instance replacement guard | `lifecycle.ignore_changes = [user_data, blueprint_id, key_pair_name]` | Postgres data lives on the instance disk, so replacing the instance **wipes the DB**. Changing these fields must be a deliberate `-replace`, never a side effect. |
| D10 | Firebase project | Dev uses the **same** project the frontend is built for (`evamed-ac3f8`) and its admin key `evamed-ac3f8-firebase-adminsdk-ghc6k-*.json` (the one local compose mounts) | Dev sign-ins are real accounts in that project. The key's `project_id` **must** match the frontend's `firebaseConfig.projectId`, otherwise every token fails verification. Your notes mention migrating to `evamed-ac3f8-599c8`; if that happens first, switch both together. |
| D11 | Logs | Docker `json-file` capped at 10 MB × 3 per container | Without the cap, logs slowly fill the 60 GB disk. |
| D12 | OS patching | Ubuntu's default `unattended-upgrades` (security only). Container base images refresh on each `--build` | Kernel updates need a manual `sudo reboot` now and then; the stack restarts itself (`restart: unless-stopped`). |

### Gaps you should decide on (not blocking this plan)

1. **The API accepts anonymous writes.** Most `/api-projects/` viewsets (`TransportsViewSet`, `UsesViewSet`, materials, etc. in `backend/evamed-api/projects_api/views.py`) have no `permission_classes`, so DRF's default `AllowAny` applies. On a public hostname anyone can edit catalogue data, and new hostnames get scanned within minutes of their certificate appearing in Certificate Transparency logs. The plan accepts this for dev because the data is a re-seedable dump. Before anything real goes on this box, set `DEFAULT_PERMISSION_CLASSES` (write → `IsAuthenticated`) in a separate change.
2. **The runtime stack was end-of-life** when this plan was written: Postgres 12 (EOL Nov 2024), Python 3.8 (EOL Oct 2024), Django 2.2 (EOL Apr 2022). `docs/superpowers/plans/2026-09-11-runtime-upgrade.md` is that separate plan; its Task 4 moves local (and this template's) Postgres to **17**, so the `deploy/compose.aws.yml` above starts on `postgres:17-alpine` rather than 12. Django 5.2 refuses to connect below PostgreSQL 14, so a box built from this plan must never be seeded with an older image.
3. **Credential hygiene.** The ecoinvent credentials are marked "rotate" in `.env`; rotate them before putting them on a server. The Django `SECRET_KEY` in `settings.py` is committed, so dev gets a freshly generated one via env (Task 1). Use an IAM user or IAM Identity Center with MFA for Terraform, never the root account.
4. **What happens to Render?** This plan leaves `render.yml` and the Render deployment untouched. `environment.prod.ts` still points at Render. Decide separately whether AWS dev replaces Render's role.
5. **Separate AWS account?** Dev lives in whichever account your CLI profile points at. If that account will also host production later, consider AWS Organizations with a dedicated dev account. The budget alert in this plan is account-wide.
6. **Stale entries.** `CORS_ALLOWED_ORIGINS` still lists an old EC2 IP (`54.224.175.163`), and `materials.service.ts` has dead `*Fake` methods pointing at Heroku. They are harmless here, but worth deleting.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `backend/evamed-api/profiles_project/env.py` | Create | `env_bool` / `env_list` helpers for typed env settings |
| `backend/evamed-api/profiles_project/tests_env.py` | Create | Tests for the helpers and for env-driven settings |
| `backend/evamed-api/profiles_project/settings.py` | Modify | `SECRET_KEY`, `ALLOWED_HOSTS`, proxy-TLS header from env |
| `frontend/evamed/src/environments/environment.awsdev.ts` | Create | Prod-like environment with relative API base `/api-projects` |
| `frontend/evamed/angular.json` | Modify | New `awsdev` build configuration |
| `deploy/compose.aws.yml` | Create | Server compose stack: db, api, web, caddy |
| `deploy/Caddyfile` | Create | TLS + path routing |
| `deploy/.env.aws.example` | Create | Template for the server's secrets file |
| `deploy/dc.sh` | Create | `docker compose` pre-pointed at the dev stack (runs on the server) |
| `deploy/push-secrets.sh` | Create | Copies `.env` + Firebase key to the server |
| `deploy/deploy.sh` | Create | Ships `HEAD`, rebuilds, health-checks |
| `deploy/README.md` | Create | Runbook |
| `infra/bootstrap-state.sh` | Create | One-time S3 state bucket creation |
| `infra/dev/versions.tf` | Create | Terraform/provider pins, S3 backend, provider config |
| `infra/dev/variables.tf` | Create | Inputs |
| `infra/dev/main.tf` | Create | Lightsail, Route 53, budget |
| `infra/dev/outputs.tf` | Create | IP, URL, SSH command |
| `infra/dev/user-data.sh` | Create | First-boot provisioning (swap, Docker, dirs) |
| `infra/dev/terraform.tfvars.example` | Create | Example inputs |
| `.gitignore` | Modify | Ignore Terraform state/vars and `deploy/.env.aws` |

---

### Task 0: Prerequisites (manual, no commit)

**Files:** none

- [ ] **Step 1: AWS identity.** Sign in as a non-root IAM user (or IAM Identity Center user) with MFA and `AdministratorAccess` for now. Create a CLI profile:

```bash
aws configure --profile evamed-dev        # or: aws configure sso --profile evamed-dev
export AWS_PROFILE=evamed-dev
aws sts get-caller-identity
```

Expected: JSON with your `Account` and `Arn` (not `:root`).

- [ ] **Step 2: Install tools.** AWS CLI v2 and Terraform ≥ 1.10 (neither is installed in this WSL environment today).

```bash
# AWS CLI v2
curl -sSLo /tmp/awscliv2.zip https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip
unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install
# Terraform (HashiCorp apt repo)
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update && sudo apt-get install -y terraform
aws --version && terraform version
```

Expected: `aws-cli/2.x` and `Terraform v1.10` or newer.

- [ ] **Step 3: Confirm Lightsail IDs still exist.**

```bash
aws lightsail get-bundles --region us-east-1 \
  --query "bundles[?bundleId=='small_3_0'].[bundleId,price,ramSizeInGb]" --output table
aws lightsail get-blueprints --region us-east-1 \
  --query "blueprints[?blueprintId=='ubuntu_24_04'].[blueprintId,name]" --output table
```

Expected: one row each. If either is empty, pick the current 2 GB Linux bundle / Ubuntu 24.04 blueprint from the full list and use that ID in Task 3's `terraform.tfvars`.

- [ ] **Step 4: Confirm the hosted zone.**

```bash
aws route53 list-hosted-zones --query "HostedZones[?Config.PrivateZone==\`false\`].Name" --output text
```

Expected: your domain (e.g. `example.com.`). Pick the dev hostname now, e.g. `dev.example.com`.

- [ ] **Step 5: SSH key and your IP.**

```bash
ls ~/.ssh/id_ed25519.pub            # already exists on this machine
curl -s https://checkip.amazonaws.com   # your public IPv4 → use "<ip>/32" for ssh_allowed_cidrs
```

---

### Task 1: Env-driven Django settings

**Files:**
- Create: `backend/evamed-api/profiles_project/env.py`
- Create: `backend/evamed-api/profiles_project/tests_env.py`
- Modify: `backend/evamed-api/profiles_project/settings.py` (lines 1–26 and the end of file)

**Interfaces:**
- Produces: `env_bool(name: str, default: bool = False) -> bool`, `env_list(name: str, default: str = '') -> list[str]`.
- Produces env contract consumed by Task 2's `compose.aws.yml`: `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` (comma-separated), `DJANGO_BEHIND_TLS_PROXY` (`True`/`False`). All optional; when unset, behaviour is identical to today.

Tests run inside the existing local compose stack because Django needs Postgres. The API image copies code at build time, so rebuild it before each run.

- [ ] **Step 1: Write the failing tests**

`backend/evamed-api/profiles_project/tests_env.py`:

```python
import json
import os
import subprocess
import sys
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase

from profiles_project.env import env_bool, env_list


class EnvListTests(SimpleTestCase):
    def test_splits_and_strips_comma_separated_values(self):
        with mock.patch.dict(os.environ, {'X_TEST_LIST': ' a.com, localhost ,,'}):
            self.assertEqual(env_list('X_TEST_LIST'), ['a.com', 'localhost'])

    def test_uses_default_when_unset(self):
        with mock.patch.dict(os.environ):
            os.environ.pop('X_TEST_LIST', None)
            self.assertEqual(env_list('X_TEST_LIST', '*'), ['*'])

    def test_empty_value_gives_empty_list(self):
        with mock.patch.dict(os.environ, {'X_TEST_LIST': ''}):
            self.assertEqual(env_list('X_TEST_LIST', '*'), [])


class EnvBoolTests(SimpleTestCase):
    def test_truthy_spellings(self):
        for raw in ('True', 'true', '1', 'yes', ' on '):
            with mock.patch.dict(os.environ, {'X_TEST_BOOL': raw}):
                self.assertTrue(env_bool('X_TEST_BOOL'), raw)

    def test_other_values_are_false(self):
        for raw in ('False', '0', 'no', ''):
            with mock.patch.dict(os.environ, {'X_TEST_BOOL': raw}):
                self.assertFalse(env_bool('X_TEST_BOOL', default=True), raw)

    def test_uses_default_when_unset(self):
        with mock.patch.dict(os.environ):
            os.environ.pop('X_TEST_BOOL', None)
            self.assertTrue(env_bool('X_TEST_BOOL', default=True))


class SettingsFromEnvTests(SimpleTestCase):
    """Load settings.py in a fresh interpreter so module-level reads see our env."""

    def load_settings(self, **overrides):
        env = {k: v for k, v in os.environ.items() if not k.startswith('DJANGO_')}
        env.update(DJANGO_SETTINGS_MODULE='profiles_project.settings', **overrides)
        code = (
            'import json; from django.conf import settings as s; '
            'print(json.dumps({"key": s.SECRET_KEY, "hosts": s.ALLOWED_HOSTS, '
            '"proxy": getattr(s, "SECURE_PROXY_SSL_HEADER", None)}))'
        )
        out = subprocess.check_output([sys.executable, '-c', code], env=env, cwd=settings.BASE_DIR)
        return json.loads(out)

    def test_defaults_match_previous_behaviour(self):
        loaded = self.load_settings()
        self.assertEqual(loaded['hosts'], ['*'])
        self.assertIsNone(loaded['proxy'])

    def test_secret_key_from_env(self):
        self.assertEqual(self.load_settings(DJANGO_SECRET_KEY='from-env')['key'], 'from-env')

    def test_allowed_hosts_from_env(self):
        loaded = self.load_settings(DJANGO_ALLOWED_HOSTS='dev.example.com,localhost')
        self.assertEqual(loaded['hosts'], ['dev.example.com', 'localhost'])

    def test_trusts_forwarded_proto_behind_tls_proxy(self):
        loaded = self.load_settings(DJANGO_BEHIND_TLS_PROXY='True')
        self.assertEqual(loaded['proxy'], ['HTTP_X_FORWARDED_PROTO', 'https'])
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /home/maikolkali/evamed-monorepo
docker compose build api
docker compose run --rm api python manage.py test profiles_project.tests_env -v 2
```

Expected: FAIL / ERROR with `ModuleNotFoundError: No module named 'profiles_project.env'`.

- [ ] **Step 3: Create the helpers**

`backend/evamed-api/profiles_project/env.py`:

```python
"""Typed readers for settings that come from the environment."""
import os


def env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(',') if item.strip()]
```

- [ ] **Step 4: Wire them into `settings.py`**

In `backend/evamed-api/profiles_project/settings.py`, after `import os` (line 12) add:

```python
from profiles_project.env import env_bool, env_list
```

Replace line 22:

```python
SECRET_KEY = '25&!(c13l4!5kwt_9(#uh1bd&^@je)im*iw0$@seh3lrox%zw)'
```

with:

```python
# The fallback is the historical committed key: fine for local docker only.
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '25&!(c13l4!5kwt_9(#uh1bd&^@je)im*iw0$@seh3lrox%zw)')
```

Replace line 27 `ALLOWED_HOSTS = ['*']` with:

```python
ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', '*')
```

Append at the end of the file:

```python

# Behind Caddy on AWS: trust its X-Forwarded-Proto so request.is_secure() and
# DRF's absolute URLs use https.
if env_bool('DJANGO_BEHIND_TLS_PROXY'):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
docker compose build api
docker compose run --rm api python manage.py test profiles_project.tests_env -v 2
```

Expected: `Ran 10 tests ... OK`.

- [ ] **Step 6: Run the whole backend suite (no regressions)**

```bash
docker compose run --rm api python manage.py test -v 1
```

Expected: `OK` (same pass count as before this task plus 10).

- [ ] **Step 7: Commit**

```bash
git add backend/evamed-api/profiles_project/env.py backend/evamed-api/profiles_project/tests_env.py backend/evamed-api/profiles_project/settings.py
git commit -m "feat(api): read secret key, allowed hosts and proxy TLS from env"
```

---

### Task 2: Frontend `awsdev` build + server compose stack (local smoke test)

**Files:**
- Create: `frontend/evamed/src/environments/environment.awsdev.ts`
- Modify: `frontend/evamed/angular.json` (`projects.evamed.architect.build.configurations`)
- Create: `deploy/compose.aws.yml`, `deploy/Caddyfile`, `deploy/.env.aws.example`, `deploy/dc.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1 env contract (`DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_BEHIND_TLS_PROXY`).
- Produces for Tasks 4–5: the compose file at `deploy/compose.aws.yml` (project name `evamed`), which interpolates `SITE_DOMAIN`, `DB_PASSWORD`, `DJANGO_SECRET_KEY`, `FIREBASE_KEY_FILE` (all required) and `ECOINVENT_*` (optional) from an `--env-file`. `deploy/dc.sh` wraps it with the server paths `/opt/evamed/src` and `/opt/evamed/secrets/.env`.

- [ ] **Step 1: Create the `awsdev` environment from prod, swapping only the API base**

```bash
cd /home/maikolkali/evamed-monorepo/frontend/evamed
sed "s#'https://evamed-api-vlx1.onrender.com/api-projects'#'/api-projects'#" \
  src/environments/environment.prod.ts > src/environments/environment.awsdev.ts
diff src/environments/environment.prod.ts src/environments/environment.awsdev.ts
```

Expected diff: exactly one changed line; the new line is `const apiEvamed = '/api-projects',`.

- [ ] **Step 2: Add the `awsdev` configuration to `angular.json`**

Inside `projects.evamed.architect.build.configurations`, after the `"docker": { ... }` object, add (mind the comma after `docker`'s closing brace):

```json
"awsdev": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.awsdev.ts"
    }
  ],
  "optimization": true,
  "outputHashing": "all",
  "sourceMap": false,
  "namedChunks": false,
  "extractLicenses": true,
  "budgets": [
    { "type": "initial", "maximumWarning": "2mb", "maximumError": "5mb" },
    { "type": "anyComponentStyle", "maximumWarning": "6kb", "maximumError": "10kb" }
  ]
}
```

Check it parses: `python3 -c "import json;print(list(json.load(open('angular.json'))['projects']['evamed']['architect']['build']['configurations']))"` → includes `'awsdev'`.

- [ ] **Step 3: Verify the build bakes in the relative API base**

```bash
cd /home/maikolkali/evamed-monorepo
docker build --build-arg NG_CONFIGURATION=awsdev -t evamed-web:awsdev frontend/evamed
docker run --rm evamed-web:awsdev sh -c \
  'grep -l "onrender.com" dist/evamed/*.js && echo LEAK || echo NO_RENDER; grep -l "/api-projects" dist/evamed/*.js | head -1'
```

Expected: `NO_RENDER`, then one `main-*.js` filename.

- [ ] **Step 4: Create `deploy/Caddyfile`**

```caddyfile
{$SITE_DOMAIN} {
	encode zstd gzip

	# Django API. /admin is deliberately absent: the SPA owns that route and
	# Django admin is reached over an SSH tunnel instead (see README).
	@api path /api/* /api-projects/* /api-profiles/*
	handle @api {
		reverse_proxy api:8000
	}

	handle {
		reverse_proxy web:8080
	}
}
```

- [ ] **Step 5: Create `deploy/compose.aws.yml`**

```yaml
# Dev stack on the Lightsail instance. Paths are relative to this file.
# Run through deploy/dc.sh on the server; see deploy/README.md.
name: evamed

services:
  db:
    # PostgreSQL 17: Django 5.2 refuses to connect to anything below 14, and the
    # seed `backup` is a custom-format dump that pg_restore 17 reads fine.
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: evamed_total
      POSTGRES_USER: myprojectuser
      # Only applied when the volume is first created.
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be set}
    volumes:
      - db_data:/var/lib/postgresql/data
      - ../backend/evamed-api/backup:/docker-entrypoint-initdb.d/backup:ro
      - ../backend/evamed-api/docker/postgres/initdb/01-restore.sh:/docker-entrypoint-initdb.d/01-restore.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myprojectuser -d evamed_total"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: ../backend/evamed-api
    command: sh -c "python manage.py collectstatic --noinput && python manage.py migrate && gunicorn profiles_project.wsgi:application -c /app/gunicorn.conf.py"
    restart: unless-stopped
    environment:
      DB_NAME: evamed_total
      DB_USER: myprojectuser
      DB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD must be set}
      DB_HOST: db
      DB_PORT: "5432"
      DJANGO_DEBUG: "False"
      DJANGO_SECRET_KEY: ${DJANGO_SECRET_KEY:?DJANGO_SECRET_KEY must be set}
      # localhost: healthcheck and the SSH-tunnelled admin.
      DJANGO_ALLOWED_HOSTS: ${SITE_DOMAIN:?SITE_DOMAIN must be set},localhost,127.0.0.1
      DJANGO_BEHIND_TLS_PROXY: "True"
      GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/firebase.json
      ECOINVENT_CLIENT_ID: ${ECOINVENT_CLIENT_ID:-}
      ECOINVENT_CLIENT_SECRET: ${ECOINVENT_CLIENT_SECRET:-}
      ECOINVENT_VERSION: ${ECOINVENT_VERSION:-3.12-sandbox}
      ECOINVENT_ALLOW_PRODUCTION: "False"
    volumes:
      - ${FIREBASE_KEY_FILE:?FIREBASE_KEY_FILE must be set}:/run/secrets/firebase.json:ro
    # Loopback only: reachable through `ssh -L`, never from the internet.
    ports:
      - "127.0.0.1:8000:8000"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/', timeout=3)"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 60s
    depends_on:
      db:
        condition: service_healthy

  web:
    build:
      context: ../frontend/evamed
      args:
        NG_CONFIGURATION: awsdev
    restart: unless-stopped
    environment:
      PORT: "8080"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    environment:
      SITE_DOMAIN: ${SITE_DOMAIN:?SITE_DOMAIN must be set}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy
      web:
        condition: service_started

volumes:
  db_data:
  caddy_data:     # holds the Let's Encrypt account + certs; keep it to avoid rate limits
  caddy_config:
```

- [ ] **Step 6: Create `deploy/.env.aws.example`**

```bash
# Copy to deploy/.env.aws (gitignored), fill in, then run deploy/push-secrets.sh.
# It is uploaded to /opt/evamed/secrets/.env on the server.

# Public hostname; must match Terraform's domain_name.
SITE_DOMAIN=dev.example.com

# Generate each with: python3 -c "import secrets; print(secrets.token_urlsafe(50))"
# DB_PASSWORD only takes effect when the db volume is first created.
DB_PASSWORD=
DJANGO_SECRET_KEY=

# Where push-secrets.sh puts the Firebase Admin key on the server. Leave as is.
FIREBASE_KEY_FILE=/opt/evamed/secrets/firebase.json

# Optional: ecoinvent (see backend/evamed-api/README.md). Rotated creds only.
ECOINVENT_CLIENT_ID=
ECOINVENT_CLIENT_SECRET=
ECOINVENT_VERSION=3.12-sandbox
```

- [ ] **Step 7: Create `deploy/dc.sh` and make it executable**

```bash
#!/usr/bin/env bash
# docker compose, pre-pointed at the dev stack. Runs ON THE SERVER, e.g.:
#   bash /opt/evamed/src/deploy/dc.sh logs -f api
set -euo pipefail
exec docker compose -f /opt/evamed/src/deploy/compose.aws.yml --env-file /opt/evamed/secrets/.env "$@"
```

```bash
chmod +x deploy/dc.sh
```

- [ ] **Step 8: Ignore secrets and Terraform artifacts**

Append to `/home/maikolkali/evamed-monorepo/.gitignore`:

```gitignore

# AWS dev deploy
deploy/.env.aws
infra/**/.terraform/
*.tfstate
*.tfstate.*
*.tfvars
!*.tfvars.example
```

Check: `git check-ignore -v deploy/.env.aws infra/dev/terraform.tfvars` → both reported as ignored.

- [ ] **Step 9: Local smoke test of the full AWS stack**

Uses `SITE_DOMAIN=localhost`, so Caddy issues a certificate from its own internal CA and serves real TLS. Stop the normal local stack first if it's running (`docker compose down`); ports 80/443 must be free.

```bash
cd /home/maikolkali/evamed-monorepo
SMOKE="$(mktemp)"
cat > "$SMOKE" <<EOF
SITE_DOMAIN=localhost
DB_PASSWORD=smoke-db-password
DJANGO_SECRET_KEY=smoke-secret-key
FIREBASE_KEY_FILE=$PWD/evamed-ac3f8-firebase-adminsdk-ghc6k-666be23c6d.json
EOF
docker compose -f deploy/compose.aws.yml --env-file "$SMOKE" -p evamed-smoke up -d --build
docker compose -f deploy/compose.aws.yml --env-file "$SMOKE" -p evamed-smoke ps
```

Expected: `db`, `api` show `healthy`; `web`, `caddy` `running`. The first start restores the dump, so allow ~1–2 minutes.

```bash
curl -sk https://localhost/api/health/                                   # {"status": "ok"}
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/api-projects/countries/   # 200
curl -sk https://localhost/ | grep -c '<app-root'                         # 1
curl -sk https://localhost/admin-materials | grep -c '<app-root'          # 1 (SPA deep link, not Django)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost/   # 308 https://localhost/
```

Then open `https://localhost/` in a browser (accept the local-CA warning), log in, open a project's results page, and confirm API calls in DevTools go to `https://localhost/api-projects/...` with no CORS errors.

Tear down (removes smoke volumes only):

```bash
docker compose -f deploy/compose.aws.yml --env-file "$SMOKE" -p evamed-smoke down -v
```

- [ ] **Step 10: Commit**

```bash
git add frontend/evamed/src/environments/environment.awsdev.ts frontend/evamed/angular.json \
  deploy/compose.aws.yml deploy/Caddyfile deploy/.env.aws.example deploy/dc.sh .gitignore
git commit -m "feat(deploy): add awsdev frontend build and Caddy-fronted compose stack"
```

---

### Task 3: Terraform for the Lightsail dev environment (write + plan)

**Files:**
- Create: `infra/bootstrap-state.sh`, `infra/dev/versions.tf`, `infra/dev/variables.tf`, `infra/dev/main.tf`, `infra/dev/outputs.tf`, `infra/dev/user-data.sh`, `infra/dev/terraform.tfvars.example`

**Interfaces:**
- Produces for Task 4: outputs `static_ip` (string), `url` (string `https://<domain_name>`), `ssh_command` (string). The instance has `/opt/evamed` (owned by `ubuntu`) and `/opt/evamed/secrets` (mode 700), plus Docker and Compose v2, and the `ubuntu` user is in the `docker` group.

- [ ] **Step 1: Create `infra/bootstrap-state.sh`**

```bash
#!/usr/bin/env bash
# One-time: create the S3 bucket that holds Terraform state. Safe to re-run.
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="evamed-tfstate-${ACCOUNT}"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "bucket $BUCKET already exists"
elif [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi

aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

cat > "$(dirname "$0")/dev/backend.hcl" <<EOF
bucket = "$BUCKET"
region = "$REGION"
EOF
echo "wrote infra/dev/backend.hcl for bucket $BUCKET"
```

```bash
chmod +x infra/bootstrap-state.sh
```

- [ ] **Step 2: Create `infra/dev/versions.tf`**

```hcl
terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # bucket/region come from backend.hcl (written by ../bootstrap-state.sh).
  # use_lockfile = S3-native state locking; no DynamoDB table needed.
  backend "s3" {
    key          = "evamed/dev/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "evamed"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
```

- [ ] **Step 3: Create `infra/dev/variables.tf`**

```hcl
variable "region" {
  description = "AWS region for Lightsail."
  type        = string
  default     = "us-east-1"
}

variable "hosted_zone_name" {
  description = "Existing public Route 53 zone, e.g. example.com"
  type        = string
}

variable "domain_name" {
  description = "Hostname for the dev environment, e.g. dev.example.com"
  type        = string

  validation {
    condition     = endswith(var.domain_name, ".${var.hosted_zone_name}")
    error_message = "domain_name must be a subdomain of hosted_zone_name."
  }
}

variable "bundle_id" {
  description = "Lightsail bundle. small_3_0 = 2 GB RAM (needed to build Angular on the box)."
  type        = string
  default     = "small_3_0"
}

variable "blueprint_id" {
  description = "Lightsail OS image."
  type        = string
  default     = "ubuntu_24_04"
}

variable "ssh_public_key_path" {
  description = "Public key installed for the ubuntu user. The private key never leaves your machine."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_allowed_cidrs" {
  description = "CIDRs allowed to reach port 22, e.g. [\"203.0.113.7/32\"]."
  type        = list(string)

  validation {
    condition     = !contains(var.ssh_allowed_cidrs, "0.0.0.0/0")
    error_message = "Do not open SSH to the whole internet."
  }
}

variable "alert_email" {
  description = "Receives AWS Budgets alerts."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Account-wide monthly cost budget."
  type        = string
  default     = "25"
}
```

The `validation` on `domain_name` references another variable, which requires Terraform ≥ 1.9. That is covered by the `>= 1.10` pin.

- [ ] **Step 4: Create `infra/dev/user-data.sh`**

```bash
#!/bin/bash
# First-boot provisioning for the EVAmed dev instance. Runs once as root.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

# 2 GB swap: the Angular production build peaks above the 2 GB of RAM.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update
apt-get install -y docker.io docker-compose-v2

# Cap container logs; the default json-file driver grows without limit.
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl enable docker
systemctl restart docker
usermod -aG docker ubuntu

install -d -o ubuntu -g ubuntu -m 755 /opt/evamed
install -d -o ubuntu -g ubuntu -m 700 /opt/evamed/secrets
```

- [ ] **Step 5: Create `infra/dev/main.tf`**

```hcl
locals {
  name = "evamed-dev"
}

resource "aws_lightsail_key_pair" "deploy" {
  name       = "${local.name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_lightsail_instance" "app" {
  name              = local.name
  availability_zone = "${var.region}a"
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.deploy.name
  ip_address_type   = "ipv4"
  user_data         = file("${path.module}/user-data.sh")

  add_on {
    type          = "AutoSnapshot"
    snapshot_time = "08:00" # UTC = 02:00 Mexico City
    status        = "Enabled"
  }

  lifecycle {
    # Postgres lives on this disk: replacing the instance wipes the DB.
    # Replace deliberately with `terraform apply -replace=...` instead.
    ignore_changes = [user_data, blueprint_id, key_pair_name]
  }
}

resource "aws_lightsail_static_ip" "app" {
  name = "${local.name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.name
  instance_name  = aws_lightsail_instance.app.name
}

# Replaces Lightsail's default firewall (22 + 80 open to all) entirely.
resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_allowed_cidrs
  }

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"]
  }
}

data "aws_route53_zone" "main" {
  name         = var.hosted_zone_name
  private_zone = false
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_lightsail_static_ip.app.ip_address]
}

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
```

- [ ] **Step 6: Create `infra/dev/outputs.tf`**

```hcl
output "static_ip" {
  value = aws_lightsail_static_ip.app.ip_address
}

output "url" {
  value = "https://${var.domain_name}"
}

output "ssh_command" {
  value = "ssh ubuntu@${var.domain_name}"
}
```

- [ ] **Step 7: Create `infra/dev/terraform.tfvars.example`**

```hcl
# Copy to terraform.tfvars (gitignored) and fill in.
hosted_zone_name  = "example.com"
domain_name       = "dev.example.com"
ssh_allowed_cidrs = ["203.0.113.7/32"] # curl -s https://checkip.amazonaws.com
alert_email       = "you@example.com"
# region            = "us-east-1"
# bundle_id         = "small_3_0"
```

- [ ] **Step 8: Bootstrap state, init, validate**

```bash
cd /home/maikolkali/evamed-monorepo
export AWS_PROFILE=evamed-dev
./infra/bootstrap-state.sh
cd infra/dev
cp terraform.tfvars.example terraform.tfvars   # then edit with real values
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive
terraform validate
```

Expected: `wrote infra/dev/backend.hcl ...`; `Terraform has been successfully initialized!`; `fmt` prints nothing; `Success! The configuration is valid.`

- [ ] **Step 9: Plan (no changes applied yet)**

```bash
terraform plan -out=dev.tfplan
```

Expected: `Plan: 7 to add, 0 to change, 0 to destroy.` (key pair, instance, static IP, attachment, public ports, Route 53 record, budget). Read it and check that no secret values appear.

- [ ] **Step 10: Commit** (`backend.hcl` holds only the bucket name and region, which aren't secret; commit it so the next person doesn't have to bootstrap again)

```bash
cd /home/maikolkali/evamed-monorepo
git add infra/bootstrap-state.sh infra/dev/versions.tf infra/dev/variables.tf infra/dev/main.tf \
  infra/dev/outputs.tf infra/dev/user-data.sh infra/dev/terraform.tfvars.example \
  infra/dev/backend.hcl infra/dev/.terraform.lock.hcl
git commit -m "feat(infra): terraform for lightsail dev environment"
```

---

### Task 4: Provision the instance and verify the host

**Files:** none new (applies Task 3)

**Interfaces:**
- Consumes: Task 3 outputs.
- Produces for Task 5: a reachable `ubuntu@<domain_name>` with Docker and Compose working and `/opt/evamed/secrets` in place.

- [ ] **Step 1: Apply**

```bash
cd /home/maikolkali/evamed-monorepo/infra/dev
terraform apply dev.tfplan
terraform output
```

Expected: `Apply complete! Resources: 7 added`, with outputs for `static_ip`, `url` and `ssh_command`. Confirm the AWS Budgets subscription email if one arrives.

- [ ] **Step 2: DNS resolves to the static IP**

```bash
dig +short "$(terraform output -raw url | sed 's#https://##')"
```

Expected: the `static_ip` value. It can take a few minutes the first time.

- [ ] **Step 3: First boot finished and host is ready**

```bash
export EVAMED_DEV_HOST=dev.example.com     # your domain_name
ssh -o StrictHostKeyChecking=accept-new ubuntu@$EVAMED_DEV_HOST \
  'cloud-init status --wait; docker compose version; swapon --show; ls -ld /opt/evamed /opt/evamed/secrets; cat /etc/docker/daemon.json'
```

Expected: `status: done`; `Docker Compose version v2.x`; a `/swapfile` of 2G; `/opt/evamed` owned by `ubuntu`; `/opt/evamed/secrets` mode `drwx------`; the log-opts JSON. If `cloud-init status` shows `error`, read `/var/log/cloud-init-output.log` on the box.

- [ ] **Step 4: Firewall check (from your machine)**

```bash
nc -zv -w 3 $EVAMED_DEV_HOST 8000 ; nc -zv -w 3 $EVAMED_DEV_HOST 5432
```

Expected: both time out or are refused.

- [ ] **Step 5: Re-plan is clean**

```bash
terraform plan
```

Expected: `No changes. Your infrastructure matches the configuration.`

No commit (nothing changed in the repo).

---

### Task 5: Secrets push, deploy script, first deploy, runbook

**Files:**
- Create: `deploy/push-secrets.sh`, `deploy/deploy.sh`, `deploy/README.md`

**Interfaces:**
- Consumes: `EVAMED_DEV_HOST` env var; `deploy/compose.aws.yml` and `deploy/dc.sh` from Task 2; the server layout from Task 4.

- [ ] **Step 1: Create `deploy/push-secrets.sh`**

```bash
#!/usr/bin/env bash
# Upload the dev server's secrets. Run once, and again after rotating anything.
#   EVAMED_DEV_HOST=dev.example.com EVAMED_FIREBASE_KEY=path/to/key.json deploy/push-secrets.sh
set -euo pipefail
cd "$(dirname "$0")"
HOST="${EVAMED_DEV_HOST:?set EVAMED_DEV_HOST, e.g. dev.example.com}"
FIREBASE_KEY="${EVAMED_FIREBASE_KEY:?set EVAMED_FIREBASE_KEY to the Firebase Admin SDK JSON}"
ENV_FILE=.env.aws

[ -f "$ENV_FILE" ] || { echo "missing deploy/$ENV_FILE; copy .env.aws.example" >&2; exit 1; }
for var in SITE_DOMAIN DB_PASSWORD DJANGO_SECRET_KEY FIREBASE_KEY_FILE; do
  grep -qE "^${var}=.+" "$ENV_FILE" || { echo "$var is empty in deploy/$ENV_FILE" >&2; exit 1; }
done

scp "$ENV_FILE" "ubuntu@$HOST:/opt/evamed/secrets/.env"
scp "$FIREBASE_KEY" "ubuntu@$HOST:/opt/evamed/secrets/firebase.json"
ssh "ubuntu@$HOST" 'chmod 600 /opt/evamed/secrets/.env /opt/evamed/secrets/firebase.json'
echo "secrets uploaded to $HOST:/opt/evamed/secrets"
```

- [ ] **Step 2: Create `deploy/deploy.sh`**

```bash
#!/usr/bin/env bash
# Ship the committed HEAD to the dev server, rebuild, and health-check.
#   EVAMED_DEV_HOST=dev.example.com deploy/deploy.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
HOST="${EVAMED_DEV_HOST:?set EVAMED_DEV_HOST, e.g. dev.example.com}"
SSH=(ssh -o StrictHostKeyChecking=accept-new "ubuntu@$HOST")
REV="$(git rev-parse --short HEAD)"

if ! git diff --quiet HEAD; then
  echo "warning: uncommitted changes are NOT deployed; shipping $REV" >&2
fi

echo "==> uploading $REV"
git archive --format=tar HEAD | "${SSH[@]}" "set -e
  rm -rf /opt/evamed/src.new && mkdir -p /opt/evamed/src.new
  tar -x -C /opt/evamed/src.new
  echo $REV > /opt/evamed/src.new/REVISION
  rm -rf /opt/evamed/src && mv /opt/evamed/src.new /opt/evamed/src"

echo "==> building and starting (first run restores the DB dump; allow ~10 min)"
"${SSH[@]}" "bash /opt/evamed/src/deploy/dc.sh up -d --build --remove-orphans && docker image prune -f"

echo "==> health check"
for _ in $(seq 1 36); do
  if curl -fsS "https://$HOST/api/health/" >/dev/null 2>&1; then
    echo "ok: $REV is live at https://$HOST"
    exit 0
  fi
  sleep 5
done
echo "health check failed; logs: ssh ubuntu@$HOST 'bash /opt/evamed/src/deploy/dc.sh logs --tail=100'" >&2
exit 1
```

```bash
chmod +x deploy/push-secrets.sh deploy/deploy.sh
```

- [ ] **Step 3: Fill secrets and push them**

```bash
cd /home/maikolkali/evamed-monorepo
cp deploy/.env.aws.example deploy/.env.aws
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # → DB_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # → DJANGO_SECRET_KEY
# edit deploy/.env.aws: SITE_DOMAIN, DB_PASSWORD, DJANGO_SECRET_KEY
export EVAMED_DEV_HOST=dev.example.com
EVAMED_FIREBASE_KEY=evamed-ac3f8-firebase-adminsdk-ghc6k-666be23c6d.json deploy/push-secrets.sh
```

Expected: `secrets uploaded to dev.example.com:/opt/evamed/secrets`.

- [ ] **Step 4: Authorize the dev domain in Firebase (manual, console)**

Firebase console → project `evamed-ac3f8` → Authentication → Settings → **Authorized domains** → Add `dev.example.com`. Without it, sign-in fails with `auth/unauthorized-domain`.

- [ ] **Step 5: First deploy**

Commit the scripts first, since deploy ships `HEAD`:

```bash
git add deploy/push-secrets.sh deploy/deploy.sh
git commit -m "feat(deploy): secrets push and deploy scripts for lightsail dev"
deploy/deploy.sh
```

Expected: ends with `ok: <rev> is live at https://dev.example.com`.

- [ ] **Step 6: End-to-end verification**

```bash
curl -s https://$EVAMED_DEV_HOST/api/health/                                        # {"status": "ok"}
curl -s -o /dev/null -w '%{http_code}\n' https://$EVAMED_DEV_HOST/api-projects/countries/   # 200
echo | openssl s_client -connect $EVAMED_DEV_HOST:443 -servername $EVAMED_DEV_HOST 2>/dev/null \
  | openssl x509 -noout -issuer                                                     # issuer: ... Let's Encrypt
ssh ubuntu@$EVAMED_DEV_HOST 'cat /opt/evamed/src/REVISION; bash /opt/evamed/src/deploy/dc.sh ps'
```

Expected: health OK, 200, Let's Encrypt issuer, REVISION equals `git rev-parse --short HEAD`, all four services up (`db`/`api` healthy).

In a browser, open `https://dev.example.com`, sign in with Google, open a project's results page, and confirm DevTools shows `/api-projects/...` requests returning 2xx with no CORS or mixed-content errors.

- [ ] **Step 7: Redeploy is idempotent and keeps data**

```bash
deploy/deploy.sh
ssh ubuntu@$EVAMED_DEV_HOST "bash /opt/evamed/src/deploy/dc.sh exec -T db psql -U myprojectuser -d evamed_total -tAc 'select count(*) from projects_api_material'"
```

Expected: second deploy succeeds; the material count is non-zero and the same before and after (the volume survived).

- [ ] **Step 8: Write `deploy/README.md`**

````markdown
# EVAmed dev on AWS Lightsail

One Lightsail instance runs `deploy/compose.aws.yml` (Postgres, Django, Angular, Caddy).
Infra lives in `infra/dev` (Terraform). Plan and decisions:
`docs/superpowers/plans/2026-09-11-aws-lightsail-dev-deploy.md`.

```bash
export AWS_PROFILE=evamed-dev
export EVAMED_DEV_HOST=dev.example.com   # terraform -chdir=infra/dev output url
```

## Deploy

Commit, then run `deploy/deploy.sh`. It ships `HEAD` only; uncommitted changes are skipped with a warning.

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

## Kernel updates

Security patches install automatically. When `ssh` greets you with "System restart required",
run `sudo reboot`; the stack comes back on its own.

## Cost

About US$12/month for the instance, plus snapshot storage (~US$0.05/GB-month), Route 53 queries, and pennies for S3 state.
A budget alert emails at 80 % of US$25 (forecast) and at 100 % (actual).

## Tear down

```bash
terraform -chdir=infra/dev destroy
```

This deletes the instance **and its database**. Automatic snapshots are deleted with the instance;
take a manual snapshot first if you want to keep one.
````

- [ ] **Step 9: Commit**

```bash
git add deploy/README.md
git commit -m "docs(deploy): runbook for the lightsail dev environment"
```

---

## Self-review notes

- **Coverage:** each decision is implemented: D1/D3/D8/D9 in Task 3, D2 in Tasks 3–4, D4 in Task 5, D5/D6/D7/D11 in Task 2 (plus D11/D12 via `user-data.sh`), and D10 in Task 5 Steps 3–4. The open "Gaps" are deliberately out of scope and listed above.
- **Names used across tasks:** `EVAMED_DEV_HOST`, `EVAMED_FIREBASE_KEY`, `/opt/evamed/src`, `/opt/evamed/secrets/.env`, `/opt/evamed/secrets/firebase.json`, compose project `evamed`, volume `evamed_db_data`, `deploy/dc.sh`, configuration `awsdev`.
- **Known risk:** Lightsail auto-snapshot deletion on instance delete and the exact bundle IDs are AWS behaviours that change over time. Task 0 Step 3 and the runbook call them out rather than assume them.
