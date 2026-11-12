AKHI AI – Automatische Verbindung

Dateien im ZIP:
- index.html: zeigt den echten Verbindungsstatus und lädt den Monitor
- style.css: Statusanzeige
- connection-monitor.js: prüft /api/health, pingt alle 4 Minuten bei sichtbarem Tab und versucht Chat-Anfragen bei Netzwerk-/5xx-Fehlern erneut

Installation:
1. ZIP entpacken.
2. index.html und style.css im Repository-Stammverzeichnis ersetzen.
3. connection-monitor.js neu im Repository-Stammverzeichnis hinzufügen.
4. Commit auf main. Render deployt automatisch.

Wichtig:
- Die Verbindung wird automatisch hergestellt, solange die Website geöffnet ist.
- Die regelmäßigen Pings können den Ruhezustand während der Nutzung verzögern.
- Wenn Safari/Browser geschlossen oder im Hintergrund stark pausiert wird, kann das kostenlose Render-Backend trotzdem schlafen.
- Das garantiert keinen 24/7-Betrieb. Für dauerhaftes Always-on ist ein dauerhaft laufender Hosting-Plan nötig.
- Der OpenRouter-Free-Endpunkt kann eigene Limits haben.
