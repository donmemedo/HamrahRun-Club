# همراه‌ران · HamrahRun Club

The Iranian version of the VAB-Club model (see the PDFs in this folder): a car-owner membership that bundles partner discounts, 24/7 roadside rescue, certified car inspections and resale, and one transparent price.

- `frontend/`: Next.js 16, Tailwind v4 and Motion. fa/en with RTL/LTR, light/dark with a circular View-Transition reveal, a mobile tab bar and desktop glass nav.
- `backend/`: FastAPI with SQLite. OTP login, plans, deals, redemptions, rescue requests and the member dashboard.

## Run

```bash
docker compose up --build        # web → http://localhost:3017   api → http://localhost:8017/docs
```

Dev mode:

```bash
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn main:app --port 8017
cd frontend && npm install && BACKEND_URL=http://localhost:8017 npm run dev -- -p 3017
```

Test: `cd backend && .venv/bin/pip install pytest && .venv/bin/pytest -q`

Login uses any `09xxxxxxxxx` number. The OTP appears on screen while `DEMO_OTP=1`. Set it to `0` once an SMS gateway is wired.

## Not built yet
- Payment gateway: `/api/subscribe` activates the plan right away (see the `ponytail:` note in `backend/main.py`).
- PWA manifest and service worker, then APK/IPA via Capacitor wrapping this web app. Safe-area insets and the tab bar are already in place.
