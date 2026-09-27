import os
import tempfile

os.environ["DB_PATH"] = tempfile.mktemp(suffix=".db")
from fastapi.testclient import TestClient  # noqa: E402

from main import app, normalize_phone  # noqa: E402

c = TestClient(app)


def test_flow():
    assert normalize_phone("+98 912-345-6789") == "09123456789"
    assert normalize_phone("۰۹۱۲۳۴۵۶۷۸۹") == "09123456789"
    assert c.post("/api/auth/otp", json={"phone": "12345"}).status_code == 422
    code = c.post("/api/auth/otp", json={"phone": "09123456789"}).json()["demo_code"]
    assert c.post("/api/auth/verify", json={"phone": "09123456789", "code": "0000" if code != "0000" else "1111"}).status_code == 400
    code = c.post("/api/auth/otp", json={"phone": "09123456789"}).json()["demo_code"]
    h = {"Authorization": "Bearer " + c.post("/api/auth/verify", json={"phone": "09123456789", "code": code}).json()["token"]}
    assert c.post("/api/deals/1/redeem", headers=h).status_code == 402
    assert c.post("/api/listings", json={"model": "Pride", "year": 1400, "km": 1, "price": 1, "city": "Tehran"}, headers=h).status_code == 402
    co = c.post("/api/checkout", json={"plan": "fleet", "period": "monthly", "vehicles": 50}, headers=h).json()
    assert co["vehicles"] == 20 and co["amount"] == 120_000 * 20  # fleet clamps to 2..20 vehicles
    co = c.post("/api/checkout", json={"plan": "plus", "period": "yearly"}, headers=h).json()
    assert co["amount"] == 3_200_000
    assert c.post(f"/api/checkout/{co['id']}/pay", headers=h).json()["ref"].startswith("ZP-")
    assert c.post(f"/api/checkout/{co['id']}/pay", headers=h).status_code == 404  # can't pay twice
    assert c.post("/api/deals/4/redeem", headers=h).json()["saved"] == 1_900_000
    me = c.get("/api/me", headers=h).json()
    assert me["saved"] == 1_900_000 and 0 < me["payback"] < 1 and me["reminders"][0]["due_km"] == 45000
    assert c.put("/api/me", json={"car": "Tara", "km": 46000}, headers=h).json()["ok"]
    assert c.post("/api/me/service/oil", headers=h).json()["ok"]
    assert c.post("/api/cars/2/visit", headers=h).json()["ok"] and c.post("/api/cars/99/visit", headers=h).status_code == 404
    lid = c.post("/api/listings", json={"model": "Pride", "year": 2021, "km": 9, "price": 5, "city": "Tehran"}, headers=h).json()
    me = c.get("/api/me", headers=h).json()
    assert me["car"] == "Tara" and me["reminders"][0]["due_km"] == 51000 and me["reminders"][1]["due_km"] == 50000
    assert me["visits"] == [2] and me["listings"][0]["year"] == 1400 and lid["status"] == "pending"
    assert c.post("/api/assist", json={"kind": "tow"}, headers=h).json()["eta"] >= 12
    assert len(c.get("/api/deals", params={"category": "insurance"}).json()) == 2
    assert c.get("/api/me").status_code == 401
    code = c.post("/api/auth/otp", json={"phone": "09120000000"}).json()["demo_code"]
    bad = "0000" if code != "0000" else "1111"
    for _ in range(5):
        c.post("/api/auth/verify", json={"phone": "09120000000", "code": bad})
    assert c.post("/api/auth/verify", json={"phone": "09120000000", "code": code}).status_code == 400
