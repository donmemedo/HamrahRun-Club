import os
import subprocess
import sys
import tempfile
import time

os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from main import app, normalize_phone  # noqa: E402

OTP = "/api/auth/otp"
VERIFY = "/api/auth/verify"
_n = [0]


@pytest.fixture(autouse=True)
def _isolate():
    main._hits.clear()
    main._otps.clear()
    yield


def phone():
    _n[0] += 1
    return f"0912{_n[0]:07d}"


def login(p=None):
    """A fresh client (own cookie jar) logged in as `p`."""
    c, p = TestClient(app), p or phone()
    code = c.post(OTP, json={"phone": p}).json()["demo_code"]
    assert c.post(VERIFY, json={"phone": p, "code": code}).status_code == 200
    return c


def buy(c, plan="plus", period="yearly"):
    co = c.post("/api/checkout", json={"plan": plan, "period": period}).json()
    assert c.post(f"/api/checkout/{co['id']}/pay").json()["ref"].startswith("ZP-")
    return co


def test_phone_normalization():
    assert normalize_phone("+98 912-345-6789") == "09123456789"
    assert normalize_phone("۰۹۱۲۳۴۵۶۷۸۹") == normalize_phone("٠٩١٢٣٤٥٦٧٨٩") == "09123456789"
    c = TestClient(app)
    assert c.post(OTP, json={"phone": "12345"}).status_code == 422
    assert c.post(OTP, json={"phone": "09123456789", "extra": 1}).status_code == 422  # extra="forbid"


def test_login_sets_httponly_cookie_and_never_returns_the_token():
    c, p = TestClient(app), phone()
    r = c.post(OTP, json={"phone": p}).json()
    assert len(r["demo_code"]) == 6 and r["ttl"] == 120
    v = c.post(VERIFY, json={"phone": p, "code": r["demo_code"]})
    assert v.json() == {"ok": True} and "token" not in v.text
    ck = v.headers["set-cookie"].lower()
    assert "hr_session=" in ck and "httponly" in ck and "samesite=lax" in ck and "path=/" in ck
    assert c.get("/api/me").status_code == 200
    assert TestClient(app).get("/api/me").status_code == 401  # no cookie
    assert c.post(VERIFY, json={"phone": p, "code": r["demo_code"]}).status_code == 400  # code is single-use
    c.post("/api/auth/logout")
    assert c.get("/api/me").status_code == 401  # session row gone and cookie cleared


def test_wrong_code_budget_survives_resend():
    c, p = TestClient(app), phone()
    code = c.post(OTP, json={"phone": p}).json()["demo_code"]
    bad = "000000" if code != "000000" else "111111"
    for _ in range(3):
        assert c.post(VERIFY, json={"phone": p, "code": bad}).status_code == 400
    main._hits.pop(f"otp:cooldown:{p}")  # pretend 60 s passed
    code = c.post(OTP, json={"phone": p}).json()["demo_code"]
    for _ in range(2):
        assert c.post(VERIFY, json={"phone": p, "code": bad}).status_code == 400
    r = c.post(VERIFY, json={"phone": p, "code": code})  # 6th attempt in 10 min, even the right one
    assert r.status_code == 429 and r.headers["retry-after"]


def test_otp_resend_cooldown_and_hourly_cap():
    c, p = TestClient(app), phone()
    assert c.post(OTP, json={"phone": p}).status_code == 200
    assert c.post(OTP, json={"phone": p}).status_code == 429  # 60 s cooldown
    for _ in range(4):
        main._hits.pop(f"otp:cooldown:{p}")
        assert c.post(OTP, json={"phone": p}).status_code == 200
    main._hits.pop(f"otp:cooldown:{p}")
    assert c.post(OTP, json={"phone": p}).status_code == 429  # 5 per hour


def test_non_ascii_or_malformed_code_is_400_not_500():
    c, p = TestClient(app), phone()
    c.post(OTP, json={"phone": p})
    for code in ("٠١٢٣٤٥", "۰۱۲۳۴۵", "ابجدهو", "12345", "12 345"):  # 5 probes: the sixth would be the 429 budget
        assert c.post(VERIFY, json={"phone": p, "code": code}).status_code == 400, code


def test_demo_code_hidden_when_disabled(monkeypatch):
    monkeypatch.setattr(main, "DEMO_OTP", False)
    assert "demo_code" not in TestClient(app).post(OTP, json={"phone": phone()}).json()


def test_prod_refuses_demo_otp_and_hides_docs():
    env = {**os.environ, "DB_PATH": tempfile.mktemp(suffix=".db"), "ENV": "prod"}
    r = subprocess.run([sys.executable, "-c", "import main"], env={**env, "DEMO_OTP": "1"}, capture_output=True, text=True)
    assert r.returncode and "DEMO_OTP" in r.stderr
    r = subprocess.run([sys.executable, "-c", "import main; print(main.app.docs_url, main.app.openapi_url, main.DEMO_OTP, main.PAYMENT_SIMULATOR, main.SECURE_COOKIE)"],
                       env=env, capture_output=True, text=True)
    assert r.stdout.strip() == "None None False False True", r.stderr
    assert TestClient(app).get("/docs").status_code == 200  # dev keeps them


def test_pay_needs_simulator(monkeypatch):
    c = login()
    co = c.post("/api/checkout", json={"plan": "plus"}).json()
    monkeypatch.setattr(main, "PAYMENT_SIMULATOR", False)
    assert c.post(f"/api/checkout/{co['id']}/pay").status_code == 503
    assert c.get("/api/me").json()["plan"] is None


def test_checkout_rules_and_no_idor_on_pay():
    a, b = login(), login()
    co = a.post("/api/checkout", json={"plan": "fleet", "period": "monthly", "vehicles": 50}).json()
    assert co["vehicles"] == 20 and co["amount"] == 120_000 * 20
    assert a.post("/api/checkout", json={"plan": "gold"}).status_code == 422
    assert a.post("/api/checkout", json={"plan": "plus", "period": "weekly"}).status_code == 422
    co = a.post("/api/checkout", json={"plan": "plus", "period": "yearly"}).json()
    assert co["amount"] == 3_200_000
    assert b.post(f"/api/checkout/{co['id']}/pay").status_code == 404  # not B's payment
    assert a.post(f"/api/checkout/{co['id']}/pay").json()["plan"] == "plus"
    assert a.post(f"/api/checkout/{co['id']}/pay").status_code == 404  # cannot pay twice
    me = a.get("/api/me").json()
    assert me["plan"] == "plus" and me["price"] == 3_200_000 and me["plan_expires"] > time.time() + 300 * 86400


def test_redeem_requires_plan_and_is_once_per_month():
    c = login()
    assert c.post("/api/deals/4/redeem").status_code == 402
    buy(c)
    assert c.post("/api/deals/4/redeem").json()["saved"] == 1_900_000
    assert c.post("/api/deals/4/redeem").status_code == 409
    assert c.post("/api/deals/99/redeem").status_code == 404
    assert c.post("/api/deals/1/redeem").status_code == 200
    me = c.get("/api/me").json()
    assert me["saved"] == 2_080_000 and 0 < me["payback"] < 1 and len(me["redemptions"]) == 2


def test_assist_requires_plan_and_caps_per_year():
    c = login()
    assert c.post("/api/assist", json={"kind": "tow"}).status_code == 402
    buy(c)
    assert c.post("/api/assist", json={"kind": "rocket"}).status_code == 422
    assert c.post("/api/assist", json={"kind": "tow", "note": "x" * 301}).status_code == 422
    for left in (2, 1, 0):
        r = c.post("/api/assist", json={"kind": "tow", "note": " " + "x" * 300 + " "}).json()
        assert r["eta"] >= 12 and r["left"] == left
    assert c.post("/api/assist", json={"kind": "tow"}).status_code == 429
    assert len(c.get("/api/me").json()["assists"]) == 3


def test_plan_expiry_and_session_expiry():
    c = login()
    buy(c, period="monthly")
    uid = main.db().execute("SELECT id FROM users WHERE plan='plus' ORDER BY id DESC").fetchone()[0]
    with main.db() as con:
        con.execute("UPDATE users SET since=? WHERE id=?", (time.time() - 32 * 86400, uid))
    assert c.get("/api/me").json()["plan"] is None
    assert c.post("/api/deals/1/redeem").status_code == 402
    with main.db() as con:
        con.execute("UPDATE sessions SET expires=? WHERE user_id=?", (time.time() - 1, uid))
    r = c.get("/api/me")
    assert r.status_code == 401 and "max-age=0" in r.headers["set-cookie"].lower()  # stale cookie cleared


def test_profile_and_listing_validation():
    c = login()
    assert c.put("/api/me", json={"car": "   "}).status_code == 422  # strip, then min_length
    assert c.put("/api/me", json={"car": "Tara", "km": 46000, "plan": "plus"}).status_code == 422  # extra field
    assert c.put("/api/me", json={"car": " Tara ", "km": 46000}).json()["ok"]
    assert c.post("/api/me/service/oil").json()["ok"]
    assert c.post("/api/me/service/wax").status_code == 404
    me = c.get("/api/me").json()
    assert me["car"] == "Tara" and me["reminders"][0]["due_km"] == 51000 and me["reminders"][1]["due_km"] == 50000
    assert c.post("/api/cars/2/visit").json()["ok"] and c.post("/api/cars/99/visit").status_code == 404
    L = {"model": "Pride", "km": 9, "price": 5, "city": "Tehran"}
    assert c.post("/api/listings", json={**L, "year": 1400}).status_code == 402
    buy(c)
    for bad in (1500, 1899, 2040, 1369, main.JALALI_YEAR + 3):
        assert c.post("/api/listings", json={**L, "year": bad}).status_code == 422, bad
    assert c.post("/api/listings", json={**L, "year": 2021}).json()["status"] == "pending"
    me = c.get("/api/me").json()
    assert me["visits"] == [2] and me["listings"][0]["year"] == 1400


def test_public_endpoints_and_headers():
    c = TestClient(app)
    assert len(c.get("/api/deals", params={"category": "insurance"}).json()) == 2
    assert len(c.get("/api/cars", params={"max_price": 800_000_000}).json()) == 2
    r = c.get("/api/plans")
    assert r.headers["cache-control"].startswith("public") and r.headers["x-content-type-options"] == "nosniff"
    assert c.get("/api/stats").json()["partners"] == 8  # distinct partner names, not a hardcoded 80
    c = login()
    assert c.get("/api/me").headers["cache-control"] == "no-store"
    assert c.post(VERIFY, json={"phone": "x"}).headers["cache-control"] == "no-store"


def test_csrf_and_body_limits():
    c = login()
    assert c.post("/api/cars/1/visit", headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert c.post("/api/cars/1/visit", headers={"sec-fetch-site": "same-origin"}).status_code == 200
    assert c.post("/api/assist", content=b"x" * 70_000, headers={"content-type": "application/json"}).status_code == 413
    assert c.get("/api/me", headers={"authorization": "Bearer nope"}).status_code == 200  # cookie wins, header ignored
    assert TestClient(app).get("/api/me", headers={"authorization": "Bearer nope"}).status_code == 401
