# AKHI AI – OpenRouter Backend

Dieses Backend stellt `/api/chat` und `/api/health` bereit. Der OpenRouter-Schlüssel wird ausschließlich als Render-Umgebungsvariable gespeichert.

## Render Web Service
- Repository: `https://github.com/Locosfilia10183/AKHI-AI`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free (kann bei Inaktivität schlafen)
- Region: Frankfurt

Die Dateien `package.json` und `server.js` müssen im Repository-Stammverzeichnis liegen.

## Render Environment Variables
- `OPENROUTER_API_KEY` = neuer, geheimer API-Key (niemals in GitHub oder Frontend)
- `OPENROUTER_MODEL` = `openrouter/free`
- `ALLOWED_ORIGIN` = `https://akhi-ai.onrender.com`

`openrouter/free` routet auf verfügbare kostenlose Modelle. Kostenlose Modelle haben Rate-Limits und Verfügbarkeit kann variieren. Es ist kein unbegrenzter Dienst.

Nach dem Deploy lautet die Backend-URL ungefähr `https://DEIN-SERVICE.onrender.com`.
In AKHI AI unter Einstellungen diese URL in das bisherige Feld „Cloudflare Worker URL“ eintragen. Das Feld akzeptiert dieselben `/api/chat`- und `/api/health`-Pfade.
