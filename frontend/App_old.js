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

function setPrompt(topic) {
  const p = prompts[topic];
  currentTopic = topic;
  const chatMessages = document.getElementById('chatMessages');
  if (chatMessages) chatMessages.innerHTML = '';
  const staticDiv = document.getElementById('defaultWelcome');
  if (staticDiv) staticDiv.remove();
  document.querySelectorAll('.nav-card').forEach(c => c.classList.remove('active'));
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add('active');
  } else {
    const idx = Object.keys(prompts).indexOf(topic);
    document.querySelectorAll('.nav-card')[idx]?.classList.add('active');
  }
  const panel = document.getElementById('selectedTopicPanel');
  panel.style.display = 'block';
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div>
    <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
    <button class="download-btn" onclick="downloadAsHtml(this)"><i class="fa-solid fa-download"></i> Download as .html</button>
    <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
  `;
  const inputEl = document.getElementById('questionInput');
  if (inputEl) {
    inputEl.placeholder = p.placeholder;
    inputEl.value = '';
    inputEl.focus();
  }
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
    const p = prompts[currentTopic];
    panel.innerHTML = `
      <div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div>
      <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
      <button class="download-btn" onclick="downloadAsHtml(this)"><i class="fa-solid fa-download"></i> Download as .html</button>
      <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
    `;
    panel.style.display = 'block';
  }
}

// NEW: Download as self-contained HTML with images
function downloadText(btn){
  downloadAsHtml(btn);
}

function downloadAsHtml(btn){
  const messageEl = btn.closest('.ttss-message');
  if(!messageEl) return;
  
  const clone = messageEl.cloneNode(true);
  clone.querySelectorAll('.download-btn').forEach(b => b.remove());

  // Convert any relative image src to absolute if possible, and preserve
  clone.querySelectorAll('img').forEach(img => {
    // Make images responsive in exported file
    img.style.maxWidth = '100%';
    // If image is base64 or external, keep as is - it will be embedded
    // If src is blob, we try to keep it, but blob URLs won't work after export
    // So we keep the src attribute as is
  });

  const answerHtml = clone.innerHTML;
  const topicTitle = prompts[currentTopic]?.title || currentTopic;
  const timestamp = new Date().toLocaleString();
  const fileNameTime = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TASS - ${topicTitle} - ${timestamp}</title>
<style>
  body{font-family:'Segoe UI',Inter,sans-serif;background:#f1f5f9;margin:0;padding:0;color:#334155;}
  .header{background:#0259FF;color:white;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;}
  .header .title{font-size:16px;font-weight:700;}
  .container{max-width:900px;margin:24px auto;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.05);}
  .ttss-label{font-size:11px;font-weight:900;color:#123A8A;margin-bottom:12px;letter-spacing:0.6px;text-transform:uppercase;display:flex;align-items:center;gap:6px;}
  .answer-content{white-space:pre-wrap;line-height:1.7;font-size:13.5px;word-break:break-word;}
  .answer-content img{max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:8px;margin:12px 0;display:block;}
  .answer-content table{border-collapse:collapse;width:100%;margin:12px 0;}
  .answer-content th,.answer-content td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px;}
  .answer-content th{background:#f8fafc;}
  .answer-content pre{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;overflow-x:auto;}
  .sources{margin-top:16px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:12px;opacity:0.8;}
  .footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:20px;padding:12px;border-top:1px solid #f1f5f9;}
  .meta{font-size:11px;color:#64748b;margin-bottom:16px;padding:10px;background:#f8fafc;border-radius:8px;display:flex;gap:16px;flex-wrap:wrap;}
  @media print{body{background:white}.header{background:#0259FF !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.container{box-shadow:none;border:none;margin:0;max-width:100%}}
</style>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</head>
<body>
<div class="header">
  <div class="title">NOKIA - TMO AI Support System | ${topicTitle}</div>
  <div style="font-size:11px;opacity:0.9">${timestamp}</div>
</div>
<div class="container">
  <div class="meta">
    <span><b>Topic:</b> ${topicTitle}</span>
    <span><b>Exported:</b> ${timestamp}</span>
    <span><b>System:</b> TASS Powered by Nokia</span>
  </div>
  ${answerHtml}
  <div class="footer">© 2026 Nokia | TASS Powered by Nokia - Exported as HTML with images</div>
</div>
</body>
</html>`;

  const blob = new Blob([htmlContent], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TASS_${currentTopic}_${fileNameTime}.html`;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
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
  const images = data.images || []; // backend can return list of image urls/base64
  
  // Preserve HTML if answer contains img tags, otherwise escape
  let safeAnswer;
  const containsHtml = /<(img|table|pre|ul|ol|li|br|p|h[1-6])\b/i.test(rawAnswer);
  if(containsHtml){
    safeAnswer = rawAnswer; // backend already returns HTML
  } else {
    safeAnswer = rawAnswer.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  
  // Render images if provided separately
  let imagesHtml = '';
  if(images.length){
    imagesHtml = images.map(src => `<img src="${src}" alt="RAN Support Image" style="max-width:100%;border-radius:8px;margin:10px 0;border:1px solid #e2e8f0;" />`).join('');
  }

  const sourcesHtml = sources.length ? `<div class="sources"><b>Sources:</b> ${sources.map(s => s.file || s).join(', ')} • <span style="font-size:10px;">Topic: ${currentTopic}</span></div>` : '';

  chat.innerHTML += `<div class="tass-message-wrap"><div class="ttss-message"><div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${prompts[currentTopic].title}</div><div class="answer-content" style="white-space: pre-wrap; line-height:1.6; font-size:13px;">${safeAnswer}${imagesHtml}</div>${sourcesHtml}<button class="download-btn" onclick="downloadAsHtml(this)"><i class="fa-solid fa-download"></i> Download as .html</button></div><div class="message-time left"><i class="fa-regular fa-clock"></i> ${replyTime} • ${prompts[currentTopic].title}</div></div>`;
  container.scrollTop = container.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  renderRecentSearches();
  const inp = document.getElementById('questionInput');
  if(inp){ inp.addEventListener('keydown', (e)=>{ if(e.key==='Enter') sendMessage(); }); }
});
