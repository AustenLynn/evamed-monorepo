#!/usr/bin/env bash
# Run a command that needs SSH to the dev server from wherever you are: opens
# port 22 for your current IP, runs the command, and closes it again on exit.
#   AWS_PROFILE=evamed-dev deploy/with-ssh.sh ssh ubuntu@dev.evamediber.click
#   AWS_PROFILE=evamed-dev EVAMED_DEV_HOST=dev.evamediber.click deploy/with-ssh.sh deploy/deploy.sh
set -euo pipefail
[ $# -gt 0 ] || { echo "usage: deploy/with-ssh.sh <command> [args...]" >&2; exit 2; }
HOST="${EVAMED_DEV_HOST:-dev.evamediber.click}"
INSTANCE="${EVAMED_INSTANCE:-evamed-dev}"
export AWS_REGION="${AWS_REGION:-us-east-1}"

CIDR="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')/32"
PORT_INFO="fromPort=22,toPort=22,protocol=tcp,cidrs=$CIDR"

close_port() {
  aws lightsail close-instance-public-ports --instance-name "$INSTANCE" --port-info "$PORT_INFO" >/dev/null \
    || echo "warning: could not close port 22 for $CIDR; the next CI deploy or terraform apply will" >&2
}

echo "==> opening port 22 for $CIDR" >&2
aws lightsail open-instance-public-ports --instance-name "$INSTANCE" --port-info "$PORT_INFO" >/dev/null
trap close_port EXIT

# Lightsail firewall changes take a few seconds to apply.
for _ in $(seq 1 12); do
  timeout 5 bash -c "</dev/tcp/$HOST/22" 2>/dev/null && break
  sleep 5
done

"$@"
