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
