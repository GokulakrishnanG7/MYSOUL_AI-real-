/* ═══════════════════════════════════════════════════════════
   MySoul AI v3 — UI Layer Manager (UPGRADED)
   scripts/ui-layer-manager.js
═══════════════════════════════════════════════════════════ */
'use strict';

const UILayer = (() => {

  /* ─── Face expressions ─── */
  const EXPR = {
    neutral:  {mouth:'M35 62 Q50 68 65 62',lex:8,ley:8,rex:8,rey:8},
    joy:      {mouth:'M30 58 Q50 80 70 58', lex:8,ley:11,rex:8,rey:11},
    happy:    {mouth:'M28 58 Q50 82 72 58', lex:9,ley:12,rex:9,rey:12},
    calm:     {mouth:'M35 63 Q50 69 65 63', lex:8,ley:6, rex:8,rey:6},
    sad:      {mouth:'M33 68 Q50 58 67 68', lex:8,ley:8, rex:8,rey:8},
    angry:    {mouth:'M32 68 Q50 59 68 68', lex:10,ley:6,rex:10,rey:6},
    stressed: {mouth:'M35 67 Q50 59 65 67', lex:10,ley:7,rex:10,rey:7},
    fear:     {mouth:'M38 65 Q50 60 62 65', lex:11,ley:13,rex:11,rey:13},
    love:     {mouth:'M29 58 Q50 82 71 58', lex:9,ley:12,rex:9,rey:12},
    surprised:{mouth:'M40 60 Q50 73 60 60', lex:12,ley:14,rex:12,rey:14},
    academic: {mouth:'M35 63 Q50 68 65 63', lex:8,ley:8, rex:8,rey:8},
  };

  const INT_MAP = {low:{pct:22,lbl:'Low'},medium:{pct:54,lbl:'Medium'},high:{pct:84,lbl:'High'},very_high:{pct:97,lbl:'Critical'}};

  const QUOTES = [
    {q:"Every emotion is a messenger. Don't shoot the messenger.",a:"Dr. Susan David"},
    {q:"The wound is the place where the Light enters you.",a:"Rumi"},
    {q:"You don't have to be positive all the time. Feeling sad, angry, annoyed is perfectly okay.",a:"Lori Deschene"},
    {q:"In the middle of difficulty lies opportunity.",a:"Albert Einstein"},
    {q:"What lies within us is the greatest force in the universe.",a:"Ralph Waldo Emerson"},
    {q:"Growth is not linear — it spirals, it breathes, it becomes.",a:"MySoul AI"},
    {q:"You are not your thoughts. You are the awareness behind them.",a:"Eckhart Tolle"},
    {q:"The soul always knows what to do to heal itself. The challenge is to silence the mind.",a:"Caroline Myss"},
    {q:"Emotions are data, not directives. Feel them. Learn from them. Move with them.",a:"MySoul AI"},
  ];

  const HTIPS = {
    eat:['🌿 Start with greens — chlorophyll boosts serotonin naturally.','🫐 A handful of blueberries protects neurons and lifts mood.','💧 Hydration is emotion regulation — drink before deciding.','🥑 Healthy fats nourish your nervous system deeply.'],
    move:['🚶 Ten minutes of walking cuts cortisol by up to 15%.','💃 Dance to one full song — instant mood elevation.','🏊 Swimming creates meditative flow and resets the nervous system.','⚡ Five jumping jacks right now can shift your mental state completely.'],
    stretch:["🧘 Child's pose for 60 seconds releases tension held in the lower back.",'🙆 Ten slow shoulder rolls dissolve hours of screen-induced stress.','🦵 Hip flexor stretches release stored emotional tension from the body.','🤸 A full-body yawn-stretch at dawn resets your entire nervous system.'],
    sleep:['🌙 Keep your space below 68°F — brains consolidate emotion in cool sleep.','📵 Avoid screens 90 minutes before bed to protect melatonin cycles.',"🫧 4-7-8 breathing can induce sleep within minutes — inhale 4, hold 7, exhale 8.",'📖 Fiction before bed activates empathy networks that reduce next-day stress.'],
  };

  /* ── Suggestion chips by emotion ── */
  const SUGGESTIONS = {
    neutral:  ["How are you feeling?","I've been thinking lately…","Tell me something beautiful","What should I do today?","I need some inspiration"],
    joy:      ["I'm so happy right now!","Something amazing happened","Tell me a good quote","Let's celebrate!","Share my energy"],
    happy:    ["I had a great day","Everything feels right","I'm grateful for…","Tell me more good things","Life is beautiful"],
    calm:     ["I feel peaceful today","Help me stay grounded","Breathing exercises","What keeps you calm?","Mindful moment"],
    sad:      ["I'm feeling down","I need some comfort","Talk me through this","It's been a hard day","I just need to be heard"],
    angry:    ["I'm really frustrated","Help me cool down","Why do I feel this way?","Breathe with me","I need to vent"],
    stressed: ["Everything feels overwhelming","Help me prioritize","I need a break","Too much on my plate","Calm me down"],
    fear:     ["I'm worried about…","I feel anxious","Help me feel safe","What if things go wrong?","I need reassurance"],
    love:     ["I'm thinking of someone","My heart is full","Tell me about love","I feel connected","So much gratitude"],
    surprised:["I can't believe this","Something unexpected happened","Wow, tell me more","Everything changed","New beginnings"],
  };

  /* ─── Charts ─── */
  let moodCh=null,actCh=null,mixCh=null;

  /* ─── Calendar state ─── */
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  /* ═══════════════════════════
     EMOTION SYSTEM
  ═══════════════════════════ */
  function setEmotion(eKey, iStr, pattern, context) {
    const k   = eKey||'neutral';
    const ed  = SoulCore.getEDef(k);
    const ex  = EXPR[k]||EXPR.neutral;
    const iD  = INT_MAP[iStr]||INT_MAP.medium;

    document.documentElement.setAttribute('data-emotion',k);

    /* Left panel */
    _el('eoGlyph').textContent = ed.emoji;
    _el('eoGlyph').style.filter = `drop-shadow(0 0 14px ${ed.col})`;
    _el('emoLabel').textContent  = ed.label;
    _el('emoLabel').style.color  = ed.col;
    _el('emoLabel').style.textShadow = `0 0 18px ${ed.col}`;
    _el('emoSublabel').textContent = `${iD.lbl} intensity`;

    const eoCore = document.getElementById('eoCore');
    if(eoCore) eoCore.style.boxShadow = `0 0 40px rgba(var(--ec-rgb),.38), inset 0 0 30px rgba(var(--ec-rgb),.1)`;

    /* Intensity ring */
    const pct = iD.pct;
    const offset = 314 - (pct/100)*314;
    _attr('irFill','stroke-dashoffset',offset);
    _el('irPct').textContent = pct+'%';
    _attr('irFill','stroke',ed.col);

    /* Pattern + context */
    if(pattern){_el('patternText').textContent=_fmtPat(pattern);document.getElementById('patternTag')?.classList.remove('hidden');}
    if(context){_el('contextText').textContent=context.toUpperCase();document.getElementById('contextTag')?.classList.remove('hidden');}

    /* SVG face */
    _attr('eyeL','rx',ex.lex);_attr('eyeL','ry',ex.ley);
    _attr('eyeR','rx',ex.rex);_attr('eyeR','ry',ex.rey);
    _attr('eyeL','fill',ed.col);_attr('eyeR','fill',ed.col);
    _attr('mouth','d',ex.mouth);_attr('mouth','stroke',ed.col);

    /* Soul orb glow */
    const sh = document.querySelector('.so-shell');
    if(sh) sh.style.boxShadow = `0 0 50px rgba(var(--ec-rgb),.42), 0 0 100px rgba(var(--ec-rgb),.2), inset 0 0 50px rgba(var(--ec-rgb),.12)`;

    /* Particles */
    window.ParticleSystem?.setEmotion(k);

    /* Aura rings */
    document.querySelectorAll('.eo-aura').forEach(r=>r.style.borderColor=ed.col);

    /* Orbit particles */
    document.querySelectorAll('.orbit-particle').forEach(p=>{p.style.background=ed.col;p.style.boxShadow=`0 0 10px ${ed.col}`;});

    /* VC bars */
    document.querySelectorAll('.vc-bar').forEach(b=>{b.style.background=ed.col;b.style.boxShadow=`0 0 6px ${ed.col}`;});

    /* Cursor */
    const cr = document.getElementById('cursorRing');
    const cd = document.getElementById('cursorDot');
    if(cr)cr.style.borderColor=ed.col;
    if(cd){cd.style.background=ed.col;cd.style.boxShadow=`0 0 8px ${ed.col}`;}

    /* Header accent */
    document.documentElement.style.setProperty('--ec',ed.col);
    document.documentElement.style.setProperty('--ec-rgb',_hexRgb(ed.col));
    // Persist last detected emotion colour for page reloads
    try{localStorage.setItem('ms_last_mood_col',ed.col);localStorage.setItem('ms_last_mood_emotion',k);}catch(e){}

    /* Background fog */
    const fog = document.querySelector('.bg-fog');
    if(fog){const rgb=_hexRgb(ed.col);fog.style.background=`radial-gradient(ellipse 60% 40% at 50% 50%, rgba(${rgb},0.04) 0%, transparent 70%)`;}

    /* Pet */
    _updatePet(k,ed);

    /* Timeline */
    _addTimeline(k,ed);

    /* Status beacon */
    const beacon=document.querySelector('.beacon-pulse');
    if(beacon){beacon.style.background=ed.col;beacon.style.boxShadow=`0 0 8px ${ed.col}`;}

    /* Suggestion chips */
    _updateChips(k);
  }

  function _hexRgb(hex){hex=hex.replace('#','');const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);return `${r},${g},${b}`;}
  function _fmtPat(p){return p.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}

  /* ── Suggestion chips ── */
  function _updateChips(emotion) {
    const row = document.getElementById('chipsRow');
    if(!row) return;
    const chips = SUGGESTIONS[emotion] || SUGGESTIONS.neutral;
    row.innerHTML = '';
    chips.forEach((text, i) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = text;
      chip.style.animationDelay = `${i * 0.06}s`;
      chip.addEventListener('click', () => {
        const input = document.getElementById('chatInput');
        if(input) {
          input.value = text;
          input.focus();
          SoulCore.SFX.click();
          // highlight effect
          input.style.boxShadow = '0 0 30px rgba(var(--ec-rgb),.35)';
          setTimeout(() => input.style.boxShadow = '', 600);
        }
      });
      row.appendChild(chip);
    });
  }

  /* ── Pet ── */
  function _updatePet(k,ed) {
    const body=document.querySelector('.pe-body');
    const mouth=document.getElementById('peMouth');
    const bubble=document.getElementById('petBubble');
    if(!body)return;

    body.style.borderColor=ed.col;
    body.style.boxShadow=`0 0 20px rgba(var(--ec-rgb),.28)`;

    const mmap={joy:'‿',happy:'‿',love:'❤',calm:'―',sad:'︿',angry:'ᵕ',stressed:'≈',fear:'◯',surprised:'ʘ',neutral:'‿'};
    if(mouth)mouth.textContent=mmap[k]||'‿';

    const line=SoulCore.getPetLine(k);
    if(bubble){bubble.style.opacity='0';setTimeout(()=>{bubble.textContent=line;bubble.style.transition='opacity .5s';bubble.style.opacity='1';},350);}
  }

  /* ── Timeline ── */
  function _addTimeline(k,ed) {
    const tl=document.getElementById('emotionTimeline');
    if(!tl)return;
    tl.querySelector('.tl-empty')?.remove();
    const d=document.createElement('div');
    d.className='tl-entry';
    d.innerHTML=`<span class="tl-emo">${ed.emoji}</span><div class="tl-info"><div class="tl-name">${ed.label}</div><div class="tl-ts">${_now()}</div></div><span class="tl-dot" style="background:${ed.col};color:${ed.col}"></span>`;
    tl.insertBefore(d,tl.firstChild);
    while(tl.children.length>10)tl.removeChild(tl.lastChild);
  }

  /* ── Thinking state ── */
  function setThinking(on) {
    document.querySelectorAll('.think-ring').forEach(r=>r.classList.toggle('active',on));
    window.ParticleSystem?.setThinking(on);
    const orb=document.getElementById('soulOrb');
    if(orb)orb.style.transform=on?'scale(1.06)':'';
  }

  /* ═══════════════════════════
     DASHBOARD
  ═══════════════════════════ */
  function initDashboard() { _moodChart();_actChart();_mixChart();_renderCalendar();_bestDay();_stressGauge(); }
  function refreshDashboard() { _moodChart();_actChart();_mixChart();_renderCalendar();_bestDay();_stressGauge(); }

  function _chartDefaults() {
    return {
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{color:'rgba(var(--ec-rgb),.05)'},ticks:{color:'rgba(190,215,255,.4)',font:{size:10,family:'JetBrains Mono'}}},
        y:{grid:{color:'rgba(var(--ec-rgb),.05)'},ticks:{color:'rgba(190,215,255,.4)',font:{size:10,family:'JetBrains Mono'}}},
      },
      responsive:true,maintainAspectRatio:false,
      animation:{duration:800,easing:'easeOutExpo'},
    };
  }

  function _moodChart() {
    const el=document.getElementById('moodChart'); if(!el||!window.Chart)return;
    moodCh?.destroy();
    const hist=JSON.parse(localStorage.getItem('ms_hist')||'[]');
    const sm={joy:9,happy:9,love:9,calm:7,surprised:7,neutral:5,fear:3,sad:2,angry:1,stressed:1};
    const now=new Date();
    const data=Array.from({length:7},(_,i)=>{
      const d=new Date(now);d.setDate(now.getDate()-(6-i));
      const s=d.toISOString().slice(0,10);
      const es=hist.filter(e=>e.date?.startsWith(s));
      if(!es.length)return null;
      return +(es.reduce((a,e)=>a+(sm[e.emotion]||5),0)/es.length).toFixed(1);
    });
    const labels=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()-(6-i));return d.toLocaleDateString('en-US',{weekday:'short'});});
    moodCh=new Chart(el,{
      type:'line',
      data:{
        labels,
        datasets:[{label:'Mood',data,borderColor:'var(--ec)',backgroundColor:'rgba(var(--ec-rgb),.06)',borderWidth:2.5,tension:.5,fill:true,pointBackgroundColor:'var(--ec)',pointRadius:5,pointHoverRadius:8,spanGaps:true}]
      },
      options:{..._chartDefaults(),plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(5,8,20,.95)',borderColor:'rgba(var(--ec-rgb),.3)',borderWidth:1}}},
    });
  }

  function _actChart() {
    const el=document.getElementById('activityChart'); if(!el||!window.Chart)return;
    actCh?.destroy();
    const hist=JSON.parse(localStorage.getItem('ms_hist')||'[]');
    const slots=[0,0,0,0,0];
    hist.forEach(e=>{const h=new Date(e.time).getHours();if(h<8)slots[0]++;else if(h<12)slots[1]++;else if(h<17)slots[2]++;else if(h<21)slots[3]++;else slots[4]++;});
    actCh=new Chart(el,{
      type:'bar',
      data:{
        labels:['Morning','Midday','Afternoon','Evening','Night'],
        datasets:[
          {label:'Sessions',data:slots,backgroundColor:'rgba(var(--ec-rgb),.35)',borderColor:'var(--ec)',borderWidth:1.5,borderRadius:8},
          {label:'Mood Avg', data:[5,7,6,8,5],backgroundColor:'rgba(255,224,64,.22)',borderColor:'#ffe040',borderWidth:1.5,borderRadius:8}
        ]
      },
      options:{..._chartDefaults(),plugins:{legend:{labels:{color:'rgba(190,215,255,.5)',font:{size:10,family:'JetBrains Mono'},padding:12}}}},
    });
  }

  function _mixChart() {
    const el=document.getElementById('emotionMixChart'); if(!el||!window.Chart)return;
    mixCh?.destroy();
    const hist=JSON.parse(localStorage.getItem('ms_hist')||'[]');
    const cnt={};hist.forEach(e=>{cnt[e.emotion]=(cnt[e.emotion]||0)+1;});
    const keys=Object.keys(cnt);
    if(!keys.length){
      // draw placeholder
      const edefs=SoulCore.getAllEDefs();
      const defKeys=['neutral','joy','calm','sad'];
      mixCh=new Chart(el,{type:'doughnut',data:{labels:defKeys.map(k=>edefs[k]?.label||k),datasets:[{data:[4,2,2,1],backgroundColor:defKeys.map(k=>(edefs[k]?.col||'#00c8ff')+'55'),borderColor:defKeys.map(k=>edefs[k]?.col||'#00c8ff'),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:800},plugins:{legend:{position:'right',labels:{color:'rgba(190,215,255,.5)',font:{size:10,family:'JetBrains Mono'},padding:10,boxWidth:12}}}}});
      return;
    }
    const edefs=SoulCore.getAllEDefs();
    mixCh=new Chart(el,{
      type:'doughnut',
      data:{labels:keys.map(k=>edefs[k]?.label||k),datasets:[{data:keys.map(k=>cnt[k]),backgroundColor:keys.map(k=>(edefs[k]?.col||'#00c8ff')+'88'),borderColor:keys.map(k=>edefs[k]?.col||'#00c8ff'),borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,animation:{duration:800},plugins:{legend:{position:'right',labels:{color:'rgba(190,215,255,.5)',font:{size:10,family:'JetBrains Mono'},padding:10,boxWidth:12}}}},
    });
  }

  /* ═══════════════════════════
     PROPER CALENDAR
  ═══════════════════════════ */
  function _renderCalendar() {
    const el = document.getElementById('emotionCalendar');
    const lbl = document.getElementById('calMonthLabel');
    if(!el) return;

    const hist = JSON.parse(localStorage.getItem('ms_hist')||'[]');
    const edefs = SoulCore.getAllEDefs();

    // Build a map: date string -> best emoji
    const dayMap = {};
    hist.forEach(e => {
      const day = new Date(e.time).toISOString().slice(0,10);
      if(!dayMap[day]) dayMap[day] = edefs[e.emotion]?.emoji || '·';
    });

    const year = calYear;
    const month = calMonth;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if(lbl) lbl.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().slice(0,10);

    el.innerHTML = '';

    // Empty cells for offset
    for(let i=0; i<firstDay; i++){
      const empty = document.createElement('div');
      empty.className = 'cal-d cal-empty';
      el.appendChild(empty);
    }

    // Day cells
    for(let d=1; d<=daysInMonth; d++){
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isFuture = new Date(year, month, d) > today;
      const isToday = dateStr === todayStr;
      const emoji = dayMap[dateStr];

      const div = document.createElement('div');
      div.className = 'cal-d' + (isToday?' cal-today':'') + (isFuture?' cal-future':'');
      div.innerHTML = `
        <span class="cal-d-n">${d}</span>
        <span class="cal-d-e">${emoji || (isFuture ? '' : '·')}</span>
        <span class="cal-d-dot"></span>
      `;
      div.title = emoji ? `${dateStr}: ${emoji}` : dateStr;
      el.appendChild(div);
    }
  }

  function initCalendarNav() {
    document.getElementById('calPrev')?.addEventListener('click', () => {
      calMonth--;
      if(calMonth < 0){ calMonth=11; calYear--; }
      _renderCalendar();
      SoulCore.SFX.click();
    });
    document.getElementById('calNext')?.addEventListener('click', () => {
      const now = new Date();
      if(calYear < now.getFullYear() || (calYear === now.getFullYear() && calMonth < now.getMonth())) {
        calMonth++;
        if(calMonth > 11){ calMonth=0; calYear++; }
        _renderCalendar();
        SoulCore.SFX.click();
      }
    });
  }

  function _bestDay() {
    const hist=JSON.parse(localStorage.getItem('ms_hist')||'[]');
    const sm={joy:9,happy:9,love:9,calm:7,surprised:7,neutral:5,fear:3,sad:2,angry:1,stressed:1};
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const sc=[0,0,0,0,0,0,0],ct=[0,0,0,0,0,0,0];
    hist.forEach(e=>{const d=new Date(e.time).getDay();sc[d]+=(sm[e.emotion]||5);ct[d]++;});
    let best=-1,bsc=-1;sc.forEach((s,i)=>{const a=ct[i]?s/ct[i]:0;if(a>bsc){bsc=a;best=i;}});
    const el=document.getElementById('bestDayName');
    if(el)el.textContent=best>=0&&ct[best]?days[best]:'–';
  }

  function _stressGauge() {
    const hist=JSON.parse(localStorage.getItem('ms_hist')||'[]').slice(0,30);
    const ses=['stressed','angry','fear','sad'];
    const pct=hist.length?Math.round(hist.filter(e=>ses.includes(e.emotion)).length/hist.length*100):0;
    const offset=301-(pct/100*301);
    const arc=document.getElementById('stressArc');
    if(arc){arc.setAttribute('stroke-dashoffset',offset);arc.setAttribute('stroke',pct>60?'#ff4060':pct>30?'#ffe040':'#38f098');}
    const pt=document.getElementById('stressPct');if(pt)pt.textContent=pct+'%';
    const ins=document.getElementById('stressInsight');
    if(ins)ins.textContent=pct>60?'High stress — try a breathing exercise.':pct>30?'Moderate — you\'re navigating well.':'Low stress. You\'re thriving. 🌿';
  }

  /* ═══════════════════════════
     WELLNESS
  ═══════════════════════════ */

  /* Breathe */
  let bInt=null;
  function initBreathe() {
    document.getElementById('breatheStart')?.addEventListener('click',()=>{
      if(bInt){_stopBreathe();return;}
      document.getElementById('breatheStart').textContent='Stop';
      _runBreathe(document.getElementById('breatheMode')?.value||'478');
    });
  }
  function _runBreathe(mode) {
    const cycles={
      '478':[{p:'inhale',d:4,w:'Breathe In',g:'Let air fill you…',cls:'inhale'},{p:'hold',d:7,w:'Hold',g:'Suspend the breath…',cls:'hold'},{p:'exhale',d:8,w:'Release',g:'Let everything go…',cls:'exhale'}],
      'box': [{p:'inhale',d:4,w:'Breathe In',g:'Fill slowly…',cls:'inhale'},{p:'hold',d:4,w:'Hold',g:'Still…',cls:'hold'},{p:'exhale',d:4,w:'Release',g:'Empty out…',cls:'exhale'},{p:'hold',d:4,w:'Rest',g:'Before the next…',cls:'hold'}],
      'deep':[{p:'inhale',d:5,w:'Deep Breath',g:'Open your chest…',cls:'inhale'},{p:'hold',d:2,w:'Hold',g:'',cls:'hold'},{p:'exhale',d:7,w:'Long Release',g:'Sigh it out…',cls:'exhale'}],
    };
    const steps=cycles[mode]||cycles['478'];
    let si=0,tl=steps[0].d;
    const core=document.getElementById('bfCore'),cnt=document.getElementById('bfCount'),word=document.getElementById('breatheWord'),guide=document.getElementById('breatheGuide');
    function tick(){
      const s=steps[si];
      if(core)core.className='bf-core '+s.cls;
      if(cnt)cnt.textContent=tl+'s';
      if(word)word.textContent=s.w;
      if(guide)guide.textContent=s.g;
      tl--;
      if(tl<0){si=(si+1)%steps.length;tl=steps[si].d;}
    }
    tick();bInt=setInterval(tick,1000);
  }
  function _stopBreathe(){clearInterval(bInt);bInt=null;const b=document.getElementById('breatheStart');if(b)b.textContent='Begin';const core=document.getElementById('bfCore');if(core)core.className='bf-core';const cnt=document.getElementById('bfCount');if(cnt)cnt.textContent='–';const w=document.getElementById('breatheWord');if(w)w.textContent='Session complete ✦';const g=document.getElementById('breatheGuide');if(g)g.textContent='Well done';}

  /* Journal */
  function initJournal() {
    const prompts=['What brought you a moment of peace today?','What are you grateful for right now?','What challenge showed your strength?','Describe how you want to feel tomorrow.','Write about someone who lights you up.'];
    const p=document.getElementById('jPrompt');if(p)p.textContent=prompts[new Date().getDay()%prompts.length];
    _renderJournal();
    document.getElementById('journalSave')?.addEventListener('click',()=>{
      const t=document.getElementById('journalInput')?.value.trim();
      if(!t)return;
      const saved=JSON.parse(localStorage.getItem('ms_journal')||'[]');
      saved.unshift({text:t,date:new Date().toISOString(),emotion:SoulCore.getState().emotion});
      localStorage.setItem('ms_journal',JSON.stringify(saved.slice(0,100)));
      document.getElementById('journalInput').value='';
      _renderJournal();SoulCore.SFX.success();
    });
  }
  function _renderJournal(){
    const saved=JSON.parse(localStorage.getItem('ms_journal')||'[]');
    const cnt=document.getElementById('journalCount');if(cnt)cnt.textContent=`${saved.length} ${saved.length===1?'entry':'entries'}`;
    const c=document.getElementById('journalEntries');if(!c)return;c.innerHTML='';
    saved.slice(0,5).forEach(e=>{
      const d=document.createElement('div');d.className='j-entry memory-card';
      const ed=SoulCore.getEDef(e.emotion||'neutral');
      d.innerHTML=`<div class="j-e-date" style="color:${ed.col}">${ed.emoji} ${new Date(e.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div><div class="j-e-text">${e.text.slice(0,220)}${e.text.length>220?'…':''}</div>`;
      c.appendChild(d);
    });
  }

  /* Inspire */
  function initInspire(){_showQuote();document.getElementById('inspireNext')?.addEventListener('click',()=>{_showQuote();SoulCore.SFX.click();});_buildTags();}
  function _showQuote(){
    const q=QUOTES[Math.floor(Math.random()*QUOTES.length)];
    const qs=document.getElementById('isQuote'),as=document.getElementById('isAuthor');
    if(qs){qs.style.opacity='0';setTimeout(()=>{qs.textContent=`"${q.q}"`;qs.style.transition='opacity .6s';qs.style.opacity='1';},300);}
    if(as)as.textContent=`— ${q.a}`;
  }
  function _buildTags(){const ts=['#resilience','#mindfulness','#growth','#selfcare','#courage','#gratitude','#presence','#healing'];const el=document.getElementById('inspireTags');if(!el)return;ts.forEach(t=>{const s=document.createElement('span');s.className='ins-tag';s.textContent=t;el.appendChild(s);});}

  /* Health */
  function initHealth(){_refreshHealth();document.getElementById('healthRefresh')?.addEventListener('click',()=>{_refreshHealth();SoulCore.SFX.click();});}
  function _refreshHealth(){['eat','move','stretch','sleep'].forEach(t=>{const tips=HTIPS[t];const el=document.getElementById(t+'Tip');if(el)el.textContent=tips[Math.floor(Math.random()*tips.length)];});}

  /* Color therapy */
  function initColor() {
    const canvas=document.getElementById('colorCanvas'); if(!canvas)return;
    const sw=document.getElementById('colorSwatches');
    const cols=['#00c8ff','#ffe040','#ff6ba0','#38f098','#a855f7','#ff9f38','#ff4060','#ffffff','#5b8dee','#a8f0cf','#ffd6a5','#c8b6ff'];
    let color=cols[0],brush=10,drawing=false,eraseMode=false,ctx=null;

    cols.forEach(c=>{
      const s=document.createElement('div');
      s.className='cs-swatch'+(c===color?' on':'');
      s.style.background=c;
      s.addEventListener('click',()=>{
        document.querySelectorAll('.cs-swatch').forEach(x=>x.classList.remove('on'));
        s.classList.add('on');color=c;eraseMode=false;
        document.getElementById('colorErase').textContent='Erase';
      });
      sw?.appendChild(s);
    });

    document.querySelectorAll('.cs-sz').forEach(b=>{
      b.addEventListener('click',()=>{
        document.querySelectorAll('.cs-sz').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        brush=parseInt(b.dataset.s);
      });
    });

    // Robust resize: use explicit pixel size from parent, fallback to window
    function resize(){
      const parent=canvas.parentElement;
      const w=parent ? parent.offsetWidth || parent.getBoundingClientRect().width : window.innerWidth;
      const h=Math.max(300, window.innerHeight*0.44);
      // Save existing drawing before resize
      let saved=null;
      if(ctx && canvas.width>0 && canvas.height>0){
        try{ saved=ctx.getImageData(0,0,canvas.width,canvas.height); }catch(e){}
      }
      canvas.width=Math.floor(w)||600;
      canvas.height=Math.floor(h)||300;
      ctx=canvas.getContext('2d');
      // Restore drawing
      if(saved){ try{ ctx.putImageData(saved,0,0); }catch(e){} }
    }

    // Init canvas — try immediately, also retry when Color tab is clicked
    function ensureReady(){
      if(canvas.width<10 || !ctx){ resize(); }
    }

    // Delayed init so panel has rendered
    setTimeout(resize, 50);

    // Also re-init every time the Color tab is activated
    document.querySelector('[data-wtab="color"]')?.addEventListener('click',()=>{
      setTimeout(()=>{ resize(); },60);
    });

    window.addEventListener('resize',()=>{ if(document.getElementById('wpanel-color')?.classList.contains('active')||!document.getElementById('wpanel-color')?.classList.contains('hidden')) resize(); });

    const pos=e=>{
      const r=canvas.getBoundingClientRect();
      const src=e.touches?e.touches[0]:e;
      return{x:src.clientX-r.left, y:src.clientY-r.top};
    };

    const paint=(x,y)=>{
      ensureReady();
      ctx.globalCompositeOperation = eraseMode ? 'destination-out' : 'source-over';
      ctx.beginPath();
      ctx.arc(x,y,brush/2,0,Math.PI*2);
      if(eraseMode){
        ctx.fillStyle='rgba(0,0,0,1)';
      } else {
        ctx.fillStyle=color;
        // Add glow effect
        ctx.shadowBlur=brush*1.5;
        ctx.shadowColor=color;
      }
      ctx.fill();
      ctx.shadowBlur=0;
      ctx.globalCompositeOperation='source-over';
    };

    canvas.addEventListener('mousedown',e=>{e.preventDefault();drawing=true;const p=pos(e);paint(p.x,p.y);});
    canvas.addEventListener('mousemove',e=>{if(!drawing)return;const p=pos(e);paint(p.x,p.y);});
    canvas.addEventListener('mouseup',()=>drawing=false);
    canvas.addEventListener('mouseleave',()=>drawing=false);
    canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=pos(e);paint(p.x,p.y);},{passive:false});
    canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const p=pos(e);paint(p.x,p.y);},{passive:false});
    canvas.addEventListener('touchend',()=>drawing=false);

    document.getElementById('colorErase')?.addEventListener('click',()=>{
      eraseMode=!eraseMode;
      document.getElementById('colorErase').textContent=eraseMode?'Drawing':'Erase';
      SoulCore.SFX.click();
    });
    document.getElementById('colorClear')?.addEventListener('click',()=>{
      ensureReady();
      ctx.clearRect(0,0,canvas.width,canvas.height);
    });
    document.getElementById('colorSave')?.addEventListener('click',()=>{
      const a=document.createElement('a');
      a.href=canvas.toDataURL('image/png');
      a.download='mysoul-art.png';
      a.click();
    });
  }

  /* Meditation */
  let mInt=null,mLeft=0;
  function initMeditate(){
    document.getElementById('medStart')?.addEventListener('click',()=>{
      if(mInt){_stopMed();return;}
      const mins=parseInt(document.getElementById('medDuration')?.value||5);
      mLeft=mins*60;
      document.getElementById('medStart').textContent='End Session';
      SoulCore.SFX.activate();
      const words=['Breathe deeply…','Let thoughts pass…','Feel the stillness…','You are at peace…','Simply be…','Notice the quiet…'];
      let wi=0;
      if(document.getElementById('medWord'))document.getElementById('medWord').textContent=words[0];
      mInt=setInterval(()=>{
        mLeft--;
        const m=String(Math.floor(mLeft/60)).padStart(2,'0'),s=String(mLeft%60).padStart(2,'0');
        const t=document.getElementById('medTimer');if(t)t.textContent=`${m}:${s}`;
        if(mLeft%30===0){wi=(wi+1)%words.length;const w=document.getElementById('medWord');if(w)w.textContent=words[wi];}
        if(mLeft<=0){_stopMed();SoulCore.SFX.chime();const w=document.getElementById('medWord');if(w)w.textContent='Session complete ✦';}
      },1000);
    });
  }
  function _stopMed(){clearInterval(mInt);mInt=null;const b=document.getElementById('medStart');if(b)b.textContent='Begin Journey';}

  /* Universe */
  let uAnim=null;
  function initUniverse(){
    const q=['You are a temporary arrangement of stardust becoming aware of itself.','Every atom in your body was forged in the heart of a dying star.','The cosmos is within you — you are made of star-stuff.','Look up at the stars. They are the story of your origin.'];
    const el=document.getElementById('universeQuote');if(el)el.textContent=q[Math.floor(Math.random()*q.length)];
  }
  function startUniverse(){
    const c=document.getElementById('universeCanvas');if(!c)return;
    c.width=c.offsetWidth||window.innerWidth;c.height=c.offsetHeight||window.innerHeight;
    const W=c.width,H=c.height;
    const ctx=c.getContext('2d');

    /* ── Background: deep space gradient drawn once ── */
    const bgGrad=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,Math.max(W,H)*.85);
    bgGrad.addColorStop(0,'#07091a');bgGrad.addColorStop(.5,'#04050f');bgGrad.addColorStop(1,'#020307');

    /* ── Milky Way band ── */
    function drawMilkyWay(){
      ctx.save();
      const mw=ctx.createLinearGradient(0,H*.2,W,H*.8);
      mw.addColorStop(0,'rgba(80,60,120,0)');
      mw.addColorStop(.3,'rgba(120,100,180,.07)');
      mw.addColorStop(.5,'rgba(160,140,220,.11)');
      mw.addColorStop(.7,'rgba(120,100,180,.07)');
      mw.addColorStop(1,'rgba(80,60,120,0)');
      ctx.fillStyle=mw;
      ctx.beginPath();ctx.ellipse(W*.5,H*.5,W*.55,H*.18,Math.PI*.15,0,Math.PI*2);
      ctx.fill();ctx.restore();
    }

    /* ── Stars (3 layers for depth) ── */
    const stars=Array.from({length:600},()=>({
      x:Math.random()*W,y:Math.random()*H,
      r:Math.random()*1.6+.15,
      spd:Math.random()*.008+.001,
      tw:Math.random()*Math.PI*2,
      twSpd:Math.random()*.025+.005,
      layer:Math.floor(Math.random()*3), // 0=far,1=mid,2=near
      col:['rgba(200,218,255,','rgba(255,220,200,','rgba(180,255,220,'][Math.floor(Math.random()*3)]
    }));

    /* ── Moon ── */
    const moon={
      x:W*.82,y:H*.14,r:42,
      craters:[{ox:-12,oy:-8,r:7},{ox:8,oy:4,r:5},{ox:-4,oy:14,r:4},{ox:14,oy:-14,r:3},{ox:-16,oy:8,r:3}]
    };

    /* ── Planets ── */
    const planets=[
      {bx:W*.15,by:H*.72,r:18,col:'#7ab3ff',rim:'#4488ee',hasRing:false,spd:.00025,amp:{x:30,y:18},phase:0},
      {bx:W*.68,by:H*.78,r:13,col:'#ffb347',rim:'#e8843a',hasRing:true,spd:.00040,amp:{x:20,y:12},phase:2.1},
      {bx:W*.35,by:H*.85,r:9, col:'#c084fc',rim:'#9050cc',hasRing:false,spd:.00065,amp:{x:15,y:9}, phase:4.3},
      {bx:W*.88,by:H*.58,r:7, col:'#6ee7b7',rim:'#2ea878',hasRing:false,spd:.00055,amp:{x:12,y:8}, phase:1.5},
    ];

    /* ── Asteroids ── */
    const asteroids=Array.from({length:12},(_,i)=>({
      x:Math.random()*W,y:Math.random()*H,
      vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.25,
      r:Math.random()*4+2,
      rot:Math.random()*Math.PI*2,
      rotSpd:(Math.random()-.5)*.03,
      pts:5+Math.floor(Math.random()*4),
      rough:Array.from({length:9},()=>Math.random()*.4+.7)
    }));

    /* ── Shooting stars ── */
    const shoots=[];
    function spawnShoot(){
      if(shoots.length>4)return;
      shoots.push({
        x:Math.random()*W,y:Math.random()*H*.4,
        vx:3+Math.random()*5,vy:1.5+Math.random()*3,
        len:80+Math.random()*120,life:1,decay:.018+Math.random()*.012
      });
    }
    setInterval(spawnShoot,1800+Math.random()*2000);

    /* ── Nebula clouds ── */
    const nebulas=[
      {x:W*.25,y:H*.35,rx:160,ry:80,col:'rgba(120,60,200,',rot:-.3},
      {x:W*.72,y:H*.55,rx:130,ry:60,col:'rgba(0,160,200,',rot:.4},
      {x:W*.5, y:H*.15,rx:100,ry:50,col:'rgba(200,80,120,',rot:.1},
    ];

    /* ── Galaxy swirl (distant) ── */
    const galaxyArms=6;

    function drawGalaxy(t){
      ctx.save();
      ctx.translate(W*.06,H*.12);ctx.rotate(t*.0002);
      for(let a=0;a<galaxyArms;a++){
        for(let i=0;i<40;i++){
          const angle=a*(Math.PI*2/galaxyArms)+(i*.18);
          const dist=i*2.2;
          const gx=Math.cos(angle)*dist,gy=Math.sin(angle)*dist;
          const alpha=(.12-i*.0025)*Math.max(0,1);
          if(alpha<=0)continue;
          ctx.beginPath();ctx.arc(gx,gy,Math.max(.4,1.2-i*.025),0,Math.PI*2);
          ctx.fillStyle=`rgba(200,180,255,${alpha})`;ctx.fill();
        }
      }
      ctx.restore();
    }

    let t=0;
    function draw(){
      /* deep bg */
      ctx.fillStyle=bgGrad;ctx.fillRect(0,0,W,H);
      drawMilkyWay();
      drawGalaxy(t);

      /* nebulas */
      nebulas.forEach(n=>{
        ctx.save();ctx.translate(n.x,n.y);ctx.rotate(n.rot+t*.0001);
        const ng=ctx.createRadialGradient(0,0,0,0,0,n.rx);
        ng.addColorStop(0,n.col+'.06)');ng.addColorStop(.5,n.col+'.03)');ng.addColorStop(1,n.col+'0)');
        ctx.fillStyle=ng;
        ctx.scale(1,n.ry/n.rx);ctx.beginPath();ctx.arc(0,0,n.rx,0,Math.PI*2);ctx.fill();
        ctx.restore();
      });

      /* stars */
      stars.forEach(s=>{
        s.tw+=s.twSpd;
        const lspd=[.001,.003,.006][s.layer];
        s.y+=lspd;if(s.y>H+2)s.y=-2;
        const alpha=.2+.5*Math.sin(s.tw);
        const sz=s.r*([.5,1,1.5][s.layer]);
        ctx.beginPath();ctx.arc(s.x,s.y,sz,0,Math.PI*2);
        ctx.fillStyle=s.col+alpha+')';ctx.fill();
        /* star glow for near layer */
        if(s.layer===2&&sz>1.2){
          ctx.beginPath();ctx.arc(s.x,s.y,sz*2.5,0,Math.PI*2);
          ctx.fillStyle=s.col+(alpha*.15)+')';ctx.fill();
        }
      });

      /* moon */
      ctx.save();
      const moonGlow=ctx.createRadialGradient(moon.x,moon.y,moon.r*.6,moon.x,moon.y,moon.r*2.5);
      moonGlow.addColorStop(0,'rgba(220,220,180,.18)');moonGlow.addColorStop(1,'rgba(220,220,180,0)');
      ctx.fillStyle=moonGlow;ctx.beginPath();ctx.arc(moon.x,moon.y,moon.r*2.5,0,Math.PI*2);ctx.fill();
      const mg=ctx.createRadialGradient(moon.x-moon.r*.3,moon.y-moon.r*.3,0,moon.x,moon.y,moon.r);
      mg.addColorStop(0,'#f0ead8');mg.addColorStop(.6,'#d4ccb0');mg.addColorStop(1,'#9a9070');
      ctx.fillStyle=mg;ctx.beginPath();ctx.arc(moon.x,moon.y,moon.r,0,Math.PI*2);ctx.fill();
      moon.craters.forEach(cr=>{
        ctx.beginPath();ctx.arc(moon.x+cr.ox,moon.y+cr.oy,cr.r,0,Math.PI*2);
        ctx.fillStyle='rgba(100,90,70,.35)';ctx.fill();
      });
      /* terminator shadow */
      ctx.save();ctx.beginPath();ctx.arc(moon.x,moon.y,moon.r,0,Math.PI*2);ctx.clip();
      const ts=ctx.createLinearGradient(moon.x-moon.r,moon.y,moon.x+moon.r*.2,moon.y);
      ts.addColorStop(0,'rgba(5,8,20,.0)');ts.addColorStop(.75,'rgba(5,8,20,.0)');ts.addColorStop(1,'rgba(5,8,20,.55)');
      ctx.fillStyle=ts;ctx.fillRect(moon.x-moon.r,moon.y-moon.r,moon.r*2,moon.r*2);ctx.restore();
      ctx.restore();

      /* planets */
      planets.forEach((p,i)=>{
        const ox=Math.cos(t*p.spd+p.phase)*p.amp.x;
        const oy=Math.sin(t*p.spd+p.phase)*p.amp.y;
        const px=p.bx+ox,py=p.by+oy;
        /* glow */
        ctx.save();ctx.shadowBlur=20;ctx.shadowColor=p.col;
        /* ring */
        if(p.hasRing){
          ctx.save();ctx.translate(px,py);ctx.scale(1,.32);
          ctx.beginPath();ctx.arc(0,0,p.r*2.4,0,Math.PI*2);
          ctx.strokeStyle=p.col+'99';ctx.lineWidth=3;ctx.stroke();
          ctx.beginPath();ctx.arc(0,0,p.r*2.8,0,Math.PI*2);
          ctx.strokeStyle=p.col+'44';ctx.lineWidth=1.5;ctx.stroke();
          ctx.restore();
        }
        const pg=ctx.createRadialGradient(px-p.r*.3,py-p.r*.3,0,px,py,p.r);
        pg.addColorStop(0,'#fff');pg.addColorStop(.25,p.col);pg.addColorStop(1,p.rim);
        ctx.beginPath();ctx.arc(px,py,p.r,0,Math.PI*2);ctx.fillStyle=pg;ctx.fill();
        ctx.restore();
      });

      /* asteroids */
      asteroids.forEach(a=>{
        a.x+=a.vx;a.y+=a.vy;a.rot+=a.rotSpd;
        if(a.x<-20)a.x=W+20;if(a.x>W+20)a.x=-20;
        if(a.y<-20)a.y=H+20;if(a.y>H+20)a.y=-20;
        ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);
        ctx.beginPath();
        for(let k=0;k<a.pts;k++){
          const ang=(k/a.pts)*Math.PI*2;
          const ri=a.rough[k%a.rough.length]*a.r;
          k===0?ctx.moveTo(Math.cos(ang)*ri,Math.sin(ang)*ri):ctx.lineTo(Math.cos(ang)*ri,Math.sin(ang)*ri);
        }
        ctx.closePath();
        ctx.fillStyle='rgba(140,130,120,.7)';ctx.fill();
        ctx.strokeStyle='rgba(200,190,180,.3)';ctx.lineWidth=.5;ctx.stroke();
        ctx.restore();
      });

      /* shooting stars */
      for(let i=shoots.length-1;i>=0;i--){
        const s=shoots[i];
        s.x+=s.vx;s.y+=s.vy;s.life-=s.decay;
        if(s.life<=0||s.x>W+s.len||s.y>H+s.len){shoots.splice(i,1);continue;}
        const grad=ctx.createLinearGradient(s.x,s.y,s.x-s.vx*(s.len/s.vx),s.y-s.vy*(s.len/s.vx));
        grad.addColorStop(0,`rgba(255,255,255,${s.life})`);
        grad.addColorStop(.3,`rgba(180,220,255,${s.life*.5})`);
        grad.addColorStop(1,'rgba(180,220,255,0)');
        ctx.beginPath();ctx.moveTo(s.x,s.y);
        ctx.lineTo(s.x-(s.vx/Math.hypot(s.vx,s.vy))*s.len,s.y-(s.vy/Math.hypot(s.vx,s.vy))*s.len);
        ctx.strokeStyle=grad;ctx.lineWidth=1.5;ctx.stroke();
        /* head sparkle */
        ctx.beginPath();ctx.arc(s.x,s.y,2,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,255,255,${s.life*.8})`;ctx.fill();
      }

      t++;
      uAnim=requestAnimationFrame(draw);
    }
    if(uAnim)cancelAnimationFrame(uAnim);draw();
  }
  function stopUniverse(){if(uAnim)cancelAnimationFrame(uAnim);uAnim=null;}

  /* ═══════════════════════════
     NAVIGATION
  ═══════════════════════════ */
  function initNavigation(){
    document.querySelectorAll('.nav-pill').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const v=btn.dataset.view;SoulCore.SFX.click();
        document.querySelectorAll('.nav-pill').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
        document.querySelectorAll('.view').forEach(vw=>vw.classList.remove('active'));
        document.getElementById('view-'+v)?.classList.add('active');
        if(v==='insights')setTimeout(()=>{refreshDashboard();initCalendarNav();},80);
        if(v==='universe')setTimeout(startUniverse,80);else stopUniverse();
      });
    });
    document.querySelectorAll('.wtab').forEach(t=>{
      t.addEventListener('click',()=>{
        document.querySelectorAll('.wtab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
        document.querySelectorAll('.wpanel').forEach(p=>p.classList.add('hidden'));
        document.getElementById('wpanel-'+t.dataset.wtab)?.classList.remove('hidden');
        SoulCore.SFX.click();
      });
    });
    document.querySelectorAll('.period').forEach(b=>{
      b.addEventListener('click',()=>{document.querySelectorAll('.period').forEach(x=>x.classList.remove('active'));b.classList.add('active');_moodChart();});
    });
  }

  /* ═══════════════════════════
     CONTROLS
  ═══════════════════════════ */
  function initControls(){
    /* Theme */
    document.getElementById('themeToggle')?.addEventListener('click',()=>{
      SoulCore.SFX.mode();
      const dark=document.documentElement.getAttribute('data-theme')==='dark';
      document.documentElement.setAttribute('data-theme',dark?'light':'dark');
    });

    /* Heartbeat */
    const hb=document.getElementById('heartbeatBtn');
    document.getElementById('soulOrb')?.addEventListener('click',()=>{SoulCore.SFX.activate();_pulse();_spawnThought();});
    hb?.addEventListener('click',()=>{SoulCore.SFX.mode();hb.classList.toggle('active');const so=document.querySelector('.so-shell');so?.classList.toggle('heartbeat');});

    /* TTS */
    const tts=document.getElementById('ttsToggle');
    tts?.addEventListener('click',()=>{const on=SoulCore.toggleTTS();tts.classList.toggle('active',on);SoulCore.SFX.click();});

    /* Lock */
    const lock=document.getElementById('lockBtn');
    lock?.addEventListener('click',()=>{document.getElementById('lockScreen')?.classList.remove('hidden');SoulCore.SFX.click();});

    /* Cursor — smooth lag effect */
    let cx=0,cy=0,tx=0,ty=0;
    const cr=document.getElementById('cursorRing'),cd=document.getElementById('cursorDot');
    document.addEventListener('mousemove',e=>{
      tx=e.clientX;ty=e.clientY;
      if(cd){cd.style.left=tx+'px';cd.style.top=ty+'px';}
    });
    // Smooth ring follow
    function animCursor(){
      cx+=(tx-cx)*.18;cy+=(ty-cy)*.18;
      if(cr){cr.style.left=cx+'px';cr.style.top=cy+'px';}
      requestAnimationFrame(animCursor);
    }
    animCursor();
    document.addEventListener('mousedown',()=>cr?.classList.add('pressed'));
    document.addEventListener('mouseup',()=>cr?.classList.remove('pressed'));

    /* Ripple */
    document.addEventListener('click',e=>_ripple(e.clientX,e.clientY));

    /* Soul orb pupil tracking */
    document.addEventListener('mousemove',e=>{
      const orb=document.getElementById('soulOrb');
      if(!orb)return;
      const r=orb.getBoundingClientRect();
      const cx2=r.left+r.width/2,cy2=r.top+r.height/2;
      const ang=Math.atan2(e.clientY-cy2,e.clientX-cx2);
      const dist=Math.min(4,Math.hypot(e.clientX-cx2,e.clientY-cy2)*.04);
      const ox=Math.cos(ang)*dist,oy=Math.sin(ang)*dist;
      _attr('pupL','cx',37+ox);_attr('pupL','cy',41+oy);
      _attr('pupR','cx',67+ox);_attr('pupR','cy',41+oy);
    });

    /* Hover glow effect on interactive elements */
    document.querySelectorAll('.nav-pill, .soul-btn, .hdr-btn, .mic-core').forEach(el=>{
      el.addEventListener('mouseenter',()=>{ SoulCore.SFX.click && void 0; });
    });

    /* Thoughts */
    setTimeout(()=>{_spawnThought();_schedThoughts();},9000);
  }

  function _pulse(){const orb=document.getElementById('soulOrb');if(!orb)return;orb.style.transform='scale(1.15)';setTimeout(()=>orb.style.transform='',300);}

  /* ═══════════════════════════
     LOCK SCREEN
  ═══════════════════════════ */
  function initLock(){
    // Accept ANY 4-digit code — no hardcoded password
    let entered='';
    const dots=document.querySelectorAll('#lockDots span');
    const hint=document.querySelector('.lock-hint');

    const updDots=()=>{
      dots.forEach((d,i)=>{
        d.classList.toggle('on', i<entered.length);
      });
    };

    const resetHint=()=>{
      if(hint) hint.textContent='Enter any 4-digit passcode';
    };
    resetHint();

    document.getElementById('lockSkip')?.addEventListener('click',()=>{
      document.getElementById('lockScreen')?.classList.add('hidden');
      SoulCore.SFX.click();
    });

    document.querySelectorAll('.kp').forEach(k=>{
      k.addEventListener('click',()=>{
        const v=k.dataset.v;
        SoulCore.SFX.click();

        if(v==='clear'){
          // Backspace
          entered=entered.slice(0,-1);
          updDots();
          resetHint();
          return;
        }

        if(v==='ok'){
          // Manual confirm
          if(entered.length===4){
            document.getElementById('lockScreen')?.classList.add('hidden');
            entered='';
            updDots();
            SoulCore.SFX.success();
          } else {
            if(hint) hint.textContent=`Enter ${4-entered.length} more digit${4-entered.length!==1?'s':''}`;
          }
          return;
        }

        // Digit button — only add if under 4
        if(entered.length<4){
          entered+=v;
          updDots();
        }

        // Auto-unlock once 4 digits entered
        if(entered.length===4){
          setTimeout(()=>{
            document.getElementById('lockScreen')?.classList.add('hidden');
            entered='';
            updDots();
            SoulCore.SFX.success();
          },280);
        }
      });
    });
  }

  /* ═══════════════════════════
     FLOATING THOUGHTS
  ═══════════════════════════ */
  const TPOOL=['Every emotion is data ✦','You are enough','Breathe with intention','One moment at a time','Your feelings are valid 💙','You are seen','Stay present ✨','Growth takes courage','Be gentle with yourself','Feel it. Heal it.','You are the observer','Emotions are temporary','This too shall pass ✦','You are not alone'];
  function _spawnThought(){
    const c=document.getElementById('floatingThoughts');if(!c)return;
    const b=document.createElement('div');b.className='thought-orb';b.textContent=TPOOL[Math.floor(Math.random()*TPOOL.length)];
    const sx=Math.random()*(window.innerWidth-300);
    const tdx=(Math.random()-.5)*220,tdy=-(180+Math.random()*260);
    b.style.cssText=`left:${sx}px;top:${window.innerHeight-55}px;--tdx:${tdx}px;--tdy:${tdy}px;`;
    c.appendChild(b);setTimeout(()=>b.remove(),9200);
  }
  function _schedThoughts(){setTimeout(()=>{_spawnThought();_schedThoughts();},15000+Math.random()*9000);}

  /* ═══════════════════════════
     STATUS / ERROR
  ═══════════════════════════ */
  function showError(msg){const b=document.getElementById('errorBanner'),t=document.getElementById('errorText');if(t)t.textContent=msg;b?.classList.remove('hidden');setTimeout(()=>b?.classList.add('hidden'),5500);}
  function showOnline(on){const b=document.querySelector('.beacon-pulse'),l=document.getElementById('statusLabel');if(b){b.style.background=on?'#38f098':'#ff4060';b.style.boxShadow=`0 0 8px ${on?'#38f098':'#ff4060'}`;}if(l)l.textContent=on?'Aware':'Offline';}

  /* ─── Helpers ─── */
  function _el(id){return document.getElementById(id)||{textContent:'',style:{},classList:{add:()=>{},remove:()=>{},toggle:()=>{}}};}
  function _attr(id,a,v){const e=document.getElementById(id);if(e)e.setAttribute(a,v);}
  function _now(){return new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  function _ripple(x,y){const c=document.getElementById('rippleRoot');const r=document.createElement('div');r.className='rpl';r.style.left=x+'px';r.style.top=y+'px';c?.appendChild(r);setTimeout(()=>r.remove(),650);}

  return {
    setEmotion,setThinking,initDashboard,refreshDashboard,
    initBreathe,initJournal,initInspire,initHealth,initColor,initMeditate,
    initUniverse,startUniverse,stopUniverse,initNavigation,initControls,initLock,
    initCalendarNav,showError,showOnline,
  };
})();

window.UILayer=UILayer;
