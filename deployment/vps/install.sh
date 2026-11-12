#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bitte mit sudo ausführen: sudo bash deployment/vps/install.sh"
  exit 1
fi

APP_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="/opt/akhi-ai"
ENV_DIR="/etc/akhi-ai"
ENV_FILE="${ENV_DIR}/akhi-ai.env"
SERVICE_FILE="/etc/systemd/system/akhi-ai.service"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js fehlt. Bitte zuerst Node.js 20 oder neuer installieren. Es wird nichts am System verändert."
  exit 1
fi
NODE_BIN="$(command -v node)"
NODE_MAJOR="$("$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ benötigt; gefunden: $("$NODE_BIN" --version). Abbruch ohne Änderungen."
  exit 1
fi

if ! id akhi-ai >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin akhi-ai
fi
install -d -o root -g akhi-ai -m 0750 "$APP_DIR" "$ENV_DIR"
install -o root -g akhi-ai -m 0640 "$APP_SOURCE/server.js" "$APP_DIR/server.js"
install -o root -g akhi-ai -m 0640 "$APP_SOURCE/package.json" "$APP_DIR/package.json"

if [[ ! -f "$ENV_FILE" ]]; then
  read -r -s -p "OpenRouter API-Key (Eingabe bleibt unsichtbar): " OPENROUTER_API_KEY
  echo
  if [[ -z "$OPENROUTER_API_KEY" ]]; then
    echo "Kein API-Key eingegeben. Abbruch."
    exit 1
  fi
  read -r -p "Frontend-Adresse [https://akhi-ai.onrender.com]: " ALLOWED_ORIGIN
  ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://akhi-ai.onrender.com}"
  umask 027
  {
    printf 'OPENROUTER_API_KEY=%q\n' "$OPENROUTER_API_KEY"
    printf 'OPENROUTER_MODEL=%q\n' "openrouter/free"
    printf 'ALLOWED_ORIGIN=%q\n' "$ALLOWED_ORIGIN"
    printf 'PORT=%q\n' "3100"
    printf 'ENABLE_WEB_SEARCH=%q\n' "false"
  } > "$ENV_FILE"
  chown root:akhi-ai "$ENV_FILE"
  chmod 0640 "$ENV_FILE"
  unset OPENROUTER_API_KEY
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=AKHI AI API (isolated from NEXUSCRAFT)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=akhi-ai
Group=akhi-ai
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
MemoryMax=768M
CPUQuota=50%
TasksMax=64
UMask=0027

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now akhi-ai
echo
echo "AKHI AI API wurde eingerichtet."
echo "Lokaler Test: curl http://127.0.0.1:3100/api/health"
echo "Wichtig: Port 3100 ist absichtlich NICHT öffentlich freigegeben."
echo "Für HTTPS später einen eigenen Reverse-Proxy-Host einrichten; Minecraft-Ports bleiben unverändert."
