#!/usr/bin/env bash
# docker compose, pre-pointed at the dev stack. Runs ON THE SERVER, e.g.:
#   bash /opt/evamed/src/deploy/dc.sh logs -f api
set -euo pipefail
exec docker compose -f /opt/evamed/src/deploy/compose.aws.yml --env-file /opt/evamed/secrets/.env "$@"
