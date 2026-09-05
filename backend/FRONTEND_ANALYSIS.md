# FRONTEND_ANALYSIS.md

Reverse-engineered from the provided `index.html` (MySoul AI v6) and the
localStorage keys / JS calls it makes.

## Pages found

- **Main app** (`index.html`) — single-page app with 4 views: Soul (home),
  Insights, Wellness, Universe.
- `pages/launcher.html` — linked from header ("MySoul OS"), not analyzed (not provided).
- `pages/onboarding.html` — linked from header ("Setup"); source of `ms_setup`
  (`user_name`, `ai_name`, `language`).
- `pages/auth.html` — linked from header ("Account"), not analyzed (not provided).

## Components found

- **Emotion panel** (left): emotion orb, intensity ring, pattern/context tags,
  "SOUL TIMELINE" scroll, soul pet with speech bubble.
- **Center stage**: soul core orb with SVG face (eyes/pupils/mouth react to
  emotion), mic button + voice corona, AI speaking bar with interrupt button,
  transcript flash, suggestion chips, error banner.
- **Chat panel** (right): message stream, composer input/send button.
- **Insights view**: Mood Wave (Chart.js line), Emotion Mix (donut), Peak Day
  card, Activity vs Mood (dual chart), Stress Index (SVG gauge), Emotion
  Calendar (custom month grid).
- **Wellness view tabs**: Breathe (4-7-8/box/deep-release timer), Journal
  (gratitude prompts + entries), Inspire (quote rotator), Health (nourish/
  move/stretch/rest tip cards), Color Therapy (canvas drawing), Meditate
  (timer + orb), De-Stress Games (Bubble Pop, Zen Garden, Breath Ball — all
  client-side only, no backend needed), Name Your AI (nickname panel).
- **Universe view**: ambient/cosmetic, static quote.
- **SOS overlay**: distress support UI — Alert Family Member / Start
  Breathing / "I'm okay" — plus a static iCall helpline number.
- **Hint bar**: contextual single-line suggestion + action button.
- **Family alert toast**, **lock screen** (cosmetic passcode, no real auth
  wired up yet), **notification bell** (badge dot, no data source yet).

## Features found

- Text chat with an AI companion that has a name (default "MySoul", or a
  user-set nickname via `ms_ai_nick`).
- Emotion-reactive UI: `--ec`/`--ec-rgb` CSS vars recolor the whole app based
  on detected emotion (`UILayer.setEmotion`).
- Voice input (mic button) — implementation lives in `scripts/voice.js`
  (not provided) but clearly expects an STT round-trip.
- Voice output (AI speaking bar + interrupt) — expects a TTS round-trip.
- SOS/distress detection — `SoulCore.onDistress(cb)` and
  `SoulCore.sendFamilyAlert(reason)` are called from the inline script,
  meaning `SoulCore` (in `scripts/soul-core.js`, not provided) is expected
  to talk to a backend for both distress signaling and alert delivery.
- Contextual hints — `SoulCore.onHints(cb)` fires suggestion strings that
  the inline script pattern-matches ("breath"/"journal"/"meditat") to wire
  up quick-action buttons.
- Mood history — Soul Timeline, Mood Wave, Emotion Mix, Peak Day, Emotion
  Calendar all need historical per-user emotion data.
- Wellness tools — mostly client-side (breathing timers, canvas drawing,
  games) but Journal entries are conversational data worth persisting
  server-side for continuity + emotion tracking.
- Personalization — user name, AI nickname, language (with flag pill on the
  composer), light/dark theme toggle (cosmetic, client-only).

## API requirements (inferred from JS hooks + UI needs)

- Send/receive chat messages, with the response carrying emotion + distress
  + hint metadata (not just plain text) so the emotion orb, SOS overlay, and
  hint bar can react without a second round-trip.
- Analyze emotion of arbitrary text (for potential live-typing reactivity).
- Store/search "remembered" facts (referenced implicitly by "Soul Timeline"
  and the product's memory-first identity).
- Voice transcribe (audio → text) and speak (text → audio).
- Family alert delivery (`sendFamilyAlert`).
- Dashboard data shaped exactly for 5 specific chart widgets.
- Journal entry CRUD.
- Settings persistence beyond localStorage (multi-device continuity).
- Generic analytics event logging (the app already has rich UI interaction
  surface — bubble-pop games, tab switches — worth tracking even if V1 does
  little with it).

## Missing backend requirements (gaps this backend fills)

- **No LLM integration existed** — `scripts/chat.js` presumably calls
  *something*, but no server was defined. → `POST /chat` with OpenRouter/
  Ollama failover.
- **No persistence** — everything lived in `localStorage` (`ms_setup`,
  `ms_ai_nick`), which doesn't survive a cleared browser or a second device.
  → full SQLite-backed user/settings/journal/task/goal models.
- **No real emotion detection** — the emotion orb/mood ring had CSS hooks
  but nothing computing `emotion`/`intensity` from actual text. →
  GoEmotions-based Emotion Engine.
- **No real distress detection** — the SOS overlay existed but nothing
  decided *when* to show it. → Distress Detector (language + emotion signal).
- **No family alert delivery** — button existed, no backend to send
  anything. → pluggable console/SMTP/Twilio alert service.
- **No memory system** — "Soul Timeline" had a `.tl-empty` placeholder only.
  → three-layer Memory Engine with FAISS semantic search.
- **No proactive behavior** — the product's stated core differentiator
  (follow-ups) had zero backend support. → APScheduler-driven Proactive
  Companion Engine.
- **No voice backend** — mic/speaking UI existed with nothing behind it. →
  faster-whisper STT + edge-tts TTS endpoints.
- **No analytics aggregation** — Insights charts had canvases and no data
  source. → `analytics_service` aggregates matching each chart's exact shape.

## Recommended architecture

FastAPI modular monolith (as built): one concern per top-level package
(`emotion/`, `memory/`, `personality/`, `safety/`, `voice/`, `scheduler/`,
`analytics/`), SQLite for MVP with a documented zero-code-change path to
MySQL, FAISS for vector search co-located with the DB rather than a separate
vector-DB service (justified at this scale; revisit only if memory volume
grows past what overfetch-then-filter can handle comfortably). See `README.md`
for the full folder layout, API map, and roadmap.
