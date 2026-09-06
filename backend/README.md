# MySoul AI — Backend (v2)

An emotionally intelligent life companion backend built for the MySoul AI
frontend. FastAPI + SQLite (MySQL-migration-ready) + FAISS memory + LLM
failover (OpenRouter → Ollama) + local voice (Whisper STT / Edge TTS) +
a background Proactive Companion Engine.

## 1. Quickstart

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — optionally set OPENROUTER_API_KEY (get one at https://openrouter.ai/keys)

uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000/` for the MySoul AI frontend. The same process
serves `/scripts/*`, `/styles/*`, `/pages/*`, and all `/api/*` routes, so no
second frontend server is required. Open `http://localhost:8000/docs` for
interactive Swagger docs of every endpoint below.

Optional (for the Ollama fallback to actually work locally):
```bash
ollama pull llama3.1:8b
ollama serve
```
If Ollama isn't running, the app still works — it just returns the
in-character "having trouble reaching my thinking" message if OpenRouter
also fails, per the no-crash requirement.

## 2. Folder structure

```
backend/
  main.py                      # FastAPI app, routers, lifespan, middleware
  config.py                    # env-driven settings (no hardcoded secrets)
  database/
    db.py                      # SQLAlchemy engine/session, init_db()
    models.py                  # all 15 tables
  services/
    llm_service.py             # OpenRouter -> Ollama failover, circuit breaker
  emotion/
    emotion_engine.py          # GoEmotions -> 14-label taxonomy + heuristics
  memory/
    memory_service.py          # short/long-term/important layers + FAISS
  personality/
    personality_engine.py      # 70/20/10 voice, builds every system prompt
  safety/
    distress_detector.py       # SOS-overlay trigger logic
    alerts.py                  # console/SMTP/Twilio family-alert delivery
  voice/
    voice_service.py           # faster-whisper STT, edge-tts TTS
  scheduler/
    followup_scheduler.py      # Proactive Companion Engine (APScheduler)
  analytics/
    analytics_service.py       # Insights view chart aggregates
  api/                         # one router per resource (see below)
  middleware/
    rate_limit.py              # slowapi, per-IP
    logging_middleware.py      # audit logging (no PII/bodies logged)
  utils/
    schemas.py                 # all Pydantic request/response models
  data/                        # sqlite db, faiss index, tts cache (gitignored)
```

## 3. API map (→ what it feeds in the frontend)

| Endpoint | Feeds |
|---|---|
| `POST /chat` | Center chat panel, emotion orb, SOS overlay, hint bar |
| `POST /emotion/analyze` | Mood Ring / Soul Bubble ad-hoc reads |
| `POST /memory/store`, `GET /memory/search` | Long-term/important memory |
| `POST /event/create`, `GET /event` | Exam/interview/birthday tracking |
| `GET /followups`, `PATCH /followups/{id}` | Notification bell, hint bar |
| `POST /voice/transcribe` | Mic button (#micBtn) |
| `POST /voice/speak` | AI speaking bar (#aiSpeakBar) |
| `GET /dashboard`, `GET /dashboard/calendar` | Insights view (all 5 charts) |
| `POST/GET/PATCH/DELETE /tasks` | Student Mode task list |
| `POST/GET/PATCH/DELETE /goals` | Student/career goal tracking |
| `POST/GET/DELETE /journal` | Gratitude Journal wellness tab |
| `POST/GET /analytics` | Generic UI telemetry sink |
| `GET/POST /settings` | Server mirror of `ms_setup` localStorage |
| `POST /alerts/family` | SOS overlay's "Alert a Family Member" |
| `POST/GET/PATCH /users` | Onboarding + "Name Your AI" panel |
| `GET /health` | Status beacon (#statusBeacon) |

## 4. LLM failover

```
User Message → OpenRouter → success → return
                   │
                 failure (timeout/4xx/5xx/circuit-open)
                   ▼
               Ollama (local) → success → return
                   │
                 failure
                   ▼
       graceful in-character message (never a stack trace)
```
Circuit breakers (per-provider) open after `CIRCUIT_BREAKER_FAILURE_THRESHOLD`
consecutive failures and stay open for `CIRCUIT_BREAKER_RESET_SECONDS`, so a
provider having a bad minute doesn't cost every subsequent request a full
timeout — requests fail fast to the fallback instead.

## 5. Memory architecture

- **Short-term**: last 12 messages of the active conversation — no extra
  storage, always fresh.
- **Long-term**: `memories` table (layer="long_term") + FAISS
  `IndexFlatIP` (cosine, via `sentence-transformers/all-MiniLM-L6-v2`).
  `memory_embeddings` is the source of truth for text; FAISS holds vectors
  only and can be rebuilt from the DB via `memory_service.rebuild_index_from_db`.
- **Important**: same table, layer="important" — auto-promoted when
  `importance_score >= 0.8` (birthdays/exams/interviews/achievements/family
  events via a heuristic extractor that runs on every user message as a
  fast-path safety net alongside the LLM's own understanding).

## 6. Emotion architecture

`SamLowe/roberta-base-go_emotions` (28 GoEmotions labels) → mapped onto your
14-label taxonomy → a lightweight regex heuristic layer upgrades ambiguous
results to `burnout`/`loneliness`/`stress` when specific language patterns
appear (compound states no off-the-shelf model outputs directly). Every
result also feeds the Distress Detector, which is a **safety** layer (biased
toward false positives) rather than a diagnostic one — pair it with a real
moderation API and clinical review before shipping to real users.

## 7. Voice architecture

- STT: `faster-whisper` (CPU-friendly Whisper reimplementation), accepts
  whatever container the browser's MediaRecorder produces (webm/ogg/etc via
  ffmpeg internally).
- TTS: `edge-tts` free neural voices, returns base64 audio for instant
  `<audio>` playback plus a cached file on disk.
- Voice interruption is a client-side concern (pause the `<audio>` element)
  since TTS here is generate-then-play, not a live stream.
- Wake word / continuous listening: intentionally NOT implemented — your
  frontend already disabled this ("auto-voice-trigger removed: wake word
  feature not supported reliably across browsers"). Revisit via a streaming
  STT websocket if you want it back.

## 8. Migration plan (SQLite → MySQL)

1. Stand up a MySQL 8+ instance.
2. `pip install pymysql`
3. Change `DATABASE_URL` in `.env` to `mysql+pymysql://user:pass@host:3306/mysoul`
4. `alembic upgrade head` (no application code changes needed — `database/db.py`
   only branches on `connect_args` for SQLite's `check_same_thread`).
5. FAISS/embeddings are unaffected — they live outside SQLAlchemy entirely.

## 9. Security

- All secrets read from environment variables only (`config.py` /
  `pydantic-settings`); `.env` is gitignored.
- Rate limiting via `slowapi`, default `RATE_LIMIT_PER_MINUTE` per client IP.
- Input validation via Pydantic on every route.
- Audit logging middleware logs method/path/status/duration/IP — never
  request/response bodies, since chat content is sensitive.
- CORS restricted to `CORS_ORIGINS` from `.env`.

## 10. Development roadmap

- [ ] Real auth (JWT scaffolding is in requirements/config; wire up
      `/auth/login` + `Depends` guard once you have real user accounts
      instead of the current single-tenant-per-device model).
- [ ] LLM-driven event extraction (promote `memory_service.extract_candidate_memory`
      pattern to also create `Event` rows automatically from chat).
- [ ] Streaming chat responses (SSE/websocket) so the reply can render
      token-by-token instead of waiting for the full completion.
- [ ] Swap `memory_service`'s global-FAISS-then-filter approach for a real
      per-user index or pgvector once memory volume grows.
- [ ] Wake-word/continuous listening via a streaming STT websocket, if you
      revisit that frontend feature.
- [ ] Alembic migration scripts (the tool is installed; no migrations are
      checked in yet since the schema is still moving).

## 11. Backend quality self-assessment

| Area | Notes |
|---|---|
| Architecture | Clean separation by concern, matches spec's folder layout exactly |
| Failover | Real circuit breaker + retry/backoff, never crashes on dual outage |
| Memory | Three real layers, FAISS-backed semantic search, DB is source of truth |
| Emotion | Rich 14-label taxonomy incl. compound states GoEmotions can't natively output |
| Safety | Distress detection + family alerts + audit logging, explicitly scoped as MVP-grade, not clinical |
| Gaps | No real auth yet; FAISS filtering is overfetch-based (fine at MVP scale, not infinite scale) |

**Overall: solid, realistic MVP backend — production-hardening items are
explicitly called out above rather than glossed over.**
