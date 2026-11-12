# AKHI AI – iPhone-first PWA (Phase 1)

Diese erste Version ist ein eigenständiger, kostenloser Web-App-Prototyp. Sie wurde ohne Lovable erstellt.

## Enthalten
- Dunkles AKHI-AI-Design, Desktop-Sidebar und iPhone-Bottom-Navigation
- Lokale Chats und Verlauf (Browser-Speicher)
- Lokales Memory hinzufügen/löschen
- JSON-Export und -Import
- 0-€-Budgetschutz: OpenAI, Claude und Grok sind nicht angebunden und als kostenpflichtig gesperrt
- Ehrliche Meldung statt vorgetäuschter KI-Antworten
- PWA-Manifest und Offline-Shell
- Sprachausgabe, sofern Browser dies unterstützt

## Noch nicht enthalten
- Kein echtes KI-Modell ist verbunden. Chatnachrichten werden lokal gespeichert.
- Die Worker-URL-Einstellung speichert nur eine Adresse; sie führt keine Requests aus.
- Keine echte Websuche, PDF-Extraktion oder Bild-/Videogenerierung.
- Daten werden aktuell über localStorage gespeichert; IndexedDB-Migration ist für Phase 2 vorgesehen.
- Die Offline-Funktion muss nach Bereitstellung über HTTPS im Browser installiert werden.

## Nutzung
1. ZIP entpacken.
2. Dateien auf einen statischen HTTPS-Host legen (z. B. GitHub Pages). Dafür ist kein eigener Server nötig.
3. Auf dem iPhone in Safari die HTTPS-Adresse öffnen.
4. Teilen → Zum Home-Bildschirm → Hinzufügen.

## Sicherheit & Kosten
Keine API-Schlüssel in die App eintragen. Ein späterer Serverless-Proxy muss Schlüssel als Server-Secrets halten und kostenpflichtige Provider bei 0 € hart blockieren. Die App deployt nichts selbst und ruft keine kostenpflichtigen APIs auf.
