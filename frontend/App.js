const prompts = {
  hotline: { title: "AGENT HOT LINE", desc: "Hot Line Support", placeholder: "Ask about FOPS basic checks for DIMM failure?", intro: "How can I guide you on FOPS checks? You can ask:<br>• FOPS basic checklist<br>• DIMM failure steps<br>• Node reboot procedure" },
  troubleshoot: { title: "AGENT TROUBLESHOOTING", desc: "Troubleshooting", placeholder: "Ask about alarm troubleshooting steps...", intro: "I'm ready to help with alarms & HW. Ask about:<br>• Critical alarm triage<br>• HW replacement flow<br>• Log collection" },
  ran: { title: "RAN Support", desc: "RAN Support", placeholder: "e.g. RAN alarm cell down troubleshooting?", intro: "Ask me about RAN issues:<br>• Cell down / Cell out of service<br>• VSWR alarms<br>• S1 / X2 link down" },
  tc30: { title: "TC30 Support", desc: "TC30 Docs", placeholder: "e.g. TC30 HWM installation steps?", intro: "You can ask me about TC30 Products:<br>• HWM installation<br>• TC30 commissioning<br>• Cloud config" },
  Comparison: { title: "Pre/Post-Check Comparison", desc: "Comparison Tool", placeholder: "Upload files to compare", intro: "COMPARE_MODE" },
  Audit: { title: "Audit Analysis", desc: "Audit Tool", placeholder: "Upload audit file for analysis", intro: "AUDIT_MODE" }
};

let currentTopic = 'hotline';
const STORAGE_KEY = 'tass_recent_searches';
const MAX_HISTORY = 20;
const BACKEND_PORT = 8000;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const COMPARISON_BACKEND_PORT = 8001;
const COMPARISON_BACKEND_URL = `http://127.0.0.1:${COMPARISON_BACKEND_PORT}`;

let auditRawData = [];
let auditHeaders = [];
let auditFileName = "";

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

  // FIX 2: Hide bottom query box for Comparison and Audit
  const inputArea = document.getElementById('inputArea');
  const tryRow = document.getElementById('tryRow');
  const hideQuery = (topic === 'Comparison' || topic === 'Audit');
  if(inputArea) inputArea.style.display = hideQuery ? 'none' : 'flex';
  if(tryRow) tryRow.style.display = hideQuery ? 'none' : 'flex';

  if (topic === 'Comparison') {
    panel.innerHTML = `
      <div class="ttss-label"><i class="fa-solid fa-code-compare"></i> TASS - PRE/POST-CHECK COMPARISON (Exact)</div>
      <div style="font-size:13px; margin-bottom:15px; color:#475569;">Upload Pre and Post check <b>.txt</b> files (with alpha, numeric, special chars like [root@NAMELG03 ~]#). Output keeps 100% exact - like Notepad++ Compare.</div>
      <div style="display:flex; gap:20px; margin:15px 0;">
        <div style="flex:1; background:#f8fafc; padding:12px; border:1px dashed #94a3b8; border-radius:8px;">
          <label style="font-weight:700; font-size:12px;">Pre-Check File (.txt)</label><br>
          <input type="file" id="preFile" accept=".txt,.log,.csv" style="margin-top:8px; width:100%">
          <div id="preFileName" style="font-size:11px; color:#64748b; margin-top:5px"></div>
        </div>
        <div style="flex:1; background:#f8fafc; padding:12px; border:1px dashed #94a3b8; border-radius:8px;">
          <label style="font-weight:700; font-size:12px;">Post-Check File (.txt)</label><br>
          <input type="file" id="postFile" accept=".txt,.log,.csv" style="margin-top:8px; width:100%">
          <div id="postFileName" style="font-size:11px; color:#64748b; margin-top:5px"></div>
        </div>
      </div>
      <button class="send-btn" onclick="handlePrePostCompare()" style="background:#0f172a; color:white; padding:10px 20px; border:none; border-radius:8px; cursor:pointer; font-weight:600;"><i class="fa-solid fa-magnifying-glass-chart"></i> Submit & Compare (Exact)</button>
      <div id="compareStatus" style="margin-top:15px; font-size:12px; color:#64748b;">Backend: ${COMPARISON_BACKEND_URL}</div>
      <div id="compareResult" style="margin-top:20px;"></div>
      <div style="margin-top:15px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
    `;
    setTimeout(()=>{
      const pre = document.getElementById('preFile');
      const post = document.getElementById('postFile');
      if(pre) pre.addEventListener('change', (e)=>{ document.getElementById('preFileName').textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name} (${e.target.files[0].size} bytes)` : ''; });
      if(post) post.addEventListener('change', (e)=>{ document.getElementById('postFileName').textContent = e.target.files[0] ? `Selected: ${e.target.files[0].name} (${e.target.files[0].size} bytes)` : ''; });
    }, 100);
    return;
  }

  if (topic === 'Audit') {
    // FIX 1: SINGLE UPLOAD OPTION ONLY
    panel.innerHTML = `
      <div class="ttss-label"><i class="fa-solid fa-file-csv"></i> TASS - AUDIT ANALYSIS - CSV/EXCEL</div>
      <div style="font-size:13px; color:#475569; margin-bottom:14px;">Upload your audit data as <b>.csv, .xlsx or .xls</b>. Analysis runs 100% in browser. Download options appear after upload.</div>
      
      <input type="file" id="auditFile" accept=".csv,.xlsx,.xls" style="display:none" />

      <div id="auditDropZone" class="audit-upload-area">
        <div style="font-size:40px; color:#0259FF; margin-bottom:8px;"><i class="fa-solid fa-cloud-arrow-up"></i></div>
        <div style="font-weight:800; font-size:15px; color:#0f172a;">Upload Audit File</div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">Drag & drop .csv / .xlsx / .xls here or click to browse</div>
        <div style="margin-top:14px;"><span style="background:#0259FF; color:white; padding:10px 18px; border-radius:8px; font-size:12px; font-weight:700; display:inline-flex; gap:8px; align-items:center;"><i class="fa-solid fa-folder-open"></i> Browse File</span></div>
        <div style="font-size:10px; color:#94a3b8; margin-top:10px;">Parsed locally - no server upload</div>
      </div>

      <div id="auditFileName" style="font-size:12px; color:#0f172a; font-weight:600; margin-top:12px;"></div>
      <div id="auditStatus" style="font-size:12px; color:#64748b; margin-top:8px;">No file uploaded yet.</div>

      <div class="audit-toolbar" id="auditDownloadGroup" style="display:none; margin-top:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px;">
        <div style="font-size:11px; font-weight:800; color:#0f172a; margin-bottom:8px;"><i class="fa-solid fa-download"></i> Download:</div>
        <div class="audit-download-group" style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="audit-download-btn" onclick="downloadAuditReport()" style="display:inline-flex; background:#0f172a; color:white; border:none; padding:8px 14px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;"><i class="fa-solid fa-file-arrow-down"></i> HTML Report</button>
          <button class="audit-download-btn secondary" onclick="exportAuditCsv()" style="display:inline-flex; background:white; color:#0f172a; border:1px solid #cbd5e1; padding:8px 14px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;"><i class="fa-solid fa-file-csv"></i> CSV</button>
          <button class="audit-download-btn secondary" onclick="exportAuditExcel()" style="display:inline-flex; background:white; color:#0f172a; border:1px solid #cbd5e1; padding:8px 14px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;"><i class="fa-solid fa-file-excel"></i> Excel</button>
          <button class="audit-download-btn" id="cmosDlBtn" onclick="downloadCmosExcel()" style="display:none; background:#dc2626; color:white; border:none; padding:8px 14px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;"><i class="fa-solid fa-file-excel"></i> CMOS Issues (Separate Sheet)</button>
          <button class="audit-btn-secondary" onclick="clearAuditData()" style="display:inline-flex; background:white; border:1px solid #cbd5e1; padding:8px 14px; border-radius:8px; font-size:11px; font-weight:600; cursor:pointer;"><i class="fa-solid fa-trash"></i> Clear</button>
        </div>
      </div>

      <div id="auditResult" style="margin-top:18px;"></div>
      <div style="margin-top:18px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
    `;
    setTimeout(()=>{ initAuditListeners(); }, 100);
    return;
  }

  // Normal topics - show input box again
  panel.innerHTML = `
    <div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div>
    <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
    <button class="download-btn" onclick="downloadAsHtml(this)"><i class="fa-solid fa-download"></i> Download as.html</button>
    <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
  `;
  const inputEl = document.getElementById('questionInput'); if (inputEl) { inputEl.placeholder = p.placeholder; inputEl.value = ''; inputEl.focus(); }
}

function resetWelcome(){ 
  const inputArea = document.getElementById('inputArea');
  const tryRow = document.getElementById('tryRow');
  if(inputArea) inputArea.style.display='flex';
  if(tryRow) tryRow.style.display='flex';
  location.reload(); 
}
function setInput(text){ const el=document.getElementById('questionInput'); if(el){ el.value=text; el.focus(); } }
function clearInput(){ const el=document.getElementById('questionInput'); if(el) el.value=''; }
function clearChat(){
  document.getElementById('chatMessages').innerHTML = '';
  const panel = document.getElementById('selectedTopicPanel');
  if(panel) { 
    const p = prompts[currentTopic]; 
    if(p && (p.intro === 'AUDIT_MODE' || p.intro === 'COMPARE_MODE')){ setPrompt(currentTopic); } 
    else { 
      if(p) panel.innerHTML = `<div class="ttss-label"><i class="fa-solid fa-robot"></i> TASS - ${p.title}</div><div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>`;
      panel.style.display = 'block'; 
      const inputArea = document.getElementById('inputArea');
      const tryRow = document.getElementById('tryRow');
      if(inputArea) inputArea.style.display='flex';
      if(tryRow) tryRow.style.display='flex';
    } 
  }
}
function downloadAsHtml(btn){
  const content = btn.closest('.ttss-message').innerHTML;
  const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TASS Export</title></head><body>${content}</body></html>`], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='TASS_Response.html'; a.click(); URL.revokeObjectURL(url);
}

// AUDIT LOGIC
function initAuditListeners(){
  const fileInput = document.getElementById('auditFile');
  const dropZone = document.getElementById('auditDropZone');
  if(!fileInput || !dropZone) return;
  fileInput.addEventListener('change', (e)=>{ if(e.target.files[0]) handleAuditFile(e.target.files[0]); });
  ['dragenter','dragover'].forEach(ev=>{
    dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(ev=>{
    dropZone.addEventListener(ev, (e)=>{ e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });
  dropZone.addEventListener('click', ()=> fileInput.click());
  dropZone.addEventListener('drop', (e)=>{
    const file = e.dataTransfer.files[0];
    if(file) handleAuditFile(file);
  });
}
async function handleAuditFile(file){
  const validExt = ['csv','xlsx','xls'];
  const ext = file.name.split('.').pop().toLowerCase();
  if(!validExt.includes(ext)){ alert('Please upload .csv, .xlsx or .xls'); return; }
  auditFileName = file.name;
  document.getElementById('auditFileName').innerHTML = `<i class="fa-solid fa-file"></i> ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  document.getElementById('auditStatus').innerHTML = `<span style="color:#2563eb;"><i class="fa-solid fa-spinner fa-spin"></i> Parsing...</span>`;
  try {
    const data = await parseAuditFile(file);
    if(!data.length) throw new Error('Empty file');
    auditRawData = data;
    auditHeaders = Object.keys(data[0]);
    renderAuditAnalysis();
    const dlGroup = document.getElementById('auditDownloadGroup'); if(dlGroup) { dlGroup.style.display = 'block'; const inner = dlGroup.querySelector('.audit-download-group'); if(inner) inner.style.display='flex'; } const cmosBtn = document.getElementById('cmosDlBtn'); if(cmosBtn) { cmosBtn.style.display = cmosIssues.length ? 'inline-flex' : 'none'; }
    document.getElementById('auditStatus').innerHTML = `<span class="audit-badge ok">✓ Parsed ${data.length} rows, ${auditHeaders.length} cols</span> - Ready to download`;
  } catch(err){
    document.getElementById('auditStatus').innerHTML = `<span class="audit-badge error">❌ ${err.message}</span>`;
  }
}
function parseAuditFile(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const data = e.target.result;
        const workbook = XLSX.read(data, {type: file.name.endsWith('.csv') ? 'string' : 'array', raw:false, cellDates:true});
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(sheet, {defval:"", raw:false});
        resolve(json);
      }catch(err){ reject(err); }
    };
    reader.onerror = ()=> reject(new Error('File read error'));
    if(file.name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

const HW_AUDIT_LOGIC = [
  {
    "param": "COMPUTE ALL COMMANDS",
    "logic": ""
  },
  {
    "param": "All commands",
    "logic": "Old Logic"
  },
  {
    "param": "Uptime",
    "logic": "Not Required"
  },
  {
    "param": "Last Reboot count",
    "logic": "Not Required"
  },
  {
    "param": "System Online since Last Reboot",
    "logic": "Not Required"
  },
  {
    "param": "Last Reboot List Dates",
    "logic": "Not Required"
  },
  {
    "param": "Product Number",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "Serial Number",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "BMC IP Address",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "BMC MAC Address",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "Critical Sensor Data Record",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Non-Responsive Sensor Data Record",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "CMOS Sensor Status from BMC SEL Logs",
    "logic": "Not Required"
  },
  {
    "param": "CMOS Current Voltage",
    "logic": "Not Required"
  },
  {
    "param": "CMOS Last 30 Days Asserted and Deasserted events count from BMC SEL Logs",
    "logic": "Not Required"
  },
  {
    "param": "Disk error from BMC SEL Logs",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Uncorrectable ECC error from BMC SEL Logs",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Uncorrectable ECC Dates from BMC SEL Logs",
    "logic": "Not Required"
  },
  {
    "param": "Correctable ECC error from BMC SEL Logs",
    "logic": "Not Required"
  },
  {
    "param": "Correctable ECC logging limit reached from BMC SEL Logs",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Memory Device Disabled error from BMC SEL Logs",
    "logic": "Not Required"
  },
  {
    "param": "CPU/Processor error from BMC SEL Logs",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "CPU/Processor error Dates from BMC SEL Logs",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Number of DIMM Modules",
    "logic": "If found NOK and value is less than 12 , need to raise"
  },
  {
    "param": "Individual DIMM Size",
    "logic": "If found NOK or No data and value is less than 16 GB , need to raise"
  },
  {
    "param": "DIMM Total Size",
    "logic": "If found NOK and value is less than 187 , need to raise"
  },
  {
    "param": "Each DIMM Serial,Manufacture,Speed & Slot",
    "logic": "If found NOK or No Data , need to raise"
  },
  {
    "param": "Kernel Component Memory CE Error count from /var/log/messages",
    "logic": "Not Required"
  },
  {
    "param": "Kernel Component Memory CE Error count from dmesg -T",
    "logic": "Not Required"
  },
  {
    "param": "Kernel Component Memory CE Error count from /sys/devices/system/edac",
    "logic": "Not Required"
  },
  {
    "param": "Faulty DIMM Slot Location",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "BMC BIOS Version",
    "logic": "If found No Data  , need to raise"
  },
  {
    "param": "BMC Firmware Version",
    "logic": "If found No Data  , need to raise"
  },
  {
    "param": "CPU Model",
    "logic": "Not Required"
  },
  {
    "param": "CPU Frequency Scaling",
    "logic": "if value is less than 64 for compute servers and less than 48 for storagebm, need to raise"
  },
  {
    "param": "Nic Interfaces list",
    "logic": "Minimun count  should be 4 , If  less than 4 , need to raise"
  },
  {
    "param": "Nic Interfaces link status",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Nic Interfaces Firmware version",
    "logic": "If found No Data  , need to raise"
  },
  {
    "param": "Nic Interfaces Driver version",
    "logic": "If found No Data  , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Labels",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Size",
    "logic": "If size is less than 960 GB ,sda and sdb are in different size ,or No Data found  , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Health",
    "logic": "Value should be PASSED or OK, If not found , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Errors / Total Uncorrected Errors",
    "logic": "Value should be No Errors Logged or OK, If not found , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Serial Number",
    "logic": "If No Data found  , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Model Number",
    "logic": "If No Data found  , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Firmware Version",
    "logic": "Not Required"
  },
  {
    "param": "Compute/Master Hard Disk Media_Wearout_Indicator",
    "logic": "If  Wear_Leveling_Count VALUE is less or equal to 5 , WORST is less or equal to 5 , need to raise"
  },
  {
    "param": "Compute/Master Hard Disk Erase_Fail_Count",
    "logic": "Not Required"
  },
  {
    "param": "Redfish Version Status",
    "logic": "Not Required"
  },
  {
    "param": "Redfish SessionTimeout",
    "logic": "if value is less 900, need to raise"
  },
  {
    "param": "Pwr and Perf Profile (OEMPAPP000)",
    "logic": "Not Required"
  },
  {
    "param": "Boot mode select (FBO001)",
    "logic": "Not Required"
  },
  {
    "param": "Configure SATA as (PCHS002)",
    "logic": "Not Required"
  },
  {
    "param": "SR-IOV Support (PCIS007)",
    "logic": "Not Required"
  },
  {
    "param": "Ipv4 PXE Support (NWSK001)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #1 (FBO201)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #2 (FBO202)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #3 (FBO203)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #4 (FBO204)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #5 (FBO205)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #6 (FBO206)",
    "logic": "Not Required"
  },
  {
    "param": "UEFI - Boot Option #7 (FBO207)",
    "logic": "Not Required"
  },
  {
    "param": "STORAGE ALL COMMANDS",
    "logic": ""
  },
  {
    "param": "All commands",
    "logic": "Logic"
  },
  {
    "param": "Storage NVME Hard Disk Labels",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk PCI Slot",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk Size",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk Health",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk Errors / Total Uncorrected Errors",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk Serial Number",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk Model Number",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Storage NVME Hard Disk Firmware Version",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "Bad Block Count",
    "logic": "If found NOK or No Data, need to raise"
  },
  {
    "param": "CEPH Health Detail",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "CEPH list no of OSD's",
    "logic": "If found NOK and osd count should be 45 and all osd should be up,if not found  need to raise"
  },
  {
    "param": "Storage RAID Controller Model Number",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "JBOD Model Number",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "JBOD Firmware Build Package",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "JBOD Enclosure Disks Information for Storage",
    "logic": ""
  },
  {
    "param": "JBOD DISK INFORMATION",
    "logic": ""
  },
  {
    "param": "EID:SLT",
    "logic": "if Found NOK and total disk count should be  15 ,if not found , need to raise"
  },
  {
    "param": "DID",
    "logic": "Not Required"
  },
  {
    "param": "DISK STATE",
    "logic": "value should be  Onln-OK ,if not found , need to raise"
  },
  {
    "param": "DISK GROUP (DG)",
    "logic": "Not Required"
  },
  {
    "param": "DG/VD",
    "logic": "Not Required"
  },
  {
    "param": "VIRTUAL DISK (VD)",
    "logic": "Not Required"
  },
  {
    "param": "DISK LABEL",
    "logic": "Not Required"
  },
  {
    "param": "RAID TYPE",
    "logic": "Not Required"
  },
  {
    "param": "RAID STATE",
    "logic": "Not Required"
  },
  {
    "param": "RAID DISK ACCESS MODE",
    "logic": "Not Required"
  },
  {
    "param": "RAID DISK CACHE MODE",
    "logic": "Not Required"
  },
  {
    "param": "RAID DISK STRIP SIZE",
    "logic": "Not Required"
  },
  {
    "param": "DISK CAPACITY",
    "logic": "If found NOK and Disk size less than  480 GB , need to raise"
  },
  {
    "param": "DISK SMART HEALTH STATUS",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "ERROR STATUS/TOTAL UNCORRECTED ERRORS",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "DISK SERIAL NUMBER",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "DISK MODEL NUMBER",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "DISK FIRMWARE VERSION",
    "logic": "If found NOK or No Data  , need to raise"
  },
  {
    "param": "MEDIA WEAROUT INDICATOR",
    "logic": "If found NOK and  VALUE is less or equal to 5 , WORST is less or equal to 5 , need to raise"
  },
  {
    "param": "ERASE FAIL COUNT",
    "logic": "If found NOK and  VALUE is less or equal to 5 , WORST is less or equal to 5 , need to raise"
  },
  {
    "param": "OSD DETAILS",
    "logic": ""
  },
  {
    "param": "OSD ID",
    "logic": "OSD Count should be 13 , if found less than 13 , need to raise"
  },
  {
    "param": "OSD STATUS",
    "logic": "OSD Count should be 13 and all should be up-OK,if found less than 13 or Down-NOK, need to raise"
  },
  {
    "param": "OSD DEVICE LABEL",
    "logic": "Not Required"
  },
  {
    "param": "RAID TYPE",
    "logic": "Not Required"
  },
  {
    "param": "RAID STATE",
    "logic": "Not Required"
  },
  {
    "param": "EID:SLT",
    "logic": "Not Required"
  },
  {
    "param": "DID",
    "logic": "Not Required"
  },
  {
    "param": "DISK STATE",
    "logic": "OSD Count should be 13 and all should be Onln-OK, if not found  , need to raise"
  },
  {
    "param": "DG/VD",
    "logic": "Not Required"
  },
  {
    "param": "DISK GROUP (DG)",
    "logic": "Not Required"
  },
  {
    "param": "VIRTUAL DISK (VD)",
    "logic": "Not Required"
  },
  {
    "param": "DISK CAPACITY",
    "logic": "Not Required"
  },
  {
    "param": "DISK SMART HEALTH STATUS",
    "logic": "If found NOK , need to raise"
  },
  {
    "param": "FAST OSD DETAILS",
    "logic": ""
  },
  {
    "param": "FAST OSD ID",
    "logic": "Fast OSD Count should be 2 , if found less than 2 and Found NOK , need to raise"
  },
  {
    "param": "FAST OSD STATUS",
    "logic": "Fast OSD Count should be 2 , if found less than 2 and Found NOK , need to raise"
  },
  {
    "param": "FAST DEVICE LABEL",
    "logic": "Not required"
  },
  {
    "param": "NVME DISK PCI SLOT",
    "logic": "Not required"
  },
  {
    "param": "NVME DISK SIZE",
    "logic": "If Found No Data , need to raise"
  },
  {
    "param": "NVME DISK HEALTH",
    "logic": "Value should be PASSED, If not found , need to raise"
  },
  {
    "param": "NVME DISK ERRORS",
    "logic": "Value should be No Errors Logged, If not found , need to raise"
  },
  {
    "param": "NVME DISK SERIAL NUMBER",
    "logic": "If found NOK or No Data , need to raise"
  },
  {
    "param": "NVME DISK MODEL NUMBER",
    "logic": "If found NOK or No Data , need to raise"
  },
  {
    "param": "NVME DISK FIRMWARE VERSION",
    "logic": "If found NOK or No Data , need to raise"
  }
];


const CMOS_THRESHOLD = 3.50;

// --- STORAGE SERVER SEPARATION ---
function isStorageHost(hostName){
  return String(hostName||'').toLowerCase().includes('storage');
}

const STORAGE_ONLY_PARAMS = new Set([
  "Storage NVME Hard Disk Labels",
  "Storage NVME Hard Disk PCI Slot",
  "Storage NVME Hard Disk Size",
  "Storage NVME Hard Disk Health",
  "Storage NVME Hard Disk Errors / Total Uncorrected Errors",
  "Storage NVME Hard Disk Serial Number",
  "Storage NVME Hard Disk Model Number",
  "Storage NVME Hard Disk Firmware Version",
  "Bad Block Count",
  "CEPH Health Detail",
  "CEPH list no of OSD's",
  "Storage RAID Controller Model Number",
  "JBOD Model Number",
  "JBOD Firmware Build Package",
  "JBOD Enclosure Disks Information for Storage",
  "JBOD DISK INFORMATION",
  "EID:SLT",
  "DISK STATE",
  "DISK GROUP (DG)",
  "DG/VD",
  "VIRTUAL DISK (VD)",
  "DISK LABEL",
  "RAID TYPE",
  "RAID STATE",
  "RAID DISK ACCESS MODE",
  "RAID DISK CACHE MODE",
  "RAID DISK STRIP SIZE",
  "DISK CAPACITY",
  "DISK SMART HEALTH STATUS",
  "ERROR STATUS/TOTAL UNCORRECTED ERRORS",
  "DISK SERIAL NUMBER",
  "DISK MODEL NUMBER",
  "DISK FIRMWARE VERSION",
  "MEDIA WEAROUT INDICATOR",
  "ERASE FAIL COUNT",
  "OSD DETAILS",
  "OSD ID",
  "OSD STATUS",
  "OSD DEVICE LABEL",
  "FAST OSD DETAILS",
  "FAST OSD ID",
  "FAST OSD STATUS",
  "FAST DEVICE LABEL",
  "NVME DISK PCI SLOT",
  "NVME DISK SIZE",
  "NVME DISK HEALTH",
  "NVME DISK ERRORS",
  "NVME DISK SERIAL NUMBER",
  "NVME DISK MODEL NUMBER",
  "NVME DISK FIRMWARE VERSION",
  "DID"
]);

const COMPUTE_ONLY_PARAMS = new Set([
  "Product Number",
  "Serial Number",
  "BMC IP Address",
  "BMC MAC Address",
  "Critical Sensor Data Record",
  "Non-Responsive Sensor Data Record",
  "Disk error from BMC SEL Logs",
  "Uncorrectable ECC error from BMC SEL Logs",
  "Correctable ECC logging limit reached from BMC SEL Logs",
  "CPU/Processor error from BMC SEL Logs",
  "CPU/Processor error Dates from BMC SEL Logs",
  "Number of DIMM Modules",
  "Individual DIMM Size",
  "DIMM Total Size",
  "Each DIMM Serial,Manufacture,Speed & Slot",
  "Faulty DIMM Slot Location",
  "BMC BIOS Version",
  "BMC Firmware Version",
  "CPU Frequency Scaling",
  "Nic Interfaces list",
  "Nic Interfaces link status",
  "Nic Interfaces Firmware version",
  "Nic Interfaces Driver version",
  "Compute/Master Hard Disk Labels",
  "Compute/Master Hard Disk Size",
  "Compute/Master Hard Disk Health",
  "Compute/Master Hard Disk Errors / Total Uncorrected Errors",
  "Compute/Master Hard Disk Serial Number",
  "Compute/Master Hard Disk Model Number",
  "Compute/Master Hard Disk Media_Wearout_Indicator",
  "Redfish SessionTimeout",
  "Compute/Master Hard Disk Firmware Version",
  "Compute/Master Hard Disk Erase_Fail_Count"
]);

function evaluateHwParam(param, valueStr, hostName) {
  const val = String(valueStr || "").trim();
  const lower = val.toLowerCase();
  const logicEntry = HW_AUDIT_LOGIC.find(r => r.param.toLowerCase() === param.toLowerCase());
  const logic = logicEntry ? logicEntry.logic : "";
  const logicLower = logic.toLowerCase();
  
  const isStorage = isStorageHost(hostName);

  // Separate applicability
  if (isStorage) {
    if (COMPUTE_ONLY_PARAMS.has(param)) {
      return { ticket: false, reason: "Compute param not applicable to storage host" };
    }
  } else {
    if (STORAGE_ONLY_PARAMS.has(param)) {
      return { ticket: false, reason: "Storage param not applicable to compute host" };
    }
  }

  // STORAGE BRANCH - only for storage hosts - per screenshot
  if (isStorage && STORAGE_ONLY_PARAMS.has(param)) {
    const hasNOK = lower.includes("nok");
    const hasNoData = lower.includes("no data") || val === "" || lower === "na" || lower === "-";

    const storageNokNodataParams = new Set([
      "Storage NVME Hard Disk Labels",
      "Storage NVME Hard Disk PCI Slot",
      "Storage NVME Hard Disk Size",
      "Storage NVME Hard Disk Health",
      "Storage NVME Hard Disk Errors / Total Uncorrected Errors",
      "Storage NVME Hard Disk Serial Number",
      "Storage NVME Hard Disk Model Number",
      "Storage NVME Hard Disk Firmware Version",
      "Bad Block Count",
      "DISK SERIAL NUMBER",
      "DISK MODEL NUMBER",
      "DISK FIRMWARE VERSION",
      "NVME DISK SERIAL NUMBER",
      "NVME DISK MODEL NUMBER",
      "NVME DISK FIRMWARE VERSION",
      "NVME DISK SIZE"
    ]);

    if (storageNokNodataParams.has(param)) {
      if (hasNOK || hasNoData) {
        return { ticket: true, reason: `${param} - ${hasNOK?'NOK':'No Data'}` };
      }
      if (!val) {
        return { ticket: true, reason: `${param} - Empty/No Data` };
      }
    }

    if (param === "CEPH Health Detail") {
      if (hasNOK) return { ticket: true, reason: "CEPH Health Detail NOK" };
    }

    if (param === "CEPH list no of OSD's") {
      const hasNOK = lower.includes("nok");
      const hasNoData = lower.includes("no data") || val.trim()==="" || lower==="na" || lower==="-";
      
      if (hasNOK) return { ticket: true, reason: "CEPH OSD NOK - Found NOK per logic" };
      if (hasNoData) return { ticket: true, reason: "CEPH OSD No Data/Empty - Not found per logic, need to raise" };
      if (!val.trim()) return { ticket: true, reason: "CEPH OSD Empty - Not found, need to raise" };
      
      let osdCount = null;
      const patterns = [
        /(\d+)\s*osd/i,
        /osd\s*[:=]?\s*(\d+)/i,
        /total\s*osd.*? (\d+)/i
      ];
      for(const pat of patterns){
        const m = val.match(pat);
        if(m){ osdCount = parseInt(m[1]); break; }
      }
      if(osdCount===null){
        const m = val.match(/\b(\d+)\b/);
        if(m) osdCount = parseInt(m[1]);
      }
      
      if(osdCount!==null && osdCount!==45){
        return { ticket: true, reason: `CEPH OSD count ${osdCount} !=45 - Should be 45 per logic, need to raise` };
      }
      if(osdCount===null){
        const nums = [...val.matchAll(/\d+/g)].map(x=>parseInt(x[0]));
        if(nums.length===0) return { ticket: true, reason: "CEPH OSD count not found - Not found per logic, need to raise" };
        if(!nums.includes(45)) return { ticket: true, reason: `CEPH OSD count ${nums} - No 45 found, should be 45` };
      }
      
      if(lower.includes("down")){
        const downMatch = val.match(/(\d+)\s*down/i);
        if(downMatch){
          const downCount = parseInt(downMatch[1]);
          if(downCount>0) return { ticket: true, reason: `CEPH OSD ${downCount} down - All should be up per logic` };
        } else {
          if(!lower.includes("0 down")) return { ticket: true, reason: "CEPH OSD down found - All should be up per logic" };
        }
      }
      
      const upMatch = val.match(/(\d+)\s*up/i);
      if(upMatch){
        const upCount = parseInt(upMatch[1]);
        if(upCount!==45) return { ticket: true, reason: `CEPH OSD up count ${upCount} !=45 - All 45 should be up per logic` };
      }
    }

    if (param === "Storage RAID Controller Model Number") {
      if (hasNOK) return { ticket: true, reason: "RAID Controller NOK" };
    }

    // generic storage fallback
    if (logicLower.includes("if found nok or no data")) {
      if (hasNOK || hasNoData) return { ticket: true, reason: `${hasNOK?'NOK':''} ${hasNoData?'No Data':''}`.trim() };
    } else if (logicLower.includes("if found nok")) {
      if (hasNOK) return { ticket: true, reason: "Found NOK" };
    }
  }
  
  if (!logic || logicLower.includes("not required") || logicLower.trim() === "") {
    return { ticket: false, reason: "Not Required" };
  }
  
  const hasNOK = lower.includes("nok");
  const hasNoData = lower.includes("no data");
  
  const extractNumber = (str) => {
    const m = str.match(/([0-9]+\.?[0-9]*)/);
    return m ? parseFloat(m[1]) : null;
  };
  const extractGB = (str) => {
    const m = str.match(/([0-9]+)\s*GB/i);
    return m ? parseFloat(m[1]) : null;
  };
  
  if (logicLower.includes("if found nok or no data")) {
    if (hasNOK || hasNoData) return { ticket: true, reason: `${hasNOK?'NOK':''} ${hasNoData?'No Data':''}`.trim() };
  } else if (logicLower.includes("if found nok")) {
    if (hasNOK) return { ticket: true, reason: "Found NOK" };
  } else if (logicLower.includes("no data") && (logicLower.includes("need to raise") || logicLower.includes("if found"))) {
    if (hasNoData || (logicLower.includes("nok") && hasNOK)) {
      if (logicLower.includes("nok") && logicLower.includes("no data")) {
        if (hasNOK || hasNoData) return { ticket: true, reason: hasNOK && hasNoData ? "NOK & No Data" : (hasNOK ? "NOK" : "No Data") };
      } else if (logicLower.includes("no data")) {
        if (hasNoData) return { ticket: true, reason: "No Data" };
        if (logicLower.includes("nok") && hasNOK) return { ticket: true, reason: "NOK" };
      }
    }
  }
  
  if (param === "Number of DIMM Modules") {
    const num = extractNumber(val);
    if (hasNOK || (num !== null && num < 12)) return { ticket: true, reason: `DIMM count ${num} <12 or NOK` };
  }
  if (param === "Individual DIMM Size") {
    const gb = extractGB(val);
    if (hasNOK || hasNoData || (gb !== null && gb < 16)) return { ticket: true, reason: `DIMM ${gb}GB <16` };
  }
  if (param === "DIMM Total Size") {
    const num = extractNumber(val);
    if (hasNOK || (num !== null && num < 187)) return { ticket: true, reason: `Total ${num}<187` };
  }
  if (param === "CPU Frequency Scaling") {
    const num = extractNumber(val);
    const isStorageBm = hostName.toLowerCase().includes("storagebm");
    const threshold = isStorageBm ? 48 : 64;
    if (num !== null && num < threshold) return { ticket: true, reason: `CPU scaling ${num} <${threshold}` };
  }
  if (param === "Nic Interfaces list") {
    const count = val.split(',').filter(s=>s.trim()).length;
    if (count>0 && count < 4) return { ticket: true, reason: `NIC count ${count}<4` };
  }
  if (param === "Compute/Master Hard Disk Size") {
    const sizes = [...val.matchAll(/=>\s*([0-9]+)\s*GB/gi)].map(m=>parseFloat(m[1]));
    if (hasNoData) return { ticket: true, reason: "No Data" };
    if (sizes.length>0) {
      if (sizes.some(s=>s < 960)) return { ticket: true, reason: `Disk <960GB ${sizes}` };
      if (sizes.length>=2 && sizes[0] !== sizes[1]) return { ticket: true, reason: `sda/sdb mismatch ${sizes[0]} vs ${sizes[1]}` };
    }
  }
  if (param === "Compute/Master Hard Disk Health") {
    const isEmpty = !val.trim();
    const hasNoDataLocal = lower.includes("no data");
    const hasNokLocal = lower.includes("nok") || lower.includes("failed");
    if (isEmpty || hasNoDataLocal || hasNokLocal || (!lower.includes("passed") && !lower.includes("ok"))) {
      if (isEmpty) return { ticket: true, reason: "Health EMPTY - No value found" };
      if (hasNoDataLocal) return { ticket: true, reason: `Health No Data: ${val}` };
      if (hasNokLocal) return { ticket: true, reason: `Health NOK/Failed: ${val}` };
      return { ticket: true, reason: `Health not PASSED/OK: ${val || 'EMPTY'}` };
    }
  }
  if (param === "Compute/Master Hard Disk Errors / Total Uncorrected Errors") {
    if (!lower.includes("no errors") && !lower.includes("ok")) {
      return { ticket: true, reason: "Errors found" };
    }
  }
if (param === "Compute/Master Hard Disk Errors / Total Uncorrected Errors") {
    const isEmpty = !val.trim();
    const hasNoData = lower.includes("no data");
    const hasNOK = lower.includes("nok") || lower.includes("failed");
    if (isEmpty || hasNoData || hasNOK || (!lower.includes("No Errors Logged") && !lower.includes("ok"))) {
      if(isEmpty) return { ticket: true, reason: "Health EMPTY - No value found" };
      if(hasNoData) return { ticket: true, reason: `Health No Data: ${val}` };
      if(hasNOK) return { ticket: true, reason: `Health NOK/Failed: ${val}` };
      return { ticket: true, reason: `Errors Logged/OK: ${val || 'EMPTY'}` };
    }
  }
  if (param.toLowerCase().includes("media_wearout_indicator") || param === "MEDIA WEAROUT INDICATOR") {
    const vm = val.match(/VALUE\s*([0-9]+)/i);
    const wm = val.match(/WORST\s*([0-9]+)/i);
    const v = vm ? parseInt(vm[1]) : null;
    const w = wm ? parseInt(wm[1]) : null;
    if ((v !== null && v <=5) || (w !== null && w <=5)) return { ticket: true, reason: `Wearout VALUE ${v} WORST ${w} <=5` };
  }
  if (param === "Redfish SessionTimeout") {
    const num = extractNumber(val);
    if (num !== null && num < 900) return { ticket: true, reason: `Timeout ${num}<900` };
  }
  if (param === "DISK CAPACITY") {
    const gb = extractGB(val) || extractNumber(val);
    if (hasNOK || (gb !== null && gb < 480)) return { ticket: true, reason: `Capacity ${gb}<480 or NOK` };
  }
  if (param === "CMOS Current Voltage") {
    const m = val.match(/([0-9]+\.?[0-9]*)\s*volts/i);
    if (m) {
      const volt = parseFloat(m[1]);
      if (volt > CMOS_THRESHOLD) return { ticket: true, reason: `CMOS ${volt}V > ${CMOS_THRESHOLD}V` };
    }
  }
  const lessThanMatch = logicLower.match(/less than\s*([0-9]+)/);
  if (lessThanMatch) {
    const threshold = parseFloat(lessThanMatch[1]);
    const gb = extractGB(val);
    const num = extractNumber(val);
    if (logicLower.includes("gb") && gb !== null && gb < threshold) return { ticket: true, reason: `${gb}GB <${threshold}GB` };
    if (num !== null && num < threshold) {
      if (hasNOK || logicLower.includes("value is less than") || logicLower.includes("less than")) {
        if (logicLower.includes("nok") && !hasNOK) {
          // check numeric only if logic says value less than
          if (logicLower.includes("value is less than") || !logicLower.includes("nok")) {
            return { ticket: true, reason: `${num}<${threshold}` };
          }
        } else {
          return { ticket: true, reason: `${num}<${threshold}` };
        }
      }
    }
  }
  if (hasNOK && logicLower.includes("nok")) return { ticket: true, reason: "NOK per logic" };
  if (hasNoData && logicLower.includes("no data")) return { ticket: true, reason: "No Data per logic" };
  return { ticket: false, reason: "OK" };
}

let allIssues = [];


let cmosIssues = [];

function renderAuditAnalysis(){
  if(!auditRawData.length) return;
  const resultDiv = document.getElementById('auditResult');
  const totalRows = auditRawData.length;
  const totalCols = auditHeaders.length;
  
  // Find hosts - FIXED: exact match for All commands, skip STORAGE ALL COMMANDS
  const allCmdRows = [];
  for(let i=0;i<auditRawData.length;i++){
    const row = auditRawData[i];
    const first = String(row[auditHeaders[0]] || Object.values(row)[0] || "").trim();
    if(first.toLowerCase() === "all commands"){
      const secondHeader = auditHeaders[1];
      const hostName = String(row[secondHeader] || "").trim();
      if(hostName && hostName.length>2 && !hostName.toLowerCase().includes("all commands")) allCmdRows.push({idx:i, name:hostName});
    }
  }
  
  const hosts = [];
  let isVertical = false;
  const headerIsVertical = auditHeaders[0] && String(auditHeaders[0]).toLowerCase() === 'all commands' && auditHeaders.length>=2;
  if(headerIsVertical){
    isVertical = true;
    const firstHostName = String(auditHeaders[1]||'').trim();
    if(firstHostName && firstHostName.length>2 && firstHostName.toLowerCase()!=='all commands' && !firstHostName.toLowerCase().includes('storage all commands')){
      let firstEnd = auditRawData.length;
      for(let j=0;j<auditRawData.length;j++){
        const p = String(auditRawData[j][auditHeaders[0]] || "").trim().toUpperCase();
        if(p.includes("STORAGE ALL COMMANDS") || p.includes("COMPUTE ALL COMMANDS")){ firstEnd=j; break; }
        if(p === "ALL COMMANDS"){ firstEnd=j; break; }
      }
      hosts.push({name:firstHostName, start:0, end:firstEnd, mode:"vertical", header:auditHeaders[1]});
    }
    for(let hIdx=0; hIdx<allCmdRows.length; hIdx++){
      const cur = allCmdRows[hIdx];
      const nextIdx = hIdx+1 < allCmdRows.length ? allCmdRows[hIdx+1].idx : auditRawData.length;
      let end = nextIdx;
      for(let j=cur.idx+1; j<nextIdx; j++){
        const p = String(auditRawData[j][auditHeaders[0]] || "").trim().toUpperCase();
        if(p.includes("STORAGE ALL COMMANDS") || p.includes("COMPUTE ALL COMMANDS")){ end=j; break; }
      }
      if(hosts.length && hosts[0].name === cur.name) continue;
      hosts.push({name:cur.name, start:cur.idx+1, end:end, mode:"vertical", header:auditHeaders[1]});
    }
  } else if(allCmdRows.length >= 1){
    isVertical = true;
    for(let hIdx=0; hIdx<allCmdRows.length; hIdx++){
      const cur = allCmdRows[hIdx];
      const nextIdx = hIdx+1 < allCmdRows.length ? allCmdRows[hIdx+1].idx : auditRawData.length;
      let end = nextIdx;
      for(let j=cur.idx+1; j<nextIdx; j++){
        const p = String(auditRawData[j][auditHeaders[0]] || "").trim().toUpperCase();
        if(p.includes("STORAGE ALL COMMANDS") || p.includes("COMPUTE ALL COMMANDS")){ end=j; break; }
      }
      hosts.push({name:cur.name, start:cur.idx+1, end:end, mode:"vertical", header:auditHeaders[1]});
    }
  } else {
    // Horizontal fallback - also exact match
    let hostsRow = null;
    for(const row of auditRawData){
      const first = String(Object.values(row)[0] || "").trim().toLowerCase();
      if(first === "all commands"){
        hostsRow = row; break;
      }
    }
    if(hostsRow){
      for(const h of auditHeaders){
        const hostName = String(hostsRow[h]||"").trim();
        if(hostName && hostName.toLowerCase() !== "all commands" && !hostName.toLowerCase().includes("compute all commands") && !hostName.toLowerCase().includes("storage all commands") && hostName.length>2){
          hosts.push({header:h, name:hostName, mode:"horizontal"});
        }
      }
    } else {
      for(let i=1;i<auditHeaders.length;i++){
        const hn = String(auditHeaders[i]||"").trim();
        if(hn.toLowerCase().includes("storage all commands") || hn.toLowerCase().includes("compute all commands")) continue;
        hosts.push({header:auditHeaders[i], name:hn, mode:"horizontal"});
      }
    }
  }
  
  allIssues = [];
  cmosIssues = [];
  
  if(isVertical){
    for(const host of hosts){
      for(let i=host.start; i<host.end; i++){
        const row = auditRawData[i];
        const param = String(row[auditHeaders[0]] || Object.values(row)[0] || "").trim();
        if(!param || param.toUpperCase().includes("STORAGE ALL COMMANDS") || param.toUpperCase().includes("COMPUTE ALL COMMANDS") || param.toLowerCase()==="all commands" || param==="") continue;
        const logicEntry = HW_AUDIT_LOGIC.find(r=>r.param.toLowerCase() === param.toLowerCase());
        if(!logicEntry) continue;
        const value = String(row[host.header] || "").trim();
        const result = evaluateHwParam(param, value, host.name);
        if(result.ticket){
          allIssues.push({host: host.name, param: param, value: value, logic: logicEntry.logic, reason: result.reason, ticketRequired: "YES", action: `Raise Ticket - ${param}: ${result.reason}`, isStorage: isStorageHost(host.name)});
        }
      }
    }
  } else {
    for(const row of auditRawData){
      const param = String(row[auditHeaders[0]] || Object.values(row)[0] || "").trim();
      if(!param || param.toLowerCase().includes("compute all commands") || param.toLowerCase().includes("storage all commands") || param.toLowerCase()==="all commands" || param.toLowerCase() === "" ) continue;
      const logicEntry = HW_AUDIT_LOGIC.find(r=>r.param.toLowerCase() === param.toLowerCase());
      if(!logicEntry) continue;
      for(const host of hosts){
        const value = String(row[host.header] || "").trim();
        const result = evaluateHwParam(param, value, host.name);
        if(result.ticket){
          allIssues.push({host: host.name, param: param, value: value, logic: logicEntry.logic, reason: result.reason, ticketRequired: "YES", action: `Raise Ticket - ${param}: ${result.reason}`, isStorage: isStorageHost(host.name)});
        }
      }
    }
  }
  
  // Stats
  const uniqueHostsWithIssues = [...new Set(allIssues.map(v=>v.host))].length;
  const cmosCount = cmosIssues.length;
  
  let html = `<div class="audit-stats-grid">
      <div class="audit-stat-card"><div class="stat-label">Total Rows</div><div class="stat-value">${totalRows}</div></div>
      <div class="audit-stat-card"><div class="stat-label">Total Hosts</div><div class="stat-value">${hosts.length}</div></div>
      <div class="audit-stat-card"><div class="stat-label">Total Issues</div><div class="stat-value" style="color:${allIssues.length>0?'#dc2626':'#16a34a'}">${allIssues.length}</div></div>
      <div class="audit-stat-card"><div class="stat-label">Hosts With Issues</div><div class="stat-value" style="color:${uniqueHostsWithIssues>0?'#d97706':'#16a34a'}">${uniqueHostsWithIssues}</div></div>
    </div>`;
  
  if(allIssues.length>0){
    // Group by param
    const byParam = {};
    allIssues.forEach(v=>{
      if(!byParam[v.param]) byParam[v.param]=0;
      byParam[v.param]++;
    });
    html += `<div style="margin-top:16px; background:#fee2e2; border:1px solid #fecaca; border-left:4px solid #dc2626; border-radius:10px; padding:14px;">
      <div style="font-weight:800; color:#991b1b; font-size:13px;"><i class="fa-solid fa-triangle-exclamation"></i> HW Audit - ${allIssues.length} issues across ${uniqueHostsWithIssues} hosts - Tickets Required</div>
      <div style="font-size:11px; color:#7f1d1d; margin-top:6px;">All issues below need tickets to be raised. Download single Excel sheet with all results.</div>
      <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
        ${Object.entries(byParam).slice(0,15).map(([p,c])=>`<span class="audit-badge error">${p}: ${c}</span>`).join('')}
        ${Object.keys(byParam).length>15 ? `<span class="audit-badge warn">+${Object.keys(byParam).length-15} more params</span>` : ''}
      </div>
      <div style="margin-top:10px; max-height:250px; overflow:auto; background:white; border-radius:8px; border:1px solid #fecaca;">
        <table class="audit-table"><thead><tr><th>Host</th><th>Parameter</th><th>Value</th><th>Reason</th><th>Ticket</th></tr></thead><tbody>
          ${allIssues.slice(0,50).map(v=>`<tr><td>${v.host}</td><td style="font-weight:600;">${v.param}</td><td style="max-width:200px; overflow:hidden; text-overflow:ellipsis;" title="${v.value.replace(/"/g,'&quot;')}">${String(v.value).substring(0,80)}</td><td style="color:#991b1b;">${v.reason}</td><td><span class="audit-badge error">YES</span></td></tr>`).join('')}
        </tbody></table>
        ${allIssues.length>50 ? `<div style="padding:6px; font-size:11px; text-align:center; color:#991b1b;">Showing 50 of ${allIssues.length} - Download full Excel for all</div>` : ''}
      </div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="audit-download-btn" style="background:#dc2626;" onclick="downloadAllIssuesExcel()"><i class="fa-solid fa-file-excel"></i> Download All Issues - Single Sheet (${allIssues.length} issues)</button>
      </div>
    </div>`;
  } else {
    html += `<div style="margin-top:16px; background:#dcfce7; border:1px solid #bbf7d0; border-radius:10px; padding:14px; color:#166534; font-size:12px;"><i class="fa-solid fa-circle-check"></i> All checks passed - No tickets required. Checked ${hosts.length} hosts against ${HW_AUDIT_LOGIC.length} logic rules. CMOS threshold ${CMOS_THRESHOLD}V checked.</div>`;
  }
  
  // Preview table
  html += `<div style="margin-top:16px; display:flex; gap:8px; align-items:center;"><input type="text" id="auditFilterInput" placeholder="Filter table... e.g. NOK, No Data, CMOS, DIMM" style="flex:1; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px;" onkeyup="filterAuditTable()" /><span style="font-size:11px; color:#64748b;">Preview 100 rows</span></div>`;
  html += `<div class="audit-table-wrap"><table class="audit-table" id="auditPreviewTable"><thead><tr>`;
  auditHeaders.forEach(h=>{ html += `<th>${h}</th>`; });
  html += `</tr></thead><tbody>`;
  auditRawData.slice(0,100).forEach(row=>{
    html += `<tr>`;
    auditHeaders.forEach(h=>{
      let val = row[h]; if(val==null) val="";
      let display = String(val).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      let style="";
      const param = String(row[auditHeaders[0]]||"").trim();
      const hostEntry = hosts.find(x=>x.header===h);
      if(hostEntry){
        const evalRes = evaluateHwParam(param, String(row[h]||""), hostEntry.name);
        if(evalRes.ticket) style="background:#fee2e2; color:#991b1b; font-weight:600;";
      }
      if(display.length>80) display = display.substring(0,80)+'...';
      html += `<td style="${style}" title="${String(row[h]).replace(/"/g,'&quot;')}">${display}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;
  
  resultDiv.innerHTML = html;
  
  const dlGroup = document.getElementById('auditDownloadGroup');
  if(dlGroup){ dlGroup.style.display='block'; const inner = dlGroup.querySelector('.audit-download-group'); if(inner) inner.style.display='flex'; const cmosBtn = document.getElementById('cmosDlBtn'); if(cmosBtn) cmosBtn.style.display = cmosIssues.length ? 'inline-flex' : 'none'; const allBtn = document.getElementById('allIssuesBtn'); if(allBtn) allBtn.style.display = allIssues.length ? 'inline-flex' : 'none'; }
}

function downloadAllIssuesExcel(){
  if(!allIssues.length){ alert('No issues found - all checks passed!'); return; }
  const header = ["Host", "Parameter", "Value", "Logic Rule", "Failure Reason", "Ticket Required", "Action", "Severity", "Date"];
  const rows = [header];
  allIssues.forEach(v=>{
    let severity = "Medium";
    if(v.param.toLowerCase().includes("critical") || v.param.toLowerCase().includes("disk error") || v.param.toLowerCase().includes("cpu") || v.param.toLowerCase().includes("dimm")) severity="High";
    if(v.param.includes("CMOS")) severity="High";
    rows.push([
      v.host,
      v.param,
      v.value,
      v.logic,
      v.reason,
      "YES",
      v.action,
      severity,
      new Date().toLocaleString()
    ]);
  });
  // Summary sheet data
  const summary = [
    ["HW Audit Automation - Full Logic Check"],
    ["File", auditFileName],
    ["Date", new Date().toLocaleString()],
    ["Total Hosts", [...new Set(allIssues.map(v=>v.host))].length || 0],
    ["Total Rules Checked", HW_AUDIT_LOGIC.length],
    ["Total Issues", allIssues.length],
    ["CMOS Threshold", CMOS_THRESHOLD + "V"],
    [""],
    ["Breakdown by Parameter"],
    ...Object.entries(allIssues.reduce((acc,v)=>{acc[v.param]=(acc[v.param]||0)+1; return acc;}, {})).map(([p,c])=>[p,c]),
    [""],
    ["Ticket Summary"],
    ["All issues listed need tickets to be raised per logic sheet HW_Audit_Automation_Logic.xlsx"]
  ];
  
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws1, "All_Issues_Single_Sheet");
  const ws2 = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");
  if(auditRawData.length){
    const ws3 = XLSX.utils.json_to_sheet(auditRawData);
    XLSX.utils.book_append_sheet(wb, ws3, "Full_Audit_Data");
  }
  const ws4 = XLSX.utils.aoa_to_sheet([["Param","Logic Rule"], ...HW_AUDIT_LOGIC.map(r=>[r.param, r.logic])]);
  XLSX.utils.book_append_sheet(wb, ws4, "Logic_Reference");
  
  XLSX.writeFile(wb, `HW_Audit_Full_Report_${auditFileName.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}


function downloadAuditReport(){
  if(!auditRawData.length){ alert('No data'); return; }
  const statsHtml = document.getElementById('auditResult').innerHTML;
  const cmosSection = cmosIssues.length ? `<h3 style="color:#dc2626;">CMOS Voltage Issues (${cmosIssues.length} hosts >3.50V) - Tickets Required</h3><p>Threshold: 3.50V</p><table border="1" cellpadding="6" style="border-collapse:collapse;"><tr><th>Host</th><th>Voltage</th><th>Action</th></tr>${cmosIssues.map(it=>`<tr><td>${it.host}</td><td style="color:red; font-weight:bold;">${it.voltage}V</td><td>Raise Ticket</td></tr>`).join('')}</table><br>` : '<p style="color:green;">No CMOS voltage issues</p>';
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Audit Report - ${auditFileName}</title><style>body{font-family:Segoe UI;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #e2e8f0;padding:6px 8px;font-size:12px} th{background:#0f172a;color:white}</style></head><body><h2>Audit Report - ${auditFileName}</h2><p>Rows:${auditRawData.length} Cols:${auditHeaders.length} Date:${new Date().toLocaleString()}</p>${cmosSection}${statsHtml}</body></html>`;
  const blob = new Blob([htmlContent], {type:'text/html'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`Audit_Report_${auditFileName.replace(/\.[^/.]+$/, '')}.html`; a.click(); URL.revokeObjectURL(url);
}


function exportAuditCsv(){
  if(!auditRawData.length){ alert('No data'); return; }
  const ws = XLSX.utils.json_to_sheet(auditRawData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "AuditData"); XLSX.writeFile(wb, `Audit_Export_${auditFileName.replace(/\.[^/.]+$/,'')}.csv`);
}
function exportAuditExcel(){
  if(!auditRawData.length){ alert('No data'); return; }
  const ws = XLSX.utils.json_to_sheet(auditRawData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "AuditData"); XLSX.writeFile(wb, `Audit_Export_${auditFileName.replace(/\.[^/.]+$/,'')}.xlsx`);
}

async function sendMessage(){
  const input = document.getElementById('questionInput'); if(!input || !input.value.trim()) return;
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
}

async function handlePrePostCompare() {
  const preInput = document.getElementById('preFile');
  const postInput = document.getElementById('postFile');
  const resultDiv = document.getElementById('compareResult');
  const statusDiv = document.getElementById('compareStatus');
  if (!preInput.files[0] || !postInput.files[0]) { alert("Please select both files"); return; }
  const preFile = preInput.files[0]; const postFile = postInput.files[0];
  resultDiv.innerHTML = `<div style="padding:15px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">Comparing...</div>`;
  const formData = new FormData(); formData.append('pre_file', preFile); formData.append('post_file', postFile);
  try {
    const res = await fetch(`${COMPARISON_BACKEND_URL}/compare-inline`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Backend error ${res.status}`);
    const htmlResult = await res.text();
    resultDiv.innerHTML = `<div style="border:1px solid #e2e8f0;border-radius:10px;overflow:auto;max-height:600px;background:white">${htmlResult}</div>`;
    statusDiv.innerHTML = `<span style="color:#16a34a">✓ Success</span>`;
  } catch (err) {
    resultDiv.innerHTML = `<div style="padding:15px;background:#fee2e2;border-radius:8px;color:#991b1b"><b>Error:</b> ${err.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderRecentSearches();
});
