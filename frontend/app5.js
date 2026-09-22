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

function setPrompt(topic) {
  const p = prompts[topic];

  // 1. Remove static div completely
  const staticDiv = document.getElementById('defaultWelcome');
  if (staticDiv) {
    staticDiv.remove(); // <- this removes TMO TSS Support system div
  }

  // 2. Active state on left
  document.querySelectorAll('.nav-card').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // 3. Show respective topic on right top
  const panel = document.getElementById('selectedTopicPanel');
  panel.style.display = 'block';
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="ttss-label"><i class="fa-solid fa-robot"></i> TTSS - ${p.title}</div>
    <div><b>You selected: ${p.title}</b> <br><br>${p.intro}</div>
    <button class="download-btn" onclick="downloadText(this)"><i class="fa-solid fa-download"></i> Download as.txt</button>
    <div style="margin-top:10px; font-size:12px;"><a href="#" onclick="resetWelcome(); return false;">← Back to Home</a></div>
  `;

  document.getElementById('questionInput').placeholder = p.placeholder;
}

function resetWelcome(){
  // Optional: bring back default welcome
  location.reload();
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