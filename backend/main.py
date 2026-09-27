"""HamrahRun Club (VAB-Club Iran) API."""
import os
import random
import re
import secrets
import sqlite3
import time
from contextlib import closing
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = os.getenv("DB_PATH", "data.db")
DEMO_OTP = os.getenv("DEMO_OTP", "1") == "1"  # echo OTP in response until an SMS gateway is wired

app = FastAPI(title="HamrahRun Club API")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])


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

ASSIST_KINDS = {"tow", "battery", "tire", "fuel", "lockout"}
_otps: dict[str, list] = {}  # phone -> [code, expires_at, wrong_tries]  # ponytail: in-memory OTP store, single worker only; move to Redis when scaling


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


with closing(db()) as con:
    con.executescript("""
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, phone TEXT UNIQUE, name TEXT DEFAULT '',
        plan TEXT, period TEXT, since REAL, car TEXT DEFAULT 'Dena Plus', km INTEGER DEFAULT 42300);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER);
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
    """)


def normalize_phone(phone: str) -> str:
    phone = phone.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789"))
    phone = re.sub(r"[\s-]", "", phone)
    phone = re.sub(r"^(\+98|0098|98)", "0", phone)
    if not re.fullmatch(r"09\d{9}", phone):
        raise HTTPException(422, "invalid_phone")
    return phone


def current_user(authorization: str = Header("")):
    token = authorization.removeprefix("Bearer ").strip()
    with closing(db()) as con:
        row = con.execute("SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=?",
                          (token,)).fetchone()
    if not row:
        raise HTTPException(401, "unauthorized")
    return dict(row)


class PhoneIn(BaseModel):
    phone: str


class VerifyIn(PhoneIn):
    code: str


class CheckoutIn(BaseModel):
    plan: str
    period: Literal["monthly", "yearly"] = "yearly"
    vehicles: int = 1


class AssistIn(BaseModel):
    kind: str
    note: str = ""


class ProfileIn(BaseModel):
    name: str | None = Field(None, max_length=60)
    car: str | None = Field(None, min_length=2, max_length=60)
    km: int | None = Field(None, ge=0, le=2_000_000)


class ListingIn(BaseModel):
    model: str = Field(min_length=2, max_length=60)
    year: int = Field(ge=1360, le=2030)  # Jalali or Gregorian; normalized to Jalali
    km: int = Field(ge=0, le=2_000_000)
    price: int = Field(gt=0, le=100_000_000_000)
    city: str = Field(min_length=2, max_length=40)
    gearbox: Literal["auto", "manual"] = "auto"


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/stats")
def stats():
    with closing(db()) as con:
        users = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        saved = con.execute("SELECT COALESCE(SUM(saved),0) FROM redemptions").fetchone()[0]
    return {"members": 6_500 + users, "partners": 80, "cities": 2, "saved": 4_870_000_000 + saved, "nps": 52}


@app.get("/api/plans")
def plans():
    return PLANS


@app.get("/api/deals")
def deals(category: str | None = None, q: str = ""):
    q = q.strip().lower()
    return [d for d in DEALS if (not category or d["category"] == category)
            and (not q or q in (d["title"]["fa"] + d["title"]["en"] + d["partner"]["fa"] + d["partner"]["en"]).lower())]


@app.get("/api/cars")
def cars(max_price: int | None = None):
    return [c for c in CARS if not max_price or c["price"] <= max_price]


@app.post("/api/auth/otp")
def send_otp(body: PhoneIn):
    phone = normalize_phone(body.phone)
    code = f"{secrets.randbelow(10_000):04d}"
    _otps[phone] = [code, time.time() + 120, 0]
    return {"sent": True, "ttl": 120, **({"demo_code": code} if DEMO_OTP else {})}


@app.post("/api/auth/verify")
def verify(body: VerifyIn):
    phone = normalize_phone(body.phone)
    code = body.code.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789"))
    saved = _otps.get(phone)
    if not saved or saved[1] < time.time() or not secrets.compare_digest(saved[0], code):
        if saved:
            saved[2] += 1
            if saved[2] >= 5:  # 5 wrong guesses burn the code (4 digits = brute-forceable)
                del _otps[phone]
        raise HTTPException(400, "wrong_code")
    del _otps[phone]
    token = secrets.token_urlsafe(32)
    with closing(db()) as con, con:
        con.execute("INSERT OR IGNORE INTO users(phone) VALUES(?)", (phone,))
        uid = con.execute("SELECT id FROM users WHERE phone=?", (phone,)).fetchone()[0]
        con.execute("INSERT INTO sessions VALUES(?,?)", (token, uid))
    return {"token": token}


@app.post("/api/auth/logout")
def logout(authorization: str = Header("")):
    with closing(db()) as con, con:
        con.execute("DELETE FROM sessions WHERE token=?", (authorization.removeprefix("Bearer ").strip(),))
    return {"ok": True}


SERVICES = {"oil": (t("تعویض روغن موتور", "Engine oil change"), 5000),
            "filter": (t("فیلتر هوا و کابین", "Air & cabin filters"), 10000),
            "brake": (t("لنت ترمز", "Brake pads"), 30000)}


@app.get("/api/me")
def me(user=Depends(current_user)):
    uid = user["id"]
    with closing(db()) as con:
        rows = lambda sql: [dict(r) for r in con.execute(sql, (uid,))]  # noqa: E731
        reds = rows("SELECT * FROM redemptions WHERE user_id=? ORDER BY at DESC")
        assists = rows("SELECT * FROM assists WHERE user_id=? ORDER BY at DESC LIMIT 5")
        listings = rows("SELECT * FROM listings WHERE user_id=? ORDER BY at DESC")
        visits = [r["car_id"] for r in rows("SELECT car_id FROM visits WHERE user_id=?")]
        done = {r["kind"]: r["km"] for r in rows("SELECT kind, km FROM services WHERE user_id=?")}
        paid = rows("SELECT amount FROM payments WHERE user_id=? AND status='paid' ORDER BY at DESC LIMIT 1")
    price = paid[0]["amount"] if paid and user["plan"] else 0
    saved = sum(r["saved"] for r in reds)
    for r in reds:
        r["deal"] = next(d for d in DEALS if d["id"] == r["deal_id"])
    km = user["km"]
    reminders = [{"id": k, "title": title, "every": every,
                  "due_km": done[k] + every if k in done else (km // every + 1) * every}
                 for k, (title, every) in SERVICES.items()]
    return {**{k: user[k] for k in ("phone", "name", "plan", "period", "since", "car", "km")},
            "member_no": f"HR-{1402_0000 + uid}", "price": price, "saved": saved,
            "payback": min(1.0, saved / price) if price else 0, "redemptions": reds, "assists": assists,
            "reminders": reminders, "listings": listings, "visits": visits}


@app.put("/api/me")
def update_me(body: ProfileIn, user=Depends(current_user)):
    fields = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items() if v is not None}
    if fields:  # keys come from ProfileIn only, so the f-string is safe
        with closing(db()) as con, con:
            con.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?", (*fields.values(), user["id"]))
    return {"ok": True}


@app.post("/api/me/service/{kind}")
def service_done(kind: str, user=Depends(current_user)):
    if kind not in SERVICES:
        raise HTTPException(404, "not_found")
    with closing(db()) as con, con:
        con.execute("INSERT OR REPLACE INTO services VALUES(?,?,?)", (user["id"], kind, user["km"]))
    return {"ok": True}


@app.post("/api/checkout")
def checkout(body: CheckoutIn, user=Depends(current_user)):
    plan = next((p for p in PLANS if p["id"] == body.plan), None)
    if not plan:
        raise HTTPException(422, "invalid_plan")
    vehicles = min(max(body.vehicles, 2), 20) if plan.get("per_vehicle") else 1
    amount = plan[body.period] * vehicles
    with closing(db()) as con, con:
        cur = con.execute("INSERT INTO payments(user_id,plan,period,vehicles,amount,status,at) VALUES(?,?,?,?,?,'pending',?)",
                          (user["id"], plan["id"], body.period, vehicles, amount, time.time()))
    return {"id": cur.lastrowid, "amount": amount, "vehicles": vehicles}


@app.post("/api/checkout/{pid}/pay")
def pay(pid: int, user=Depends(current_user)):
    # ponytail: simulated gateway; the real flow redirects to Zarinpal/IDPay and verifies its callback here
    ref = f"ZP-{secrets.token_hex(4).upper()}"
    with closing(db()) as con, con:
        p = con.execute("SELECT * FROM payments WHERE id=? AND user_id=? AND status='pending'", (pid, user["id"])).fetchone()
        if not p:
            raise HTTPException(404, "not_found")
        con.execute("UPDATE payments SET status='paid', ref=? WHERE id=?", (ref, pid))
        con.execute("UPDATE users SET plan=?, period=?, since=? WHERE id=?", (p["plan"], p["period"], time.time(), user["id"]))
    return {"ref": ref}


@app.post("/api/deals/{deal_id}/redeem")
def redeem(deal_id: int, user=Depends(current_user)):
    deal = next((d for d in DEALS if d["id"] == deal_id), None)
    if not deal:
        raise HTTPException(404, "not_found")
    if not user["plan"]:
        raise HTTPException(402, "membership_required")
    code = f"HR-{secrets.token_hex(3).upper()}"
    with closing(db()) as con, con:
        con.execute("INSERT INTO redemptions(user_id,deal_id,code,saved,at) VALUES(?,?,?,?,?)",
                    (user["id"], deal_id, code, deal["saving"], time.time()))
    return {"code": code, "saved": deal["saving"]}


@app.post("/api/cars/{car_id}/visit")
def visit(car_id: int, user=Depends(current_user)):
    if not any(c["id"] == car_id for c in CARS):
        raise HTTPException(404, "not_found")
    with closing(db()) as con, con:
        con.execute("INSERT OR IGNORE INTO visits VALUES(?,?,?)", (user["id"], car_id, time.time()))
    return {"ok": True}


@app.post("/api/listings")
def create_listing(body: ListingIn, user=Depends(current_user)):
    if not user["plan"]:
        raise HTTPException(402, "membership_required")
    year = body.year - 621 if body.year >= 1900 else body.year
    # ponytail: stays 'pending' until inspected; approval belongs in the partner/admin panel
    with closing(db()) as con, con:
        cur = con.execute("INSERT INTO listings(user_id,model,year,km,price,city,gearbox,status,at) VALUES(?,?,?,?,?,?,?,'pending',?)",
                          (user["id"], body.model.strip(), year, body.km, body.price, body.city.strip(), body.gearbox, time.time()))
    return {"id": cur.lastrowid, "status": "pending"}


@app.post("/api/assist")
def assist(body: AssistIn, user=Depends(current_user)):
    if body.kind not in ASSIST_KINDS:
        raise HTTPException(422, "invalid_kind")
    eta = random.randint(12, 35)  # ponytail: fake ETA until dispatch partners expose a real one
    with closing(db()) as con, con:
        cur = con.execute("INSERT INTO assists(user_id,kind,note,eta,at) VALUES(?,?,?,?,?)",
                          (user["id"], body.kind, body.note[:300], eta, time.time()))
    return {"id": cur.lastrowid, "kind": body.kind, "eta": eta}
