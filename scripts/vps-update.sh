#!/bin/bash
# Pull main, rebuild, restart hoopstat. Safe on the shared VPS (own Node/Go under /opt/hoopstat/tools).
set -euo pipefail

ROOT=/opt/hoopstat/app
export PATH=/opt/hoopstat/tools/node/bin:/opt/hoopstat/tools/go/bin:$PATH

cd "$ROOT"
git fetch --prune origin
git checkout -q main
git pull --ff-only origin main

npm ci
npm run build
mkdir -p /opt/hoopstat/bin
(cd backend && CGO_ENABLED=0 go build -o /opt/hoopstat/bin/hoopstat ./cmd/api)

sudo cp "$ROOT/deploy/hoopstat.service" /etc/systemd/system/hoopstat.service
sudo systemctl daemon-reload
sudo systemctl enable hoopstat
sudo systemctl restart hoopstat
sudo systemctl --no-pager --full status hoopstat
