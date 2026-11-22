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

# The upload replaces /opt/evamed/src, but a running Caddy keeps its bind mount
# on the old (deleted) Caddyfile and `up -d` doesn't recreate it when only that
# file changed, so Caddyfile edits never applied. Validate the new file first
# (a bad one fails the deploy with the site untouched), then recreate Caddy
# only when the file changed. Its certificates live in a volume.
echo "==> Caddy config"
"${SSH[@]}" 'set -e
  new=$(sha256sum /opt/evamed/src/deploy/Caddyfile | cut -d" " -f1)
  old=$(cat /opt/evamed/caddyfile.sha256 2>/dev/null || true)
  if [ "$new" = "$old" ]; then echo "unchanged"; exit 0; fi
  docker run --rm -e SITE_DOMAIN=localhost -v /opt/evamed/src/deploy/Caddyfile:/etc/caddy/Caddyfile:ro \
    caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  bash /opt/evamed/src/deploy/dc.sh up -d --force-recreate --no-deps caddy
  echo "$new" > /opt/evamed/caddyfile.sha256
  echo "reloaded"'

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
