"""HamrahRun Club (VAB-Club Iran) API."""
import hashlib
import os
import random
import re
import secrets
import sqlite3
import threading
import time
from collections import deque
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ENV = os.getenv("ENV", "dev")
DEV = ENV != "prod"
DB_PATH = os.getenv("DB_PATH", "data.db")
DEMO_OTP = os.getenv("DEMO_OTP", "1" if DEV else "0") == "1"  # echo the code in the response: dev only
PAYMENT_SIMULATOR = os.getenv("PAYMENT_SIMULATOR", "1" if DEV else "0") == "1"  # mark payments paid with no gateway: dev only
SECURE_COOKIE = os.getenv("SECURE_COOKIE", "0" if DEV else "1") == "1"
if not DEV and (DEMO_OTP or PAYMENT_SIMULATOR):
    raise RuntimeError("DEMO_OTP and PAYMENT_SIMULATOR must be 0 when ENV=prod")

OTP_TTL = 120
SESSION_TTL = 30 * 86400
PLAN_TTL = {"monthly": 31 * 86400, "yearly": 366 * 86400}
REDEEM_EVERY = 30 * 86400  # one code per deal per month
ASSISTS_PER_YEAR = 3
MAX_BODY = 64 * 1024
JALALI_YEAR = time.gmtime().tm_year - 621

app = FastAPI(title="HamrahRun Club API", docs_url="/docs" if DEV else None, redoc_url=None,
              openapi_url="/openapi.json" if DEV else None)
if os.getenv("CORS_ORIGINS"):  # the web app is same-origin through the Next proxy; CORS only for an explicit extra origin
    app.add_middleware(CORSMiddleware, allow_origins=os.environ["CORS_ORIGINS"].split(","), allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT"], allow_headers=["content-type", "authorization"])


@app.middleware("http")
async def harden(request: Request, call_next):
    if request.method in ("POST", "PUT", "DELETE"):
        if int(request.headers.get("content-length") or 0) > MAX_BODY:
            return JSONResponse({"detail": "payload_too_large"}, 413)
        if "hr_session" in request.cookies and request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "cross_site"}, 403)  # CSRF belt to SameSite=Lax's braces
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers.setdefault("Cache-Control", "no-store")
    return resp


def t(fa, en):
    return {"fa": fa, "en": en}


PLANS = [
    {"id": "standard", "name": t("استاندارد", "Standard"), "monthly": 150_000, "yearly": 1_600_000,
     "features": [t("تخفیف همه شرکا", "All partner discounts"), t("مشاوره فنی", "Technical advice"),
                  t("یادآور سرویس", "Service reminders"), t("راهنمای قیمت و نگهداری", "Price & maintenance guides")]},
    {"id": "plus", "name": t("پلاس", "Plus"), "monthly": 300_000, "yearly": 3_200_000, "popular": True,
     "features": [t("همه مزایای استاندارد", "Everything in Standard"), t("۳ امداد جاده‌ای رایگان در سال", "3 free roadside rescues / year"),
                  t("کارشناسی خودرو با تخفیف", "Discounted car inspection"), t("پشتیبانی با اولویت", "Priority support"),
                  t("ضمانت تجربه", "Experience guarantee")]},
    {"id": "fleet", "name": t("ناوگان", "Fleet"), "monthly": 120_000, "yearly": 1_300_000, "per_vehicle": True,
     "features": [t("۲ تا ۲۰ خودرو", "2 to 20 vehicles"), t("پیش‌خوان هزینه ناوگان", "Fleet cost dashboard"),
                  t("فاکتور رسمی", "Official invoices"), t("مدیر حساب اختصاصی", "Dedicated account manager")]},
]
PLANS_BY_ID = {p["id"]: p for p in PLANS}

CATEGORIES = ["fuel", "charge", "battery", "insurance", "wash", "rental", "repair", "tire"]

# (id, partner fa/en, category, title fa/en, discount %, avg saving toman, icon, color)
_DEALS = [
    (1, "سوخت‌رسان", "Sookhtresan", "fuel", "کارت سوخت اعضا", "Member fuel card", 7, 180_000, "fuel", "#ff9f0a"),
    (2, "ولت‌شارژ", "VoltCharge", "charge", "شارژ سریع خودرو برقی", "EV fast charging", 20, 95_000, "zap", "#30d158"),
    (3, "نیرو باتری", "Niroo Battery", "battery", "تعویض باتری در محل", "On-site battery swap", 15, 420_000, "battery-charging", "#0a84ff"),
    (4, "بیمه آرامش", "Aramesh Insurance", "insurance", "بیمه بدنه با تخفیف عضویت", "Body insurance member rate", 12, 1_900_000, "shield-check", "#5e5ce6"),
    (5, "بیمه آرامش", "Aramesh Insurance", "insurance", "بیمه شخص ثالث", "Third-party insurance", 5, 650_000, "shield", "#5e5ce6"),
    (6, "کارواش برق", "Bargh Carwash", "wash", "شست‌وشوی کامل + واکس", "Full wash + wax", 30, 210_000, "droplets", "#64d2ff"),
    (7, "رنت‌رو", "RentRo", "rental", "اجاره خودرو سفر", "Travel car rental", 18, 1_200_000, "car", "#bf5af2"),
    (8, "تعمیرگاه مهرگان", "Mehregan Garage", "repair", "سرویس دوره‌ای با قیمت شفاف", "Transparent periodic service", 15, 550_000, "wrench", "#ff375f"),
    (9, "تعمیرگاه مهرگان", "Mehregan Garage", "repair", "عیب‌یابی رایگان", "Free diagnostics", 100, 300_000, "scan-line", "#ff375f"),
    (10, "لاستیک پارس", "Pars Tire", "tire", "خرید لاستیک + بالانس رایگان", "Tires + free balancing", 10, 800_000, "circle-dot", "#ffd60a"),
    (11, "ولت‌شارژ", "VoltCharge", "charge", "نصب شارژر خانگی", "Home charger install", 25, 2_400_000, "plug-zap", "#30d158"),
    (12, "کارواش برق", "Bargh Carwash", "wash", "نانوسرامیک بدنه", "Nano-ceramic coating", 22, 1_600_000, "sparkles", "#64d2ff"),
]
DEALS = [{"id": i, "partner": t(pf, pe), "category": c, "title": t(tf, te), "discount": d, "saving": s,
          "icon": ic, "color": col, "rating": round(4.3 + (i % 7) / 10, 1)}
         for i, pf, pe, c, tf, te, d, s, ic, col in _DEALS]
DEALS_BY_ID = {d["id"]: d for d in DEALS}
PARTNERS = len({d["partner"]["en"] for d in DEALS})

# (id, model fa/en, jalali year, km, price toman, city fa/en, inspection score, gearbox, color)
_CARS = [
    (1, "پژو ۲۰۷ پانوراما", "Peugeot 207 Panorama", 1401, 38_000, 890_000_000, "تهران", "Tehran", 94, "auto", "#e5e5ea"),
    (2, "دنا پلاس توربو", "Dena Plus Turbo", 1402, 21_000, 1_050_000_000, "کرج", "Karaj", 91, "auto", "#1c1c1e"),
    (3, "تویوتا کرولا", "Toyota Corolla", 1397, 96_000, 2_300_000_000, "تهران", "Tehran", 88, "auto", "#8e8e93"),
    (4, "هیوندای توسان", "Hyundai Tucson", 1396, 120_000, 2_950_000_000, "تهران", "Tehran", 86, "auto", "#0a84ff"),
    (5, "شاهین G", "Shahin G", 1402, 14_000, 780_000_000, "کرج", "Karaj", 96, "manual", "#ff453a"),
    (6, "کیا اسپورتیج", "Kia Sportage", 1395, 138_000, 2_600_000_000, "تهران", "Tehran", 84, "auto", "#f2f2f7"),
    (7, "تارا اتوماتیک", "Tara Automatic", 1403, 6_000, 1_120_000_000, "تهران", "Tehran", 98, "auto", "#30d158"),
    (8, "رنو تندر ۹۰", "Renault Tondar 90", 1399, 74_000, 610_000_000, "کرج", "Karaj", 89, "manual", "#636366"),
]
CARS = [{"id": i, "model": t(mf, me), "year": y, "km": km, "price": p, "city": t(cf, ce), "score": sc,
         "gearbox": g, "color": col, "certified": True}
        for i, mf, me, y, km, p, cf, ce, sc, g, col in _CARS]
CAR_IDS = {c["id"] for c in CARS}

SERVICES = {"oil": (t("تعویض روغن موتور", "Engine oil change"), 5000),
            "filter": (t("فیلتر هوا و کابین", "Air & cabin filters"), 10000),
            "brake": (t("لنت ترمز", "Brake pads"), 30000)}

# ---------------------------------------------------------------------------- storage

_local = threading.local()


def db() -> sqlite3.Connection:
    """One connection per worker thread, WAL so readers never block the writer."""
    con = getattr(_local, "con", None)
    if con is None:
        con = _local.con = sqlite3.connect(DB_PATH, timeout=5)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA synchronous=NORMAL")
    return con


db().executescript("""
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, phone TEXT UNIQUE, name TEXT DEFAULT '',
    plan TEXT, period TEXT, since REAL, car TEXT DEFAULT 'Dena Plus', km INTEGER DEFAULT 42300);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, expires REAL);
CREATE TABLE IF NOT EXISTS redemptions(id INTEGER PRIMARY KEY, user_id INTEGER, deal_id INTEGER,
    code TEXT, saved INTEGER, at REAL);
CREATE TABLE IF NOT EXISTS assists(id INTEGER PRIMARY KEY, user_id INTEGER, kind TEXT, note TEXT,
    eta INTEGER, at REAL);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY, user_id INTEGER, plan TEXT, period TEXT,
    vehicles INTEGER, amount INTEGER, status TEXT, ref TEXT, at REAL);
CREATE TABLE IF NOT EXISTS listings(id INTEGER PRIMARY KEY, user_id INTEGER, model TEXT, year INTEGER,
    km INTEGER, price INTEGER, city TEXT, gearbox TEXT, status TEXT, at REAL);
CREATE TABLE IF NOT EXISTS visits(user_id INTEGER, car_id INTEGER, at REAL, PRIMARY KEY(user_id, car_id));
CREATE TABLE IF NOT EXISTS services(user_id INTEGER, kind TEXT, km INTEGER, PRIMARY KEY(user_id, kind));
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS redemptions_user ON redemptions(user_id, deal_id, at);
CREATE INDEX IF NOT EXISTS assists_user ON assists(user_id, at);
CREATE INDEX IF NOT EXISTS payments_user ON payments(user_id, status, at);
CREATE INDEX IF NOT EXISTS listings_user ON listings(user_id, at);
""")
if "expires" not in {r["name"] for r in db().execute("PRAGMA table_info(sessions)")}:
    db().execute("ALTER TABLE sessions ADD COLUMN expires REAL")  # pre-hash rows never match again, which is the point

# ---------------------------------------------------------------------------- auth plumbing

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_otps: dict[str, tuple[str, float]] = {}  # phone -> (sha256(phone:code), expires)  # ponytail: in-memory, single worker; Redis when scaling out
_hits: dict[str, deque] = {}  # ponytail: in-process sliding-window limiter; Redis when scaling out
_hits_lock = threading.Lock()


def throttle(key: str, limit: int, window: int):
    now = time.time()
    with _hits_lock:
        q = _hits.setdefault(key, deque())
        while q and q[0] <= now - window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, "too_many_requests", headers={"Retry-After": str(int(q[0] + window - now) + 1)})
        q.append(now)
        if len(_hits) > 50_000:  # lazy eviction keeps memory bounded under a key-spray
            for k in [k for k, v in _hits.items() if v[-1] < now - 3600]:
                del _hits[k]


def client_ip(request: Request) -> str:
    # Behind the Next proxy every request has the proxy's address, so read X-Forwarded-For. Next keeps a client-sent
    # XFF as is, so in production an edge proxy must overwrite it (nginx: proxy_set_header X-Forwarded-For $remote_addr).
    # Until then this key is spoofable: it is a soft breaker, and the per-phone limits are the real control.
    xff = request.headers.get("x-forwarded-for", "")
    return xff.split(",")[0].strip() or (request.client.host if request.client else "?")


def digest(*parts: str) -> str:
    return hashlib.sha256(":".join(parts).encode()).hexdigest()


def normalize_phone(phone: str) -> str:
    phone = re.sub(r"[\s-]", "", phone.translate(_DIGITS))
    phone = re.sub(r"^(\+98|0098|98)", "0", phone)
    if not re.fullmatch(r"09[0-9]{9}", phone):
        raise HTTPException(422, "invalid_phone")
    return phone


def set_session(response: Response, token: str | None):
    if token:
        response.set_cookie("hr_session", token, max_age=SESSION_TTL, httponly=True, samesite="lax", secure=SECURE_COOKIE, path="/")
    else:
        response.delete_cookie("hr_session", path="/")


def current_user(request: Request):
    token = request.cookies.get("hr_session", "")
    row = token and db().execute(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
        (digest(token), time.time())).fetchone()
    if not row:  # a stale cookie gets cleared so the web app stops showing a logged-in nav
        raise HTTPException(401, "unauthorized", headers={"Set-Cookie": "hr_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"} if token else None)
    user = dict(row)
    user["plan_expires"] = user["since"] + PLAN_TTL.get(user["period"], 0) if user["plan"] and user["since"] else None
    if user["plan_expires"] and user["plan_expires"] < time.time():
        user["plan"] = None
    return user

# ---------------------------------------------------------------------------- models


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_max_length=400)


def Str(lo: int, hi: int):  # noqa: N802 - strip, then validate, so whitespace cannot satisfy min_length
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=lo, max_length=hi)]


class PhoneIn(Strict):
    phone: Str(1, 20)


class VerifyIn(PhoneIn):
    code: Str(1, 10)


class CheckoutIn(Strict):
    plan: Literal["standard", "plus", "fleet"]
    period: Literal["monthly", "yearly"] = "yearly"
    vehicles: int = Field(1, ge=0, le=10_000)


class AssistIn(Strict):
    kind: Literal["tow", "battery", "tire", "fuel", "lockout"]
    note: Str(0, 300) = ""


class ProfileIn(Strict):
    name: Str(0, 60) | None = None
    car: Str(2, 60) | None = None
    km: int | None = Field(None, ge=0, le=2_000_000)


class ListingIn(Strict):
    model: Str(2, 60)
    year: int = Field(ge=1370, le=JALALI_YEAR + 622)  # Jalali or Gregorian; normalized to Jalali below
    km: int = Field(ge=0, le=2_000_000)
    price: int = Field(gt=0, le=100_000_000_000)
    city: Str(2, 40)
    gearbox: Literal["auto", "manual"] = "auto"

# ---------------------------------------------------------------------------- public


@app.get("/api/health")
def health():
    return {"ok": True}


@lru_cache(maxsize=1)
def _stats(bucket: int):  # bucket changes once a minute, so the COUNT/SUM run at most once a minute
    users = db().execute("SELECT COUNT(*) FROM users").fetchone()[0]
    saved = db().execute("SELECT COALESCE(SUM(saved),0) FROM redemptions").fetchone()[0]
    # Launch baselines, not live numbers: the marketing page adds them to the real counters. Product decision, flagged in the audit.
    return {"members": 6_500 + users, "partners": PARTNERS, "cities": 2, "saved": 4_870_000_000 + saved, "nps": 52}


@app.get("/api/stats")
def stats(response: Response):
    response.headers["Cache-Control"] = "public, max-age=60"
    return _stats(int(time.time() // 60))


@app.get("/api/plans")
def plans(response: Response):
    response.headers["Cache-Control"] = "public, max-age=300"
    return PLANS


@app.get("/api/deals")
def deals(response: Response, category: str | None = None, q: str = ""):
    response.headers["Cache-Control"] = "public, max-age=300"
    q = q.strip().lower()[:60]
    return [d for d in DEALS if (not category or d["category"] == category)
            and (not q or q in (d["title"]["fa"] + d["title"]["en"] + d["partner"]["fa"] + d["partner"]["en"]).lower())]


@app.get("/api/cars")
def cars(response: Response, max_price: int | None = None):
    response.headers["Cache-Control"] = "public, max-age=300"
    return [c for c in CARS if not max_price or c["price"] <= max_price]

# ---------------------------------------------------------------------------- auth


@app.post("/api/auth/otp")
def send_otp(body: PhoneIn, request: Request):
    phone = normalize_phone(body.phone)
    throttle(f"otp:ip:{client_ip(request)}", 60, 3600)  # breaker only: CGNAT makes IPs shared
    throttle(f"otp:cooldown:{phone}", 1, 60)
    throttle(f"otp:hour:{phone}", 5, 3600)
    code = f"{secrets.randbelow(1_000_000):06d}"
    _otps[phone] = (digest(phone, code), time.time() + OTP_TTL)
    if len(_otps) > 50_000:
        for k in [k for k, (_, exp) in _otps.items() if exp < time.time()]:
            del _otps[k]
    # ponytail: no SMS gateway yet; the send call goes here and DEMO_OTP goes away
    return {"sent": True, "ttl": OTP_TTL, **({"demo_code": code} if DEMO_OTP else {})}


@app.post("/api/auth/verify")
def verify(body: VerifyIn, request: Request, response: Response):
    phone = normalize_phone(body.phone)
    throttle(f"verify:ip:{client_ip(request)}", 120, 900)
    throttle(f"verify:phone:{phone}", 5, 600)  # 5 attempts per 10 min whatever happens to the code: resend does not reset it
    code = body.code.translate(_DIGITS)
    saved = _otps.get(phone)
    if not re.fullmatch(r"[0-9]{6}", code) or not saved or saved[1] < time.time() \
            or not secrets.compare_digest(saved[0], digest(phone, code)):
        raise HTTPException(400, "wrong_code")
    del _otps[phone]
    token = secrets.token_urlsafe(32)
    con = db()
    with con:
        con.execute("INSERT OR IGNORE INTO users(phone) VALUES(?)", (phone,))
        uid = con.execute("SELECT id FROM users WHERE phone=?", (phone,)).fetchone()[0]
        con.execute("INSERT INTO sessions VALUES(?,?,?)", (digest(token), uid, time.time() + SESSION_TTL))
        con.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
    set_session(response, token)
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("hr_session", "")
    if token:
        con = db()
        with con:
            con.execute("DELETE FROM sessions WHERE token=?", (digest(token),))
    set_session(response, None)
    return {"ok": True}

# ---------------------------------------------------------------------------- member


@app.get("/api/me")
def me(user=Depends(current_user)):
    uid, con = user["id"], db()
    rows = lambda sql: [dict(r) for r in con.execute(sql, (uid,))]  # noqa: E731
    reds = rows("SELECT * FROM redemptions WHERE user_id=? ORDER BY at DESC LIMIT 50")
    assists = rows("SELECT id, kind, eta, at FROM assists WHERE user_id=? ORDER BY at DESC LIMIT 5")
    listings = rows("SELECT * FROM listings WHERE user_id=? ORDER BY at DESC LIMIT 20")
    visits = [r["car_id"] for r in rows("SELECT car_id FROM visits WHERE user_id=?")]
    done = {r["kind"]: r["km"] for r in rows("SELECT kind, km FROM services WHERE user_id=?")}
    paid = rows("SELECT amount FROM payments WHERE user_id=? AND status='paid' ORDER BY at DESC LIMIT 1")
    price = paid[0]["amount"] if paid and user["plan"] else 0
    saved = sum(r["saved"] for r in reds)
    for r in reds:
        r["deal"] = DEALS_BY_ID[r["deal_id"]]
    km = user["km"]
    reminders = [{"id": k, "title": title, "every": every,
                  "due_km": done[k] + every if k in done else (km // every + 1) * every}
                 for k, (title, every) in SERVICES.items()]
    return {**{k: user[k] for k in ("phone", "name", "plan", "period", "since", "plan_expires", "car", "km")},
            "member_no": f"HR-{1402_0000 + uid}", "price": price, "saved": saved,
            "payback": min(1.0, saved / price) if price else 0, "redemptions": reds, "assists": assists,
            "reminders": reminders, "listings": listings, "visits": visits}


@app.put("/api/me")
def update_me(body: ProfileIn, user=Depends(current_user)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields:  # keys come from ProfileIn only (extra="forbid"), so the f-string is safe
        con = db()
        with con:
            con.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?", (*fields.values(), user["id"]))
    return {"ok": True}


@app.post("/api/me/service/{kind}")
def service_done(kind: str, user=Depends(current_user)):
    if kind not in SERVICES:
        raise HTTPException(404, "not_found")
    con = db()
    with con:
        con.execute("INSERT OR REPLACE INTO services VALUES(?,?,?)", (user["id"], kind, user["km"]))
    return {"ok": True}


@app.post("/api/checkout")
def checkout(body: CheckoutIn, user=Depends(current_user)):
    throttle(f"checkout:{user['id']}", 10, 3600)
    plan = PLANS_BY_ID[body.plan]
    vehicles = min(max(body.vehicles, 2), 20) if plan.get("per_vehicle") else 1
    amount = plan[body.period] * vehicles
    con = db()
    with con:
        cur = con.execute("INSERT INTO payments(user_id,plan,period,vehicles,amount,status,at) VALUES(?,?,?,?,?,'pending',?)",
                          (user["id"], plan["id"], body.period, vehicles, amount, time.time()))
    return {"id": cur.lastrowid, "amount": amount, "vehicles": vehicles, "plan": plan["id"], "period": body.period}


@app.post("/api/checkout/{pid}/pay")
def pay(pid: int, user=Depends(current_user)):
    # ponytail: simulated gateway, dev only; the real flow redirects to Zarinpal/IDPay and verifies its callback here
    if not PAYMENT_SIMULATOR:
        raise HTTPException(503, "gateway_unavailable")
    ref = f"ZP-{secrets.token_hex(4).upper()}"
    con = db()
    with con:
        p = con.execute("SELECT * FROM payments WHERE id=? AND user_id=? AND status='pending'", (pid, user["id"])).fetchone()
        if not p:
            raise HTTPException(404, "not_found")
        con.execute("UPDATE payments SET status='paid', ref=? WHERE id=?", (ref, pid))
        con.execute("UPDATE users SET plan=?, period=?, since=? WHERE id=?", (p["plan"], p["period"], time.time(), user["id"]))
    return {"ref": ref, "plan": p["plan"], "period": p["period"]}


@app.post("/api/deals/{deal_id}/redeem")
def redeem(deal_id: int, user=Depends(current_user)):
    deal = DEALS_BY_ID.get(deal_id)
    if not deal:
        raise HTTPException(404, "not_found")
    if not user["plan"]:
        raise HTTPException(402, "membership_required")
    con = db()
    with con:
        con.execute("BEGIN IMMEDIATE")  # lock before the check so two parallel requests cannot both pass it
        if con.execute("SELECT 1 FROM redemptions WHERE user_id=? AND deal_id=? AND at>?",
                       (user["id"], deal_id, time.time() - REDEEM_EVERY)).fetchone():
            raise HTTPException(409, "already_redeemed")
        code = f"HR-{secrets.token_hex(3).upper()}"
        con.execute("INSERT INTO redemptions(user_id,deal_id,code,saved,at) VALUES(?,?,?,?,?)",
                    (user["id"], deal_id, code, deal["saving"], time.time()))
    return {"code": code, "saved": deal["saving"]}


@app.post("/api/cars/{car_id}/visit")
def visit(car_id: int, user=Depends(current_user)):
    if car_id not in CAR_IDS:
        raise HTTPException(404, "not_found")
    con = db()
    with con:
        con.execute("INSERT OR IGNORE INTO visits VALUES(?,?,?)", (user["id"], car_id, time.time()))
    return {"ok": True}


@app.post("/api/listings")
def create_listing(body: ListingIn, user=Depends(current_user)):
    if not user["plan"]:
        raise HTTPException(402, "membership_required")
    throttle(f"listing:{user['id']}", 5, 86400)
    year = body.year - 621 if body.year >= 1900 else body.year
    if not 1370 <= year <= JALALI_YEAR + 1:
        raise HTTPException(422, "invalid_year")
    # ponytail: stays 'pending' until inspected; approval belongs in the partner/admin panel
    con = db()
    with con:
        cur = con.execute("INSERT INTO listings(user_id,model,year,km,price,city,gearbox,status,at) VALUES(?,?,?,?,?,?,?,'pending',?)",
                          (user["id"], body.model, year, body.km, body.price, body.city, body.gearbox, time.time()))
    return {"id": cur.lastrowid, "status": "pending"}


@app.post("/api/assist")
def assist(body: AssistIn, user=Depends(current_user)):
    if not user["plan"]:
        raise HTTPException(402, "membership_required")
    con = db()
    with con:
        con.execute("BEGIN IMMEDIATE")
        used = con.execute("SELECT COUNT(*) FROM assists WHERE user_id=? AND at>?", (user["id"], time.time() - 365 * 86400)).fetchone()[0]
        if used >= ASSISTS_PER_YEAR:
            raise HTTPException(429, "assist_limit")
        eta = random.randint(12, 35)  # ponytail: fake ETA until dispatch partners expose a real one
        cur = con.execute("INSERT INTO assists(user_id,kind,note,eta,at) VALUES(?,?,?,?,?)",
                          (user["id"], body.kind, body.note, eta, time.time()))
    return {"id": cur.lastrowid, "kind": body.kind, "eta": eta, "left": ASSISTS_PER_YEAR - used - 1}
