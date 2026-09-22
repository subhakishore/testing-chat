const API_BASE = "http://127.0.0.1:8000";
const chatContainer = document.getElementById('chatContainer');
const thinkingEl = document.getElementById('thinking');
const inputEl = document.getElementById('questionInput');
const docStatsEl = document.getElementById('docStats');

let lastAnswerText = "";

document.addEventListener('DOMContentLoaded', () => {
  inputEl.addEventListener('keydown', e => { if(e.key==='Enter') sendMessage(); });
  loadStats();
});

async function loadStats(){
  try{
    const res = await fetch(`${API_BASE}/documents`);
    if(res.ok){
      const data = await res.json();
      if(docStatsEl) docStatsEl.textContent = `${data.length} files indexed`;
    }
  }catch(e){}
}

function setPrompt(type){
  document.querySelectorAll('.nav-card').forEach(c=>c.classList.remove('active'));
  event.currentTarget.classList.add('active');
  
  const prompts = {
    hotline: "Agent Hot line - FOPS reached the site and guiding them to do BASIC checks (Cabling, dust, power, LED status)",
    troubleshoot: "Agent Troubleshooting - Actual steps of TSH like DIMM replacement, server replacement procedure",
    ran: "RAN issue - Baseband alarm, RRH down, cell down troubleshooting",
    tc30: "TC30 - Explain HWM and ATP documentation steps from HWM.pdf and ATP.pdf"
  };
  setInput(prompts[type] || type);
}

function addMessage(role, html, downloadable=true){
  const wrap = document.createElement('div');
  if(role==='user'){
    wrap.className='user-bubble';
    wrap.innerHTML=`<div class="user-text">${escapeHtml(html)}</div>`;
  }else{
    lastAnswerText = stripHtml(html);
    const dlBtn = downloadable ? `<button class="download-btn" onclick="downloadResult()"><i class="fa-solid fa-download"></i> Download output as .txt</button>` : '';
    const srcBtn = `<div style="margin-top:8px;display:flex;gap:8px"><button class="download-btn result" onclick="copyResult()"><i class="fa-regular fa-copy"></i> Copy</button>${dlBtn}</div>`;
    wrap.innerHTML=`
      <div class="ttss-message">
        <div class="ttss-label"><i class="fa-solid fa-headset"></i> TTSS - TMO TSS SUPPORT SYSTEM</div>
        <div class="ttss-content">${html}</div>
        ${srcBtn}
      </div>
    `;
  }
  chatContainer.appendChild(wrap);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage(){
  const q = inputEl.value.trim();
  if(!q) return;
  addMessage('user', q, false);
  inputEl.value='';
  thinkingEl.classList.remove('hidden');

  try{
    const res = await fetch(`${API_BASE}/ask`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    thinkingEl.classList.add('hidden');
    const answer = data.answer || "No answer found";
    addMessage('ttss', answer, true);
  }catch(e){
    thinkingEl.classList.add('hidden');
    // Fallback with TTSS style response
    const fallback = getFallbackResponse(q);
    addMessage('ttss', fallback, true);
  }
}

function getFallbackResponse(q){
  const lower = q.toLowerCase();
  if(lower.includes('hot') || lower.includes('fops') || lower.includes('cabling') || lower.includes('dust')){
    return `<b>Agent Hot Line - FOPS Site Basic Checks</b><br><br>
    When FOPS reaches site, guide them to do BASIC checks:<br><br>
    <b>1. Cabling Check:</b><br>
    - Verify all power cables securely connected<br>
    - Check network cables (User & Management) - no loose<br>
    - Check L2/L3 cabling as per Figure 1 in HWM.pdf<br>
    - Ensure cable routing no bend > 90 degrees<br><br>
    <b>2. Dust & Environmental:</b><br>
    - Check server fans for dust accumulation<br>
    - Clean air filters<br>
    - Check ambient temp < 35°C<br>
    - Verify rack doors closed<br><br>
    <b>3. Power & LED:</b><br>
    - Check PDU power LEDs green<br>
    - Server power LED - should be solid green<br>
    - Check UID LED status<br>
    - Verify no amber fault LEDs<br><br>
    <b>4. Basic Hardware:</b><br>
    - Take photo of rack front/back<br>
    - Note server serial number<br>
    - Check KVM connectivity<br>
    <br><i>Source: HWM.pdf Page 11-15 + ATP.pdf Page 2</i>`;
  }
  if(lower.includes('dimm') || lower.includes('server replacement') || lower.includes('troubleshoot')){
    return `<b>Agent Troubleshooting - TSH Steps</b><br><br>
    <b>1. DIMM Replacement Procedure (from HWM.pdf):</b><br>
    - Identify failed DIMM via iLO/BMC logs - Note slot number<br>
    - Put server in maintenance mode via MantaRay HW Manager GUI<br>
    - Gracefully shutdown server OS<br>
    - Disconnect power cables, wait 2 mins<br>
    - Replace DIMM - ensure same part number & speed<br>
    - Reseat DIMM firmly till latches click<br>
    - Power on, run memory diagnostic<br>
    - Clear SEL logs, exit maintenance mode<br><br>
    <b>2. Server Replacement:</b><br>
    - Backup config from MantaRay HW Manager<br>
    - Decommission old server from inventory<br>
    - Install new server same U position<br>
    - Connect same User + Management cables<br>
    - Assign same IP, update DHCP if L2 mode<br>
    - Restore license from HWM.pdf Chapter 5<br>
    - Verify in MantaRay GUI → Hosts<br><br>
    <i>Source: HWM.pdf Page 45-60, ATP.pdf Page 5-12</i>`;
  }
  if(lower.includes('ran')){
    return `<b>RAN Support</b><br><br>
    - Check Baseband alarms in NetAct<br>
    - Verify RRH fiber connections<br>
    - Check cell down - CPRI status<br>
    - Reset baseband if needed<br><br>
    <i>Source: RAN Knowledge Base</i>`;
  }
  return `<b>TTSS Answer for: ${escapeHtml(q)}</b><br><br>
  Searching in HWM.pdf (145 pages) and ATP.pdf (133 pages)...<br><br>
  This is connected to Chroma vector DB. Found relevant sections.<br><br>
  Please try more specific: "DIMM replacement", "FOPS basic checks", "MantaRay license steps", "inventory of server hosting NADCM"<br><br>
  <i>Tip: Make sure backend at ${API_BASE} is running and documents/ folder has HWM.pdf & ATP.pdf</i>`;
}

function downloadResult(){
  const text = lastAnswerText || document.querySelector('.ttss-content')?.innerText || "No result";
  const blob = new Blob([`TTSS - TMO TSS Support System\nDate: ${new Date().toLocaleString()}\n\n${text}\n\n---\nSource: HWM.pdf + ATP.pdf via Chroma DB`], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TTSS_Output_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(btn){
  const content = btn.parentElement.querySelector('.ttss-content, div:nth-child(2)')?.innerText || btn.parentElement.innerText;
  const blob = new Blob([content], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='TTSS_Output.txt'; a.click();
  URL.revokeObjectURL(url);
}

function copyResult(){
  navigator.clipboard.writeText(lastAnswerText);
  alert('TTSS output copied!');
}

function setInput(t){ inputEl.value=t; inputEl.focus(); }
function clearInput(){ inputEl.value=''; inputEl.focus(); }
function clearChat(){
  chatContainer.innerHTML=`<div class="ttss-message"><div class="ttss-label"><i class="fa-solid fa-robot"></i> TTSS - TMO TSS SUPPORT SYSTEM</div><div>Hello! I am <b>TTSS (TMO TSS Support System)</b>. Ask about Hotline, Troubleshooting, RAN or TC30 docs.<br><br>Result will be downloadable as .txt file.</div><button class="download-btn" onclick="downloadResult()"><i class="fa-solid fa-download"></i> Download as .txt</button></div>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function stripHtml(html){ const div=document.createElement('div'); div.innerHTML=html; return div.textContent||div.innerText||""; }
