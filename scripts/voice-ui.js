/* ═══════════════════════════════════════════════════════════
   MySoul AI v3+ — Gemini-Style Voice Pop-Up UI
   scripts/voice-ui.js  — ADDITIVE ONLY, no existing code modified
═══════════════════════════════════════════════════════════ */
'use strict';

const VoicePopup = (() => {

  /* ── State ── */
  let _state = 'idle'; // idle | listening | thinking | speaking
  let _animFrame = null;
  let _analyser = null;
  let _audioCtx = null;
  let _dataArr = null;
  let _stream = null;
  let _visible = false;
  let _dragging = false;
  let _dx = 0, _dy = 0;
  let _posX = null, _posY = null;

  /* ── DOM refs ── */
  let _overlay, _card, _canvas, _ctx2d, _stateLabel, _waveCtx;
  let _canvasEl;

  /* ─── Build HTML ─── */
  function _build() {
    if (document.getElementById('voicePopupOverlay')) return;

    const el = document.createElement('div');
    el.id = 'voicePopupOverlay';
    el.innerHTML = `
      <div class="vpu-card glass-deep" id="vpuCard">
        <div class="vpu-drag-handle" id="vpuDrag">
          <div class="vpu-drag-dots"></div>
        </div>

        <div class="vpu-orb-wrap" id="vpuOrbWrap">
          <div class="vpu-aura vpu-aura-1"></div>
          <div class="vpu-aura vpu-aura-2"></div>
          <div class="vpu-aura vpu-aura-3"></div>
          <canvas class="vpu-wave-canvas" id="vpuWaveCanvas" width="220" height="220"></canvas>
          <div class="vpu-orb-core" id="vpuCore">
            <div class="vpu-inner-glow"></div>
            <svg class="vpu-icon" viewBox="0 0 60 60" fill="none">
              <ellipse cx="30" cy="22" rx="9" ry="12" stroke="var(--ec)" stroke-width="2.5" fill="none"/>
              <path d="M14 32 C14 44 46 44 46 32" stroke="var(--ec)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
              <line x1="30" y1="44" x2="30" y2="50" stroke="var(--ec)" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="22" y1="50" x2="38" y2="50" stroke="var(--ec)" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <div class="vpu-eq" id="vpuEq">
          ${Array.from({length: 20}, (_, i) => `<div class="vpu-eq-bar" style="--bi:${i}"></div>`).join('')}
        </div>

        <div class="vpu-state-label" id="vpuStateLabel">Tap to speak</div>

        <div class="vpu-transcript" id="vpuTranscript"></div>

        <div class="vpu-actions">
          <button class="vpu-btn vpu-btn-minimize" id="vpuMinimize" title="Minimize">
            <svg viewBox="0 0 24 24" fill="none"><path d="M20 12H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="vpu-btn vpu-btn-main" id="vpuMainBtn">
            <span id="vpuMainIcon">◎</span>
          </button>
          <button class="vpu-btn vpu-btn-close" id="vpuClose" title="Close">
            <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    _overlay   = el;
    _card      = document.getElementById('vpuCard');
    _canvasEl  = document.getElementById('vpuWaveCanvas');
    _waveCtx   = _canvasEl.getContext('2d');
    _stateLabel= document.getElementById('vpuStateLabel');

    _bindEvents();
  }

  /* ─── Events ─── */
  function _bindEvents() {
    document.getElementById('vpuMinimize')?.addEventListener('click', hide);
    document.getElementById('vpuClose')?.addEventListener('click', hide);

    const mainBtn = document.getElementById('vpuMainBtn');
    mainBtn?.addEventListener('click', () => {
      if (_state === 'idle') _startListen();
      else _stopListen();
    });

    // Drag support
    const handle = document.getElementById('vpuDrag');
    handle?.addEventListener('mousedown', e => {
      _dragging = true;
      const r = _card.getBoundingClientRect();
      _dx = e.clientX - r.left; _dy = e.clientY - r.top;
    });
    document.addEventListener('mousemove', e => {
      if (!_dragging) return;
      _posX = e.clientX - _dx; _posY = e.clientY - _dy;
      _card.style.left = _posX + 'px';
      _card.style.top  = _posY + 'px';
      _card.style.bottom = 'auto';
      _card.style.transform = 'none';
    });
    document.addEventListener('mouseup', () => { _dragging = false; });

    // Touch drag
    handle?.addEventListener('touchstart', e => {
      const t = e.touches[0];
      _dragging = true;
      const r = _card.getBoundingClientRect();
      _dx = t.clientX - r.left; _dy = t.clientY - r.top;
    }, {passive:true});
    document.addEventListener('touchmove', e => {
      if (!_dragging) return;
      const t = e.touches[0];
      _posX = t.clientX - _dx; _posY = t.clientY - _dy;
      _card.style.left = _posX + 'px';
      _card.style.top  = _posY + 'px';
      _card.style.bottom = 'auto';
      _card.style.transform = 'none';
    }, {passive:true});
    document.addEventListener('touchend', () => { _dragging = false; });
  }

  /* ─── Audio analyser ─── */
  async function _startAnalyser() {
    try {
      _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = _audioCtx.createMediaStreamSource(_stream);
      _analyser = _audioCtx.createAnalyser();
      _analyser.fftSize = 256;
      src.connect(_analyser);
      _dataArr = new Uint8Array(_analyser.frequencyBinCount);
    } catch (e) {
      console.warn('[VoicePopup] mic access denied', e);
    }
  }

  function _stopAnalyser() {
    _stream?.getTracks().forEach(t => t.stop());
    _audioCtx?.close().catch(() => {});
    _analyser = null; _audioCtx = null; _dataArr = null; _stream = null;
  }

  /* ─── State transitions ─── */
  function _setState(s) {
    _state = s;
    const labels = { idle: 'Tap to speak', listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…' };
    if (_stateLabel) _stateLabel.textContent = labels[s] || s;

    const core = document.getElementById('vpuCore');
    const card = document.getElementById('vpuCard');
    const eq   = document.getElementById('vpuEq');
    const btn  = document.getElementById('vpuMainIcon');

    ['idle','listening','thinking','speaking'].forEach(c => {
      core?.classList.remove('vpu-state-' + c);
      card?.classList.remove('vpu-state-' + c);
    });
    core?.classList.add('vpu-state-' + s);
    card?.classList.add('vpu-state-' + s);

    if (btn) btn.textContent = (s === 'listening') ? '■' : '◎';
    if (eq) eq.style.display = (s === 'speaking') ? 'flex' : 'none';
  }

  async function _startListen() {
    _setState('listening');
    await _startAnalyser();
    _drawWave();
    // Hook into existing voice system
    document.getElementById('micBtn')?.click();
  }

  function _stopListen() {
    _setState('thinking');
    _stopAnalyser();
    document.getElementById('micBtn')?.click();
    setTimeout(() => { if (_state === 'thinking') _setState('idle'); }, 3000);
  }

  /* ─── Canvas waveform ─── */
  function _drawWave() {
    cancelAnimationFrame(_animFrame);
    if (!_visible) return;

    const W = _canvasEl.width, H = _canvasEl.height;
    const cx = W / 2, cy = H / 2;
    _waveCtx.clearRect(0, 0, W, H);

    if (_state === 'listening' && _analyser && _dataArr) {
      _analyser.getByteFrequencyData(_dataArr);
      const bars = 64;
      const step = Math.floor(_dataArr.length / bars);

      for (let i = 0; i < bars; i++) {
        const val   = _dataArr[i * step] / 255;
        const angle = (i / bars) * Math.PI * 2;
        const r1    = 70 + val * 28;
        const r2    = 72 + val * 52;
        const col   = `rgba(${_getEcRgb()},${0.3 + val * 0.7})`;

        _waveCtx.beginPath();
        _waveCtx.moveTo(cx + Math.cos(angle) * 70, cy + Math.sin(angle) * 70);
        _waveCtx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        _waveCtx.strokeStyle = col;
        _waveCtx.lineWidth   = 2.5;
        _waveCtx.stroke();
      }
    } else {
      // Breathing idle animation
      const t   = Date.now() / 1000;
      const r   = 70 + Math.sin(t * 1.2) * 6;
      const grd = _waveCtx.createRadialGradient(cx, cy, r - 10, cx, cy, r + 20);
      grd.addColorStop(0, `rgba(${_getEcRgb()},0.25)`);
      grd.addColorStop(1, `rgba(${_getEcRgb()},0)`);
      _waveCtx.beginPath();
      _waveCtx.arc(cx, cy, r + 12, 0, Math.PI * 2);
      _waveCtx.fillStyle = grd;
      _waveCtx.fill();
    }

    _animFrame = requestAnimationFrame(_drawWave);
  }

  function _getEcRgb() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ec-rgb').trim();
    return v || '0,200,255';
  }

  /* ─── Public API ─── */
  function show() {
    _build();
    _overlay.classList.add('vpu-visible');
    _visible = true;
    _setState('idle');
    _drawWave();
  }

  function hide() {
    _overlay?.classList.remove('vpu-visible');
    _visible = false;
    cancelAnimationFrame(_animFrame);
    _stopAnalyser();
    _setState('idle');
  }

  function setThinking(on) { if (_visible) _setState(on ? 'thinking' : 'idle'); }
  function setSpeaking(on)  { if (_visible) _setState(on ? 'speaking' : 'idle'); }
  function showTranscript(t) {
    const el = document.getElementById('vpuTranscript');
    if (el) { el.textContent = t; el.classList.add('vpu-tx-visible'); }
  }

  /* ─── Init — hook mic button to open popup ─── */
  function init() {
    _build();
    // Add a secondary floating mic trigger button
    const fab = document.createElement('button');
    fab.id = 'voicePopupFab';
    fab.className = 'vpu-fab';
    fab.title = 'Open Voice Mode';
    fab.innerHTML = `<svg viewBox="0 0 60 60" fill="none"><ellipse cx="30" cy="22" rx="9" ry="12" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M14 32 C14 44 46 44 46 32" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/><line x1="30" y1="44" x2="30" y2="50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="22" y1="50" x2="38" y2="50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
    fab.addEventListener('click', () => { SoulCore?.SFX?.activate?.(); show(); });
    document.getElementById('rippleRoot')?.after(fab);
  }

  return { init, show, hide, setThinking, setSpeaking, showTranscript };
})();

document.addEventListener('DOMContentLoaded', () => { VoicePopup.init(); });
