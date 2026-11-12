# AKHI AI – VPS-Deployment (getrennt von NEXUSCRAFT)

Diese Anleitung richtet AKHI AI als eigenen systemd-Dienst ein. Sie ändert keine Minecraft-Dateien, Ports oder Dienste.

## Voraussetzungen
- Ubuntu 24.04
- Node.js 20 oder neuer
- Repository auf dem VPS geklont
- Ein eigener OpenRouter-Key für den zentralen KI-Dienst

## Installation
Im Repository-Stammverzeichnis:

```bash
sudo bash deployment/vps/install.sh
```

Der Installer:
- legt einen eingeschränkten Systembenutzer `akhi-ai` an
- kopiert nur `server.js` und `package.json` nach `/opt/akhi-ai`
- fragt den OpenRouter-Key verdeckt im Terminal ab und speichert ihn mit Dateirechten 0640 unter `/etc/akhi-ai/akhi-ai.env`
- startet `akhi-ai.service` mit systemd
- begrenzt den Dienst auf 768 MB RAM und 50 % eines CPU-Kerns
- bindet die API nur an den lokalen Port 3100; es wird keine Firewall-Regel und kein öffentlicher Port angelegt

## Prüfen und verwalten

```bash
systemctl status akhi-ai --no-pager
journalctl -u akhi-ai -n 80 --no-pager
curl http://127.0.0.1:3100/api/health
```

```bash
sudo systemctl restart akhi-ai
sudo systemctl stop akhi-ai
```

## Wichtig vor öffentlicher Nutzung
1. Zuerst prüfen, wie viel RAM/CPU NEXUSCRAFT und Minecraft aktuell benötigen.
2. Einen eigenen HTTPS-Reverse-Proxy-Host für die AKHI-API konfigurieren. Nicht einfach Port 3100 öffentlich öffnen.
3. In `/etc/akhi-ai/akhi-ai.env` muss `ALLOWED_ORIGIN` exakt der Origin der AKHI-Webseite entsprechen.
4. Danach die AKHI-Frontend-API-Adresse auf die neue HTTPS-API umstellen und CORS/Healthcheck testen.

Der Installer konfiguriert absichtlich weder Nginx/Caddy noch DNS oder TLS und verändert keine vorhandene Proxy-Konfiguration. Der API-Key wird niemals in GitHub committet.
