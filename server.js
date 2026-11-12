import http from "node:http";

const PORT = Number(process.env.PORT || 10000);
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://akhi-ai.onrender.com";
const hits = new Map();

function send(res, status, data) {
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/api/health" && req.method === "GET")
    return send(res, 200, {ok:true, provider:"OpenRouter", model:MODEL, configured:Boolean(API_KEY)});
  if (url.pathname !== "/api/chat" || req.method !== "POST") return send(res,404,{error:"Nicht gefunden"});
  if (origin && origin !== ALLOWED_ORIGIN) return send(res,403,{error:"Origin nicht erlaubt"});
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now(), recent = (hits.get(ip)||[]).filter(t=>now-t<60000);
  if (recent.length >= 12) return send(res,429,{error:"Zu viele Anfragen. Bitte kurz warten."});
  recent.push(now); hits.set(ip,recent);
  if (!API_KEY) return send(res,503,{error:"OPENROUTER_API_KEY fehlt im Backend."});
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200000) return send(res,413,{error:"Nachricht zu groß"});
  }
  try {
    const input = JSON.parse(raw || "{}");
    const messages = Array.isArray(input.messages) ? input.messages : [];
    const safe = messages.slice(-20)
      .filter(m=>m && ["user","assistant"].includes(m.role) && typeof m.content==="string")
      .map(m=>({role:m.role,content:m.content.slice(0,12000)}));
    if (!safe.length || safe.at(-1).role !== "user")
      return send(res,400,{error:"Keine gültige Nutzernachricht erhalten."});
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${API_KEY}`,
        "Content-Type":"application/json",
        "HTTP-Referer":"https://akhi-ai.onrender.com",
        "X-OpenRouter-Title":"AKHI AI"
      },
      body:JSON.stringify({
        model:MODEL,
        messages:[
          {role:"system",content:"Du bist AKHI AI, der persönliche KI-Assistent von Elham. Antworte hilfreich und ehrlich. Schreibe auf Deutsch, wenn der Nutzer Deutsch schreibt. Behaupte nie, Funktionen ausgeführt zu haben, die du nicht wirklich ausgeführt hast."},
          ...safe
        ],
        temperature:0.7
      })
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok) return send(res,response.status,{error:result.error?.message||"OpenRouter-Anfrage fehlgeschlagen."});
    const reply = result.choices?.[0]?.message?.content;
    if (typeof reply !== "string") return send(res,502,{error:"OpenRouter hat keine Textantwort geliefert."});
    return send(res,200,{reply,model:result.model||MODEL});
  } catch {
    return send(res,500,{error:"Serverfehler bei der KI-Anfrage."});
  }
});
server.listen(PORT,"0.0.0.0",()=>console.log(`AKHI AI API läuft auf Port ${PORT}`));
