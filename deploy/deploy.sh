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
