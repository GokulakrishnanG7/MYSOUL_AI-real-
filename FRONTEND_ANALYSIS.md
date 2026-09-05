# MySoul AI v6 — Frontend Analysis

> Reverse-engineered from the live frontend. Backend is designed to match these contracts exactly.

---

## Pages Found

| Page | Path | Purpose | Backend calls |
|------|------|---------|---------------|
| Main Chat | `index.html` | Emotion-aware companion chat, SOS, hints, wellness | `POST /api/chat`, `/api/chat/voice`, `/api/alerts/family` |
| Onboarding | `pages/onboarding.html` | Language, user name, AI name | `POST /api/auth/setup` |
| Auth | `pages/auth.html` | Login / Register / Google OAuth | `/api/auth/login`, `/register`, `/google` |
| Launcher | `pages/launcher.html` | OS home / app grid | Local only (stats from storage) |
| Dashboard | `pages/dashboard.html` | Daily hub, mood, tasks | Local + future sync |
| Emotion | `pages/emotion.html` | Emotion analysis | `POST /api/chat` + `[EMOTION_ANALYSIS]` |
| Memory | `pages/memory.html` | Memory bank search/timeline | Local → sync via `/api/memory` |
| Voice | `pages/voice.html` | Full voice companion | `POST /api/chat` + `[VOICE_COMPANION]` |
| Tasks | `pages/tasks.html` | Task CRUD | Local → sync via `/api/tasks` |
| Study | `pages/study.html` | Study guidance | `[STUDY_GUIDANCE]` |
| Career | `pages/career.html` | Career guidance | `[CAREER_GUIDANCE]` |
| Solver | `pages/solver.html` | Step-by-step solver | `[PROBLEM_SOLVER_STEPBYSTEP]` |
| Decision | `pages/decision.html` | Pros/cons JSON | `[DECISION_ANALYSIS]` |
| Quiz | `pages/quiz.html` | Quiz JSON generator | `[QUIZ_GENERATOR]` |
| Story | `pages/story.html` | Story writer + narration | `[STORY_WRITER]` |

---

## Components / Scripts Found

| File | Role |
|------|------|
| `scripts/soul-core.js` | **Canonical API client** — chat, voice, alerts, JWT, emotion defs |
| `scripts/chat.js` | Chat UI wiring |
| `scripts/voice.js` | Web Speech + MediaRecorder → `/api/chat/voice` |
| `scripts/voice-ui.js` | Voice FAB overlay |
| `scripts/panels.js` | Memory bank, tasks, personality, language, nudges |
| `scripts/ui-layer-manager.js` | Mood ring, insights, wellness, lock |
| `scripts/particles.js` | Ambient particles |
| `modules/soul-features.js` | MoodRing, SoulBubble, BreathCoach, Oracle |
| `modules/auto-voice-trigger.js` | Wake word + voice nav |
| `modules/page-shell.js` | `soulAPI()` for OS pages (`../api/chat`) |

---

## Features Inventory

### Core companion
- Emotion-aware chat with intensity / pattern / context
- Personalized AI name + user name + language
- JWT auth headers on all API calls
- Offline keyword emotion + fallback replies

### Emotional intelligence UI
- Mood Ring / Soul Bubble color themes (`--ec`)
- Emotion hint bar from `hints[]`
- SOS overlay on `emotion=distress` or `urgency=high`
- Family alert button → `/api/alerts/family`
- Breathing coach, journal, meditate, color therapy

### Voice
- Wake words: `hey soul`, `hello soul`, `mysoul`, dynamic `hey <ai_name>`
- Voice commands: open chat/emotion/memory/tasks/quiz/story/dashboard
- MediaRecorder → backend STT
- Web Speech API fallback + browser TTS

### Memory (frontend local today)
- `ms_memory_bank`, `ms_hist`, `ms_journal`
- Tags, search, timeline seeding from chat history

### Productivity / guidance
- Tasks, study, career, solver, decision, quiz, story
- System hint prefixes routed through same `/api/chat`

### Modes (product intent — not in frontend yet)
- Student Mode / Elder Mode → backend-ready, frontend greenfield

---

## Exact API Contracts (Frontend Expects)

### `POST /api/chat`
```json
// Request
{
  "user_id": "user_xxxxxxxx",
  "text": "message or [HINT] message",
  "language": "en",
  "user_name": "Friend",
  "ai_name": "MySoul"
}
// Response (REQUIRED)
{
  "response": "string",
  "emotion": "neutral|joy|happy|calm|sad|angry|stressed|fear|love|surprised|distress|anxious|academic",
  "intensity": "low|medium|high|very_high",
  "pattern": null,
  "context": null,
  "urgency": null,
  "hints": [],
  "emotion_state": {"color": "#00c8ff", "label": "NEUTRAL"},
  "errors": []
}
```

### `POST /api/chat/voice` (multipart)
- Fields: `audio` (webm), `user_id`, `language`
- Response: `{transcript, response, emotion, intensity, hints, urgency, emotion_state, ...}`

### Auth
- `POST /api/auth/setup` → `{ai_name, user_name, language}`
- `POST /api/auth/login` → `{access_token}`
- `POST /api/auth/register` → `{access_token}`
- `GET /api/auth/google?redirect_uri=...`
- `GET /api/auth/google/callback`

### `POST /api/alerts/family`
```json
{"user_id","emotion","urgency","note","timestamp"}
```

### System hints (prefix in `text`)
`EMOTION_ANALYSIS` · `VOICE_COMPANION` · `STUDY_GUIDANCE` · `CAREER_GUIDANCE` · `DECISION_ANALYSIS` · `QUIZ_GENERATOR` · `PROBLEM_SOLVER_STEPBYSTEP` · `STORY_WRITER`

---

## Emotion / Mood Mapping (UI)

| Emotion | Theme color |
|---------|-------------|
| neutral, sad, fear, distress, anxious | `#00c8ff` (blue) |
| joy, happy, angry, stressed, surprised | `#ffe040` (yellow) |
| calm, love, academic | `#38f098` (green) |

Intensity UI: low 22% · medium 54% · high 84% · very_high 97%

---

## localStorage Keys

| Key | Purpose |
|-----|---------|
| `ms_uid` | Anonymous user id |
| `ms_setup` | Onboarding profile |
| `ms_jwt` (sessionStorage) | Auth token |
| `ms_hist` | Emotion history |
| `ms_memory_bank` | Memories |
| `ms_tasks` | Tasks |
| `ms_journal` | Journal |
| `ms_personality` | Empathy/humor/formality |
| `ms_decisions` | Decision history |
| `ms_last_mood_*` | Theme persistence |
| `ms_ai_nick` | Nickname |

---

## Missing Backend Requirements (Gaps)

1. Persistent memory / tasks / journal / goals / events / followups
2. Emotion engine with richer labels (backend V2 expands beyond UI keys, maps down)
3. Vector memory (FAISS) + importance tiers
4. LLM failover OpenRouter → Ollama
5. Personality engine (70/20/10 blend)
6. Proactive companion follow-ups
7. Whisper STT + Edge TTS
8. Student / Elder mode APIs
9. Family contacts CRUD for SOS
10. Analytics dashboard data
11. Rate limiting, audit logs, env-only secrets

---

## Recommended Architecture

```
Browser (unchanged UI)
    │
    ▼
FastAPI (serves static frontend + /api/*)
    ├── Auth (JWT)
    ├── Chat Pipeline
    │     ├── Safety filter
    │     ├── Emotion engine
    │     ├── Memory retrieve/store
    │     ├── Personality prompt
    │     ├── LLM failover (OpenRouter → Ollama)
    │     └── Response enricher (hints, urgency, emotion_state)
    ├── Voice (Whisper + Edge TTS)
    ├── Memory (short / long / important + FAISS)
    ├── Scheduler (proactive follow-ups)
    ├── Student / Elder services
    └── SQLite (migration-ready → MySQL)
```

**Connection strategy:** Run the FastAPI app from `backend/`. It serves the parent folder as static files and mounts `/api`. No frontend design or script changes required — existing relative paths (`/api/chat`, `../api/chat`) resolve correctly.
