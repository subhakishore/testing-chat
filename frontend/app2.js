const prompts = {
  hotline: {
    title: "AGENT HOT LINE",
    desc: "Hot Line Support",
    placeholder: "Ask about FOPS basic checks for DIMM failure?",
    intro: "You selected: <b>AGENT HOT LINE</b> <br><br>How can I guide you on FOPS checks? You can ask:<br>• FOPS basic checklist<br>• DIMM failure steps<br>• Node reboot procedure"
  },
  troubleshoot: {
    title: "AGENT TROUBLESHOOTING",
    desc: "Troubleshooting",
    placeholder: "Ask about alarm troubleshooting steps...",
    intro: "You selected: <b>AGENT TROUBLESHOOTING</b>.<br><br>I'm ready to help with alarms & HW. Ask about:<br>• Critical alarm triage<br>• HW replacement flow<br>• Log collection"
  },
  ran: {
    title: "RAN",
    desc: "RAN Support",
    placeholder: "e.g. RAN alarm cell down troubleshooting?",
    intro: "You selected: <b>RAN Support</b>.<br><br>Ask me about RAN issues:<br>• Cell down / Cell out of service<br>• VSWR alarms<br>• S1 / X2 link down"
  },
  tc30: {
    title: "TC30",
    desc: "TC30 Docs",
    placeholder: "e.g. TC30 HWM installation steps?",
    intro: "You selected: <b>TC30 </b>.<br><br>I'm ready to help with TC30 products:<br>• HWM installation<br>• TC30 commissioning<br>• Cloud config"
  }
};

let currentTopic = 'hotline';

function setPrompt(topic) {
  currentTopic = topic;
  document.querySelectorAll('.nav-card').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const p = prompts[topic];
  const chat = document.getElementById('chatContainer');
  const msg = document.createElement('div');
  msg.className = 'ttss-message';
  msg.innerHTML = `
    <div class="ttss-label"><i class="fa-solid fa-robot"></i> TTSS - ${p.title}</div>
    <div>${p.intro}</div>
    <button class="download-btn" onclick="downloadText(this)"><i class="fa-solid fa-download"></i> Download as.txt</button>
  `;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;

  document.getElementById('questionInput').placeholder = p.placeholder;
  document.getElementById('questionInput').focus();
}

function setInput(text){
  document.getElementById('questionInput').value = text;
  document.getElementById('questionInput').focus();
}
function clearInput(){ document.getElementById('questionInput').value = ''; }
function clearChat(){ document.getElementById('chatContainer').innerHTML = ''; }
function downloadText(btn){
  const text = btn.parentElement.innerText;
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `TTSS_${currentTopic}_${Date.now()}.txt`; a.click();
}

function sendMessage(){
  const input = document.getElementById('questionInput');
  if(!input.value.trim()) return;
  const chat = document.getElementById('chatContainer');
  chat.innerHTML += `<div class="user-message">${input.value}</div>`;
  document.getElementById('thinking').classList.remove('hidden');
  setTimeout(()=>{
    document.getElementById('thinking').classList.add('hidden');
    chat.innerHTML += `<div class="ttss-message">
      <div class="ttss-label"><i class="fa-solid fa-robot"></i> TTSS - ${prompts[currentTopic].title}</div>
      <div>Searching Chroma DB for: <b>${input.value}</b> under ${prompts[currentTopic].desc}...<br><br>Here are downloadable steps.</div>
      <button class="download-btn" onclick="downloadText(this)"><i class="fa-solid fa-download"></i> Download as.txt</button>
    </div>`;
    chat.scrollTop = chat.scrollHeight;
    input.value = '';
  }, 800);
}