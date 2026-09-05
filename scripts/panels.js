/* ═══════════════════════════════════════════════════════════
   MySoul AI v3+ — Enhanced Panels
   scripts/panels.js — ADDITIVE ONLY
   Covers: Memory Bank, Daily Companion, Tasks, Personality,
           Language toggle, Proactive Nudges, Story Mode
═══════════════════════════════════════════════════════════ */
'use strict';

/* ════════════════════════════════════════
   MEMORY BANK PANEL
════════════════════════════════════════ */
const MemoryPanel = (() => {
  const KEY = 'ms_memory_bank';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function _save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function addEntry(emotion, text, tags = []) {
    const data = _load();
    data.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      emotion,
      text,
      tags: tags.length ? tags : [emotion, 'general'],
    });
    if (data.length > 200) data.length = 200;
    _save(data);
  }

  function _build() {
    if (document.getElementById('memoryPanel')) return;

    const el = document.createElement('div');
    el.id = 'memoryPanel';
    el.className = 'memory-panel glass-deep hidden';
    el.innerHTML = `
      <div class="mp-header">
        <div class="mp-title">
          <span class="mp-icon">◈</span>
          <span>Memory Bank</span>
        </div>
        <button class="mp-close" id="mpClose">✕</button>
      </div>
      <div class="mp-search-wrap">
        <input class="mp-search" id="mpSearch" placeholder="Search memories…" autocomplete="off"/>
        <span class="mp-search-icon">⌕</span>
      </div>
      <div class="mp-tags" id="mpTagsRow"></div>
      <div class="mp-timeline" id="mpTimeline">
        <div class="mp-empty">No memories yet — start chatting!</div>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById('mpClose')?.addEventListener('click', hide);
    document.getElementById('mpSearch')?.addEventListener('input', e => _render(e.target.value, _activeTag));

    // Click outside to close
    document.addEventListener('mousedown', e => {
      if (el.classList.contains('hidden')) return;
      if (!el.contains(e.target) && e.target.id !== 'memoryFab') hide();
    });
  }

  let _activeTag = null;

  function _render(q = '', tag = null) {
    _activeTag = tag;
    const data = _load();
    const timeline = document.getElementById('mpTimeline');
    const tagsRow  = document.getElementById('mpTagsRow');
    if (!timeline) return;

    // Tags
    const allTags = [...new Set(data.flatMap(d => d.tags))].slice(0, 12);
    if (tagsRow) {
      tagsRow.innerHTML = `<button class="mp-tag-chip ${!tag ? 'active' : ''}" data-tag="">All</button>` +
        allTags.map(t => `<button class="mp-tag-chip ${tag === t ? 'active' : ''}" data-tag="${t}">${t}</button>`).join('');
      tagsRow.querySelectorAll('.mp-tag-chip').forEach(btn => {
        btn.addEventListener('click', () => _render(q, btn.dataset.tag || null));
      });
    }

    let filtered = data;
    if (tag) filtered = filtered.filter(d => d.tags.includes(tag));
    if (q)   filtered = filtered.filter(d => d.text.toLowerCase().includes(q.toLowerCase()));

    if (!filtered.length) {
      timeline.innerHTML = '<div class="mp-empty">No matching memories</div>';
      return;
    }

    // Group by date
    const groups = {};
    filtered.forEach(d => {
      const day = new Date(d.ts).toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(d);
    });

    const EMOTION_COLORS = {
      neutral:'#00c8ff', joy:'#ffe040', happy:'#ffda20', calm:'#38f098',
      sad:'#5b8dee', angry:'#ff4060', stressed:'#ff4060', fear:'#a855f7',
      love:'#ff6ba0', surprised:'#ff9f38', academic:'#00c8ff',
    };

    timeline.innerHTML = Object.entries(groups).map(([day, items]) => `
      <div class="mp-group">
        <div class="mp-day-label">${day}</div>
        ${items.map(item => `
          <div class="mp-entry" style="--ec: ${EMOTION_COLORS[item.emotion] || '#00c8ff'}">
            <div class="mp-entry-dot"></div>
            <div class="mp-entry-body">
              <div class="mp-entry-text">${_esc(item.text)}</div>
              <div class="mp-entry-meta">
                <span class="mp-entry-emo">${item.emotion}</span>
                <span class="mp-entry-time">${new Date(item.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  function _esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function show() {
    _build();
    _render();
    document.getElementById('memoryPanel')?.classList.remove('hidden');
    document.getElementById('memoryPanel')?.classList.add('mp-open');
  }

  function hide() {
    document.getElementById('memoryPanel')?.classList.remove('mp-open');
    setTimeout(() => document.getElementById('memoryPanel')?.classList.add('hidden'), 380);
  }

  function init() {
    _build();
    // Fab button
    const fab = document.createElement('button');
    fab.id = 'memoryFab';
    fab.className = 'panel-fab';
    fab.title = 'Memory Bank';
    fab.innerHTML = '◈';
    fab.addEventListener('click', () => { SoulCore?.SFX?.click?.(); show(); });
    document.getElementById('rippleRoot')?.after(fab);
  }

  return { init, show, hide, addEntry };
})();


/* ════════════════════════════════════════
   DAILY COMPANION DASHBOARD
════════════════════════════════════════ */
const DailyCompanion = (() => {
  const TASKS_KEY = 'ms_tasks';

  function _getTasks() {
    try { return JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
    catch { return []; }
  }
  function _saveTasks(t) { localStorage.setItem(TASKS_KEY, JSON.stringify(t)); }

  function _greeting() {
    const h = new Date().getHours();
    if (h < 5)  return { greet: 'Still awake?', sub: 'The night holds its own magic' };
    if (h < 12) return { greet: 'Good morning', sub: 'A fresh canvas awaits you' };
    if (h < 17) return { greet: 'Good afternoon', sub: 'Keep the momentum going' };
    if (h < 21) return { greet: 'Good evening', sub: 'Time to wind down and reflect' };
    return { greet: 'Good night', sub: 'Prepare for peaceful rest' };
  }

  function _build() {
    if (document.getElementById('dailyPanel')) return;
    const el = document.createElement('div');
    el.id = 'dailyPanel';
    el.className = 'daily-panel glass-deep hidden';
    el.innerHTML = `
      <div class="dp-header">
        <div class="dp-title"><span>✦</span><span>Daily Companion</span></div>
        <button class="dp-close" id="dpClose">✕</button>
      </div>

      <div class="dp-greeting" id="dpGreeting">
        <div class="dp-greet-text" id="dpGreetText">Hello</div>
        <div class="dp-greet-sub" id="dpGreetSub">Loading…</div>
      </div>

      <div class="dp-mood-bar" id="dpMoodBar">
        <div class="dp-section-label">Today's Mood</div>
        <div class="dp-mood-orbs" id="dpMoodOrbs"></div>
      </div>

      <div class="dp-tasks-section">
        <div class="dp-section-label">
          <span>Tasks</span>
          <button class="dp-add-task-btn" id="dpAddTaskBtn">+ Add</button>
        </div>
        <div class="dp-add-task-form hidden" id="dpAddForm">
          <input class="dp-task-input" id="dpTaskInput" placeholder="New task…" autocomplete="off"/>
          <button class="dp-task-save" id="dpTaskSave">↑</button>
        </div>
        <div class="dp-tasks-list" id="dpTasksList"></div>
      </div>

      <div class="dp-suggestions">
        <div class="dp-section-label">Soul Suggestions</div>
        <div class="dp-sug-cards" id="dpSugCards"></div>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById('dpClose')?.addEventListener('click', hide);
    document.getElementById('dpAddTaskBtn')?.addEventListener('click', () => {
      document.getElementById('dpAddForm')?.classList.toggle('hidden');
      document.getElementById('dpTaskInput')?.focus();
    });
    document.getElementById('dpTaskSave')?.addEventListener('click', _addTask);
    document.getElementById('dpTaskInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _addTask();
    });

    document.addEventListener('mousedown', e => {
      const panel = document.getElementById('dailyPanel');
      if (!panel || panel.classList.contains('hidden')) return;
      if (!panel.contains(e.target) && e.target.id !== 'dailyFab') hide();
    });
  }

  function _addTask() {
    const inp = document.getElementById('dpTaskInput');
    const t   = inp?.value.trim();
    if (!t) return;
    const tasks = _getTasks();
    tasks.unshift({ id: Date.now(), text: t, done: false, priority: 'normal' });
    _saveTasks(tasks);
    if (inp) inp.value = '';
    _renderTasks();
    SoulCore?.SFX?.success?.();
  }

  function _renderTasks() {
    const list  = document.getElementById('dpTasksList');
    const tasks = _getTasks();
    if (!list) return;
    if (!tasks.length) { list.innerHTML = '<div class="dp-empty">No tasks yet</div>'; return; }
    list.innerHTML = tasks.slice(0, 8).map(task => `
      <div class="dp-task ${task.done ? 'done' : ''}" data-id="${task.id}">
        <button class="dp-task-check" data-id="${task.id}">${task.done ? '✓' : '○'}</button>
        <span class="dp-task-text">${task.text}</span>
        <button class="dp-task-del" data-id="${task.id}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.dp-task-check').forEach(btn => {
      btn.addEventListener('click', () => _toggleTask(+btn.dataset.id));
    });
    list.querySelectorAll('.dp-task-del').forEach(btn => {
      btn.addEventListener('click', () => _deleteTask(+btn.dataset.id));
    });
  }

  function _toggleTask(id) {
    const tasks = _getTasks().map(t => t.id === id ? {...t, done: !t.done} : t);
    _saveTasks(tasks); _renderTasks();
  }
  function _deleteTask(id) {
    _saveTasks(_getTasks().filter(t => t.id !== id)); _renderTasks();
  }

  const SUGGESTIONS = [
    { icon:'🌬', text: 'Take a 2-minute breath break' },
    { icon:'💧', text: 'Drink a glass of water' },
    { icon:'🚶', text: 'Take a short walk outside' },
    { icon:'📖', text: 'Journal your feelings today' },
    { icon:'☯', text: 'Try a quick meditation' },
    { icon:'🌿', text: 'Step away from screens briefly' },
    { icon:'🎵', text: 'Listen to uplifting music' },
    { icon:'🤗', text: 'Reach out to a friend' },
  ];

  function _renderSuggestions() {
    const el = document.getElementById('dpSugCards');
    if (!el) return;
    const picks = SUGGESTIONS.sort(() => 0.5 - Math.random()).slice(0, 3);
    el.innerHTML = picks.map(s => `
      <div class="dp-sug-card glass-card">
        <div class="dp-sug-icon">${s.icon}</div>
        <div class="dp-sug-text">${s.text}</div>
      </div>
    `).join('');
  }

  function show() {
    _build();
    const { greet, sub } = _greeting();
    const gt = document.getElementById('dpGreetText');
    const gs = document.getElementById('dpGreetSub');
    if (gt) gt.textContent = greet;
    if (gs) gs.textContent = sub;

    // Mood orbs from history
    const hist = JSON.parse(localStorage.getItem('ms_hist') || '[]');
    const orbs = document.getElementById('dpMoodOrbs');
    if (orbs) {
      const COLORS = { neutral:'#00c8ff', joy:'#ffe040', happy:'#ffda20', calm:'#38f098', sad:'#5b8dee', angry:'#ff4060', stressed:'#ff4060', fear:'#a855f7', love:'#ff6ba0', surprised:'#ff9f38' };
      orbs.innerHTML = hist.slice(0, 10).map(h => `
        <div class="dp-mood-orb" style="background:${COLORS[h.emotion]||'#00c8ff'}" title="${h.emotion}"></div>
      `).join('') || '<div class="dp-empty">Chat to build mood history</div>';
    }

    _renderTasks();
    _renderSuggestions();
    document.getElementById('dailyPanel')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('dailyPanel')?.classList.add('dp-open'), 10);
  }

  function hide() {
    document.getElementById('dailyPanel')?.classList.remove('dp-open');
    setTimeout(() => document.getElementById('dailyPanel')?.classList.add('hidden'), 380);
  }

  function init() {
    _build();
    const fab = document.createElement('button');
    fab.id = 'dailyFab';
    fab.className = 'panel-fab panel-fab-2';
    fab.title = 'Daily Companion';
    fab.innerHTML = '✦';
    fab.addEventListener('click', () => { SoulCore?.SFX?.click?.(); show(); });
    document.getElementById('rippleRoot')?.after(fab);
  }

  return { init, show, hide };
})();


/* ════════════════════════════════════════
   PERSONALITY CONTROL PANEL
════════════════════════════════════════ */
const PersonalityPanel = (() => {
  const KEY = 'ms_personality';
  const DEFAULTS = { empathy: 80, humor: 45, formality: 30 };

  function _load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }; }
    catch { return { ...DEFAULTS }; }
  }
  function _save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  function get() { return _load(); }

  function _build() {
    if (document.getElementById('personalityPanel')) return;
    const p = _load();
    const el = document.createElement('div');
    el.id = 'personalityPanel';
    el.className = 'personality-panel glass-deep hidden';
    el.innerHTML = `
      <div class="pp-header">
        <div class="pp-title"><span>✺</span><span>Personality</span></div>
        <button class="pp-close" id="ppClose">✕</button>
      </div>
      <div class="pp-preview" id="ppPreview">Warm · Playful · Casual</div>
      <div class="pp-sliders">
        ${_slider('empathy',   'Empathy',   p.empathy,   '🫂', 'Cold', 'Deeply caring')}
        ${_slider('humor',     'Humor',     p.humor,     '😄', 'Serious', 'Playful')}
        ${_slider('formality', 'Formality', p.formality, '🎩', 'Casual', 'Formal')}
      </div>
      <div class="pp-lang">
        <div class="pp-section-label">Language</div>
        <div class="pp-lang-opts" id="ppLangOpts">
          ${['English','Hindi','Tamil','Spanish','French','Japanese'].map(l =>
            `<button class="pp-lang-btn ${l==='English'?'active':''}" data-lang="${l}">${l}</button>`
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById('ppClose')?.addEventListener('click', hide);
    el.querySelectorAll('.pp-slider').forEach(s => {
      s.addEventListener('input', _onSlider);
    });
    el.querySelectorAll('.pp-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.pp-lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        LanguageToggle.set(btn.dataset.lang);
        SoulCore?.SFX?.click?.();
      });
    });

    document.addEventListener('mousedown', e => {
      const panel = document.getElementById('personalityPanel');
      if (!panel || panel.classList.contains('hidden')) return;
      if (!panel.contains(e.target) && e.target.id !== 'personalityFab') hide();
    });
  }

  function _slider(id, label, val, icon, lo, hi) {
    return `
      <div class="pp-slider-wrap">
        <div class="pp-slider-label">
          <span>${icon} ${label}</span>
          <span class="pp-slider-val" id="pp-val-${id}">${val}%</span>
        </div>
        <div class="pp-slider-track">
          <input type="range" class="pp-slider" id="pp-${id}" data-key="${id}"
            min="0" max="100" value="${val}" autocomplete="off"/>
          <div class="pp-slider-fill" id="pp-fill-${id}" style="width:${val}%"></div>
        </div>
        <div class="pp-slider-ends"><span>${lo}</span><span>${hi}</span></div>
      </div>
    `;
  }

  function _onSlider(e) {
    const key = e.target.dataset.key;
    const val = +e.target.value;
    const p = _load(); p[key] = val; _save(p);
    const vEl = document.getElementById(`pp-val-${key}`);
    const fEl = document.getElementById(`pp-fill-${key}`);
    if (vEl) vEl.textContent = val + '%';
    if (fEl) fEl.style.width = val + '%';
    _updatePreview(p);
  }

  function _updatePreview(p) {
    const prev = document.getElementById('ppPreview');
    if (!prev) return;
    const emp = p.empathy > 60 ? 'Empathic' : p.empathy > 30 ? 'Balanced' : 'Direct';
    const hum = p.humor > 60 ? 'Playful' : p.humor > 30 ? 'Light' : 'Serious';
    const frm = p.formality > 60 ? 'Formal' : p.formality > 30 ? 'Semi-casual' : 'Casual';
    prev.textContent = `${emp} · ${hum} · ${frm}`;
  }

  function show() {
    _build();
    document.getElementById('personalityPanel')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('personalityPanel')?.classList.add('pp-open'), 10);
  }

  function hide() {
    document.getElementById('personalityPanel')?.classList.remove('pp-open');
    setTimeout(() => document.getElementById('personalityPanel')?.classList.add('hidden'), 380);
  }

  function init() {
    _build();
    const fab = document.createElement('button');
    fab.id = 'personalityFab';
    fab.className = 'panel-fab panel-fab-3';
    fab.title = 'Personality Settings';
    fab.innerHTML = '✺';
    fab.addEventListener('click', () => { SoulCore?.SFX?.click?.(); show(); });
    document.getElementById('rippleRoot')?.after(fab);
  }

  return { init, show, hide, get };
})();


/* ════════════════════════════════════════
   LANGUAGE TOGGLE
════════════════════════════════════════ */
const LanguageToggle = (() => {
  const KEY = 'ms_lang';
  let _current = localStorage.getItem(KEY) || 'English';

  const GREETINGS = {
    English: 'How are you feeling right now?',
    Hindi:   'आप अभी कैसा महसूस कर रहे हैं?',
    Tamil:   'நீங்கள் இப்போது எப்படி உணர்கிறீர்கள்?',
    Spanish: '¿Cómo te sientes ahora mismo?',
    French:  'Comment vous sentez-vous en ce moment?',
    Japanese:'今どんな気持ちですか？',
  };

  function set(lang) {
    _current = lang;
    localStorage.setItem(KEY, lang);
    const inp = document.getElementById('chatInput');
    if (inp) inp.placeholder = GREETINGS[lang] || GREETINGS.English;
    // Visual feedback
    _showToast(`Language: ${lang}`);
  }

  function get() { return _current; }

  function _showToast(msg) {
    let t = document.getElementById('langToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'langToast';
      t.className = 'lang-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 2200);
  }

  function init() {
    set(_current);
  }

  return { init, set, get };
})();


/* ════════════════════════════════════════
   PROACTIVE NUDGES
════════════════════════════════════════ */
const ProactiveNudges = (() => {
  const NUDGES = {
    stressed:  ['You seem stressed — want to try breathing?', 'Shall I remind you to pause?', 'A 2-min break can reset everything 🌬'],
    sad:       ['You deserve comfort right now 💙', 'Want to try some inspiration?', 'I\'m here — no judgment, just presence'],
    angry:     ['Let it out safely here 🔥', 'Want a space to breathe?', 'Your feelings are completely valid'],
    joy:       ['This energy is beautiful! Capture it in a journal ✦', 'You\'re glowing — what happened?'],
    calm:      ['Beautiful stillness. Want a meditation? ☯'],
    neutral:   [],
  };

  let _lastEmotion = 'neutral';
  let _shown = 0;
  let _queue = [];
  let _timer = null;

  function trigger(emotion) {
    if (emotion === _lastEmotion) return;
    _lastEmotion = emotion;
    const msgs = NUDGES[emotion];
    if (!msgs?.length) return;
    _queue.push(...msgs);
    if (!_timer) _timer = setTimeout(_show, 4000);
  }

  function _show() {
    _timer = null;
    if (!_queue.length) return;
    const msg = _queue.shift();
    _showNudge(msg);
    if (_queue.length) _timer = setTimeout(_show, 8000);
  }

  function _showNudge(text) {
    const el = document.createElement('div');
    el.className = 'nudge-popup glass-deep';
    el.innerHTML = `
      <div class="nudge-icon">◈</div>
      <div class="nudge-text">${text}</div>
      <button class="nudge-close">✕</button>
    `;
    document.body.appendChild(el);

    el.querySelector('.nudge-close')?.addEventListener('click', () => _dismiss(el));
    setTimeout(() => el.classList.add('nudge-visible'), 50);
    setTimeout(() => _dismiss(el), 7000);
  }

  function _dismiss(el) {
    el.classList.remove('nudge-visible');
    setTimeout(() => el.remove(), 400);
  }

  function init() {}

  return { init, trigger };
})();


/* ════════════════════════════════════════
   STORY MODE
════════════════════════════════════════ */
const StoryMode = (() => {
  const STORIES = [
    {
      title: 'The Lighthouse',
      text: `There was once a lighthouse keeper who stood at the edge of the world, guiding ships through the darkest storms. Each night, the beacon turned — not just for the ships, but as a reminder to himself: even in the deepest darkness, a single light is enough.\n\nYou are that lighthouse. Your warmth, your presence — it guides more people than you know. Even when the fog feels thick and the storm feels close, you are still shining.`,
    },
    {
      title: 'The River\'s Wisdom',
      text: `The river does not struggle against the rocks in its path. It finds a way — always flowing, always moving forward, shaping even the hardest stone with patience and persistence.\n\nYour emotions are like that river. They don't need to be controlled or stopped. They need to be let to flow — gently, honestly, toward the ocean of understanding.`,
    },
    {
      title: 'Seeds of Tomorrow',
      text: `A farmer planted a seed in winter — when the ground was cold and nothing seemed possible. She watered it, believed in it, and waited.\n\nSpring came, as it always does. And where there was emptiness, there was now life. Every effort you've made in hard times is a seed waiting to bloom. Trust the season.`,
    },
  ];

  let _current = 0;
  let _speaking = false;

  function _build() {
    if (document.getElementById('storyPanel')) return;
    const el = document.createElement('div');
    el.id = 'storyPanel';
    el.className = 'story-panel hidden';
    el.innerHTML = `
      <div class="sp-stars" id="spStars"></div>
      <div class="sp-content">
        <div class="sp-header">
          <div class="sp-back" id="spBack">← Return</div>
          <div class="sp-nav">
            <button class="sp-nav-btn" id="spPrev">‹</button>
            <span class="sp-nav-count" id="spNavCount">1 / ${STORIES.length}</span>
            <button class="sp-nav-btn" id="spNext">›</button>
          </div>
        </div>
        <div class="sp-card">
          <div class="sp-glyph">✦</div>
          <div class="sp-title" id="spTitle"></div>
          <div class="sp-text" id="spText"></div>
        </div>
        <div class="sp-controls">
          <button class="sp-play-btn" id="spPlay">▶ Listen</button>
          <button class="sp-stop-btn hidden" id="spStop">◼ Stop</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    _buildStars();
    _renderStory();

    document.getElementById('spBack')?.addEventListener('click', hide);
    document.getElementById('spPlay')?.addEventListener('click', _playStory);
    document.getElementById('spStop')?.addEventListener('click', _stopStory);
    document.getElementById('spNext')?.addEventListener('click', () => {
      _current = (_current + 1) % STORIES.length;
      _renderStory();
    });
    document.getElementById('spPrev')?.addEventListener('click', () => {
      _current = (_current - 1 + STORIES.length) % STORIES.length;
      _renderStory();
    });
  }

  function _buildStars() {
    const wrap = document.getElementById('spStars');
    if (!wrap) return;
    wrap.innerHTML = Array.from({length: 80}, () => {
      const x = Math.random() * 100, y = Math.random() * 100;
      const s = 0.5 + Math.random() * 1.5;
      const d = Math.random() * 4;
      return `<div class="sp-star" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${d}s"></div>`;
    }).join('');
  }

  function _renderStory() {
    const s = STORIES[_current];
    const t = document.getElementById('spTitle');
    const b = document.getElementById('spText');
    const c = document.getElementById('spNavCount');
    if (t) t.textContent = s.title;
    if (b) b.textContent = s.text;
    if (c) c.textContent = `${_current + 1} / ${STORIES.length}`;
    _stopStory();
  }

  function _playStory() {
    if (!('speechSynthesis' in window)) return;
    _stopStory();
    const s = STORIES[_current];
    const utt = new SpeechSynthesisUtterance(s.title + '. ' + s.text);
    utt.rate = 0.85; utt.pitch = 1.05;
    utt.onend = _stopStory;
    speechSynthesis.speak(utt);
    _speaking = true;
    document.getElementById('spPlay')?.classList.add('hidden');
    document.getElementById('spStop')?.classList.remove('hidden');
  }

  function _stopStory() {
    speechSynthesis.cancel();
    _speaking = false;
    document.getElementById('spPlay')?.classList.remove('hidden');
    document.getElementById('spStop')?.classList.add('hidden');
  }

  function show() {
    _build();
    document.getElementById('storyPanel')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('storyPanel')?.classList.add('sp-open'), 10);
  }

  function hide() {
    _stopStory();
    document.getElementById('storyPanel')?.classList.remove('sp-open');
    setTimeout(() => document.getElementById('storyPanel')?.classList.add('hidden'), 400);
  }

  function init() {
    _build();
    const fab = document.createElement('button');
    fab.id = 'storyFab';
    fab.className = 'panel-fab panel-fab-4';
    fab.title = 'Story Mode';
    fab.innerHTML = '◎';
    fab.addEventListener('click', () => { SoulCore?.SFX?.click?.(); show(); });
    document.getElementById('rippleRoot')?.after(fab);
  }

  return { init, show, hide };
})();


/* ── Init all panels ── */
document.addEventListener('DOMContentLoaded', () => {
  MemoryPanel.init();
  DailyCompanion.init();
  PersonalityPanel.init();
  LanguageToggle.init();
  ProactiveNudges.init();
  StoryMode.init();

  /* Hook into UILayer.setEmotion to feed memory + nudges */
  const _origSetEmo = window.UILayer?.setEmotion;
  if (_origSetEmo) {
    const _patchEmotion = function(emotion, intensity, pattern, context) {
      _origSetEmo.call(this, emotion, intensity, pattern, context);
      ProactiveNudges.trigger(emotion);
      if (context) {
        MemoryPanel.addEntry(emotion, context, [emotion, pattern||'general'].filter(Boolean));
      }
    };
    // Defer to ensure UILayer is loaded
    setTimeout(() => {
      if (window.UILayer) window.UILayer.setEmotion = _patchEmotion;
    }, 500);
  }
});
