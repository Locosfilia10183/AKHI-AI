/* AKHI AI connection monitor: keep the API warm while this page is open. */
(() => {
  "use strict";
  const API = "https://akhi-ai-api.onrender.com";
  const originalFetch = window.fetch.bind(window);
  const dot = () => document.getElementById("connectionDot");
  const label = () => document.getElementById("connectionLabel");
  function status(kind, message) {
    if (dot()) dot().className = "online-dot " + kind;
    if (label()) label().textContent = message;
  }
  async function healthCheck() {
    if (!navigator.onLine) { status("offline", "Kein Internet"); return false; }
    status("checking", "Verbinde mit AKHI AI …");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await originalFetch(API + "/api/health", {
        method: "GET", cache: "no-store", signal: controller.signal
      });
      if (!res.ok) throw new Error("Backend nicht erreichbar");
      const data = await res.json();
      if (!data.configured) { status("offline", "KI-Schlüssel fehlt"); return false; }
      status("connected", "KI verbunden");
      return true;
    } catch {
      status("offline", "Verbindung wird gesucht");
      return false;
    } finally { clearTimeout(timer); }
  }
  // Retry only chat requests after network errors or temporary server failures.
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.includes("/api/chat")) return originalFetch(input, init);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await originalFetch(input, init);
        if (response.status < 500 || response.status === 501) return response;
        lastError = new Error("Vorübergehender Serverfehler (" + response.status + ")");
      } catch (error) { lastError = error; }
      status("checking", "Verbindung wird wiederhergestellt …");
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
    }
    status("offline", "Verbindung fehlgeschlagen");
    throw lastError || new Error("Backend nicht erreichbar");
  };
  healthCheck();
  // Pings every four minutes while the tab is visible. This may prevent idle
  // sleep while in use, but cannot guarantee uptime if the browser is closed.
  setInterval(() => {
    if (document.visibilityState === "visible") healthCheck();
  }, 4 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") healthCheck();
  });
  window.addEventListener("online", healthCheck);
  window.addEventListener("offline", () => status("offline", "Kein Internet"));
})();
