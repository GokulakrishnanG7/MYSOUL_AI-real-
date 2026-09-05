/* ═══════════════════════════════════════════════════════════
   MySoul AI OS — Unique New Features
   modules/soul-features.js
   
   FEATURES:
   1. 🌈 Mood Ring       — ambient color aura around screen edges
   2. 🫧 Soul Bubble     — floating companion orb (persistent)
   3. 🧘 Breath Coach    — animated breathing guide widget
   4. 🔮 Daily Oracle    — daily wisdom card with animation
   5. 🎵 Emotion Soundscape — ambient tones matched to mood
   6. 💡 Smart Insight    — AI-powered journal prompts
═══════════════════════════════════════════════════════════ */
'use strict';

/* ════════════════════════════════════════
   1. MOOD RING — Ambient Screen Aura
   Glowing edge color that shifts with emotion
════════════════════════════════════════ */
const MoodRing = (() => {
  const EMOTION_AURAS = {
    neutral:   { color: '0,200,255',   intensity: 0.12, speed: 4 },
    joy:       { color: '255,224,64',  intensity: 0.22, speed: 2 },
    happy:     { color: '255,218,32',  intensity: 0.20, speed: 2.5 },
    calm:      { color: '56,240,152',  intensity: 0.10, speed: 6 },
    sad:       { color: '91,141,238',  intensity: 0.15, speed: 7 },
    angry:     { color: '255,64,96',   intensity: 0.25, speed: 1.5 },
    stressed:  { color: '255,64,96',   intensity: 0.22, speed: 1.8 },
    fear:      { color: '168,85,247',  intensity: 0.18, speed: 3 },
    love:      { color: '255,107,160', intensity: 0.20, speed: 3.5 },
    surprised: { color: '255,159,56',  intensity: 0.20, speed: 2 },
    anxious:   { color: '168,85,247',  intensity: 0.18, speed: 2.5 },
  };

  let _ring, _current = 'neutral', _animId;

  function _build() {
    if (document.getElementById('moodRing')) return;
    _ring = document.createElement('div');
    _ring.id = 'moodRing';
    _ring.style.cssText = `
      position:fixed;inset:0;z-index:1;pointer-events:none;
      transition:box-shadow 2s ease, opacity 1s ease;
      border-radius:0;opacity:.7;
    `;
    document.body.insertBefore(_ring, document.body.firstChild);
    _animate();
  }

  function _animate() {
    let t = 0;
    function frame() {
      t += 0.016;
      const aura = EMOTION_AURAS[_current] || EMOTION_AURAS.neutral;
      const pulse = aura.intensity * (0.7 + 0.3 * Math.sin(t * (6.28 / aura.speed)));
      const spread = 60 + 20 * Math.sin(t * 0.8);
      _ring.style.boxShadow = `
        inset 0 0 ${spread}px rgba(${aura.color},${pulse}),
        inset 0 0 ${spread*1.8}px rgba(${aura.color},${pulse * 0.5})
      `;
      _animId = requestAnimationFrame(frame);
    }
    frame();
  }

  function setEmotion(emotion) {
    _current = emotion;
  }

  function init() {
    _build();
    // Hook into existing emotion updates
    const histInterval = setInterval(() => {
      const hist = JSON.parse(localStorage.getItem('ms_hist') || '[]');
      if (hist[0]) { _current = hist[0].emotion || 'neutral'; }
    }, 5000);
  }

  return { init, setEmotion };
})();


/* ════════════════════════════════════════
   2. SOUL BUBBLE — Floating Companion Orb
   Persistent mini-orb with quick actions
════════════════════════════════════════ */
const SoulBubble = (() => {
  let _bubble, _menu, _open = false;

  function _build() {
    if (document.getElementById('soulBubble')) return;

    _injectStyles();

    _bubble = document.createElement('div');
    _bubble.id = 'soulBubble';
    _bubble.innerHTML = `
      <div class="sb-glow"></div>
      <div class="sb-face">◈</div>
      <div class="sb-pulse"></div>
    `;
    _bubble.addEventListener('click', _toggle);
    document.body.appendChild(_bubble);

    _menu = document.createElement('div');
    _menu.id = 'soulBubbleMenu';
    _menu.innerHTML = `
      <div class="sbm-item" data-action="voice">🎤 <span>Voice</span></div>
      <div class="sbm-item" data-action="breathe">🌬 <span>Breathe</span></div>
      <div class="sbm-item" data-action="oracle">🔮 <span>Oracle</span></div>
      <div class="sbm-item" data-action="nudge">💡 <span>Insight</span></div>
      <div class="sbm-item" data-action="home">⬡ <span>Home</span></div>
    `;
    _menu.querySelectorAll('.sbm-item').forEach(item => {
      item.addEventListener('click', () => _handleAction(item.dataset.action));
    });
    document.body.appendChild(_menu);

    // Make draggable
    _makeDraggable(_bubble);
  }

  function _makeDraggable(el) {
    let dx=0,dy=0,down=false,moved=false;
    el.addEventListener('mousedown', e => {
      down=true; moved=false;
      const r=el.getBoundingClientRect(); dx=e.clientX-r.left; dy=e.clientY-r.top;
    });
    document.addEventListener('mousemove', e => {
      if (!down) return;
      moved=true; _open=false; _menu.classList.remove('sbm-open');
      el.style.right='auto'; el.style.bottom='auto';
      el.style.left=(e.clientX-dx)+'px'; el.style.top=(e.clientY-dy)+'px';
    });
    document.addEventListener('mouseup', () => { down=false; });
    el.addEventListener('touchstart', e=>{down=true;moved=false;const t=e.touches[0],r=el.getBoundingClientRect();dx=t.clientX-r.left;dy=t.clientY-r.top},{passive:true});
    document.addEventListener('touchmove', e=>{if(!down)return;moved=true;const t=e.touches[0];el.style.left=(t.clientX-dx)+'px';el.style.top=(t.clientY-dy)+'px';el.style.right='auto';el.style.bottom='auto'},{passive:true});
    document.addEventListener('touchend', ()=>{down=false;});
  }

  function _toggle(e) {
    if (_open) {
      _close();
    } else {
      _open = true;
      _menu.classList.add('sbm-open');
      const r = _bubble.getBoundingClientRect();
      _menu.style.left = Math.min(r.left - 10, window.innerWidth - 170) + 'px';
      _menu.style.top  = (r.top - _menu.offsetHeight - 10) + 'px';
      if (parseFloat(_menu.style.top) < 10) {
        _menu.style.top = (r.bottom + 10) + 'px';
      }
    }
  }

  function _close() {
    _open = false;
    _menu?.classList.remove('sbm-open');
  }

  function _handleAction(action) {
    _close();
    switch(action) {
      case 'voice':   VoiceSystem?.show(); break;
      case 'breathe': BreathCoach?.show(); break;
      case 'oracle':  DailyOracle?.show(); break;
      case 'nudge':   SmartInsight?.show(); break;
      case 'home':    location.href = (location.pathname.includes('/pages/') ? '' : 'pages/') + 'launcher.html'; break;
    }
  }

  function _injectStyles() {
    if (document.getElementById('sbStyles')) return;
    const s = document.createElement('style');
    s.id = 'sbStyles';
    s.textContent = `
#soulBubble{position:fixed;right:18px;bottom:180px;z-index:88000;width:52px;height:52px;border-radius:50%;background:rgba(5,8,20,.9);border:1.5px solid rgba(0,200,255,.45);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.5);user-select:none}
#soulBubble:hover{transform:scale(1.12);border-color:rgba(0,200,255,.8);box-shadow:0 0 20px rgba(0,200,255,.4)}
.sb-glow{position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(0,200,255,.18) 0%,transparent 70%);animation:sbGlow 3s ease-in-out infinite}
@keyframes sbGlow{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
.sb-face{font-size:20px;color:rgba(0,200,255,.9);position:relative;z-index:1;transition:transform .3s ease}
#soulBubble:hover .sb-face{transform:scale(1.1)}
.sb-pulse{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(0,200,255,.3);animation:sbPulse 2.5s ease-out infinite}
@keyframes sbPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(2);opacity:0}}

#soulBubbleMenu{position:fixed;z-index:88001;width:156px;background:rgba(5,8,20,.95);border:1px solid rgba(0,200,255,.25);border-radius:16px;overflow:hidden;backdrop-filter:blur(20px);transform:scale(.85) translateY(10px);opacity:0;pointer-events:none;transition:all .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 12px 40px rgba(0,0,0,.6)}
#soulBubbleMenu.sbm-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}
.sbm-item{display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:13px;color:rgba(190,215,255,.75);cursor:pointer;transition:all .2s ease;border-bottom:1px solid rgba(255,255,255,.04)}
.sbm-item:last-child{border-bottom:none}
.sbm-item:hover{background:rgba(0,200,255,.08);color:rgba(0,200,255,.95);padding-left:20px}
    `;
    document.head.appendChild(s);
  }

  function init() { _build(); }
  function updateEmotion(emotion) {
    const COLS={neutral:'0,200,255',happy:'255,218,32',sad:'91,141,238',angry:'255,64,96',calm:'56,240,152',love:'255,107,160',fear:'168,85,247',stressed:'255,64,96',joy:'255,224,64',surprised:'255,159,56'};
    const c = COLS[emotion] || '0,200,255';
    const bubble = document.getElementById('soulBubble');
    if (bubble) {
      bubble.style.borderColor = `rgba(${c},.5)`;
      bubble.style.boxShadow   = `0 4px 20px rgba(0,0,0,.5), 0 0 12px rgba(${c},.2)`;
    }
  }

  return { init, updateEmotion };
})();


/* ════════════════════════════════════════
   3. BREATH COACH — Guided Breathing Overlay
════════════════════════════════════════ */
const BreathCoach = (() => {
  const PATTERNS = {
    '4-4-4-4': { name:'Box Breathing', phases:[{label:'Inhale',dur:4},{label:'Hold',dur:4},{label:'Exhale',dur:4},{label:'Hold',dur:4}] },
    '4-7-8':   { name:'4-7-8 Calm',    phases:[{label:'Inhale',dur:4},{label:'Hold',dur:7},{label:'Exhale',dur:8}] },
    '5-5':     { name:'Equal Breath',  phases:[{label:'Inhale',dur:5},{label:'Exhale',dur:5}] },
  };

  let _overlay, _running=false, _timer=null, _phaseIdx=0, _seconds=0, _pattern='4-4-4-4', _cycles=0;

  function _build() {
    if (document.getElementById('breathOverlay')) return;
    _overlay = document.createElement('div');
    _overlay.id = 'breathOverlay';
    _overlay.innerHTML = `
      <div class="bco-card">
        <div class="bco-close" id="bcoClose">✕</div>
        <div class="bco-title">Breathing Space</div>
        <div class="bco-orb-wrap">
          <div class="bco-orb" id="bcoOrb">
            <div class="bco-count" id="bcoCount">–</div>
          </div>
        </div>
        <div class="bco-phase" id="bcoPhase">Choose a pattern</div>
        <div class="bco-cycles" id="bcoCycles">Cycles: 0</div>
        <div class="bco-btns">
          <select class="bco-sel" id="bcoSel">
            <option value="4-4-4-4">Box Breathing (4-4-4-4)</option>
            <option value="4-7-8">4-7-8 Calm</option>
            <option value="5-5">Equal Breath (5-5)</option>
          </select>
          <button class="bco-btn" id="bcoStart">Begin</button>
        </div>
      </div>
    `;
    document.body.appendChild(_overlay);
    _injectStyles();
    document.getElementById('bcoClose')?.addEventListener('click', hide);
    document.getElementById('bcoStart')?.addEventListener('click', _toggle);
    document.getElementById('bcoSel')?.addEventListener('change', e => { _pattern = e.target.value; _reset(); });
    _overlay.addEventListener('click', e => { if (e.target === _overlay) hide(); });
  }

  function _injectStyles() {
    if (document.getElementById('bcoStyles')) return;
    const s = document.createElement('style');
    s.id='bcoStyles';
    s.textContent=`
#breathOverlay{position:fixed;inset:0;z-index:95000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity .4s ease}
#breathOverlay.bco-open{opacity:1;pointer-events:all}
.bco-card{background:rgba(5,8,20,.95);border:1px solid rgba(56,240,152,.25);border-radius:24px;padding:28px 32px;width:min(340px,90vw);text-align:center;box-shadow:0 20px 80px rgba(0,0,0,.8);position:relative}
.bco-close{position:absolute;top:16px;right:16px;cursor:pointer;color:rgba(190,215,255,.4);font-size:14px;padding:4px 8px;border-radius:6px;transition:all .2s ease}
.bco-close:hover{color:rgba(56,240,152,.8);background:rgba(56,240,152,.1)}
.bco-title{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;color:rgba(190,215,255,.8);margin-bottom:24px;letter-spacing:.06em}
.bco-orb-wrap{display:flex;justify-content:center;margin-bottom:20px}
.bco-orb{width:130px;height:130px;border-radius:50%;border:2px solid rgba(56,240,152,.4);background:rgba(56,240,152,.07);display:flex;align-items:center;justify-content:center;transition:all .5s ease;animation:bcoBreath 4s ease-in-out infinite}
@keyframes bcoBreath{0%,100%{box-shadow:0 0 20px rgba(56,240,152,.2)}50%{box-shadow:0 0 50px rgba(56,240,152,.5)}}
.bco-orb.inhale{transform:scale(1.35);background:rgba(56,240,152,.15);border-color:rgba(56,240,152,.7)}
.bco-orb.exhale{transform:scale(.8);background:rgba(56,240,152,.04);border-color:rgba(56,240,152,.25)}
.bco-orb.hold{transform:scale(1.1)}
.bco-count{font-family:'JetBrains Mono',monospace;font-size:36px;font-weight:300;color:rgba(56,240,152,.9)}
.bco-phase{font-family:'Syne',sans-serif;font-size:18px;font-weight:600;color:#e2eeff;margin-bottom:6px;letter-spacing:.04em;min-height:28px}
.bco-cycles{font-size:11px;color:rgba(130,170,220,.4);letter-spacing:.1em;margin-bottom:18px}
.bco-btns{display:flex;gap:10px;justify-content:center;align-items:center}
.bco-sel{background:rgba(56,240,152,.06);border:1px solid rgba(56,240,152,.2);border-radius:10px;color:rgba(190,215,255,.7);font-size:12px;padding:8px 12px;flex:1}
.bco-btn{padding:9px 22px;border-radius:22px;background:rgba(56,240,152,.12);border:1px solid rgba(56,240,152,.4);color:rgba(56,240,152,.9);font-family:'Syne',sans-serif;font-size:12px;cursor:pointer;transition:all .25s ease;letter-spacing:.06em}
.bco-btn:hover{background:rgba(56,240,152,.25);box-shadow:0 0 16px rgba(56,240,152,.3)}
    `;
    document.head.appendChild(s);
  }

  function _toggle() {
    if (_running) { _stop(); document.getElementById('bcoStart').textContent='Begin'; }
    else { _start(); document.getElementById('bcoStart').textContent='Stop'; }
  }

  function _start() {
    _running=true; _phaseIdx=0; _cycles=0;
    _pattern = document.getElementById('bcoSel')?.value || '4-4-4-4';
    _runPhase();
  }

  function _runPhase() {
    if (!_running) return;
    const pat = PATTERNS[_pattern];
    const phase = pat.phases[_phaseIdx % pat.phases.length];
    _seconds = phase.dur;
    const orb = document.getElementById('bcoOrb');
    const phaseEl = document.getElementById('bcoPhase');
    if (phaseEl) phaseEl.textContent = phase.label;
    if (orb) { orb.className='bco-orb'; orb.classList.add(phase.label.toLowerCase()); }
    _tick();
  }

  function _tick() {
    if (!_running) return;
    document.getElementById('bcoCount').textContent = _seconds;
    if (_seconds > 0) { _seconds--; _timer = setTimeout(_tick, 1000); }
    else {
      _phaseIdx++;
      const pat = PATTERNS[_pattern];
      if (_phaseIdx % pat.phases.length === 0) {
        _cycles++;
        document.getElementById('bcoCycles').textContent = `Cycles: ${_cycles}`;
      }
      _runPhase();
    }
  }

  function _stop() { _running=false; clearTimeout(_timer); _reset(); }
  function _reset() {
    document.getElementById('bcoCount').textContent='–';
    document.getElementById('bcoPhase').textContent='Ready';
    document.getElementById('bcoOrb').className='bco-orb';
  }

  function show() { _build(); document.getElementById('breathOverlay')?.classList.add('bco-open'); }
  function hide() { _stop(); document.getElementById('breathOverlay')?.classList.remove('bco-open'); }

  return { show, hide };
})();


/* ════════════════════════════════════════
   4. DAILY ORACLE — Animated Wisdom Card
════════════════════════════════════════ */
const DailyOracle = (() => {
  const WISDOMS = [
    { text: "You are not your thoughts. You are the awareness behind them.", author: "Ancient Wisdom" },
    { text: "The present moment is the only place where life exists.", author: "Eckhart Tolle" },
    { text: "Every sunset is an opportunity to reset.", author: "Richie Norton" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "What you seek is seeking you.", author: "Rumi" },
    { text: "Your calm mind is the ultimate weapon against your challenges.", author: "Bryant McGill" },
    { text: "Stars can't shine without darkness.", author: "D.H. Sidebottom" },
    { text: "The wound is the place where the light enters you.", author: "Rumi" },
    { text: "You don't have to see the whole staircase. Just take the first step.", author: "MLK Jr." },
    { text: "Breathe. It's just a bad day, not a bad life.", author: "Unknown" },
    { text: "Everything you need is already inside you.", author: "Bill Bowerman" },
    { text: "Be gentle with yourself. You are a child of the universe.", author: "Max Ehrmann" },
  ];

  let _overlay, _idx = 0;

  function _build() {
    if (document.getElementById('oracleOverlay')) return;
    _idx = Math.floor(Math.random() * WISDOMS.length);
    _overlay = document.createElement('div');
    _overlay.id = 'oracleOverlay';
    _overlay.innerHTML = `
      <div class="orc-card">
        <div class="orc-close" id="orcClose">✕</div>
        <div class="orc-glyph">🔮</div>
        <div class="orc-label">Daily Oracle</div>
        <div class="orc-text" id="orcText"></div>
        <div class="orc-author" id="orcAuthor"></div>
        <div class="orc-btns">
          <button class="orc-btn" id="orcNext">Next Wisdom →</button>
          <button class="orc-btn orc-share" id="orcShare">Share ✦</button>
        </div>
        <div class="orc-stars" id="orcStars"></div>
      </div>
    `;
    document.body.appendChild(_overlay);
    _injectStyles();
    _buildStars();
    document.getElementById('orcClose')?.addEventListener('click', hide);
    document.getElementById('orcNext')?.addEventListener('click', () => { _idx = (_idx+1) % WISDOMS.length; _render(); });
    document.getElementById('orcShare')?.addEventListener('click', _share);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) hide(); });
    _render();
  }

  function _buildStars() {
    const el = document.getElementById('orcStars');
    if (!el) return;
    el.innerHTML = Array.from({length:30},()=>{
      const x=Math.random()*100, y=Math.random()*100, s=.4+Math.random()*1.2, d=Math.random()*4;
      return `<div style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;border-radius:50%;background:white;opacity:.3;animation:orcStar 3s ease-in-out ${d}s infinite alternate"></div>`;
    }).join('');
  }

  function _render() {
    const w = WISDOMS[_idx];
    const txt  = document.getElementById('orcText');
    const auth = document.getElementById('orcAuthor');
    if (txt) {
      txt.style.opacity = '0';
      setTimeout(() => { txt.textContent = w.text; txt.style.opacity = '1'; }, 200);
    }
    if (auth) auth.textContent = '— ' + w.author;
  }

  function _share() {
    const w = WISDOMS[_idx];
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`"${w.text}" — ${w.author} (MySoul AI)`).then(()=>{
        const btn = document.getElementById('orcShare');
        if (btn) { btn.textContent='Copied! ✓'; setTimeout(()=>btn.textContent='Share ✦',1800); }
      });
    }
  }

  function _injectStyles() {
    if (document.getElementById('orcStyles')) return;
    const s = document.createElement('style');
    s.id='orcStyles';
    s.textContent=`
#oracleOverlay{position:fixed;inset:0;z-index:95000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .4s ease}
#oracleOverlay.orc-open{opacity:1;pointer-events:all}
.orc-card{background:radial-gradient(ellipse at 50% 20%,rgba(10,18,50,.98) 0%,rgba(4,6,16,1) 100%);border:1px solid rgba(168,85,247,.3);border-radius:24px;padding:32px 28px;width:min(380px,92vw);text-align:center;position:relative;overflow:hidden;box-shadow:0 20px 80px rgba(0,0,0,.8),0 0 60px rgba(168,85,247,.1)}
.orc-close{position:absolute;top:14px;right:16px;cursor:pointer;color:rgba(190,215,255,.3);font-size:14px;padding:4px 8px;border-radius:6px;z-index:1}
.orc-close:hover{color:rgba(168,85,247,.8)}
.orc-glyph{font-size:40px;margin-bottom:8px;display:block;animation:os-float 4s ease-in-out infinite}
.orc-label{font-family:'Syne',sans-serif;font-size:10px;letter-spacing:.2em;color:rgba(168,85,247,.7);text-transform:uppercase;margin-bottom:24px}
.orc-text{font-family:'DM Sans',sans-serif;font-size:19px;color:#e2eeff;line-height:1.7;margin-bottom:14px;font-style:italic;transition:opacity .3s ease;position:relative;z-index:1}
.orc-author{font-size:12px;color:rgba(168,85,247,.7);margin-bottom:24px;letter-spacing:.06em}
.orc-btns{display:flex;gap:10px;justify-content:center;position:relative;z-index:1}
.orc-btn{padding:9px 20px;border-radius:20px;background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.35);color:rgba(168,85,247,.9);font-family:'Syne',sans-serif;font-size:12px;cursor:pointer;transition:all .25s ease}
.orc-btn:hover{background:rgba(168,85,247,.22);box-shadow:0 0 16px rgba(168,85,247,.3)}
.orc-share{background:rgba(255,224,64,.08);border-color:rgba(255,224,64,.3);color:rgba(255,224,64,.85)}
.orc-stars{position:absolute;inset:0;pointer-events:none;overflow:hidden}
@keyframes orcStar{from{opacity:.1}to{opacity:.5}}
    `;
    document.head.appendChild(s);
  }

  function show() { _build(); document.getElementById('oracleOverlay')?.classList.add('orc-open'); }
  function hide() { document.getElementById('oracleOverlay')?.classList.remove('orc-open'); }

  return { show, hide };
})();


/* ════════════════════════════════════════
   5. SMART INSIGHT — AI Journal Prompt Engine
════════════════════════════════════════ */
const SmartInsight = (() => {
  const PROMPTS = {
    default: [
      "What's one thing that made you smile today, even briefly?",
      "What emotion are you carrying right now, and where do you feel it in your body?",
      "What would you tell your past self from a year ago?",
      "What's one thing you can let go of today?",
      "What does 'enough' mean to you right now?",
      "What are you most grateful for in this moment?",
      "What's one small act of kindness you could do today?",
    ],
    sad:   ["What's the softest, kindest thing you could say to yourself right now?","What or who has supported you in tough times before?"],
    angry: ["What boundary was crossed that you need to honor?","What would it feel like to release this anger safely?"],
    stressed: ["What's the one thing that would make today feel more manageable?","What can you let go of that's not your responsibility?"],
    happy: ["How can you carry this joy into tomorrow?","Who could you share this happiness with?"],
    calm:  ["What conditions created this peace? How can you return here?","What intention would you like to set from this stillness?"],
  };

  let _overlay;

  function _build() {
    if (document.getElementById('insightOverlay')) return;
    _overlay = document.createElement('div');
    _overlay.id = 'insightOverlay';
    _overlay.innerHTML = `
      <div class="ins-card">
        <div class="ins-close" id="insClose">✕</div>
        <div class="ins-icon">💡</div>
        <div class="ins-label">Soul Prompt</div>
        <div class="ins-prompt" id="insPrompt">Loading…</div>
        <textarea class="ins-textarea" id="insText" placeholder="Write freely… this space is only yours"></textarea>
        <div class="ins-actions">
          <button class="ins-btn-ghost" id="insSkip">New Prompt</button>
          <button class="ins-btn-solid" id="insSave">Save ✦</button>
        </div>
        <div class="ins-saved hidden" id="insSaved">✓ Saved to your memory</div>
      </div>
    `;
    document.body.appendChild(_overlay);
    _injectStyles();
    document.getElementById('insClose')?.addEventListener('click', hide);
    document.getElementById('insSkip')?.addEventListener('click', _randomPrompt);
    document.getElementById('insSave')?.addEventListener('click', _save);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) hide(); });
    _randomPrompt();
  }

  function _randomPrompt() {
    const hist  = JSON.parse(localStorage.getItem('ms_hist') || '[]');
    const emo   = hist[0]?.emotion || 'default';
    const pool  = [...(PROMPTS[emo] || []), ...PROMPTS.default];
    const p     = pool[Math.floor(Math.random() * pool.length)];
    const el    = document.getElementById('insPrompt');
    if (el) { el.style.opacity='0'; setTimeout(() => { el.textContent=p; el.style.opacity='1'; }, 200); }
    const ta = document.getElementById('insText');
    if (ta) ta.value = '';
  }

  function _save() {
    const text    = document.getElementById('insText')?.value.trim();
    const prompt  = document.getElementById('insPrompt')?.textContent;
    if (!text) return;
    const entries = JSON.parse(localStorage.getItem('ms_journal') || '[]');
    entries.unshift({ id: Date.now(), prompt, text, ts: new Date().toISOString() });
    localStorage.setItem('ms_journal', JSON.stringify(entries.slice(0, 100)));
    const saved = document.getElementById('insSaved');
    if (saved) { saved.classList.remove('hidden'); setTimeout(() => saved.classList.add('hidden'), 2200); }
  }

  function _injectStyles() {
    if (document.getElementById('insStyles')) return;
    const s = document.createElement('style');
    s.id='insStyles';
    s.textContent=`
#insightOverlay{position:fixed;inset:0;z-index:95000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity .4s ease}
#insightOverlay.ins-open{opacity:1;pointer-events:all}
.ins-card{background:rgba(5,8,20,.95);border:1px solid rgba(255,224,64,.2);border-radius:22px;padding:28px 24px;width:min(360px,92vw);position:relative;box-shadow:0 20px 60px rgba(0,0,0,.8)}
.ins-close{position:absolute;top:14px;right:14px;cursor:pointer;color:rgba(190,215,255,.3);font-size:14px;padding:4px 8px;border-radius:6px}
.ins-close:hover{color:rgba(255,224,64,.7)}
.ins-icon{font-size:32px;text-align:center;margin-bottom:8px}
.ins-label{font-family:'Syne',sans-serif;font-size:10px;letter-spacing:.2em;color:rgba(255,224,64,.6);text-align:center;text-transform:uppercase;margin-bottom:18px}
.ins-prompt{font-size:16px;color:#e2eeff;line-height:1.7;text-align:center;margin-bottom:18px;font-style:italic;min-height:48px;transition:opacity .3s ease}
.ins-textarea{width:100%;min-height:100px;padding:12px 14px;background:rgba(255,224,64,.04);border:1px solid rgba(255,224,64,.15);border-radius:14px;color:rgba(190,215,255,.85);font-size:14px;line-height:1.6;resize:none;outline:none;margin-bottom:14px;transition:border-color .25s ease}
.ins-textarea:focus{border-color:rgba(255,224,64,.4)}
.ins-textarea::placeholder{color:rgba(130,170,220,.35)}
.ins-actions{display:flex;gap:10px;justify-content:center}
.ins-btn-ghost{padding:9px 20px;border-radius:20px;background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(190,215,255,.5);font-family:'Syne',sans-serif;font-size:12px;cursor:pointer;transition:all .25s ease}
.ins-btn-ghost:hover{border-color:rgba(255,224,64,.3);color:rgba(255,224,64,.7)}
.ins-btn-solid{padding:9px 20px;border-radius:20px;background:rgba(255,224,64,.12);border:1px solid rgba(255,224,64,.4);color:rgba(255,224,64,.9);font-family:'Syne',sans-serif;font-size:12px;cursor:pointer;transition:all .25s ease}
.ins-btn-solid:hover{background:rgba(255,224,64,.22);box-shadow:0 0 16px rgba(255,224,64,.25)}
.ins-saved{text-align:center;font-size:12px;color:rgba(56,240,152,.8);margin-top:10px}
.ins-saved.hidden{display:none}
    `;
    document.head.appendChild(s);
  }

  function show() { _build(); document.getElementById('insightOverlay')?.classList.add('ins-open'); }
  function hide() { document.getElementById('insightOverlay')?.classList.remove('ins-open'); }

  return { show, hide };
})();


/* ════════════════════════════════════════
   INIT ALL FEATURES
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  MoodRing.init();
  SoulBubble.init();
  // BreathCoach, DailyOracle, SmartInsight are lazy-loaded on demand

  // Patch existing emotion updates to feed features
  const _patchInterval = setInterval(() => {
    if (window.UILayer?.setEmotion) {
      clearInterval(_patchInterval);
      const orig = window.UILayer.setEmotion.bind(window.UILayer);
      window.UILayer.setEmotion = function(emotion, ...args) {
        orig(emotion, ...args);
        MoodRing.setEmotion(emotion);
        SoulBubble.updateEmotion(emotion);
      };
    }
  }, 500);
});

// Expose globally
window.MoodRing    = MoodRing;
window.SoulBubble  = SoulBubble;
window.BreathCoach = BreathCoach;
window.DailyOracle = DailyOracle;
window.SmartInsight= SmartInsight;
