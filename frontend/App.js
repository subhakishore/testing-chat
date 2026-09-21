const API_BASE = "http://127.0.0.1:8000";
const chatContainer = document.getElementById('chatContainer');
const thinkingEl = document.getElementById('thinking');
const inputEl = document.getElementById('questionInput');
const sourcesListEl = document.getElementById('sourcesList');
const recentListEl = document.getElementById('recentList');
const sourceCountEl = document.getElementById('sourceCount');
const docStatsEl = document.getElementById('docStats');

let documents = [
  { name:'NADCM_Guide.pdf', type:'pdf', size:'2.4 MB • 84 pages', active:true },
  { name:'HR_Guidelines.pdf', type:'pdf', size:'1.8 MB', active:false },
  { name:'Policy.doc', type:'doc', size:'840 KB', active:false },
];

document.addEventListener('DOMContentLoaded', () => {
  renderSources();
  renderRecent();
  loadDocuments();
  inputEl.addEventListener('keydown', e => { if(e.key==='Enter') sendMessage(); });
});

function renderSources(){
  if(!sourcesListEl) return;
  sourcesListEl.innerHTML = documents.map(doc => `
    <div class="source-card ${doc.active?'active':''}" onclick="askAboutDoc('${doc.name}')">
      <div class="source-icon ${doc.type}"><i class="fa-solid ${doc.type==='pdf'?'fa-file-pdf':'fa-file-word'}"></i></div>
      <div class="source-info">
        <div class="source-name">${doc.name}</div>
        <div class="source-meta">${doc.size}</div>
      </div>
      ${doc.active?'<div class="source-check"><i class="fa-solid fa-circle-check"></i></div>':''}
    </div>
  `).join('');
  if(sourceCountEl) sourceCountEl.textContent = documents.length;
  if(docStatsEl) docStatsEl.textContent = `${documents.length} files indexed in Chroma`;
}

async function loadDocuments(){
  try{
    const res = await fetch(`${API_BASE}/documents`);
    if(res.ok){
      const data = await res.json();
      if(Array.isArray(data) && data.length>0){
        documents = data.map(d=>({
          name: d.name,
          type: d.type || (d.name.toLowerCase().endsWith('.pdf')?'pdf':'doc'),
          size: d.size || '',
          active: d.active || d.name==='NADCM_Guide.pdf'
        }));
        renderSources();
      }
    }
  }catch(e){ console.log("Using fallback docs, backend /documents not reachable"); }
}

function renderRecent(){
  if(!recentListEl) return;
  const recents = JSON.parse(localStorage.getItem('recentQueries')||'["leave policy","NADCM Guide summary","remote work policy"]');
  recentListEl.innerHTML = recents.map(r=>`
    <div class="recent-item" onclick="setInput('${r.replace(/'/g,"\\'")}')"><i class="fa-solid fa-magnifying-glass" style="font-size:10px;color:#94a3b8"></i> ${r}</div>
  `).join('');
}

function saveRecent(q){
  let recents = JSON.parse(localStorage.getItem('recentQueries')||'[]');
  recents = [q, ...recents.filter(x=>x!==q)].slice(0,6);
  localStorage.setItem('recentQueries', JSON.stringify(recents));
  renderRecent();
}

function addMessage(role, html, sources=[]){
  const wrap = document.createElement('div');
  if(role==='user'){
    wrap.className='user-bubble';
    wrap.innerHTML=`<div class="user-text">${html}</div>`;
  }else{
    wrap.innerHTML=`
      <div class="bot-message">
        <div class="bot-label"><i class="fa-solid fa-robot"></i> BOT</div>
        <div>${html}</div>
        ${sources.length?`<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">${sources.map(s=>`<span style="font-size:10px;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 6px;border-radius:8px"><i class="fa-solid fa-paperclip"></i> ${s}</span>`).join('')}</div>`:''}
      </div>
    `;
    wrap.style.marginBottom='12px';
  }
  chatContainer.appendChild(wrap);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage(){
  const q = inputEl.value.trim();
  if(!q) return;
  addMessage('user', escapeHtml(q));
  saveRecent(q);
  inputEl.value='';
  thinkingEl.classList.remove('hidden');
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try{
    const res = await fetch(`${API_BASE}/ask`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ question: q })
    });
    if(!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    thinkingEl.classList.add('hidden');
    const answer = data.answer || data.response || data.result || "No answer";
    const srcs = data.sources || (data.source?[data.source]:[]);
    addMessage('bot', answer, srcs);
  }catch(e){
    thinkingEl.classList.add('hidden');
    addMessage('bot', `Backend not reachable at <b>${API_BASE}</b><br>Make sure backend is running: <code>python backend/main.py</code><br><br>Preview: Found relevant info for "<b>${escapeHtml(q)}</b>" in NADCM_Guide.pdf`, ["NADCM_Guide.pdf"]);
  }
}

function askAboutDoc(name){ setInput(`What is in ${name}?`); }
function setInput(t){ inputEl.value=t; inputEl.focus(); }
function clearInput(){ inputEl.value=''; inputEl.focus(); }
function clearChat(){
  chatContainer.innerHTML=`<div class="bot-message"><div class="bot-label"><i class="fa-solid fa-robot"></i> BOT</div><div>Hello! Ask me anything about your documents. I search across <b>documents/</b> via Chroma vector DB and cite sources.</div></div>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
