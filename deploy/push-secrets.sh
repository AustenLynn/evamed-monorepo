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
