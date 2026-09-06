/* ═══════════════════════════════════════════════════════════
   MySoul AI v6 — Soul Core (API + State + Auth + Voice)
   scripts/soul-core.js
═══════════════════════════════════════════════════════════ */
'use strict';

const SoulCore = (() => {
  // Use the FastAPI host when the app is served by the backend, while still
  // supporting a separately hosted frontend and direct file previews.
  const localStaticServer = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && window.location.port && window.location.port !== '8000';
  const sameOrigin = /^https?:$/.test(window.location.protocol);
  const BASE = window.MYSOUL_API_BASE
    || (localStaticServer || !sameOrigin ? 'http://localhost:8000' : window.location.origin);
  const API_CHAT  = `${BASE}/api/chat`;
  const API_VOICE = `${BASE}/api/chat/voice`;
  const API_ALERT = `${BASE}/api/alerts/family`;

  function readSetup() {
    try { return JSON.parse(localStorage.getItem('ms_setup') || '{}'); }
    catch { return {}; }
  }
  function currentProfile() {
    const setup = readSetup();
    return {
      ai_name: setup.ai_name || localStorage.getItem('ms_ai_nick') || 'MySoul',
      user_name: setup.user_name || 'Friend',
      language: setup.language || 'en',
    };
  }

  const UID    = (() => {
    let id = localStorage.getItem('ms_uid');
    if(!id){ id = Math.random().toString(36).slice(2,10); localStorage.setItem('ms_uid',id); }
    return 'user_' + id;
  })();
  /* Mood → background colour rule:
     GREEN  (#38f098) = positive / calm moods
     YELLOW (#ffe040) = energetic / excited moods
     BLUE   (#00c8ff) = neutral / sad / serious moods
     Only these three colours are used for the background theme. */
  const EDEFS = {
    neutral:   {emoji:'🤖',label:'NEUTRAL',   col:'#00c8ff',intensity:50},  // blue  — neutral
    joy:       {emoji:'😊',label:'JOY',        col:'#ffe040',intensity:85},  // yellow — energetic positive
    happy:     {emoji:'😄',label:'HAPPY',      col:'#ffe040',intensity:80},  // yellow — energetic positive
    calm:      {emoji:'😌',label:'CALM',       col:'#38f098',intensity:35},  // green  — positive/calm
    sad:       {emoji:'😢',label:'SAD',        col:'#00c8ff',intensity:65},  // blue   — low/serious
    angry:     {emoji:'😠',label:'ANGRY',      col:'#ffe040',intensity:90},  // yellow — high-energy
    stressed:  {emoji:'😰',label:'STRESSED',   col:'#ffe040',intensity:88},  // yellow — high-energy/tense
    fear:      {emoji:'😨',label:'FEARFUL',    col:'#00c8ff',intensity:75},  // blue   — low/withdrawn
    love:      {emoji:'🥰',label:'LOVE',       col:'#38f098',intensity:95},  // green  — warm positive
    surprised: {emoji:'😲',label:'SURPRISED',  col:'#ffe040',intensity:80},  // yellow — energetic/alert
    distress:  {emoji:'🆘',label:'DISTRESS',   col:'#00c8ff',intensity:98},  // blue   — serious/urgent
    anxious:   {emoji:'😟',label:'ANXIOUS',    col:'#00c8ff',intensity:80},  // blue   — withdrawn/worried
    academic:  {emoji:'📚',label:'ACADEMIC',   col:'#38f098',intensity:60},  // green  — focused/positive
  };

  const FB = {
    neutral:  `I'm right here — fully present with you. What's stirring in your mind?`,
    joy:      "Your joy is luminous! Something wonderful is clearly moving through you. Tell me everything.",
    happy:    "This happiness in your words is contagious. What's making your world shine today?",
    calm:     "There's a beautiful stillness around you right now. What's keeping you anchored?",
    sad:      "I feel the weight in your words, and I want you to know — you don't carry this alone. I'm here.",
    angry:    "Your intensity tells me something deeply important just happened. I'm listening without judgment.",
    stressed: "I sense the pressure you're under. Breathe with me for a moment — you've gotten through hard things before.",
    fear:     "Fear is just the mind protecting what matters most. You're safe here. What's worrying you?",
    love:     "Love radiates from your every word — it's the most powerful force there is. Who or what has your heart?",
    surprised:"Something completely unexpected just turned your world! I love these moments. What happened?",
    distress: "I sense you might be going through something really difficult right now. You're not alone — I'm here with you. Would you like to talk about what's happening?",
    anxious:  "I can sense the anxiety in your words. Let's take this one breath at a time together. What's making you feel this way?",
  };

  const HINTS = {
    stressed: ["Sounds like you're feeling stressed. Want to try a breathing exercise?","Take 3 slow deep breaths right now 🌬","Would a short meditation help?"],
    anxious:  ["Try box breathing — 4 seconds each side","Ground yourself: name 5 things you can see","A quick walk can shift your nervous system"],
    sad:      ["Journaling your feelings can help process them","Reach out to someone you trust today","It's okay to feel this — all emotions pass"],
    angry:    ["Try the breathing exercise before responding","Physical movement can help release this energy","Writing out feelings can bring clarity"],
    distress: ["Please reach out to someone you trust right now","iCall helpline: 9152987821 — free & confidential","You don't have to face this alone"],
    fear:     ["Name what you're afraid of — it reduces its power","Focus on what you can control right now"],
    calm:     ["A great moment to journal or reflect","Your calm energy is your superpower today"],
    joy:      ["Capture this feeling — write about what's making you happy","Share your joy with someone who matters"],
    neutral:  ["How are you really feeling today?","Take a moment to check in with yourself"],
    happy:    ["What's making you smile? Capture this moment"],
  };

  const PET = {
    neutral:   ["I'm here ✦","Listening…","Tell me anything"],
    joy:       ["Yay!! 🌟","Love this!","You're glowing!"],
    happy:     ["So happy!!","Pure joy 🌟","Amazing energy!"],
    calm:      ["So peaceful…","Breathe easy 🌿","Tranquil vibes"],
    sad:       ["I've got you 💙","Not alone 🫂","It's okay to feel"],
    angry:     ["Let it out…","You're valid","I hear you 🔥"],
    stressed:  ["Breathe… 🌬","One step at a time","You've got this"],
    fear:      ["Brave soul 💜","Right here","You're safe"],
    love:      ["So much love! 💗","Hearts full!","Beautiful ✨"],
    surprised: ["Whoa!! ⚡","Really?!","Tell me more!"],
    distress:  ["I'm with you 🙏","You matter 💜","Help is near"],
    anxious:   ["Breathe with me 🌬","One moment at a time","You're safe here"],
  };

  const S = {
    emotion:'neutral', intensity:'medium', pattern:null, context:null,
    tts:false, online:true, urgency:null, hints:[],
    history: JSON.parse(localStorage.getItem('ms_hist')||'[]'),
  };

  let _distressCb=null, _hintCb=null;
  function onDistress(cb){ _distressCb=cb; }
  function onHints(cb){ _hintCb=cb; }

  let _actx=null;
  function _ac(){if(!_actx)_actx=new(window.AudioContext||window.webkitAudioContext)();return _actx;}
  function _tone(f,t,d,g=.06){try{const c=_ac(),o=c.createOscillator(),gn=c.createGain();o.connect(gn);gn.connect(c.destination);o.type=t;o.frequency.setValueAtTime(f,c.currentTime);gn.gain.setValueAtTime(g,c.currentTime);gn.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);o.start(c.currentTime);o.stop(c.currentTime+d);}catch(e){}}

  const SFX={
    click:   ()=>_tone(900,'sine',.08,.045),
    send:    ()=>{_tone(520,'triangle',.1,.055);},
    receive: ()=>{_tone(380,'sine',.15,.048);setTimeout(()=>_tone(448,'sine',.1,.048),110);},
    activate:()=>{_tone(440,'sine',.12,.065);setTimeout(()=>_tone(660,'sine',.1,.065),85);},
    mode:    ()=>_tone(330,'square',.08,.038),
    error:   ()=>_tone(180,'sawtooth',.22,.058),
    success: ()=>{_tone(528,'sine',.12,.058);setTimeout(()=>_tone(660,'sine',.16,.058),130);},
    chime:   ()=>{_tone(528,'sine',.25,.05);setTimeout(()=>_tone(660,'sine',.2,.04),200);setTimeout(()=>_tone(792,'sine',.3,.035),400);},
    alert:   ()=>{_tone(220,'sawtooth',.3,.08);setTimeout(()=>_tone(180,'sawtooth',.4,.06),200);},
  };

  function _authHeaders(){
    const t=sessionStorage.getItem('ms_jwt');
    const h={'Content-Type':'application/json'};
    if(t)h['Authorization']=`Bearer ${t}`;
    return h;
  }

  async function sendMessage(text){
    try{
      const profile = currentProfile();
      const r=await fetch(API_CHAT,{
        method:'POST',headers:_authHeaders(),
        body:JSON.stringify({user_id:UID,text,...profile}),
        signal:AbortSignal.timeout(15000),
      });
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const d=await r.json();
      if(!d.response)throw new Error('Empty response');
      S.online=true;
      const ek=(d.emotion||'neutral').toLowerCase().replace(/\s+/g,'_');
      const e=EDEFS[ek]?ek:'neutral';
      S.emotion=e;S.intensity=d.intensity||'medium';S.pattern=d.pattern||null;S.context=d.context||null;
      S.urgency=d.urgency||null;S.hints=d.hints||HINTS[e]||[];
      _log(e);
      if(e==='distress'||S.urgency==='high'){_distressCb?.({emotion:e,urgency:S.urgency});SFX.alert();}
      if(S.hints.length)_hintCb?.(S.hints);else if(HINTS[e])_hintCb?.(HINTS[e]);
      return{emotion:e,intensity:d.intensity||'medium',pattern:d.pattern,context:d.context,
             response:d.response,fromAPI:true,errors:d.errors||[],hints:S.hints,urgency:S.urgency,
             emotion_state:d.emotion_state||{color:EDEFS[e].col,label:EDEFS[e].label}};
    }catch(err){
      S.online=false;
      const e=_detect(text);S.emotion=e;_log(e);
      S.hints=HINTS[e]||[];
      if(S.hints.length)_hintCb?.(S.hints);
      if(e==='distress'){_distressCb?.({emotion:e,urgency:'high'});SFX.alert();}
      return{emotion:e,intensity:'medium',pattern:null,context:null,response:FB[e]||FB.neutral,
             fromAPI:false,errors:[err.message],hints:S.hints,urgency:e==='distress'?'high':null,
             emotion_state:{color:EDEFS[e].col,label:EDEFS[e].label}};
    }
  }

  async function sendVoice(audioBlob){
    const fd=new FormData();
    fd.append('audio',audioBlob,'recording.webm');
    const profile = currentProfile();
    fd.append('user_id',UID);fd.append('language',profile.language);
    const t=sessionStorage.getItem('ms_jwt');
    const headers=t?{'Authorization':`Bearer ${t}`}:{};
    const r=await fetch(API_VOICE,{method:'POST',headers,body:fd,signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async function sendFamilyAlert(note=''){
    try{
      const r=await fetch(API_ALERT,{method:'POST',headers:_authHeaders(),
        body:JSON.stringify({user_id:UID,emotion:S.emotion,urgency:S.urgency||'high',note,timestamp:new Date().toISOString()}),
        signal:AbortSignal.timeout(10000)});
      return r.ok;
    }catch(e){return false;}
  }

  function _detect(t){
    t=t.toLowerCase();
    const rules=[
      {k:['kill myself','end my life','suicide','want to die','don\'t want to live','no reason to live'],e:'distress'},
      {k:['love','adore','heart','gorgeous','beautiful'],e:'love'},
      {k:['stress','overwhelm','too much','pressure','can\'t cope'],e:'stressed'},
      {k:['anxious','anxiety','panic','nervous','dread'],e:'anxious'},
      {k:['happy','joy','excited','amazing','wonderful','yay'],e:'joy'},
      {k:['calm','peaceful','relax','tranquil'],e:'calm'},
      {k:['sad','unhappy','depressed','cry','lonely','hurt'],e:'sad'},
      {k:['angry','furious','mad','hate','rage','frustrated'],e:'angry'},
      {k:['scared','afraid','fear','terrified'],e:'fear'},
      {k:['wow','whoa','omg','surprised','shocked'],e:'surprised'},
    ];
    for(const r of rules)if(r.k.some(k=>t.includes(k)))return r.e;
    return 'neutral';
  }

  function _log(e){
    S.history.unshift({emotion:e,time:Date.now(),date:new Date().toISOString()});
    if(S.history.length>300)S.history.pop();
    try{localStorage.setItem('ms_hist',JSON.stringify(S.history.slice(0,300)));}catch(e){}
  }

  function speak(txt){
    if(!S.tts||!window.speechSynthesis)return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(txt);
    u.rate=.96;u.pitch=1.06;u.volume=.85;
    const lm={ta:'ta-IN',hi:'hi-IN',te:'te-IN',ml:'ml-IN',kn:'kn-IN',fr:'fr-FR',es:'es-ES',de:'de-DE',zh:'zh-CN',ja:'ja-JP',ar:'ar-SA'};
    const language = currentProfile().language;
    u.lang=lm[language]||'en-US';
    const vs=window.speechSynthesis.getVoices();
    const v=vs.find(v=>v.lang===u.lang)||vs.find(v=>v.lang.startsWith(language))||vs.find(v=>v.lang==='en-US')||vs[0];
    if(v)u.voice=v;
    window.speechSynthesis.speak(u);
  }
  function stopSpeak(){window.speechSynthesis?.cancel();}
  function toggleTTS(){S.tts=!S.tts;return S.tts;}

  return{
    sendMessage,sendVoice,sendFamilyAlert,onDistress,onHints,
    getEDef:(k)=>EDEFS[k]||EDEFS.neutral,
    getAllEDefs:()=>({...EDEFS}),
    getState:()=>({...S}),
    getPetLine:(e)=>{const l=PET[e]||PET.neutral;return l[Math.floor(Math.random()*l.length)];},
    getSetup:()=>currentProfile(),
    SFX,speak,stopSpeak,toggleTTS,
    get online(){return S.online;},
    get tts(){return S.tts;},
    get currentEmotion(){return S.emotion;},
  };
})();

window.SoulCore=SoulCore;
