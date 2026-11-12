/* AKHI AI — Single Chat Edition
   Chat-Historie lokal im Browser; KI-Anfragen an das Render-Backend.
   Niemals API-Schlüssel in Frontend-Dateien speichern.
*/
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const DB_NAME = "akhi-ai-db", STORE = "kv";
  const BACKEND = "https://akhi-ai-api.onrender.com";
  const SUPABASE_URL = "https://jeubdegyactnxjpperkr.supabase.co";
  const SUPABASE_KEY = "sb_publishable_UQAPvQ123TCoY8MdQdNODA_EhSGNdNv";
  let supabaseClient = null, authSession = null, userId = null;
  const INTRO = "Hallo! Ich bin die KI von Elham. Abi, er hat mich erschaffen. Ich helfe dir ab heute bei allem, wobei ich dich unterstützen kann. Wenn du Fragen hast, schreib Elham Abi. Was möchtest du machen?";
  let db, chats = [], activeChat = null, sending = false, memories = [], attachments = [], lastAssistantText = "";

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
  const userKey = key => userId + ":" + key;
  async function save() {
    await put(userKey("chats"), chats); await put(userKey("activeChat"), activeChat);
    if (supabaseClient && userId) {
      const rows=chats.map(c=>({user_id:userId,id:c.id,title:c.title||"Neuer Chat",messages:c.messages||[],archived:!!c.archived,created_at:new Date(c.created||Date.now()).toISOString(),updated_at:new Date().toISOString()}));
      const {error}=await supabaseClient.from("akhi_chats").upsert(rows,{onConflict:"user_id,id"});
      if(error) console.warn("Cloud-Chat-Sync:",error.message);
    }
  }
  async function saveMemory() {
    await put(userKey("memory"), memories); renderMemory();
    if(supabaseClient&&userId){const {error}=await supabaseClient.from("akhi_memories").upsert({user_id:userId,memories,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)console.warn("Cloud-Memory-Sync:",error.message);}
  }
  async function loadCloudData() {
    const [chatResult,memoryResult]=await Promise.all([
      supabaseClient.from("akhi_chats").select("id,title,messages,archived,created_at,updated_at").order("updated_at",{ascending:false}),
      supabaseClient.from("akhi_memories").select("memories").maybeSingle()
    ]);
    if(chatResult.error)throw new Error("Cloud-Chats: "+chatResult.error.message);
    if(memoryResult.error)throw new Error("Cloud-Gedächtnis: "+memoryResult.error.message);
    if(Array.isArray(chatResult.data)&&chatResult.data.length){
      chats=chatResult.data.map(c=>({id:c.id,title:c.title,messages:Array.isArray(c.messages)?c.messages:[],archived:!!c.archived,created:Date.parse(c.created_at)||Date.now()}));
    } else {
      chats=(await get(userKey("chats")))||[];
    }
    memories=Array.isArray(memoryResult.data?.memories)?memoryResult.data.memories:(await get(userKey("memory")))||[];
    activeChat=(await get(userKey("activeChat")))||null;
    if(!chats.some(c=>c.id===activeChat&&!c.archived))activeChat=chats.find(c=>!c.archived)?.id||null;
    if(!chats.length||!activeChat){const first={id:id(),title:"Neuer Chat",messages:[],created:Date.now()};chats.unshift(first);activeChat=first.id;}
    await save();await saveMemory();
  }
  function renderMemory() { const host=$("#memoryList"); if(!host)return; host.replaceChildren(); $("#memoryCount").textContent=memories.length+" Erinnerungen"; if(!memories.length){const p=document.createElement("p");p.className="memory-empty";p.textContent="Noch keine Erinnerungen gespeichert.";host.append(p);return;} memories.forEach((item,index)=>{const row=document.createElement("div");row.className="memory-item";const span=document.createElement("span");span.textContent=item;const del=document.createElement("button");del.type="button";del.textContent="×";del.addEventListener("click",async()=>{memories.splice(index,1);await saveMemory();});row.append(span,del);host.append(row);}); }
  async function updateMemory(chat) { try { const r=await fetch(BACKEND+"/api/memory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({memory:memories,conversations:chats.filter(c=>!c.archived).slice(0,40).map(c=>({title:c.title||"Chat",messages:(c.messages||[]).slice(-40)}))})}); if(!r.ok)return; const d=await r.json(); if(Array.isArray(d.memory)){memories=d.memory.filter(x=>typeof x==="string").slice(0,40);await saveMemory();} } catch(e) { console.warn("Memory update failed",e); } }

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
  function setupSidebar() {
    const toggle=$("#menuToggle"), backdrop=$("#sidebarBackdrop");
    const close=()=>{document.body.classList.remove("sidebar-open");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Chat-Menü öffnen");};
    const open=()=>{document.body.classList.add("sidebar-open");toggle.setAttribute("aria-expanded","true");toggle.setAttribute("aria-label","Chat-Menü schließen");};
    toggle.addEventListener("click",()=>document.body.classList.contains("sidebar-open")?close():open());
    backdrop.addEventListener("click",close);
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
    $("#newChatBtn").addEventListener("click",close);
    $("#chatList").addEventListener("click",e=>{if(e.target.closest(".chat-item-title"))close();});
  }
  function renderChatList() {
    const host=$("#chatList"); if(!host) return; host.replaceChildren();
    const query=($("#chatSearch")?.value||"").trim().toLowerCase();
    const visible=chats.filter(c=>!c.archived && (!query || (c.title||"").toLowerCase().includes(query) || c.messages.some(m=>m.content.toLowerCase().includes(query))));
    if(!visible.length){const empty=document.createElement("div");empty.className="chat-empty";empty.textContent=query?"Keine passenden Chats":"Noch keine Chats";host.append(empty);return;}
    visible.forEach(chat=>{
      const item=document.createElement("div");item.className="chat-item"+(chat.id===activeChat?" active":"");
      const title=document.createElement("span");title.className="chat-item-title";title.textContent=chat.title||"Neuer Chat";title.addEventListener("click",()=>{activeChat=chat.id;save().then(render);});
      const actions=document.createElement("span");actions.className="chat-actions";
      const rename=document.createElement("button");rename.type="button";rename.textContent="✎";rename.title="Umbenennen";rename.setAttribute("aria-label","Chat umbenennen");rename.addEventListener("click",()=>{const next=prompt("Neuer Chatname:",chat.title||"Neuer Chat");if(next&&next.trim()){chat.title=next.trim().slice(0,70);save().then(render);}});
      const archive=document.createElement("button");archive.type="button";archive.textContent="⌑";archive.title="Archivieren";archive.setAttribute("aria-label","Chat archivieren");archive.addEventListener("click",()=>{chat.archived=true;if(activeChat===chat.id){activeChat=chats.find(c=>c.id!==chat.id&&!c.archived)?.id||null;}save().then(()=>{if(!activeChat)makeChat();else render();});});
      const del=document.createElement("button");del.type="button";del.textContent="×";del.title="Löschen";del.setAttribute("aria-label","Chat löschen");del.addEventListener("click",()=>{if(!confirm("Diesen Chat wirklich löschen?"))return;chats=chats.filter(c=>c.id!==chat.id);if(activeChat===chat.id)activeChat=chats.find(c=>!c.archived)?.id||null;save().then(()=>{if(!activeChat)makeChat();else render();});});
      actions.append(rename,archive,del);item.append(title,actions);host.append(item);
    });
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
    renderChatList();
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

  async function parseFile(file) {
    if(file.size>8*1024*1024) throw new Error(file.name+" ist größer als 8 MB.");
    if(file.type.startsWith("image/")) return {name:file.name,type:"image",data:await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file);})};
    let text="";
    if(/\.pdf$/i.test(file.name)){
      if(!window.pdfjsLib)throw new Error("PDF-Bibliothek nicht geladen.");
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      for(let i=1;i<=Math.min(pdf.numPages,35);i++){const p=await pdf.getPage(i);const c=await p.getTextContent();text+=c.items.map(x=>x.str).join(" ")+"\n";}
    } else if(/\.docx$/i.test(file.name)){if(!window.mammoth)throw new Error("Word-Leser nicht geladen.");text=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;}
    else if(/\.(xlsx|xls)$/i.test(file.name)){if(!window.XLSX)throw new Error("Excel-Leser nicht geladen.");const w=XLSX.read(await file.arrayBuffer(),{type:"array"});text=w.SheetNames.map(n=>n+"\n"+XLSX.utils.sheet_to_csv(w.Sheets[n])).join("\n");}
    else text=await file.text();
    return {name:file.name,type:"text",text:text.slice(0,45000)};
  }
  function drawAttachments(){const h=$("#attachmentPreview");h.replaceChildren();attachments.forEach((a,i)=>{const b=document.createElement("button");b.type="button";b.textContent="📎 "+a.name+" ×";b.onclick=()=>{attachments.splice(i,1);drawAttachments();};h.append(b);});}
  function setupTools(){
    $("#attachBtn").onclick=()=>$("#fileInput").click();
    $("#fileInput").onchange=async e=>{for(const f of e.target.files){try{attachments.push(await parseFile(f));}catch(err){toast(err.message);}}drawAttachments();e.target.value="";};
    const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
    $("#voiceBtn").onclick=()=>{if(!Speech){toast("Spracheingabe wird hier nicht unterstützt.");return;}const rec=new Speech();rec.lang="de-DE";rec.onresult=e=>{$("#prompt").value+=($("#prompt").value?" ":"")+e.results[0][0].transcript;};rec.onerror=()=>toast("Mikrofon nicht verfügbar.");rec.start();};
    $("#speakBtn").onclick=()=>{if(!lastAssistantText)return toast("Noch keine Antwort vorhanden.");speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(lastAssistantText));};
  }

  async function send() {
    if (sending) return;
    const input = $("#prompt"), text = input.value.trim();
    if (!text && !attachments.length) return;
    let chat = current();
    if (!chat) { makeChat(); chat = current(); }
    input.value = "";
    if (!chat.messages.length) chat.title = text.slice(0, 42);
    const promptText=text||"Bitte analysiere meine Anhänge."; const attachmentText=attachments.filter(a=>a.type==="text").map(a=>"\n[Datei "+a.name+"]\n"+a.text).join(""); chat.messages.push({role:"user", content:promptText+attachmentText}); bubble("user", promptText+(attachments.length?"\n📎 "+attachments.map(a=>a.name).join(", "):"")); await save();
    if (/^(hi|hey|hallo|servus|moin|guten morgen|guten tag|guten abend)[!.?\s]*$/i.test(text)) {
      chat.messages.push({role:"assistant", content:INTRO}); bubble("assistant", INTRO); await save(); return;
    }
    sending = true; $("#sendBtn").disabled = true;
    const pending = bubble("assistant", "Abi, einen Moment …");
    try {
      const response = await fetch(BACKEND + "/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:chat.messages.slice(-20),memory:memories,attachments,mode:$("#assistantMode").value})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Serverfehler (${response.status})`);
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("Die KI hat keine Antwort geliefert.");
      pending.textContent = data.reply; lastAssistantText=data.reply; downloadCode(pending, data.reply); attachments=[]; drawAttachments();
      chat.messages.push({role:"assistant", content:data.reply});
      await updateMemory(chat);
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
    $("#signOutBtn").addEventListener("click",async()=>{if(!supabaseClient)return;const {error}=await supabaseClient.auth.signOut();if(error)toast(error.message);});
    $("#clearMemory").addEventListener("click",async()=>{if(!confirm("Alle Erinnerungen löschen?"))return;memories=[];await saveMemory();toast("Gedächtnis gelöscht.");});
    $("#clearHistory").addEventListener("click", async () => { if (!confirm("Möchtest du wirklich deinen gesamten lokalen Chatverlauf löschen?")) return; chats=[]; const fresh={id:id(),title:"Neuer Chat",messages:[],created:Date.now()}; chats=[fresh]; activeChat=fresh.id; await save(); render(); close(); toast("Chatverlauf wurde gelöscht."); });
    const updateStatus = () => { const label=$("#connectionLabel")?.textContent || "Status unbekannt"; $("#settingsStatus").textContent=label; const dot=$("#connectionDot"); $("#settingsStatusDot").className="online-dot "+(dot?.classList.contains("offline")?"offline":dot?.classList.contains("checking")?"checking":""); };
    updateStatus(); setInterval(updateStatus, 3000);
  }
  async function initAuth() {
    const gate=$("#authGate"), message=$("#authMessage"), app=$("#mainApp");
    const setSession=session=>{document.body.classList.toggle("authenticated",!!session);gate.hidden=!!session;app.setAttribute("aria-hidden",String(!session));$("#accountEmail").textContent=session?.user?.email||"Nicht angemeldet";};
    if(!window.supabase?.createClient){message.textContent="Anmeldedienst konnte nicht geladen werden. Bitte Seite neu laden.";return;}
    supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    const {data:{session}}=await supabaseClient.auth.getSession();authSession=session;userId=session?.user?.id||null;setSession(session);
    supabaseClient.auth.onAuthStateChange((event,nextSession)=>{const nextId=nextSession?.user?.id||null;authSession=nextSession;setSession(nextSession);if(["SIGNED_IN","SIGNED_OUT","USER_UPDATED"].includes(event)&&nextId!==userId)window.location.reload();});
    const login=provider=>async()=>{message.textContent="Weiterleitung zur sicheren Anmeldung …";const {error}=await supabaseClient.auth.signInWithOAuth({provider,options:{redirectTo:window.location.origin}});if(error)message.textContent=error.message;};
    $("#googleLogin").addEventListener("click",login("google"));$("#appleLogin").addEventListener("click",login("apple"));
  }
  async function boot() {
    await initAuth();
    if(!authSession){return;}
    await openDB();
    await loadCloudData();
    if (!chats.length) { const first = {id:id(), title:"Neuer Chat", messages:[], created:Date.now()}; chats=[first]; activeChat=first.id; }
    if (!chats.some(c => c.id === activeChat && !c.archived)) activeChat = chats.find(c=>!c.archived)?.id || null;
    if(!activeChat){const first={id:id(),title:"Neuer Chat",messages:[],created:Date.now()};chats.unshift(first);activeChat=first.id;}
    $("#sendBtn").addEventListener("click", send);
    $("#prompt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && localStorage.getItem("akhi-enter-send") !== "0") { e.preventDefault(); send(); } });
    setupSettings();
    setupTools();
    renderMemory();
    // Erinnerungen werden erst nach einer echten Unterhaltung aktualisiert.
    setupSidebar();
    $("#newChatBtn").addEventListener("click", makeChat);
    $("#chatSearch").addEventListener("input", renderChatList);
    $("#akhiNewChat")?.addEventListener("click", makeChat);
    await save(); render();
  }
  boot().catch(error => {
    console.error("AKHI AI Startfehler:", error);
    $("#messages").textContent = "AKHI AI konnte nicht starten: " + error.message;
  });
})();