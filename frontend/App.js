const prompts = {
  hotline: {
    title: "AGENT HOT LINE",
    desc: "Hot Line Support",
    placeholder: "Ask about FOPS basic checks for DIMM failure?",
    intro: "How can I guide you on FOPS checks? You can ask:<br>• FOPS basic checklist<br>• DIMM failure steps<br>• Node reboot procedure"
  },
  troubleshoot: {
    title: "AGENT TROUBLESHOOTING",
    desc: "Troubleshooting",
    placeholder: "Ask about alarm troubleshooting steps...",
    intro: "I'm ready to help with alarms & HW. Ask about:<br>• Critical alarm triage<br>• HW replacement flow<br>• Log collection"
  },
  ran: {
    title: "RAN Support",
    desc: "RAN Support",
    placeholder: "e.g. RAN alarm cell down troubleshooting?",
    intro: "Ask me about RAN issues:<br>• Cell down / Cell out of service<br>• VSWR alarms<br>• S1 / X2 link down"
  },
  tc30: {
    title: "TC30 Support",
    desc: "TC30 Docs",
    placeholder: "e.g. TC30 HWM installation steps?",
    intro: "You can ask me about TC30 Products:<br>• HWM installation<br>• TC30 commissioning<br>• Cloud config"
  }
};

let currentTopic = 'hotline';
const STORAGE_KEY = 'tass_recent_searches';
const MAX_HISTORY = 20;

function getTimeString(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function loadRecentSearches() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveRecentSearch(query) {
  if (!query.trim()) return;
  const history = loadRecentSearches();
  const now = new Date();
  if (history.length && history[0].text.toLowerCase() === query.toLowerCase()) {
    history[0].time = now.toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderRecentSearches(); return;
  }
  const entry = { id: Date.now(), text: query, time: now.toISOString(), topic: currentTopic };
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderRecentSearches();
}
function renderRecentSearches() {
  const list = document.getElementById('recentSearchesList');
  if (!list) return;
  const history = loadRecentSearches();
  if (!history.length) { list.innerHTML = `<div class="empty-recent">No recent searches</div>`; return; }
  list.innerHTML = history.map(item => {
    const d = new Date(item.time);
    const timeLabel = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const dateLabel = d.toLocaleDateString([], { day:'2-digit', month:'short' });
    const safeText = item.text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="recent-item" onclick="reuseSearch('${safeText.replace(/'/g, "\\'")}')"><div class="recent-item-left"><i class="fa-solid fa-magnifying-glass"></i><div class="recent-text">${safeText}</div></div><div class="recent-time">${timeLabel}<br><span style="font-size:9px; opacity:0.7">${dateLabel}</span></div></div>`;
  }).join('');
}
function reuseSearch(text) { setInput(text); }
function clearRecentSearches() {
  if (!confirm('Clear all recent searches?')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderRecentSearches();
}

// ---- FIXED: Clear right pane when left topic clicked ----
function setPrompt(topic) {
  const p = prompts[topic];
  currentTopic = topic;

  // 1. Clear previous chat results in right pane
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) chatMessages.innerHTML = '';

  // 2. Remove default welcome if exists
  const staticDiv = document.getElementById('defaultWelcome');
  if (staticDiv) staticDiv.remove();

  // 3. Update active card on left
  document.querySelectorAll('.nav-card').forEach(c => c.classList.remove('active'));
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  } else {
    // fallback if called programmatically
    const idx = Object.keys(prompts).indexOf(topic);
    document.querySelectorAll('.nav-card')[idx]?.classList.add('active');
  }

  // 4. Show fresh pane for selected topic
  const panel = document.getElementById('selectedTopicPanel');
  panel.style.display = 'block';
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div>
    <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
    <button class="download-btn" onclick="downloadText(this)"><i class="fa-solid fa-download"></i> Download as.txt</button>
    <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
  `;

  // 5. Update placeholder and clear input
  const inputEl = document.getElementById('questionInput');
  if (inputEl) {
    inputEl.placeholder = p.placeholder;
    inputEl.value = '';
    inputEl.focus();
  }

  // 6. Scroll to top
  const container = document.getElementById('chatContainer');
  if (container) container.scrollTop = 0;
}

function resetWelcome(){ location.reload(); }
function setInput(text){ document.getElementById('questionInput').value = text; document.getElementById('questionInput').focus(); }
function clearInput(){ document.getElementById('questionInput').value = ''; }
function clearChat(){ 
  document.getElementById('chatMessages').innerHTML = ''; 
  const panel = document.getElementById('selectedTopicPanel');
  if(panel) {
    // Show current topic fresh pane again, don't hide completely
    const p = prompts[currentTopic];
    panel.innerHTML = `
      <div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div>
      <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
      <button class="download-btn" onclick="downloadText(this)"><i class="fa-solid fa-download"></i> Download as.txt</button>
      <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
    `;
    panel.style.display = 'block';
  }
}

function downloadText(btn){
  const text = btn.parentElement.innerText;
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `TASS_${currentTopic}_${Date.now()}.txt`; a.click();
}

async function sendMessage(){
  const input = document.getElementById('questionInput');
  if(!input.value.trim()) return;
  const query = input.value.trim();
  const chat = document.getElementById('chatMessages');
  const nowTime = getTimeString();
  saveRecentSearch(query);
  chat.innerHTML += `<div class="user-message-wrap"><div class="user-bubble"><div class="user-text">${query}</div><div class="message-time right"><i class="fa-regular fa-clock"></i> ${nowTime}</div></div></div>`;
  document.getElementById('thinking').classList.remove('hidden');
  input.value = '';
  const container = document.getElementById('chatContainer');
  container.scrollTop = container.scrollHeight;

  // Try both endpoints - topic locked
  const endpoints = ["http://127.0.0.1:8000/ask", "http://127.0.0.1:8000/query"];
  let data = null;
  let lastError = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, topic: currentTopic })
      });
      if(!res.ok){
        const text = await res.text();
        lastError = `${res.status} - ${text}`;
        continue;
      }
      data = await res.json();
      break;
    } catch (e) {
      lastError = e.message;
    }
  }

  document.getElementById('thinking').classList.add('hidden');
  const replyTime = getTimeString();

  if (!data) {
    chat.innerHTML += `<div class="tass-message-wrap"><div class="ttss-message" style="border-left: 3px solid #d93025;"><div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${prompts[currentTopic].title}</div><div style="color:#d93025;"><b>Failed:</b> ${lastError}</div></div><div class="message-time left"><i class="fa-regular fa-clock"></i> ${replyTime}</div></div>`;
    container.scrollTop = container.scrollHeight;
    return;
  }

  const rawAnswer = data.answer || JSON.stringify(data, null, 2);
  const sources = data.sources || [];
  const safeAnswer = rawAnswer.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const sourcesHtml = sources.length ? `<div style="margin-top:12px; padding-top:8px; border-top:1px solid #e0e0e0; font-size:12px; opacity:0.8;"><b>Sources:</b> ${sources.map(s => s.file || s).join(', ')} • <span style="font-size:10px;">Topic: ${currentTopic}</span></div>` : '';

  chat.innerHTML += `<div class="tass-message-wrap"><div class="ttss-message"><div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${prompts[currentTopic].title}</div><div class="answer-content" style="white-space: pre-wrap; line-height:1.6; font-family: monospace; font-size:13px;">${safeAnswer}</div>${sourcesHtml}<button class="download-btn" onclick="downloadText(this)"><i class="fa-solid fa-download"></i> Download as.txt</button></div><div class="message-time left"><i class="fa-regular fa-clock"></i> ${replyTime} • ${prompts[currentTopic].title}</div></div>`;
  container.scrollTop = container.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  renderRecentSearches();
  const inp = document.getElementById('questionInput');
  if(inp){ inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendMessage(); }); }
});
