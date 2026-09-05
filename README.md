# MySoul AI — Frontend v6

## 🆕 What's New in v6

### New Pages
- **`pages/onboarding.html`** — Full immersive onboarding with voice input, language selector, name setup, animated logo ring. Calls `POST /api/auth/setup`.
- **`pages/auth.html`** — Sign In / Register with JWT handling, Google OAuth button, email+password forms. Calls `POST /api/auth/login` and `POST /api/auth/register`.

### Upgraded Features
- **SOS / Distress Overlay** — Auto-triggers when `emotion="distress"` or `urgency="high"` from API response. Shows support options, family alert button, breathing exercise shortcut, and crisis helpline.
- **Emotion Hint Bar** — Contextual wellness suggestions pulled from `response.hints[]` (or locally generated if offline). Appears as a floating pill at bottom of screen with action buttons.
- **Family Alert API** — `POST /api/alerts/family` called when user clicks "Alert a Family Member" in SOS overlay. Sends emotion, urgency, and timestamp.
- **Full Voice API** — `POST /api/chat/voice` via `MediaRecorder` (audio blob). Falls back to Web Speech API transcript if backend unavailable.
- **AI Name in Header** — Reads from `localStorage.ms_setup` and shows personalized AI name pill.
- **Language Flag Indicator** — Shows selected language flag in chat input bar.
- **JWT Auth Headers** — All API calls now include `Authorization: Bearer <token>` when logged in.
- **Setup Banner** — Shows first-time setup prompt if user hasn't personalized yet.

## API Endpoints Expected

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/setup` | Save ai_name, user_name, language |
| POST | `/api/auth/login` | JWT login |
| POST | `/api/auth/register` | Create account |
| GET  | `/api/auth/google` | Google OAuth redirect |
| POST | `/api/chat` | Text chat |
| POST | `/api/chat/voice` | Voice audio chat (FormData) |
| POST | `/api/alerts/family` | SOS family alert |

## Chat API Response Schema Expected

```json
{
  "response": "string",
  "emotion": "neutral|joy|sad|stressed|distress|...",
  "intensity": "low|medium|high",
  "urgency": null | "high",
  "hints": ["Try breathing exercise", "..."],
  "emotion_state": { "color": "#hex", "label": "STRESSED" },
  "pattern": null,
  "context": null,
  "errors": []
}
```

## File Structure

```
mysoul_v6/
├── index.html              # Main app (upgraded with SOS + hints)
├── pages/
│   ├── onboarding.html     # ✨ NEW — Name Me screen
│   ├── auth.html           # ✨ NEW — Sign In / Register
│   ├── launcher.html       # MySoul OS launcher
│   └── ... (other pages unchanged)
├── scripts/
│   ├── soul-core.js        # ✨ UPGRADED — Full API + auth + distress detection
│   ├── voice.js            # ✨ UPGRADED — Added MediaRecorder backend voice
│   └── ... (other scripts unchanged)
├── styles/
│   └── enhancements.css    # ✨ UPGRADED — SOS overlay + hint bar styles
└── modules/
    └── soul-features.js    # Unchanged
```
