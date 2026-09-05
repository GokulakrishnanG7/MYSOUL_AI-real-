/* ═══════════════════════════════════════════════════════════
   MySoul AI OS — Auto Voice Trigger v2 (FIXED + ENHANCED)
   modules/auto-voice-trigger.js
   
   FIXES:
   ✓ Robust wake word with auto-restart on every error/end
   ✓ onerror handler prevents silent crashes
   ✓ Chrome 5s limit handled with immediate restart
   ✓ Mic permission requested upfront with clear feedback
   ✓ Persistent listening indicator (pulsing dot)
   ✓ Works on all pages without page reload
   
   NEW FEATURES added in this file:
   ✓ Persistent wake indicator pill (bottom-right)
   ✓ Voice navigation commands ("open chat", "go home"…)
   ✓ Wake badge flash at top of screen
═══════════════════════════════════════════════════════════ */
'use strict';

const VoiceSystem = (() => {

  /* ── Dynamic wake words: always include the user's custom AI name ── */
  function _buildWakeWords() {
    const setup  = JSON.parse(localStorage.getItem('ms_setup') || '{}');
    const aiName = (setup.ai_name || 'MySoul').toLowerCase().trim();
    const base   = ['hey soul','hello soul','hey ai','hello ai','mysoul','my soul','ok soul','wake up soul'];
    if (aiName && aiName !== 'mysoul') {
      base.push('hey ' + aiName, 'hello ' + aiName, 'ok ' + aiName, 'wake up ' + aiName, aiName);
    }
    return base;
  }
  let WAKE_WORDS = _buildWakeWords();
  window.addEventListener('ms_setup_changed', () => { WAKE_WORDS = _buildWakeWords(); });
  const VOICE_CMDS = {
    'open chat':      () => _nav('../index.html'),
    'go home':        () => _nav('launcher.html'),
    'open emotion':   () => _nav('emotion.html'),
    'open memory':    () => _nav('memory.html'),
    'open tasks':     () => _nav('tasks.html'),
    'open quiz':      () => _nav('quiz.html'),
    'open story':     () => _nav('story.html'),
    'open dashboard': () => _nav('dashboard.html'),
    'go back':        () => history.back(),
    'close':          () => hide(),
  };

  function _nav(href) {
    // Handle relative paths from /pages/ directory
    const inPages = location.pathname.includes('/pages/');
    if (inPages && href.startsWith('../')) location.href = href;
    else if (!inPages && !href.startsWith('../')) location.href = 'pages/' + href;
    else location.href = href;
  }

  let _popupVisible = false;
  let _wakeActive   = false;
  let _listenState  = 'idle';
  let _wakeRec      = null;
  let _activeRec    = null;
  let _onTranscript = null;
  let _analyser     = null, _audioCtx = null, _dataArr = null, _stream = null;
  let _animFrame    = null;
  let _wakeTimer    = null;
  let _canvasEl, _waveCtx;
  let _permGranted  = false;
  let _SR           = null;

  /* ════════ BUILD POPUP ════════ */
  function _buildPopup() {
    if (document.getElementById('osVoiceOverlay')) return;
    const el = document.createElement('div');
    el.id = 'osVoiceOverlay';
    el.innerHTML = `
      <div class="osv-backdrop" id="osvBackdrop"></div>
      <div class="osv-card" id="osvCard">
        <div class="osv-drag" id="osvDrag"><div class="osv-handle"></div></div>
        <div class="osv-orb-wrap">
          <div class="osv-aura osv-a1"></div>
          <div class="osv-aura osv-a2"></div>
          <div class="osv-aura osv-a3"></div>
          <canvas class="osv-canvas" id="osvCanvas" width="200" height="200"></canvas>
          <div class="osv-core" id="osvCore">
            <div class="osv-core-glow"></div>
            <svg class="osv-mic-icon" viewBox="0 0 60 60" fill="none">
              <ellipse cx="30" cy="21" rx="9" ry="12" stroke="currentColor" stroke-width="2.5" fill="rgba(0,200,255,0.1)"/>
              <path d="M13 31 C13 44 47 44 47 31" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              <line x1="30" y1="44" x2="30" y2="51" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="21" y1="51" x2="39" y2="51" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div class="osv-dots" id="osvDots"><span></span><span></span><span></span></div>
        <div class="osv-eq" id="osvEq">${Array.from({length:22},(_,i)=>`<div class="osv-eq-bar" style="--i:${i}"></div>`).join('')}</div>
        <div class="osv-label" id="osvLabel">Say <em>"Hey Soul"</em> or tap</div>
        <div class="osv-transcript" id="osvTranscript"></div>
        <div class="osv-perm-warn hidden" id="osvPermWarn">🎤 Microphone permission needed — allow in browser settings</div>
        <div class="osv-actions">
          <button class="osv-btn-icon" id="osvMinimize" title="Minimize">
            <svg viewBox="0 0 24 24" fill="none"><path d="M20 12H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="osv-btn-main" id="osvMainBtn">◎</button>
          <button class="osv-btn-icon" id="osvClose" title="Close">
            <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="osv-hint">Voice commands: "open chat" · "go home" · "open quiz"</div>
      </div>`;
    document.body.appendChild(el);
    _canvasEl = document.getElementById('osvCanvas');
    _waveCtx  = _canvasEl?.getContext('2d');
    _injectStyles();
    _bindEvents();
  }

  /* ════════ STYLES ════════ */
  function _injectStyles() {
    if (document.getElementById('osvStyles')) return;
    const s = document.createElement('style');
    s.id = 'osvStyles';
    s.textContent = `
#osVoiceOverlay{position:fixed;inset:0;z-index:99900;display:flex;align-items:flex-end;justify-content:center;padding-bottom:44px;pointer-events:none;opacity:0;transition:opacity .35s ease}
#osVoiceOverlay.osv-open{pointer-events:all;opacity:1}
.osv-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .4s ease;cursor:pointer}
#osVoiceOverlay.osv-open .osv-backdrop{opacity:1}
.osv-card{position:relative;width:min(340px,94vw);border-radius:28px;background:rgba(5,8,20,.95);border:1px solid rgba(0,200,255,.3);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);padding:10px 20px 22px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 24px 80px rgba(0,0,0,.85),0 0 50px rgba(0,200,255,.14);transform:translateY(60px) scale(.9);transition:transform .55s cubic-bezier(.34,1.56,.64,1);overflow:hidden}
#osVoiceOverlay.osv-open .osv-card{transform:translateY(0) scale(1)}
.osv-drag{width:100%;display:flex;justify-content:center;padding:6px 0 2px;cursor:grab}
.osv-handle{width:36px;height:4px;background:rgba(0,200,255,.22);border-radius:2px}
.osv-drag:active{cursor:grabbing}
.osv-orb-wrap{position:relative;width:170px;height:170px;flex-shrink:0}
.osv-aura{position:absolute;border-radius:50%;pointer-events:none}
.osv-a1{inset:-14px;background:radial-gradient(circle,rgba(0,200,255,.2) 0%,transparent 70%);animation:osvA 3s ease-in-out infinite}
.osv-a2{inset:-30px;background:radial-gradient(circle,rgba(0,200,255,.08) 0%,transparent 65%);animation:osvA 4.5s ease-in-out infinite .7s}
.osv-a3{inset:-48px;background:radial-gradient(circle,rgba(0,200,255,.04) 0%,transparent 60%);animation:osvA 6s ease-in-out infinite 1.4s}
@keyframes osvA{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
.osv-canvas{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:1}
.osv-core{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:96px;height:96px;border-radius:50%;background:rgba(0,200,255,.08);border:1.5px solid rgba(0,200,255,.5);display:flex;align-items:center;justify-content:center;z-index:2;animation:osvBreath 3.5s ease-in-out infinite;transition:all .6s ease;cursor:pointer}
.osv-core:hover{transform:translate(-50%,-50%) scale(1.06);box-shadow:0 0 40px rgba(0,200,255,.5)}
.osv-core-glow{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(0,200,255,.15) 0%,transparent 70%)}
.osv-mic-icon{width:38px;height:38px;color:rgba(0,200,255,.9);position:relative;z-index:1}
@keyframes osvBreath{0%,100%{box-shadow:0 0 22px rgba(0,200,255,.3)}50%{box-shadow:0 0 48px rgba(0,200,255,.7)}}
.osv-state-listening .osv-core{border-color:rgba(0,200,255,.95)!important;animation:osvListen .5s ease-in-out infinite alternate!important;box-shadow:0 0 50px rgba(0,200,255,.7)!important}
@keyframes osvListen{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.15)}}
.osv-state-thinking .osv-core{border-color:rgba(168,85,247,.9)!important;animation:osvThink 1.2s ease-in-out infinite!important}
@keyframes osvThink{0%,100%{box-shadow:0 0 20px rgba(168,85,247,.4)}50%{box-shadow:0 0 65px rgba(168,85,247,.95)}}
.osv-state-thinking .osv-a1{background:radial-gradient(circle,rgba(168,85,247,.2) 0%,transparent 70%)!important}
.osv-state-speaking .osv-core{border-color:rgba(255,224,64,.8)!important;animation:osvSpeak .35s ease-in-out infinite alternate!important}
@keyframes osvSpeak{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-50%) scale(1.11)}}
.osv-state-speaking .osv-a1{background:radial-gradient(circle,rgba(255,224,64,.18) 0%,transparent 70%)!important}
.osv-dots{display:none;gap:7px;align-items:center;justify-content:center}
.osv-dots span{width:7px;height:7px;border-radius:50%;background:rgba(168,85,247,.85);animation:osvDot 1s ease-in-out infinite}
.osv-dots span:nth-child(2){animation-delay:.2s}.osv-dots span:nth-child(3){animation-delay:.4s}
@keyframes osvDot{0%,100%{transform:scale(.55);opacity:.35}50%{transform:scale(1.25);opacity:1}}
.osv-state-thinking .osv-dots{display:flex}
.osv-eq{display:none;align-items:flex-end;justify-content:center;gap:3px;height:34px;width:100%}
.osv-eq-bar{width:3px;background:rgba(0,200,255,.8);border-radius:2px;animation:osvEq .45s ease-in-out infinite alternate;animation-delay:calc(var(--i)*.045s)}
@keyframes osvEq{from{height:4px;opacity:.35}to{height:28px;opacity:1}}
.osv-state-speaking .osv-eq{display:flex}
.osv-label{font-family:'Syne',sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(190,215,255,.5);text-align:center;min-height:18px}
.osv-label em{font-style:normal;color:rgba(0,200,255,.9)}
.osv-transcript{font-size:14px;color:#e2eeff;text-align:center;max-width:290px;min-height:20px;line-height:1.5;opacity:0;transition:opacity .3s ease}
.osv-transcript.osv-show{opacity:1}
.osv-perm-warn{font-size:11px;color:#ff9f38;text-align:center;padding:6px 14px;border-radius:10px;background:rgba(255,159,56,.1);border:1px solid rgba(255,159,56,.25)}
.osv-perm-warn.hidden{display:none!important}
.osv-actions{display:flex;gap:14px;align-items:center;margin-top:4px}
.osv-btn-icon{width:42px;height:42px;border-radius:50%;background:rgba(0,200,255,.07);border:1px solid rgba(0,200,255,.22);color:rgba(0,200,255,.8);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .25s ease}
.osv-btn-icon:hover{background:rgba(0,200,255,.18);transform:scale(1.1)}
.osv-btn-icon svg{width:16px;height:16px}
.osv-btn-main{width:62px;height:62px;border-radius:50%;background:rgba(0,200,255,.14);border:1.5px solid rgba(0,200,255,.55);color:rgba(0,200,255,.92);font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s ease;box-shadow:0 0 22px rgba(0,200,255,.3)}
.osv-btn-main:hover{background:rgba(0,200,255,.28);box-shadow:0 0 40px rgba(0,200,255,.65);transform:scale(1.08)}
.osv-hint{font-size:10px;color:rgba(130,170,220,.32);text-align:center;letter-spacing:.04em;margin-top:2px}

/* ── Wake Indicator Pill ── */
#osvWakeIndicator{position:fixed;bottom:92px;right:14px;z-index:89000;display:flex;align-items:center;gap:7px;padding:6px 12px 6px 8px;border-radius:20px;background:rgba(5,8,20,.9);border:1px solid rgba(0,200,255,.18);backdrop-filter:blur(12px);font-family:'Syne',sans-serif;font-size:10px;letter-spacing:.1em;color:rgba(0,200,255,.65);cursor:pointer;transition:all .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.4);user-select:none}
#osvWakeIndicator:hover{border-color:rgba(0,200,255,.5);color:rgba(0,200,255,.95);transform:scale(1.04)}
#osvWakeDot{width:8px;height:8px;border-radius:50%;background:#ff4060;transition:background .4s ease,box-shadow .4s ease;flex-shrink:0}
#osvWakeDot.active{background:#38f098;box-shadow:0 0 6px #38f098;animation:wakePulse 1.8s ease-in-out infinite}
#osvWakeDot.listening{background:#00c8ff;box-shadow:0 0 8px #00c8ff;animation:wakeListenAnim .6s ease-in-out infinite alternate}
@keyframes wakePulse{0%,100%{box-shadow:0 0 4px #38f098}50%{box-shadow:0 0 14px #38f098,0 0 24px rgba(56,240,152,.35)}}
@keyframes wakeListenAnim{from{transform:scale(.75);opacity:.6}to{transform:scale(1.35);opacity:1}}

/* ── Wake Badge ── */
#osvWakeBadge{position:fixed;top:14px;left:50%;transform:translateX(-50%) translateY(-36px);z-index:99800;padding:9px 22px;border-radius:24px;background:rgba(0,200,255,.14);border:1px solid rgba(0,200,255,.4);color:rgba(0,200,255,.95);font-family:'Syne',sans-serif;font-size:12px;letter-spacing:.14em;backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:all .45s cubic-bezier(.34,1.56,.64,1);white-space:nowrap}
#osvWakeBadge.show{opacity:1;transform:translateX(-50%) translateY(0)}
    `;
    document.head.appendChild(s);
  }

  /* ════════ INDICATOR PILL ════════ */
  function _buildIndicator() {
    if (document.getElementById('osvWakeIndicator')) return;
    const ind = document.createElement('div');
    ind.id = 'osvWakeIndicator';
    ind.innerHTML = `<div id="osvWakeDot"></div><span id="osvWakeText">Tap to enable wake word</span>`;
    ind.title = 'Click to enable "Hey Soul" wake word';
    ind.addEventListener('click', () => {
      if (!_wakeActive) _initWakeWord();
      else { show(); setTimeout(_startActive, 400); }
    });
    document.body.appendChild(ind);
  }

  function _setIndicator(state) {
    const dot  = document.getElementById('osvWakeDot');
    const text = document.getElementById('osvWakeText');
    if (!dot || !text) return;
    dot.className = '';
    if      (state === 'ready')    { dot.classList.add('active');    text.textContent = 'Say "Hey Soul"'; }
    else if (state === 'heard')    { dot.classList.add('listening'); text.textContent = 'Wake word heard!'; }
    else if (state === 'nomic')    { text.textContent = 'Mic denied — tap to retry'; }
    else                           { text.textContent = 'Tap to enable wake word'; }
  }

  /* ════════ PERMISSION + WAKE INIT ════════ */
  async function _initWakeWord() {
    _setIndicator('ready'); // optimistic
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      _permGranted = true;
      _hideBanner(); // mic granted — hide the activation banner permanently
      document.getElementById('osvPermWarn')?.classList.add('hidden');
    } catch (e) {
      _permGranted = false;
      _setIndicator('nomic');
      _buildPopup();
      document.getElementById('osvPermWarn')?.classList.remove('hidden');
      // Update banner to show error
      const btn = document.getElementById('osvActivateBtn');
      if (btn) btn.textContent = 'Retry';
      const small = document.querySelector('#osvActivateBanner .osv-ban-text small');
      if (small) small.textContent = '⚠ Mic blocked — allow in browser then tap Retry';
      document.getElementById('osvActivateBanner')?.classList.remove('hidden');
      show(); // Show popup so user sees the warning
      return;
    }

    _SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!_SR) {
      _setIndicator('off');
      return;
    }

    _wakeActive = true;
    _setIndicator('ready');
    _startWakeLoop();
  }

  /* ════════ WAKE LOOP (ROBUST) ════════ */
  function _startWakeLoop() {
    if (!_wakeActive || _popupVisible) return;
    clearTimeout(_wakeTimer);

    try { _wakeRec?.abort(); } catch(e) {}
    _wakeRec = null;

    try {
      _wakeRec = new _SR();
      _wakeRec.continuous     = false;  // false is MORE reliable (Chrome stops at 5s when continuous)
      _wakeRec.interimResults = true;
      _wakeRec.lang           = 'en-US';

      _wakeRec.onresult = (e) => {
        let transcript = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += (e.results[i][0].transcript || '').toLowerCase().trim();
        }

        // Wake word check
        if (WAKE_WORDS.some(w => transcript.includes(w))) {
          try { _wakeRec.abort(); } catch(e) {}
          _setIndicator('heard');
          _showBadge('◎  "Hey Soul" — I\'m here!');
          _wakeActive = false;
          setTimeout(() => { show(); setTimeout(_startActive, 500); }, 300);
          return;
        }

        // Voice command check (only when popup not open)
        if (!_popupVisible && transcript.length > 2) {
          const cmd = Object.keys(VOICE_CMDS).find(k => transcript.includes(k));
          if (cmd) {
            _showBadge('▶ ' + cmd);
            setTimeout(() => VOICE_CMDS[cmd]?.(), 700);
          }
        }
      };

      // CRITICAL FIX: restart immediately on end
      _wakeRec.onend = () => {
        if (!_wakeActive || _popupVisible) return;
        _wakeTimer = setTimeout(_startWakeLoop, 150); // tiny gap prevents race condition
      };

      _wakeRec.onerror = (e) => {
        if (e.error === 'not-allowed') {
          _wakeActive = false;
          _permGranted = false;
          _setIndicator('nomic');
          return;
        }
        if (e.error === 'aborted') return; // intentional abort, ignore
        // All other errors (no-speech, audio-capture, network): just restart
        if (_wakeActive && !_popupVisible) {
          _wakeTimer = setTimeout(_startWakeLoop, 500);
        }
      };

      _wakeRec.start();

    } catch (err) {
      // Start failed — retry
      if (_wakeActive) _wakeTimer = setTimeout(_startWakeLoop, 1000);
    }
  }

  /* ════════ ACTIVE LISTENING ════════ */
  async function _startActive() {
    _setState('listening');

    try {
      _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = _audioCtx.createMediaStreamSource(_stream);
      _analyser = _audioCtx.createAnalyser();
      _analyser.fftSize = 256;
      src.connect(_analyser);
      _dataArr = new Uint8Array(_analyser.frequencyBinCount);
    } catch(e) {}

    _drawWave();

    if (!_SR) { _simulateDemo(); return; }
    try { _activeRec?.abort(); } catch(e) {}

    _activeRec = new _SR();
    _activeRec.continuous     = false;
    _activeRec.interimResults = true;
    _activeRec.lang           = 'en-US';

    let _silTimer = null;

    _activeRec.onresult = (e) => {
      let fin = '', tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else tmp += t;
      }
      _showTranscript(fin || tmp);
      clearTimeout(_silTimer);
      if (fin) {
        _stopActive();
        _handleTranscript(fin.trim());
      } else {
        _silTimer = setTimeout(() => { if (_listenState === 'listening') _stopActive(); }, 3500);
      }
    };

    _activeRec.onerror = (e) => { if (e.error !== 'aborted') _stopActive(); };
    _activeRec.onend   = () => {
      if (_listenState === 'listening') {
        _setState('idle');
        // If popup was closed externally while we were listening, re-arm wake
        if (!_popupVisible && _permGranted && _SR && !_wakeActive) {
          _wakeActive = true;
          _setIndicator('ready');
          _wakeTimer = setTimeout(_startWakeLoop, 500);
        }
      }
    };

    try { _activeRec.start(); } catch(e) { _simulateDemo(); }
  }

  function _stopActive() {
    _stream?.getTracks().forEach(t => t.stop());
    _audioCtx?.close().catch(() => {});
    _analyser = null; _audioCtx = null; _dataArr = null; _stream = null;
    try { _activeRec?.abort(); } catch(e) {}
  }

  function _handleTranscript(text) {
    _setState('thinking');

    if (_onTranscript) {
      _onTranscript(text);
      // Re-arm wake word after custom handler finishes
      setTimeout(() => {
        if (!_popupVisible && _permGranted && _SR && !_wakeActive) {
          _wakeActive = true;
          _setIndicator('ready');
          _startWakeLoop();
        }
      }, 4000);
      return;
    }

    // Default: push to chat input if on chat page
    const chatInput = document.getElementById('chatInput');
    const sendBtn   = document.getElementById('sendBtn');
    if (chatInput && sendBtn) {
      chatInput.value = text;
      sendBtn.click();
      setTimeout(() => { _setState('idle'); hide(); }, 500);
    } else {
      // BUG FIX: was never calling hide() so wake word never re-armed after use
      setTimeout(() => { _setState('speaking'); }, 800);
      setTimeout(() => {
        _setState('idle');
        hide(); // re-arms the wake word loop
      }, 3000);
    }
  }

  function _simulateDemo() {
    _showTranscript('(Demo — microphone not available)');
    setTimeout(() => { _stopActive(); _handleTranscript('Tell me something inspiring.'); }, 2200);
  }

  /* ════════ WAVEFORM ════════ */
  function _drawWave() {
    cancelAnimationFrame(_animFrame);
    if (!_popupVisible || !_canvasEl) return;
    const W = 200, H = 200, cx = 100, cy = 100;
    _waveCtx.clearRect(0, 0, W, H);

    if (_listenState === 'listening' && _analyser && _dataArr) {
      _analyser.getByteFrequencyData(_dataArr);
      for (let i = 0; i < 64; i++) {
        const v = _dataArr[Math.floor(i * _dataArr.length / 64)] / 255;
        const a = (i / 64) * Math.PI * 2;
        const r = 70 + v * 52;
        _waveCtx.beginPath();
        _waveCtx.moveTo(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66);
        _waveCtx.lineTo(cx + Math.cos(a) * r,  cy + Math.sin(a) * r);
        _waveCtx.strokeStyle = `rgba(0,200,255,${.28 + v * .72})`;
        _waveCtx.lineWidth = 2.5; _waveCtx.stroke();
      }
    } else {
      const t   = Date.now() / 1000;
      const r   = 70 + Math.sin(t * 1.2) * 6;
      const g   = _waveCtx.createRadialGradient(cx, cy, r-8, cx, cy, r+22);
      g.addColorStop(0, 'rgba(0,200,255,.22)'); g.addColorStop(1, 'rgba(0,200,255,0)');
      _waveCtx.beginPath(); _waveCtx.arc(cx, cy, r+14, 0, Math.PI*2);
      _waveCtx.fillStyle = g; _waveCtx.fill();
    }
    _animFrame = requestAnimationFrame(_drawWave);
  }

  /* ════════ STATE ════════ */
  function _setState(s) {
    _listenState = s;
    const card  = document.getElementById('osvCard');
    const label = document.getElementById('osvLabel');
    const btn   = document.getElementById('osvMainBtn');
    if (!card) return;
    ['idle','listening','thinking','speaking'].forEach(c => card.classList.remove('osv-state-'+c));
    card.classList.add('osv-state-'+s);
    const LABELS = {
      idle:      'Say <em>"Hey Soul"</em> or tap',
      listening: 'Listening…',
      thinking:  'Thinking…',
      speaking:  'Speaking…',
    };
    if (label) label.innerHTML = LABELS[s] || s;
    if (btn)   btn.textContent = (s === 'listening') ? '■' : '◎';
  }

  function _showTranscript(t) {
    const el = document.getElementById('osvTranscript');
    if (el) { el.textContent = t; el.classList.add('osv-show'); }
  }

  function _showBadge(msg) {
    let b = document.getElementById('osvWakeBadge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'osvWakeBadge';
      document.body.appendChild(b);
    }
    b.textContent = msg;
    b.classList.add('show');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('show'), 2800);
  }

  /* ════════ DRAG ════════ */
  function _bindEvents() {
    document.getElementById('osvBackdrop')?.addEventListener('click', hide);
    document.getElementById('osvMinimize')?.addEventListener('click', hide);
    document.getElementById('osvClose')?.addEventListener('click',   hide);
    document.getElementById('osvCore')?.addEventListener('click', () => {
      _listenState === 'listening' ? _stopActive() : _startActive();
    });
    document.getElementById('osvMainBtn')?.addEventListener('click', () => {
      _listenState === 'listening' ? _stopActive() : _startActive();
    });

    const card = document.getElementById('osvCard');
    const drag = document.getElementById('osvDrag');
    let dx=0, dy=0, down=false;
    drag?.addEventListener('mousedown', e => {
      down=true; const r=card.getBoundingClientRect(); dx=e.clientX-r.left; dy=e.clientY-r.top; e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!down) return;
      card.style.cssText += `;left:${e.clientX-dx}px;top:${e.clientY-dy}px;bottom:auto;transform:none`;
    });
    document.addEventListener('mouseup', () => down=false);
    drag?.addEventListener('touchstart', e=>{down=true;const t=e.touches[0],r=card.getBoundingClientRect();dx=t.clientX-r.left;dy=t.clientY-r.top},{passive:true});
    document.addEventListener('touchmove', e=>{if(!down)return;const t=e.touches[0];card.style.left=(t.clientX-dx)+'px';card.style.top=(t.clientY-dy)+'px';card.style.bottom='auto';card.style.transform='none'},{passive:true});
    document.addEventListener('touchend', ()=>down=false);
  }

  /* ════════ PUBLIC ════════ */
  function show() {
    _buildPopup();
    _popupVisible = true;
    document.getElementById('osVoiceOverlay')?.classList.add('osv-open');
    const tx = document.getElementById('osvTranscript');
    if (tx) { tx.textContent=''; tx.classList.remove('osv-show'); }
    _setState('idle');
    _drawWave();
  }

  function hide() {
    _popupVisible = false;
    cancelAnimationFrame(_animFrame);
    _stopActive();
    document.getElementById('osVoiceOverlay')?.classList.remove('osv-open');
    _setState('idle');
    // Always re-arm wake word when popup closes (covers: user dismissed,
    // transcript handled, close button clicked, backdrop clicked)
    clearTimeout(_wakeTimer);
    if (_permGranted && _SR) {
      _wakeActive = true;
      _setIndicator('ready');
      _wakeTimer = setTimeout(_startWakeLoop, 700);
    }
  }

  function setState(s) { _setState(s); }
  function onTranscript(cb) { _onTranscript = cb; }

  function init() {
    _buildPopup();
    _buildIndicator();
    _buildActivationBanner();
    // NOTE: We do NOT auto-call _initWakeWord() here.
    // Browsers (Chrome, Edge, Safari) BLOCK getUserMedia unless triggered
    // by a real user gesture (click/tap). Calling it on page load causes
    // a silent permission failure and the wake word never starts.
    // The indicator pill + activation banner both call _initWakeWord on click.
  }

  /* ════════ ONE-TIME ACTIVATION BANNER ════════
     Shows a subtle tap-to-activate nudge until the user enables the wake word.
     Disappears permanently once mic is granted.                              */
  function _buildActivationBanner() {
    if (document.getElementById('osvActivateBanner')) return;
    const b = document.createElement('div');
    b.id = 'osvActivateBanner';
    b.innerHTML = `
      <div class="osv-ban-pulse"></div>
      <span class="osv-ban-icon">🎤</span>
      <div class="osv-ban-text">
        <strong>Enable \"Hey Soul\" wake word</strong>
        <small>Tap to activate · Works like Siri / Alexa</small>
      </div>
      <button class="osv-ban-btn" id="osvActivateBtn">Activate</button>
      <button class="osv-ban-x" id="osvBannerClose" title="Dismiss">✕</button>`;
    document.body.appendChild(b);

    // Inject banner styles
    if (!document.getElementById('osvBannerStyles')) {
      const s = document.createElement('style');
      s.id = 'osvBannerStyles';
      s.textContent = `
#osvActivateBanner{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:88000;display:flex;align-items:center;gap:10px;padding:12px 16px 12px 14px;border-radius:18px;background:rgba(5,8,20,.96);border:1px solid rgba(0,200,255,.45);backdrop-filter:blur(20px);box-shadow:0 8px 40px rgba(0,0,0,.7),0 0 30px rgba(0,200,255,.18);max-width:min(420px,92vw);animation:osvBanIn .6s cubic-bezier(.34,1.56,.64,1) forwards;font-family:'Syne',sans-serif}
@keyframes osvBanIn{from{opacity:0;transform:translateX(-50%) translateY(30px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
#osvActivateBanner.hidden{display:none!important}
.osv-ban-pulse{width:10px;height:10px;border-radius:50%;background:#00c8ff;flex-shrink:0;animation:osvBanPulse 1.4s ease-in-out infinite;box-shadow:0 0 8px #00c8ff}
@keyframes osvBanPulse{0%,100%{transform:scale(.8);opacity:.6}50%{transform:scale(1.4);opacity:1;box-shadow:0 0 18px #00c8ff}}
.osv-ban-icon{font-size:20px;flex-shrink:0}
.osv-ban-text{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.osv-ban-text strong{font-size:12px;color:rgba(220,235,255,.9);letter-spacing:.04em;white-space:nowrap}
.osv-ban-text small{font-size:10px;color:rgba(0,200,255,.6);white-space:nowrap}
.osv-ban-btn{flex-shrink:0;padding:7px 16px;border-radius:12px;background:rgba(0,200,255,.2);border:1px solid rgba(0,200,255,.55);color:rgba(0,200,255,.95);font-size:11px;font-family:'Syne',sans-serif;letter-spacing:.08em;cursor:pointer;transition:all .25s ease;white-space:nowrap}
.osv-ban-btn:hover{background:rgba(0,200,255,.38);box-shadow:0 0 18px rgba(0,200,255,.5)}
.osv-ban-x{flex-shrink:0;width:24px;height:24px;border-radius:50%;background:transparent;border:none;color:rgba(130,160,200,.4);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:color .2s ease}
.osv-ban-x:hover{color:rgba(130,160,200,.9)}
      `;
      document.head.appendChild(s);
    }

    document.getElementById('osvActivateBtn')?.addEventListener('click', () => {
      _hideBanner();
      _initWakeWord();
    });
    document.getElementById('osvBannerClose')?.addEventListener('click', _hideBanner);
  }

  function _hideBanner() {
    document.getElementById('osvActivateBanner')?.classList.add('hidden');
  }

  return { init, show, hide, setState, onTranscript };
})();

document.addEventListener('DOMContentLoaded', () => VoiceSystem.init());
window.VoiceSystem = VoiceSystem;
