const ALLOWED_ORIGIN = "*"; // Nach dem Hosting auf deine konkrete Domain begrenzen.
const MODELS = {
  auto: "@cf/zai-org/glm-4.7-flash",
  glm: "@cf/zai-org/glm-4.7-flash",
  gemma: "@cf/google/gemma-4-26b-a4b-it",
  llama: "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
};
const MAX_MESSAGES = 20;
const MAX_CHARS = 12000;
const MAX_TOKENS = 700;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return Response.json({ ok: true, models: MODELS, billing: "Cloudflare Workers AI free allocation only; no paid fallback" }, { headers });
    }
    if (url.pathname !== "/api/chat" || request.method !== "POST") return Response.json({ error: "Not found" }, { status: 404, headers });
    if (!env.AI) return Response.json({ error: "AI binding fehlt. Worker korrekt mit Workers AI verbinden." }, { status: 503, headers });
    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
        return Response.json({ error: "UngÃ¼ltige Nachrichtenanzahl." }, { status: 400, headers });
      }
      const messages = body.messages.map(m => {
        if (!["user", "assistant"].includes(m.role) || typeof m.content !== "string") throw new Error("UngÃ¼ltiges Nachrichtenformat.");
        return { role: m.role, content: m.content.slice(0, MAX_CHARS) };
      });
      const total = messages.reduce((n, m) => n + m.content.length, 0);
      if (total > MAX_CHARS) return Response.json({ error: "Kontext zu lang. Bitte kÃ¼rze den Chat." }, { status: 413, headers });
      const model = MODELS[body.model] || MODELS.auto;
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: "Du bist AKHI AI, ein hilfreicher deutschsprachiger Assistent. Antworte ehrlich, klar und sicher. Behaupte nicht, Websuche, Dateien oder externe Aktionen ausgefÃ¼hrt zu haben, wenn dies nicht geschehen ist." },
          ...messages
        ],
        max_tokens: MAX_TOKENS
      });
      const reply = result?.response || result?.choices?.[0]?.message?.content || "";
      if (!reply) throw new Error("Das Modell hat keine Antwort geliefert.");
      return Response.json({ reply, model }, { headers });
    } catch (error) {
      // Keine Weiterleitung zu kostenpflichtigen APIs. Das Free-Kontingent wird von Cloudflare begrenzt.
      return Response.json({ error: error.message || "KI-Anfrage fehlgeschlagen. Kostenloses Kontingent eventuell ausgeschÃ¶pft." }, { status: 502, headers });
    }
  }
};
