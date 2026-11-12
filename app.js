/* AKHI AI — Single Chat Edition
   Chat-Historie lokal im Browser; KI-Anfragen an das Render-Backend.
   Niemals API-Schlüssel in Frontend-Dateien speichern.
*/
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const DB_NAME = "akhi-ai-db", STORE = "kv";
  const BACKEND = "https://akhi-ai-api.onrender.com";
  const INTRO = "Hallo! Ich bin die KI von Elham. Abi, er hat mich erschaffen. Ich helfe dir ab heute bei allem, wobei ich dich unterstützen kann. Wenn du Fragen hast, schreib Elham Abi. Was möchtest du machen?";
  let db, chats = [], activeChat = null, sending = false;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => { db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }
  function get(key) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function put(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  const id = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const current = () => chats.find(c => c.id === activeChat);
  async function save() { await put("chats", chats); await put("activeChat", activeChat); }

  function bubble(role, content) {
    const host = $("#messages");
    host.querySelector(".welcome")?.remove();
    const row = document.createElement("div");
    row.className = "message" + (role === "user" ? " user" : "");
    const avatar = document.createElement("div");
    avatar.className = "avatar"; avatar.textContent = role === "user" ? "Du" : "A";
    const body = document.createElement("div"); body.className = "bubble"; body.textContent = content;
    row.append(avatar, body); host.append(row); host.scrollTop = host.scrollHeight;
    return body;
  }
  function render() {
    const host = $("#messages"); host.replaceChildren();
    const chat = current();
    if (!chat || !chat.messages.length) {
      const welcome = document.createElement("div"); welcome.className = "welcome";
      const orb = document.createElement("div"); orb.className = "orb"; orb.textContent = "✧";
      const heading = document.createElement("h2"); heading.textContent = "Hallo, Abi!";
      const p = document.createElement("p"); p.textContent = INTRO;
      welcome.append(orb, heading, p); host.append(welcome);
    } else chat.messages.forEach(m => bubble(m.role, m.content));
    $("#chatTitle").textContent = chat?.title || "AKHI AI";
  }
  function makeChat() {
    const chat = {id:id(), title:"Neuer Chat", messages:[], created:Date.now()};
    chats.unshift(chat); activeChat = chat.id; save().then(render); $("#prompt").focus();
  }
  function downloadCode(target, answer) {
    const blocks = [...answer.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)];
    blocks.forEach((match, i) => {
      const lang = (match[1].trim().split(/\s+/)[0] || "txt").toLowerCase();
      const ext = ({js:"js",javascript:"js",ts:"ts",typescript:"ts",py:"py",python:"py",html:"html",css:"css",json:"json",java:"java",jsx:"jsx",tsx:"tsx",sh:"sh",bash:"sh",md:"md",sql:"sql",php:"php",yml:"yml",yaml:"yml"}[lang] || "txt");
      const filename = `akhi-datei-${i+1}.${ext}`;
      const btn = document.createElement("button"); btn.type = "button"; btn.textContent = `↓ ${filename} herunterladen`;
      btn.style.cssText = "display:block;margin-top:10px;padding:9px 12px;border:0;border-radius:9px;background:#d8b46a;color:#17130b;font-weight:700";
      btn.addEventListener("click", () => {
        const url = URL.createObjectURL(new Blob([match[2].replace(/\n$/, "")], {type:"text/plain;charset=utf-8"}));
        const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      target.append(btn);
    });
  }
  async function send() {
    if (sending) return;
    const input = $("#prompt"), text = input.value.trim();
    if (!text) return;
    let chat = current();
    if (!chat) { makeChat(); chat = current(); }
    input.value = "";
    if (!chat.messages.length) chat.title = text.slice(0, 42);
    chat.messages.push({role:"user", content:text}); bubble("user", text); await save();
    if (/^(hi|hey|hallo|servus|moin|guten morgen|guten tag|guten abend)[!.?\s]*$/i.test(text)) {
      chat.messages.push({role:"assistant", content:INTRO}); bubble("assistant", INTRO); await save(); return;
    }
    sending = true; $("#sendBtn").disabled = true;
    const pending = bubble("assistant", "Abi, einen Moment …");
    try {
      const response = await fetch(BACKEND + "/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:chat.messages.slice(-20)})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Serverfehler (${response.status})`);
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Die KI hat keine Antwort geliefert.");
      pending.textContent = data.reply; downloadCode(pending, data.reply);
      chat.messages.push({role:"assistant", content:data.reply});
    } catch (error) {
      const message = `Abi, gerade klappt die Verbindung nicht: ${error.message}`;
      pending.textContent = message; chat.messages.push({role:"assistant", content:message});
    } finally {
      sending = false; $("#sendBtn").disabled = false; await save();
      $("#messages").scrollTop = $("#messages").scrollHeight;
    }
  }
  function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2400); }
  function setupSettings() {
    const overlay = $("#settingsOverlay");
    const open = () => { overlay.classList.add("open"); overlay.setAttribute("aria-hidden","false"); };
    const close = () => { overlay.classList.remove("open"); overlay.setAttribute("aria-hidden","true"); };
    $("#settingsOpen").addEventListener("click", open); $("#settingsClose").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    const light = $("#settingLight"), large = $("#settingLargeText"), enter = $("#settingEnter");
    light.checked = localStorage.getItem("akhi-light") === "1"; large.checked = localStorage.getItem("akhi-large-text") === "1"; enter.checked = localStorage.getItem("akhi-enter-send") !== "0";
    document.body.classList.toggle("light-theme", light.checked); document.body.classList.toggle("large-chat", large.checked);
    light.addEventListener("change", () => { localStorage.setItem("akhi-light", light.checked ? "1" : "0"); document.body.classList.toggle("light-theme", light.checked); });
    large.addEventListener("change", () => { localStorage.setItem("akhi-large-text", large.checked ? "1" : "0"); document.body.classList.toggle("large-chat", large.checked); });
    enter.addEventListener("change", () => localStorage.setItem("akhi-enter-send", enter.checked ? "1" : "0"));
    $("#prompt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && localStorage.getItem("akhi-enter-send") === "0") e.stopImmediatePropagation(); }, true);
    $("#clearHistory").addEventListener("click", async () => { if (!confirm("Möchtest du wirklich deinen gesamten lokalen Chatverlauf löschen?")) return; chats=[]; const fresh={id:id(),title:"Neuer Chat",messages:[],created:Date.now()}; chats=[fresh]; activeChat=fresh.id; await save(); render(); close(); toast("Chatverlauf wurde gelöscht."); });
    const updateStatus = () => { const label=$("#connectionLabel")?.textContent || "Status unbekannt"; $("#settingsStatus").textContent=label; const dot=$("#connectionDot"); $("#settingsStatusDot").className="online-dot "+(dot?.classList.contains("offline")?"offline":dot?.classList.contains("checking")?"checking":""); };
    updateStatus(); setInterval(updateStatus, 3000);
  }
  async function boot() {
    await openDB();
    chats = (await get("chats")) || [];
    activeChat = (await get("activeChat")) || null;
    if (!chats.length) { const first = {id:id(), title:"Neuer Chat", messages:[], created:Date.now()}; chats=[first]; activeChat=first.id; }
    if (!chats.some(c => c.id === activeChat)) activeChat = chats[0].id;
    $("#sendBtn").addEventListener("click", send);
    $("#prompt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && localStorage.getItem("akhi-enter-send") !== "0") { e.preventDefault(); send(); } });
    setupSettings();
    $("#akhiNewChat")?.addEventListener("click", makeChat);
    await save(); render();
  }
  boot().catch(error => {
    console.error("AKHI AI Startfehler:", error);
    $("#messages").textContent = "AKHI AI konnte nicht starten: " + error.message;
  });
})();