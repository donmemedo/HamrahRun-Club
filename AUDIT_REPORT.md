# HamrahRun Club: security, performance and UX audit

Date: 2026-10-08. Scope: `backend/main.py`, the Next.js app in `frontend/`, Dockerfiles and `docker-compose.yml`.
The findings come from a code-reading audit of the original MVP, static analysis, dependency audits and a four-lens review workflow. Every fix below is covered by a test or a build check.

## What was not done

A safety check stopped two parts of the request, and they were skipped as instructed.

- **Offensive red-team work and live pen-testing** of the fixed build. This covers the red-team tactics and tools skills and the attack-tree construction.
- **The security lens of the final review workflow.** Security instead rests on the fixes below, their regression tests, bandit, pip-audit and npm audit.

The controls are verified by tests that assert the defended behaviour, for example a rate-limited request gets a 429 and an expired session gets a 401.

## Results at a glance

| Check | Result |
|---|---|
| Backend tests (`pytest`) | 15 pass. The original suite had 1 test. |
| Frontend redirect test (`npm test`) | pass |
| TypeScript (`tsc --noEmit`) and `next build` | pass |
| `npm audit` (production deps) | 0 vulnerabilities, after Next 16.3.6 → 16.4.0 and `npm audit fix` |
| `pip-audit` on pinned requirements | no known vulnerabilities |
| bandit | 2 low-risk notes, both reviewed below |

## Security fixes

| # | Finding | Fix | Test |
|---|---|---|---|
| S1 | Login codes were returned in the API response by default. | `ENV=dev\|prod`. The demo code is on only in dev, and the API refuses to start in prod with it on. | `test_prod_refuses_demo_otp_and_hides_docs`, `test_demo_code_hidden_when_disabled` |
| S2 | Plans activated with no payment. | The payment simulator is behind `PAYMENT_SIMULATOR`, off in prod. With it off, pay returns `503 gateway_unavailable`. | `test_pay_needs_simulator` |
| S3 | The wrong-code counter reset on every resend, with no rate limit. | 6-digit codes stored as a SHA-256 hash. A per-phone attempt budget survives resends. Resends have a 60 s cooldown and an hourly cap, plus a per-IP breaker. 429 responses carry `Retry-After`. | `test_wrong_code_budget_survives_resend`, `test_otp_resend_cooldown_and_hourly_cap` |
| S4 | `backend/data.db`, with a real phone number and live sessions, was committed. | Removed from the index; `*.db` is ignored. Git history still contains it. | — |
| S5 | Sessions never expired and were stored in plaintext. | Tokens are stored as SHA-256 hashes with a 30-day expiry. Expired rows are pruned at login, and a stale cookie is cleared on 401. | `test_plan_expiry_and_session_expiry` |
| S6 | No rate limiting; the OTP map grew without bound. | In-memory sliding-window limiter with lazy eviction, and the OTP map is pruned past 50k entries. | as S3 |
| S7 | Session token in `localStorage`, and no CSP. | HttpOnly, SameSite=Lax `hr_session` cookie; JavaScript never sees the token. Per-request CSP nonce via `proxy.ts`. | `test_login_sets_httponly_cookie_and_never_returns_the_token` |
| S8 | The post-login `next` parameter allowed off-site redirects. | `lib/safe-next.ts` parses with the URL parser and keeps same-origin paths only. Leading slashes are collapsed so a path cannot become protocol-relative. | `lib/safe-next.test.ts` |
| S9 | Unlimited redemptions inflated savings and the public stats. | One code per deal per member per 30 days. The check and insert run in one `BEGIN IMMEDIATE` transaction. | `test_redeem_requires_plan_and_is_once_per_month` |
| S10 | Rescue needed no membership and had no limit. | Members only, 3 per rolling year, race-safe. The UI shows the remaining quota. | `test_assist_requires_plan_and_caps_per_year` |
| S11 | Plans never expired. | Expiry is computed from `since` plus the period and enforced on every request. `/me` returns `plan_expires`. | `test_plan_expiry_and_session_expiry` |
| S12 | CORS allowed `*`. | No CORS unless `CORS_ORIGINS` is set; the web app is same-origin through `/api`. | — |
| S13 | No security headers; `X-Powered-By` was sent. | CSP (nonce, `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`), nosniff, `X-Frame-Options`, Referrer-Policy, Permissions-Policy, COOP, and HSTS on HTTPS. `poweredByHeader: false`. The API adds nosniff and `Cache-Control: no-store`. | `test_public_endpoints_and_headers` |
| S14 | `/docs` was public and the API port was published. | Docs are dev only. Compose uses `expose`, so the API is reachable only from the frontend container. | `test_prod_refuses_demo_otp_and_hides_docs` |
| S15 | Unpinned dependencies, unused extras, containers running as root. | Three pinned direct dependencies (the `[standard]` extra is gone). Both images run as a non-root user, with memory limits in compose. | pip-audit |
| S16 | A non-ASCII code returned 500. | Codes are normalised from Persian and Arabic-Indic digits, then must be exactly 6 ASCII digits, else 400. | `test_non_ascii_or_malformed_code_is_400_not_500` |
| S17 | Whitespace passed `min_length`. | Strip-then-validate string types on every input model, plus `extra="forbid"`. | `test_profile_and_listing_validation` |
| S18 | Absurd listing years were accepted. | Year bounds derived from the current Jalali year. | `test_profile_and_listing_validation` |
| S19 | Odd `Authorization` header parsing. | Bearer auth is gone; only the cookie authenticates. | `test_csrf_and_body_limits` |
| new | CSRF exposure once auth moved to a cookie. | SameSite=Lax, plus the API rejects state-changing requests with `Sec-Fetch-Site: cross-site`. | `test_csrf_and_body_limits` |
| new | Unbounded request bodies. | 64 KB cap returns 413. | `test_csrf_and_body_limits` |

### Static analysis notes

- bandit B608 at the `update_me` query: the column names come only from `ProfileIn` fields, and `extra="forbid"` rejects any other key. Values are bound parameters. Not exploitable; left as is with a comment.
- bandit B311 at `random.randint` for the rescue ETA: a placeholder number, not a security value.

### Known limits

- The per-IP rate limit reads `X-Forwarded-For`. Next forwards a client-sent value unchanged, so the limit is only trustworthy behind an edge proxy that overwrites the header (documented in the README). The per-phone limits do not depend on it.
- Limits and pending codes live in process memory, so the API runs one worker. Redis is the upgrade path.
- `backend/data.db` remains in git history. Removing it needs a history rewrite and a force-push, which is your call.

## Functional fixes

| # | Bug | Fix |
|---|---|---|
| F1 | Choosing a plan called a missing `/api/subscribe` endpoint and failed silently. | Real flow: a confirmation sheet with plan, period, vehicles and amount, then checkout, pay, success with a reference. Landing-page plan buttons deep-link into it. |
| F2 | The dashboard always showed «دنا پلاس» in Persian. | Shows the member's car. Car, odometer and name are editable, with save feedback. |
| F3 | "Request a viewing" only flipped local state. | Calls `POST /api/cars/{id}/visit` and sends logged-out users to login. Shows busy, done and error states. |
| F4 | Errors were swallowed. | Every API error code maps to a Persian/English message. Lists show a retry state, and there are `error.tsx`, `not-found.tsx` and a dashboard `loading.tsx`. |
| F5 | Backend features had no UI, and the `Me` type had a field the API never returned. | Rescue history and quota, service "done" buttons, plan validity date. The type matches the API. Listing creation still has no UI. |
| F6 | The calculator hardcoded the Plus price and the footer hardcoded the year. | The price comes from `/api/plans` and the year from `Intl` in the active calendar. |

## Performance

| # | Change | Effect |
|---|---|---|
| P1 | One SQLite connection per worker thread, WAL, `synchronous=NORMAL`, busy timeout | No connect per request; readers no longer block the writer. |
| P2 | Indexes on every `user_id` lookup path | `/me` and the limit checks use index seeks. |
| P3 | `DEALS_BY_ID`, `PLANS_BY_ID` and `CAR_IDS` lookups; `/me` lists are capped | No linear scans per row. |
| P4 | `/api/stats` cached for 60 s; catalog endpoints send `Cache-Control: public` | The public stats query runs at most once a minute. |
| P5 | Security work stays cheap | SHA-256 for tokens and codes, an in-memory sliding window, lazy eviction. No bcrypt on the hot path. |
| P6 | Slim pinned deps, non-root images, memory limits | Smaller image and attack surface. |
| P7 | Pages fetch catalog data on the server, cached for 5 minutes | Content is in the first HTML. The landing page no longer makes 4 requests after hydration, and the stats row no longer jumps. |
| P8 | Hero backdrop: three 55vmax circles with `blur(90px)` animated forever, now static radial gradients | Removes continuous full-screen filter repaints on mid-range Android. |
| P9 | Reveal, hero and card glows use opacity and transform only. The gradient-shine and float loops are gone. CountUp writes to the text node. | Compositor-only motion, and no React render per animation frame. |
| P10 | Inter (1.9 MB across subsets) removed. One 46 KB Vazirmatn variable file, self-hosted and preloaded by `next/font`. Latin text uses the system font. | Less font weight and better fallback metrics, so less shift. |
| P11 | Member-card tilt reads its rect once, writes once per frame and is mouse-only | No forced layout per pointer move; touch scrolling is unaffected. |

## Apple-design UX pass

Based on the `apple-design` skill (WWDC "Designing Fluid Interfaces" and related talks).

- **Motion tokens.** A critically damped spring is the default everywhere through `MotionConfig`. Bounce is reserved for the drawer, using Apple's drawer values (damping about 0.8, response 0.3).
- **Sheet.** On phones it tracks the finger 1:1 from where it was grabbed and rubber-bands upward. The scrim dims with drag progress, and dismissal uses Apple's momentum projection, `(v/1000)·0.998/(1−0.998)`. On desktop it scales in and out along the same path. Focus is trapped and returned to the trigger; Escape closes it.
- **Reduced motion, transparency and contrast.** Springs drop transforms under `reducedMotion="user"`, and CSS entrances become short cross-fades. Glass turns solid under reduced transparency. Increased contrast strengthens secondary text and hairlines.
- **Accessibility.** The segmented control is a radiogroup with roving tabindex and RTL-aware arrow keys. Global focus-visible rings, 44 px touch targets for nav, toggles, chips and close buttons, a visible focus ring on the OTP boxes, `aria-current`, labelled progress bars, `role="alert"` on errors. Light-mode pink and green text now meet AA (5.3:1 and 5.1:1, up from 3.5:1 and 2.1:1).
- **Feedback and wayfinding.** Inline phone formatting and validation. The resend timer follows the server's `Retry-After`. Busy, success and error states on every action. Per-route titles, a back link on login, and 404 and error pages.
- **Typography.** Persian headings use looser leading (1.35) and Latin tracking stays off Persian text. Button heights and card radii are collapsed to a small set.
- **Copy.** New Persian strings follow the UX vocabulary guide, for example «نادرست» not «اشتباه», «کد تایید», «حساب کاربری», «مبلغ», «تایید».

## Review workflow results

REVIEW_RESULTS

## Knowledge graph (graphify)

GRAPHIFY_RESULTS

## Decisions for you

1. **Stats baselines.** `/api/stats` adds launch baselines to live counts (6,500 members, 4.87 billion toman saved, NPS 52). The partner count is now real. Should these be marked as targets or removed?
2. **Rescue for non-members.** Rescue is now members-only, matching the Plus promise of 3 free rescues a year. A paid rescue for non-members would be a product addition.
3. **Git history.** `backend/data.db` with one real phone number is still in history. Rewriting needs a force-push.
4. **Stray files.** The `.whl` files in the repo root are now ignored, not deleted. `frontend/AGENTS.md` and `frontend/CLAUDE.md` are generated by `next dev` and were left uncommitted.
5. **Next 16.4.0.** `npm install next@^16.3.8` resolved to the 16.4.0 minor release. It builds and audits clean; pin 16.3.8 if you prefer patch-only upgrades.
