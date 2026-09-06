# Browser verification findings

## 2026-09-06

The FastAPI process at `http://127.0.0.1:8000/` served the MySoul AI index page with HTTP 200 and `text/html`. The repaired root page rendered the full app after its loader finished, including navigation, emotion panel, central orb, conversation panel, chat input, send button, voice controls, and floating feature buttons.

Static JavaScript was served successfully from `/scripts/soul-core.js` with HTTP 200 and JavaScript content type. The visible chat input is `#chatInput`, the send control is `#sendBtn`, and the conversation container is present. The frontend was served by the same backend process, confirming the static mount works for the main app.

Backend smoke tests also returned HTTP 200 for `/health` and `/api/auth/setup`. The compatibility route inventory includes `/api/chat`, `/api/chat/voice`, `/api/alerts/family`, `/api/auth/setup`, `/api/auth/login`, `/api/auth/register`, and Google OAuth placeholder routes. The LLM health status was `down` for OpenRouter and Ollama in the sandbox, but the chat API still returned a graceful in-character response rather than an error.

## Chat flow verification

A real message was entered into `#chatInput` and submitted with Enter. The UI showed the user bubble, a temporary responding indicator, then rendered the complete assistant response from the backend in the conversation panel. The response was:

> I'm having trouble reaching my thinking right now, but I'm still here with you. Can we try again in a moment?

The same rendered response displayed the backend-derived emotion label `CALM`, intensity `LOW`, updated the emotion orb/timeline, and populated the contextual hint bar. This confirms the frontend-to-backend request and backend-to-frontend response display path works in the browser, including graceful LLM-provider fallback behavior.

## Authentication verification

The backend-served `/pages/auth.html` loaded successfully with sign-in, account creation, Google sign-in, setup, and skip-to-app controls visible. All local page and asset references across the full HTML tree resolved with HTTP 200.

The first register smoke test exposed a real dependency issue: `passlib==1.7.4` with unpinned `bcrypt==5.0.0` caused HTTP 500 during password hashing. The dependency is now pinned to `bcrypt==4.0.1`, the backend was restarted, and final registration plus login tests both returned HTTP 200 with a JWT response.
