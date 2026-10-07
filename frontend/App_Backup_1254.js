const prompts = {
  hotline: { title: "AGENT HOT LINE", desc: "Hot Line Support", placeholder: "Ask about FOPS basic checks for DIMM failure?", intro: "How can I guide you on FOPS checks? You can ask:<br>• FOPS basic checklist<br>• DIMM failure steps<br>• Node reboot procedure" },
  troubleshoot: { title: "AGENT TROUBLESHOOTING", desc: "Troubleshooting", placeholder: "Ask about alarm troubleshooting steps...", intro: "I'm ready to help with alarms & HW. Ask about:<br>• Critical alarm triage<br>• HW replacement flow<br>• Log collection" },
  ran: { title: "RAN Support", desc: "RAN Support", placeholder: "e.g. RAN alarm cell down troubleshooting?", intro: "Ask me about RAN issues:<br>• Cell down / Cell out of service<br>• VSWR alarms<br>• S1 / X2 link down" },
  tc30: { title: "TC30 Support", desc: "TC30 Docs", placeholder: "e.g. TC30 HWM installation steps?", intro: "You can ask me about TC30 Products:<br>• HWM installation<br>• TC30 commissioning<br>• Cloud config" },
  Comparison: { title: "Pre/Post-Check Comparison", desc: "Comparison Tool", placeholder: "Upload files to compare", intro: "COMPARE_MODE" },
  Audit: { title: "Audit Analysis", desc: "Audit Tool", placeholder: "Upload audit file", intro: "AUDIT_MODE" }
};

let currentTopic = 'hotline';
const STORAGE_KEY = 'tass_recent_searches';
const MAX_HISTORY = 20;
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

function getTimeString(date = new Date()) { return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function loadRecentSearches() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveRecentSearch(query) {
  if (!query.trim()) return;
  const history = loadRecentSearches();
  const now = new Date();
  if (history.length && history[0].text.toLowerCase() === query.toLowerCase()) { history[0].time = now.toISOString(); localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); renderRecentSearches(); return; }
  const entry = { id: Date.now(), text: query, time: now.toISOString(), topic: currentTopic };
  history.unshift(entry); if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); renderRecentSearches();
}
function renderRecentSearches() {
  const list = document.getElementById('recentSearchesList'); if (!list) return;
  const history = loadRecentSearches();
  if (!history.length) { list.innerHTML = `<div class="empty-recent">No recent searches</div>`; return; }
  list.innerHTML = history.map(item => {
    const d = new Date(item.time); const timeLabel = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); const dateLabel = d.toLocaleDateString([], { day:'2-digit', month:'short' });
    const safeText = item.text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<div class="recent-item" onclick="reuseSearch('${safeText.replace(/'/g, "\\'")}')"><div class="recent-item-left"><i class="fa-solid fa-magnifying-glass"></i><div class="recent-text">${safeText}</div></div><div class="recent-time">${timeLabel}<br><span style="font-size:9px; opacity:0.7">${dateLabel}</span></div></div>`;
  }).join('');
}
function reuseSearch(text) { setInput(text); }
function clearRecentSearches() { if (!confirm('Clear all recent searches?')) return; localStorage.removeItem(STORAGE_KEY); renderRecentSearches(); }

function setPrompt(topic) {
  const p = prompts[topic]; if(!p) return;
  currentTopic = topic;
  const chatMessages = document.getElementById('chatMessages'); if (chatMessages) chatMessages.innerHTML = '';
  const staticDiv = document.getElementById('defaultWelcome'); if (staticDiv) staticDiv.style.display = 'none';
  document.querySelectorAll('.nav-card').forEach(c => c.classList.remove('active'));
  if (window.event && window.event.currentTarget) { window.event.currentTarget.classList.add('active'); }

  const panel = document.getElementById('selectedTopicPanel');
  panel.style.display = 'block'; panel.classList.remove('hidden');

  if (topic === 'Comparison') {
    panel.innerHTML = `
      <div class="ttss-label"><i class="fa-solid fa-code-compare"></i> TASS - PRE/POST-CHECK COMPARISON</div>
      <div style="font-size:13px; margin-bottom:15px;">Upload Pre and Post check files separately and click Submit to analyze.</div>
      <div style="display:flex; gap:20px; margin:15px 0;">
        <div style="flex:1; background:#f8fafc; padding:12px; border:1px dashed #cbd5e1; border-radius:8px;">
          <label style="font-weight:700; font-size:12px;">Pre-Check File</label><br>
          <input type="file" id="preFile" accept=".txt,.log,.csv,.json" style="margin-top:8px;">
        </div>
        <div style="flex:1; background:#f8fafc; padding:12px; border:1px dashed #cbd5e1; border-radius:8px;">
          <label style="font-weight:700; font-size:12px;">Post-Check File</label><br>
          <input type="file" id="postFile" accept=".txt,.log,.csv,.json" style="margin-top:8px;">
        </div>
      </div>
      <button class="send-btn" onclick="handlePrePostCompare()"><i class="fa-solid fa-magnifying-glass-chart"></i> Submit & Compare</button>
      <div id="compareResult" style="margin-top:20px;"></div>
      <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div>
    <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
    <button class="download-btn" onclick="downloadAsHtml(this)"><i class="fa-solid fa-download"></i> Download as.html</button>
    <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
  `;
  const inputEl = document.getElementById('questionInput'); if (inputEl) { inputEl.placeholder = p.placeholder; inputEl.value = ''; inputEl.focus(); }
}

function resetWelcome(){ location.reload(); }
function setInput(text){ document.getElementById('questionInput').value = text; document.getElementById('questionInput').focus(); }
function clearInput(){ document.getElementById('questionInput').value = ''; }
function clearChat(){
  document.getElementById('chatMessages').innerHTML = '';
  const panel = document.getElementById('selectedTopicPanel');
  if(panel) { const p = prompts[currentTopic]; panel.innerHTML = `<div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div><div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>`; panel.style.display = 'block'; }
}

// This function is separate
function downloadAsHtml(btn){ /* your existing download code - keep as is */ }

async function sendMessage(){
  const input = document.getElementById('questionInput'); if(!input.value.trim()) return;
  const query = input.value.trim(); const chat = document.getElementById('chatMessages'); const nowTime = getTimeString();
  saveRecentSearch(query);
  chat.innerHTML += `<div class="user-message-wrap"><div class="user-bubble"><div class="user-text">${query}</div><div class="message-time right"><i class="fa-regular fa-clock"></i> ${nowTime}</div></div></div>`;
  document.getElementById('thinking').classList.remove('hidden'); input.value = '';
  const container = document.getElementById('chatContainer'); container.scrollTop = container.scrollHeight;
  const endpoints = [`${BACKEND_URL}/ask`, `${BACKEND_URL}/query`];
  let data = null; let lastError = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: query, topic: currentTopic }) });
      if(!res.ok){ const text = await res.text(); lastError = `${res.status} - ${text}`; continue; }
      data = await res.json(); break;
    } catch (e) { lastError = e.message; }
  }
  document.getElementById('thinking').classList.add('hidden'); const replyTime = getTimeString();
  if (!data) {
    chat.innerHTML += `<div class="tass-message-wrap"><div class="ttss-message" style="border-left: 3px solid #d93025;"><div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${prompts[currentTopic].title}</div><div style="color:#d93025;"><b>Failed:</b> ${lastError}</div></div><div class="message-time left"><i class="fa-regular fa-clock"></i> ${replyTime}</div></div>`;
    container.scrollTop = container.scrollHeight; return;
  }
  const rawAnswer = data.answer || JSON.stringify(data, null, 2); const sources = data.sources || []; const images = data.images || [];
  let safeAnswer; const containsHtml = /<(img|table|pre|ul|ol|li|br|p|h[1-6])\b/i.test(rawAnswer);
  if(containsHtml){ safeAnswer = rawAnswer; } else { safeAnswer = rawAnswer.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  let imagesHtml = ''; if(images.length){ imagesHtml = images.map(src => { let finalSrc = src; if(!src.startsWith('http') && src.startsWith('/')){ finalSrc = BACKEND_URL + src; } return `<div style='margin:12px 0;'><img src="${finalSrc}" alt="Support Image" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;" onerror="this.style.display='none'" /></div>`; }).join(''); }
  const sourcesHtml = sources.length? `<div class="sources"><b>Sources:</b> ${sources.map(s => s.file || s).join(', ')}</div>` : '';
  chat.innerHTML += `<div class="tass-message-wrap"><div class="ttss-message"><div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${prompts[currentTopic].title}</div><div class="answer-content">${safeAnswer}${imagesHtml}</div>${sourcesHtml}<button class="download-btn" onclick="downloadAsHtml(this)"><i class="fa-solid fa-download"></i> Download as.html</button></div><div class="message-time left"><i class="fa-regular fa-clock"></i> ${replyTime}</div></div>`;
  container.scrollTop = container.scrollHeight;
} // <-- sendMessage ends HERE - IMPORTANT

// --- NEW FUNCTION - MUST BE OUTSIDE sendMessage ---
async function handlePrePostCompare() {
  const preInput = document.getElementById('preFile');
  const postInput = document.getElementById('postFile');
  const resultDiv = document.getElementById('compareResult');
  if (!preInput.files[0] ||!postInput.files[0]) { alert("Please browse and select both Pre and Post files"); return; }
  resultDiv.innerHTML = `<div class="thinking"><span class="dot-anim"></span> Analyzing files...</div>`;
  const formData = new FormData();
  formData.append('pre_file', preInput.files[0]);
  formData.append('post_file', postInput.files[0]);
  try {
    const res = await fetch(`${BACKEND_URL}/compare`, { method: 'POST', body: formData });
    const data = await res.json();
    resultDiv.innerHTML = `<div class="ttss-message" style="max-width:100%; background:#f0fdf4; border-left:3px solid #16a34a;"><b>Summary:</b> ${data.summary}<br><b>Added:</b> ${data.added?.length || 0} | <b>Removed:</b> ${data.removed?.length || 0}<pre style="margin-top:10px; background:white; padding:10px; border-radius:8px; max-height:300px; overflow:auto;">${JSON.stringify(data, null, 2)}</pre></div>`;
  } catch (err) {
    resultDiv.innerHTML = `<div style="color:red;"><b>Error:</b> ${err.message} - Check if backend is running on ${BACKEND_URL}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderRecentSearches();
  const inp = document.getElementById('questionInput');
  if(inp){ inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendMessage(); }); }
});