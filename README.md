# همراه‌ران · HamrahRun Club

The Iranian version of the VAB-Club model: a car-owner membership that bundles partner discounts, 24/7 roadside rescue, certified car inspections and resale, and one transparent price.

- `frontend/`: Next.js 16, Tailwind v4 and Motion. fa/en with RTL/LTR, light/dark with a circular View-Transition reveal, a mobile tab bar and a desktop glass nav. Pages render on the server with the catalog data already in the HTML; interactive parts are client views (`app/*/view.tsx`).
- `backend/`: FastAPI with SQLite. OTP login, plans, checkout, deals, redemptions, rescue requests and the member dashboard.

## Run

```bash
docker compose up --build        # web → http://localhost:3017 (the API is reached through /api on the same origin)
```

Dev mode:

```bash
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python -m uvicorn main:app --port 8017
cd frontend && npm install && BACKEND_URL=http://localhost:8017 npm run dev -- -p 3017
```

API docs are at `http://localhost:8017/docs` in dev only.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ENV` | `dev` | `prod` turns off API docs, flips the defaults below and refuses to start if `DEMO_OTP` or `PAYMENT_SIMULATOR` is on. |
| `DEMO_OTP` | `1` in dev, `0` in prod | Returns the login code in the response so it shows on screen. Turn off once an SMS gateway sends real codes. |
| `PAYMENT_SIMULATOR` | `1` in dev, `0` in prod | Marks a checkout paid without a gateway. With it off, paying returns `503 gateway_unavailable` until Zarinpal/IDPay is wired in `pay()`. |
| `SECURE_COOKIE` | `0` in dev, `1` in prod | Adds `Secure` to the session cookie. Must be `1` behind HTTPS. |
| `CORS_ORIGINS` | unset | Comma-separated extra origins. The web app does not need it because it calls the API through its own `/api` proxy. |
| `DB_PATH` | `data.db` | SQLite file. Runs in WAL mode. |
| `BACKEND_URL` (frontend) | `http://localhost:8000` | Where Next proxies `/api` and fetches the catalog on the server. |

### Production notes

- Put an HTTPS reverse proxy (nginx, Caddy) in front of the frontend and have it overwrite `X-Forwarded-For` with the client address (`proxy_set_header X-Forwarded-For $remote_addr;`). Next keeps a client-sent value, and the API's per-IP rate limit reads it.
- Run the API with one worker. Login codes and rate-limit counters live in process memory; move them to Redis before scaling out.

## How login and purchase work

1. Login: enter a `09xxxxxxxxx` number, receive a 6-digit code, verify. The API sets an HttpOnly `hr_session` cookie (30 days); no token is stored in JavaScript.
2. Choosing a plan opens a confirmation sheet with the plan, period, vehicle count (Fleet) and amount. Confirming calls `POST /api/checkout` and then `POST /api/checkout/{id}/pay`.
3. Plans expire after their period. Each deal can be redeemed once a month, and members get 3 free rescues a year.

## Test

```bash
cd backend && .venv/bin/pip install pytest httpx && .venv/bin/python -m pytest -q
cd frontend && npm test          # redirect-safety check
cd frontend && npx tsc --noEmit  # types
```

## Not built yet

- SMS gateway for login codes, and a real payment gateway with callback verification.
- UI for creating member listings (the API exists: `POST /api/listings`).
- PWA manifest and service worker, then APK/IPA via Capacitor. Safe-area insets and the tab bar are already in place.

See `AUDIT_REPORT.md` for the security, performance and UX audit behind the current code.
