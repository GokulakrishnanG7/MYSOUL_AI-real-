/* ═══════════════════════════════════════════════════════════
   MySoul AI v3 — Chat + Boot (UPGRADED)
   scripts/chat.js
═══════════════════════════════════════════════════════════ */
'use strict';

const Chat = (() => {
  const EMOJIMAP={joy:'✨',happy:'😄',sad:'💙',angry:'🔥',stressed:'😰',calm:'🌿',fear:'🫂',love:'💗',surprised:'⚡',neutral:'◈',academic:'📚'};
  let stream=null;

  function init(){
    stream=document.getElementById('chatMessages');
    document.getElementById('sendBtn')?.addEventListener('click',_send);
    document.getElementById('chatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey)_send();});
    document.getElementById('chatInput')?.addEventListener('input',()=>{if(Math.random()<.22)_burst();});
    document.getElementById('clearChatBtn')?.addEventListener('click',_clear);
    document.getElementById('interruptBtn')?.addEventListener('click',()=>{
      SoulCore.stopSpeak();
      document.getElementById('aiSpeakBar')?.classList.add('hidden');
      SoulCore.SFX.click();
    });
  }

  async function _send(){
    const inp=document.getElementById('chatInput');
    const txt=inp?.value.trim();
    if(!txt)return;
    inp.value='';
    SoulCore.SFX.send();
    _appendUser(txt);
    const typEl=_appendTyping();
    UILayer.setThinking(true);
    document.getElementById('aiSpeakBar')?.classList.remove('hidden');
    document.getElementById('voiceCorona')?.classList.add('active');
    document.getElementById('soulOrb')?.classList.add('speaking');
    try{
      const res=await SoulCore.sendMessage(txt);
      typEl.remove();
      UILayer.setThinking(false);
      UILayer.setEmotion(res.emotion,res.intensity,res.pattern,res.context);
      UILayer.showOnline(res.fromAPI);
      if(!res.fromAPI)UILayer.showError('Using local intelligence — backend unavailable.');
      _appendAI(res.response,res.emotion,res.intensity,res.context);
      if(SoulCore.tts)SoulCore.speak(res.response);
    }catch(e){
      typEl.remove();UILayer.setThinking(false);
      _appendAI("I'm here for you — always. What's on your mind?","neutral","low",null);
    }finally{
      document.getElementById('aiSpeakBar')?.classList.add('hidden');
      document.getElementById('voiceCorona')?.classList.remove('active');
      document.getElementById('soulOrb')?.classList.remove('speaking');
    }
  }

  function addVoice(txt){
    _appendUser(txt);
    setTimeout(async()=>{
      const typEl=_appendTyping();
      UILayer.setThinking(true);
      document.getElementById('aiSpeakBar')?.classList.remove('hidden');
      try{
        const res=await SoulCore.sendMessage(txt);
        typEl.remove();UILayer.setThinking(false);
        UILayer.setEmotion(res.emotion,res.intensity,res.pattern,res.context);
        UILayer.showOnline(res.fromAPI);
        _appendAI(res.response,res.emotion,res.intensity,res.context);
        if(SoulCore.tts)SoulCore.speak(res.response);
      }catch(e){typEl.remove();UILayer.setThinking(false);_appendAI("I'm right here.","neutral","low",null);}
      finally{document.getElementById('aiSpeakBar')?.classList.add('hidden');document.getElementById('voiceCorona')?.classList.remove('active');}
    },50);
  }

  function _appendUser(txt){
    const d=document.createElement('div');d.className='msg msg-user';
    d.innerHTML=`<div class="msg-body"><div class="msg-text">${_esc(txt)}</div><div class="msg-foot"><span class="msg-ts">${_time()}</span></div></div><div class="msg-avi" style="background:rgba(var(--ec-rgb),.1);color:var(--ec)">◎</div>`;
    stream.appendChild(d);_scroll();_burst();
  }

  function _appendTyping(){
    const d=document.createElement('div');d.className='msg msg-ai';
    d.innerHTML=`<div class="msg-avi">◈</div><div class="msg-body"><div class="typing-dots"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>`;
    stream.appendChild(d);_scroll();return d;
  }

  function _appendAI(txt,emotion,intensity,context){
    const d=document.createElement('div');d.className='msg msg-ai';
    const avi=EMOJIMAP[emotion]||'◈';
    const ed=SoulCore.getEDef(emotion);
    const tags=[];
    if(emotion&&emotion!=='neutral')tags.push(`<span class="msg-etag" style="background:rgba(var(--ec-rgb),.12);color:var(--ec)">${ed.label}</span>`);
    if(intensity&&intensity!=='medium')tags.push(`<span class="msg-etag">${intensity.toUpperCase()}</span>`);
    const msgId='tw_'+Date.now();
    d.innerHTML=`<div class="msg-avi" style="color:${ed.col}">${avi}</div><div class="msg-body"><div class="msg-text" id="${msgId}"></div><div class="msg-foot"><span class="msg-ts">${_time()}</span>${tags.join('')}</div></div>`;
    stream.appendChild(d);_scroll();
    const bubble=d.querySelector('.msg-text');
    _typewriter(bubble,txt,()=>{SoulCore.SFX.receive();});
  }

  function _typewriter(el,txt,done,spd=18){
    let i=0;el.textContent='';
    const t=setInterval(()=>{
      el.textContent+=txt[i++];
      _scroll();
      if(i>=txt.length){clearInterval(t);done?.();}
    },spd);
  }

  function _clear(){
    SoulCore.SFX.mode();
    stream.innerHTML=`<div class="msg msg-ai"><div class="msg-avi">◈</div><div class="msg-body"><div class="msg-text">Fresh start ✨ — I'm still here. What's stirring in you?</div><div class="msg-foot"><span class="msg-ts">${_time()}</span></div></div></div>`;
  }

  function _burst(){
    const inp=document.getElementById('chatInput');if(!inp)return;
    const r=inp.getBoundingClientRect();
    for(let i=0;i<3;i++){
      const s=document.createElement('div');
      s.style.cssText=`position:fixed;width:4px;height:4px;border-radius:50%;background:var(--ec);left:${r.left+Math.random()*r.width}px;top:${r.top}px;pointer-events:none;z-index:9997;box-shadow:0 0 8px var(--ec);animation:bUp .9s ease-out forwards;animation-delay:${i*.06}s;`;
      document.body.appendChild(s);setTimeout(()=>s.remove(),1200);
    }
  }

  function _scroll(){if(stream)stream.scrollTop=stream.scrollHeight;}
  function _time(){return new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});}
  function _esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  return {init,addVoice};
})();

window.Chat=Chat;

/* ═══════════════════════════════════════════════════════════
   BOOT SEQUENCE
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{

  /* Inject burst keyframe */
  const ks=document.createElement('style');
  ks.textContent='@keyframes bUp{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(-90px);opacity:0}}';
  document.head.appendChild(ks);

  /* Animated loader */
  const statuses=['Awakening consciousness...','Loading emotional core...','Calibrating empathy...','Connecting to your soul...','Ready ✦'];
  let si=0;
  const statusEl=document.getElementById('loaderStatus');
  const sInt=setInterval(()=>{
    si++;
    if(statusEl&&si<statuses.length)statusEl.textContent=statuses[si];
    if(si>=statuses.length)clearInterval(sInt);
  },460);

  setTimeout(()=>{
    document.getElementById('loader')?.classList.add('hidden');
    const app=document.getElementById('app');
    app?.classList.remove('hidden');
    app?.classList.add('revealed');
  },2700);

  /* Boot all systems — ORDER MATTERS */
  UILayer.initNavigation();
  UILayer.initControls();
  UILayer.initLock();
  UILayer.initBreathe();
  UILayer.initJournal();
  UILayer.initInspire();
  UILayer.initHealth();
  UILayer.initColor();
  UILayer.initMeditate();
  UILayer.initUniverse();
  UILayer.initCalendarNav();           // ← NEW: calendar month nav
  UILayer.setEmotion('neutral','medium',null,null);

  /* Voice — safe init */
  if(window.VoiceUI) {
    VoiceUI.init({onTranscript:txt=>{
      document.getElementById('transcriptBox')?.classList.add('hidden');
      Chat.addVoice(txt);
    }});
  }

  Chat.init();

  /* Idle demo — shows emotion cycling when user is inactive */
  let idleT=setTimeout(demo,20000);
  const resetIdle=()=>{clearTimeout(idleT);idleT=setTimeout(demo,24000);};
  document.addEventListener('click',resetIdle);
  document.addEventListener('keydown',resetIdle);
  function demo(){
    ['calm','joy','neutral','surprised','calm'].forEach((e,i)=>{
      setTimeout(()=>UILayer.setEmotion(e,'medium',null,null),i*2600);
    });
  }

  /* Particles boot */
  if(window.ParticleSystem){
    ParticleSystem.init(document.getElementById('particleCanvas'));
  }

  console.log('%c◈ MySoul AI v3 — Alive','color:#00c8ff;font-size:15px;font-weight:700;letter-spacing:.2em;');
  console.log('%cEmotional Intelligence × Cosmic Design','color:#ffe040;font-size:10px;');
  console.log('%c✓ Fixed: CSS/JS paths, Calendar, Suggestions, Smooth cursor, Memory cards','color:#38f098;font-size:10px;');
});
