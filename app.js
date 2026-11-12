/* AKHI AI — Single Chat Edition
   Uses the existing IndexedDB database and Render OpenRouter backend.
   No API key is stored in this file or in the browser.
*/
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const DB_NAME = "akhi-ai-db";
  const STORE = "kv";
  const BACKEND_DEFAULT = "https://akhi-ai-api.onrender.com";
  const INTRO = "Hallo! Ich bin die KI von Elham. Abi, er hat mich erschaffen. Ich helfe dir ab heute bei allem, wobei ich dich unterstützen kann. Wenn du Fragen hast, schreib Elham Abi. Was möchtest du machen?";
  let db;
  let chats = [];
  let activeChat = null;
  let workerUrl = BACKEND_DEFAULT;
  let sending = false;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => { db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }
  function read(key) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function write(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  const makeId = () => crypto.randomUUID?.() || String(Date.now()) + Math.random();
  const escapeText = (s) => String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

  function installSingleChatUI() {
    const style = document.createElement("style");
    style.textContent = `
      .sidebar,.mobile-nav,#mobileMenu,[data-page]:not([data-page="chat"]),#themeBtn,
      #modelSelect,.chat-history,.nav-label { display:none!important; }
      .app{display:block!important}.main{width:100%!important;margin:0!important}
      .topbar{justify-content:space-between!important}
      .chat-layout{max-width:900px!important;margin:0 auto!important}
      .chat-head h1{font-size:clamp(28px,5vw,42px)!important}
      .chat-head p{font-size:16px!important}
      .messages{min-height:38vh}
      .welcome h2{font-size:26px}
      .quick-grid{display:none!important}
      .message .bubble{white-space:pre-wrap;overflow-wrap:anywhere}
      .akhi-status{font-size:12px;color:#aaa;padding:8px 4px;text-align:center}
      .akhi-new{border:1px solid #343744;background:#171923;color:#eee;border-radius:12px;padding:9px 13px}
      .akhi-chat-picker{display:flex;gap:8px;align-items:center}
      .akhi-chat-picker select{max-width:55vw;background:#171923;color:#eee;border:1px solid #343744;border-radius:10px;padding:8px}
    `;
    document.head.append(style);
    const top = $(".topbar");
    if (top && !$("#akhiChatPicker")) {
      const wrap = document.createElement("div");
      wrap.className = "akhi-chat-picker";
      wrap.innerHTML = `<select id="akhiChatPicker" aria-label="Unterhaltung auswählen"></select><button class="akhi-new" id="akhiNewChat">＋ Neuer Chat</button>`;
      top.append(wrap);
    }
    const head = $(".chat-head");
    if (head) {
      const title = $("#chatTitle");
      if (title) title.textContent = "Ich bin die KI von Elham";
      const p = head.querySelector("p");
      if (p) p.textContent = "Abi, sag mir einfach, wobei ich dir helfen soll.";
    }
    const model = $("#modelSelect");
    if (model) model.parentElement?.removeChild(model);
    const fine = $(".fineprint");
    if (fine) fine.textContent = "AKHI AI · Verbunden über dein sicheres Render-Backend.";
    const attach = $(".attach-row");
    if (attach) {
      const hint = attach.querySelector(".composer-hint");
      if (hint) hint.textContent = "Enter senden · Shift + Enter neue Zeile";
    }
  }

  function current() { return chats.find(c => c.id === activeChat); }
  function newChat() {
    const chat = { id: makeId(), title: "Neuer Chat", messages: [], created: Date.now() };
    chats.unshift(chat);
    activeChat = chat.id;
    persist();
    render();
    $("#prompt")?.focus();
  }
  async function persist() {
    await write("chats", chats);
    await write("activeChat", activeChat);
    await write("workerUrl", workerUrl);
  }
  function renderPicker() {
    const picker = $("#akhiChatPicker");
    if (!picker) return;
    picker.innerHTML = chats.map(c =>
      `<option value="${escapeText(c.id)}">${escapeText(c.title || "Neuer Chat")}</option>`
    ).join("");
    picker.value = activeChat || "";
  }
  function addBubble(role, content, pending = false) {
    const host = $("#messages");
    const welcome = host?.querySelector(".welcome");
    if (welcome) welcome.remove();
    const row = document.createElement("div");
    row.className = "message" + (role === "user" ? " user" : "");
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "Du" : "A";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = content;
    if (pending) bubble.dataset.pending = "true";
    row.append(avatar, bubble);
    host.append(row);
    host.scrollTop = host.scrollHeight;
    return bubble;
  }
  function render() {
    const host = $("#messages");
    if (!host) return;
    host.innerHTML = "";
    const chat = current();
    if (!chat || !chat.messages.length) {
      const welcome = document.createElement("div");
      welcome.className = "welcome";
      const orb = document.createElement("div");
      orb.className = "orb";
      orb.textContent = "✧";
      const h = document.createElement("h2");
      h.textContent = "Hallo, Abi!";
      const p = document.createElement("p");
      p.textContent = INTRO;
      welcome.append(orb, h, p);
      host.append(welcome);
    } else {
      chat.messages.forEach(m => addBubble(m.role, m.content));
    }
    $("#chatTitle").textContent = chat?.title || "AKHI AI";
    renderPicker();
  }
  function isGreeting(text) {
    return /^(hi|hey|hallo|servus|moin|guten morgen|guten tag|guten abend|السلام عليكم)[!.?\s]*$/i.test(text.trim());
  }
  function localGreeting() { return INTRO; }

  async function send() {
    if (sending) return;
    const input = $("#prompt");
    const text = input?.value.trim();
    if (!text) return;
    let chat = current();
    if (!chat) { newChat(); chat = current(); }
    input.value = "";
    if (!chat.messages.length) chat.title = text.slice(0, 42);
    chat.messages.push({ role: "user", content: text });
    addBubble("user", text);
    await persist();

    if (isGreeting(text)) {
      const reply = localGreeting();
      chat.messages.push({ role: "assistant", content: reply });
      addBubble("assistant", reply);
      await persist();
      return;
    }

    sending = true;
    const sendBtn = $("#sendBtn");
    if (sendBtn) sendBtn.disabled = true;
    const pending = addBubble("assistant", "Abi, gerne tue ich das. Ich überlege kurz …", true);
    try {
      if (!workerUrl) throw new Error("Backend-Adresse fehlt. Bitte AKHI AI neu laden.");
      const response = await fetch(workerUrl.replace(/\/+$/, "") + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chat.messages.slice(-20) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Serverfehler (${response.status})`);
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Die KI hat keine Antwort geliefert.");
      pending.textContent = data.reply;
      chat.messages.push({ role: "assistant", content: data.reply });
    } catch (err) {
      const msg = `Abi, ich kann das gerade nicht ausführen: ${err.message}. Bitte versuche es gleich noch einmal.`;
      pending.textContent = msg;
      chat.messages.push({ role: "assistant", content: msg });
    } finally {
      pending.removeAttribute("data-pending");
      sending = false;
      if (sendBtn) sendBtn.disabled = false;
      await persist();
      $("#messages").scrollTop = $("#messages").scrollHeight;
    }
  }

  async function boot() {
    installSingleChatUI();
    await openDB();
    chats = (await read("chats")) || [];
    activeChat = (await read("activeChat")) || null;
    const savedUrl = await read("workerUrl");
    // The saved setting wins; default points to the user's Render API.
    workerUrl = (savedUrl || BACKEND_DEFAULT).trim();
    if (!chats.length) {
      chats = [{ id: makeId(), title: "Neuer Chat", messages: [], created: Date.now() }];
      activeChat = chats[0].id;
    }
    if (!chats.some(c => c.id === activeChat)) activeChat = chats[0].id;
    $("#sendBtn")?.addEventListener("click", send);
    $("#prompt")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $("#akhiNewChat")?.addEventListener("click", newChat);
    $("#akhiChatPicker")?.addEventListener("change", async e => {
      activeChat = e.target.value;
      await persist();
      render();
    });
    // Keep the legacy settings button wired only if it is present in the DOM;
    // the single-chat interface intentionally hides all navigation.
    $("#saveConnection")?.addEventListener("click", async () => {
      const field = $("#workerUrl");
      if (field?.value.trim()) workerUrl = field.value.trim().replace(/\/+$/, "");
      await persist();
    });
    await persist();
    render();
  }

  boot().catch(err => {
    console.error("AKHI AI startup error:", err);
    const host = $("#messages");
    if (host) host.textContent = "AKHI AI konnte nicht starten: " + err.message;
  });
})();
