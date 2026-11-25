"""
Comprehensive programmatic tests for booking features:
  - Payment status
  - Periodic bookings
  - 7-min slot lock
  - Reports
  - Grid new fields
"""
import time
import httpx

BASE = "http://127.0.0.1:8001/api/v1"

# ─── helpers ─────────────────────────────────────────────────────────────────

_pass = 0
_fail = 0
_errors: list[str] = []


def ok(name: str):
    global _pass
    _pass += 1
    print(f"  ✅  {name}")


def fail(name: str, detail: str = ""):
    global _fail
    _fail += 1
    msg = f"  ❌  {name}" + (f" — {detail}" if detail else "")
    _errors.append(msg)
    print(msg)


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        ok(name)
    else:
        fail(name, detail)


def login(phone: str, password: str) -> str:
    r = httpx.post(f"{BASE}/auth/login", json={"phone": phone, "password": password})
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text[:100]}"
    return r.json()["access_token"]


def hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─── Fixtures ─────────────────────────────────────────────────────────────────

print("\n═══ AUTH ═════════════════════════════════════════════")
tok_alice = login("+70001110001", "Alice1234")   # admin
tok_boris = login("+70001110002", "Boris1234")   # player
print("  Admin (Alice) and player (Boris) logged in")

# Get first location + first court
r = httpx.get(f"{BASE}/bookings/locations", headers=hdr(tok_alice))
assert r.status_code == 200 and r.json(), "No locations!"
loc_id = r.json()[0]["id"]
LOC_NAME = r.json()[0]["name"]

TEST_DATE_LOCK     = "2026-06-01"  # понедельник — для lock-тестов
TEST_DATE_PAY      = "2026-06-02"  # вторник — для payment_status
TEST_DATE_PERIODIC = "2026-06-08"  # понедельник — старт периодической серии
TEST_DATE_REPORT_S = "2026-06-01"
TEST_DATE_REPORT_E = "2026-06-30"
VALID_UNTIL        = "2026-06-29"  # конец периодической серии (4 понедельника: 8, 15, 22, 29)

# Get grid for lock date to find a free slot
def get_free_slot(date: str, court_idx: int = 0) -> tuple[str, str]:
    """Returns (court_id, slot_start) for first free slot on date."""
    r = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_alice), params={"date": date})
    assert r.status_code == 200
    court = r.json()["courts"][court_idx]
    slot = next((s for s in court["slots"] if s["status"] == "free"), None)
    assert slot, f"No free slot on {date} court {court_idx}"
    return court["court_id"], slot["slot_start"]


# ─── 1. Grid: new fields ──────────────────────────────────────────────────────

print("\n═══ 1. GRID NEW FIELDS ═══════════════════════════════")
r = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_alice), params={"date": TEST_DATE_LOCK})
check("Grid 200", r.status_code == 200)
if r.status_code == 200:
    grid = r.json()
    court = grid["courts"][0]
    slot0  = court["slots"][0]
    check("court.is_singles_only present",   "is_singles_only" in court)
    check("court.price_per_slot present",    "price_per_slot" in court)
    check("slot.payment_status present",     "payment_status" in slot0)
    check("slot.is_periodic present",        "is_periodic" in slot0)
    check("slot.locked_until present",       "locked_until" in slot0)
    check("slot.status is string",           isinstance(slot0["status"], str))
    check("slot.status value known",         slot0["status"] in {"free","booked","mine","locked","periodic","periodic_mine"})


# ─── 2. Slot Lock: basic ─────────────────────────────────────────────────────

print("\n═══ 2. SLOT LOCK ═════════════════════════════════════")
court_id, free_slot = get_free_slot(TEST_DATE_LOCK)

# 2a. Alice locks a slot
r = httpx.post(f"{BASE}/bookings/lock", headers=hdr(tok_alice), json={
    "court_id": court_id, "date": TEST_DATE_LOCK, "slot_start": free_slot
})
check("Lock slot → 201", r.status_code == 201, r.text[:100])
lock_id = None
if r.status_code == 201:
    lk = r.json()
    lock_id = lk["id"]
    check("Lock has expires_at",  "expires_at" in lk)
    check("Lock has court_id",    lk["court_id"] == court_id)
    check("Lock has slot_start",  lk["slot_start"] == free_slot)

    # 2b. Alice renews own lock → 200
    r2 = httpx.post(f"{BASE}/bookings/lock", headers=hdr(tok_alice), json={
        "court_id": court_id, "date": TEST_DATE_LOCK, "slot_start": free_slot
    })
    check("Renew own lock → 200", r2.status_code == 200, r2.text[:100])

    # 2c. Boris tries to lock same slot → 409
    r3 = httpx.post(f"{BASE}/bookings/lock", headers=hdr(tok_boris), json={
        "court_id": court_id, "date": TEST_DATE_LOCK, "slot_start": free_slot
    })
    check("Other user lock same slot → 409", r3.status_code == 409, r3.text[:100])

    # 2d. Grid shows slot as 'locked' for Boris
    r4 = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_boris), params={"date": TEST_DATE_LOCK})
    if r4.status_code == 200:
        target = next((s for c in r4.json()["courts"] for s in c["slots"]
                       if c["court_id"] == court_id and s["slot_start"] == free_slot), None)
        check("Grid shows 'locked' for other user", target is not None and target["status"] == "locked",
              f"status={target['status'] if target else 'N/A'}")
        check("locked_until filled for locked slot", target is not None and target["locked_until"] is not None)

    # 2e. Boris (player) tries to book slot locked by Alice → 409
    r5b = httpx.post(f"{BASE}/bookings", headers=hdr(tok_boris), json={
        "court_id": court_id, "date": TEST_DATE_LOCK, "slot_start": free_slot
    })
    check("Player cannot book slot locked by other → 409", r5b.status_code == 409, f"got {r5b.status_code}: {r5b.text[:80]}")

    # 2f. Unlock
    r6 = httpx.delete(f"{BASE}/bookings/lock/{lock_id}", headers=hdr(tok_alice))
    check("Unlock → 204", r6.status_code == 204, r6.text[:80])
    lock_id = None

    # 2g. Grid slot is free again
    r7 = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_boris), params={"date": TEST_DATE_LOCK})
    if r7.status_code == 200:
        target2 = next((s for c in r7.json()["courts"] for s in c["slots"]
                        if c["court_id"] == court_id and s["slot_start"] == free_slot), None)
        check("After unlock slot is free", target2 is not None and target2["status"] == "free",
              f"status={target2['status'] if target2 else 'N/A'}")

# Cleanup: if lock was not released
if lock_id:
    httpx.delete(f"{BASE}/bookings/lock/{lock_id}", headers=hdr(tok_alice))


# ─── 3. Payment status ────────────────────────────────────────────────────────

print("\n═══ 3. PAYMENT STATUS ════════════════════════════════")
court_id_pay, _ = get_free_slot(TEST_DATE_PAY)
r = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_alice), params={"date": TEST_DATE_PAY})
free_slots_pay = [s["slot_start"] for c in r.json()["courts"] for s in c["slots"]
                  if c["court_id"] == court_id_pay and s["status"] == "free"]

booked_ids_pay: list[str] = []
for pstatus, slot_t in zip(["unpaid", "cash", "card", "sbp"], free_slots_pay[:4]):
    r2 = httpx.post(f"{BASE}/bookings/admin", headers=hdr(tok_alice), json={
        "court_id": court_id_pay, "date": TEST_DATE_PAY,
        "slot_starts": [slot_t], "payment_status": pstatus
    })
    check(f"Admin book payment_status={pstatus} → 201", r2.status_code == 201, r2.text[:80])
    if r2.status_code == 201 and r2.json()["booked"]:
        b = r2.json()["booked"][0]
        check(f"  Response payment_status={pstatus}", b["payment_status"] == pstatus,
              f"got {b['payment_status']}")
        booked_ids_pay.append(b["id"])

# Verify payment_status visible in grid
r3 = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_alice), params={"date": TEST_DATE_PAY})
if r3.status_code == 200:
    grid_slots = {s["slot_start"]: s for c in r3.json()["courts"] for s in c["slots"]
                  if c["court_id"] == court_id_pay}
    for pstatus, slot_t in zip(["unpaid", "cash", "card", "sbp"], free_slots_pay[:4]):
        gs = grid_slots.get(slot_t)
        check(f"  Grid payment_status={pstatus} visible",
              gs is not None and gs.get("payment_status") == pstatus,
              f"got {gs.get('payment_status') if gs else 'N/A'}")

# Cleanup
for bid in booked_ids_pay:
    httpx.delete(f"{BASE}/bookings/{bid}", headers=hdr(tok_alice))


# ─── 4. Periodic bookings ─────────────────────────────────────────────────────

print("\n═══ 4. PERIODIC BOOKINGS ═════════════════════════════")
# Monday 8 Jun → Mondays: 8, 15, 22, 29 June = 4 instances
court_id_p, slot_p = get_free_slot(TEST_DATE_PERIODIC)

r = httpx.post(f"{BASE}/bookings/admin", headers=hdr(tok_alice), json={
    "court_id": court_id_p, "date": TEST_DATE_PERIODIC,
    "slot_starts": [slot_p],
    "payment_status": "cash",
    "is_periodic": True,
    "day_of_week": 0,          # Понедельник
    "valid_until": VALID_UNTIL
})
check("Periodic booking create → 201", r.status_code == 201, r.text[:100])
periodic_ids: list[str] = []
recurring_group_id = None

if r.status_code == 201:
    resp = r.json()
    check("4 instances booked (4 Mondays in Jun 8–29)", len(resp["booked"]) == 4,
          f"got {len(resp['booked'])}, failed={resp['failed']}")
    check("No failed slots", len(resp["failed"]) == 0, str(resp["failed"]))

    for b in resp["booked"]:
        check(f"  [{b['date']}] is_periodic=True",       b["is_periodic"] is True)
        check(f"  [{b['date']}] day_of_week=0",          b["day_of_week"] == 0)
        check(f"  [{b['date']}] payment_status=cash",    b["payment_status"] == "cash")
        check(f"  [{b['date']}] recurring_group_id set", b.get("recurring_group_id") is not None)
        periodic_ids.append(b["id"])

    # All share same recurring_group_id
    group_ids = {b["recurring_group_id"] for b in resp["booked"]}
    check("All share same recurring_group_id", len(group_ids) == 1, str(group_ids))
    recurring_group_id = list(group_ids)[0]

    # Grid shows 'periodic' status for these slots
    r2 = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_alice), params={"date": TEST_DATE_PERIODIC})
    if r2.status_code == 200:
        target = next((s for c in r2.json()["courts"] for s in c["slots"]
                       if c["court_id"] == court_id_p and s["slot_start"] == slot_p), None)
        check("Grid shows 'periodic' (admin owns)", target is not None and target["status"] in {"periodic", "periodic_mine"},
              f"status={target['status'] if target else 'N/A'}")
        check("Grid slot is_periodic=True", target is not None and target.get("is_periodic") is True)

    # Cancel single booking from series
    if len(periodic_ids) >= 2:
        r3 = httpx.delete(f"{BASE}/bookings/{periodic_ids[1]}", headers=hdr(tok_alice),
                          params={"cancel_series": False})
        check("Cancel single from series → 204", r3.status_code == 204, r3.text[:80])
        # verify only that one is gone
        r4 = httpx.get(f"{BASE}/bookings/player/{None}", headers=hdr(tok_alice))  # skip this
        periodic_ids.pop(1)

    # Cancel entire remaining series
    r5 = httpx.delete(f"{BASE}/bookings/{periodic_ids[0]}", headers=hdr(tok_alice),
                      params={"cancel_series": True})
    check("Cancel entire series → 204", r5.status_code == 204, r5.text[:80])

    # Verify all bookings in series are cancelled in DB
    # Повторная отмена уже отменённой брони → 400 (already cancelled) или 404 (not found)
    if r5.status_code == 204:
        still_active = 0
        for bid in periodic_ids:
            rr = httpx.delete(f"{BASE}/bookings/{bid}", headers=hdr(tok_alice))
            # 204 = была ещё активна (плохо), 400/404 = уже отменена (хорошо)
            if rr.status_code == 204:
                still_active += 1
        check("After cancel_series no bookings still active",
              still_active == 0,
              f"{still_active} booking(s) were not cancelled")


# ─── 5. Reports ───────────────────────────────────────────────────────────────

print("\n═══ 5. REPORTS ═══════════════════════════════════════")

# 5a. Non-admin gets 403
r = httpx.get(f"{BASE}/bookings/reports", headers=hdr(tok_boris),
              params={"location_id": loc_id, "date_from": "2026-06-01", "date_to": "2026-06-30"})
check("Non-admin reports → 403", r.status_code == 403, f"got {r.status_code}: {r.text[:80]}")

# 5b. Admin gets report
r = httpx.get(f"{BASE}/bookings/reports", headers=hdr(tok_alice),
              params={"location_id": loc_id, "date_from": TEST_DATE_REPORT_S, "date_to": TEST_DATE_REPORT_E})
check("Admin reports → 200", r.status_code == 200, r.text[:100])
if r.status_code == 200:
    rep = r.json()
    check("Report has location_name",    "location_name" in rep)
    check("Report has total_revenue",    "total_revenue" in rep)
    check("Report has total_bookings",   "total_bookings" in rep)
    check("Report has total_visitors",   "total_visitors" in rep)
    check("Report has avg_load_pct",     "avg_load_pct" in rep)
    check("Report has by_day list",      isinstance(rep.get("by_day"), list))
    check("Report date_from matches",    rep.get("date_from") == TEST_DATE_REPORT_S)
    check("Report date_to matches",      rep.get("date_to") == TEST_DATE_REPORT_E)
    if rep.get("by_day"):
        day0 = rep["by_day"][0]
        check("DayRevenue has date",           "date" in day0)
        check("DayRevenue has revenue",        "revenue" in day0)
        check("DayRevenue has bookings_count", "bookings_count" in day0)
        check("DayRevenue has unique_visitors","unique_visitors" in day0)
        check("DayRevenue has used_slots",     "used_slots" in day0)
        check("DayRevenue has free_slots",     "free_slots" in day0)
        check("DayRevenue has load_pct",       "load_pct" in day0)
        check("30 days in range",              len(rep["by_day"]) == 30, f"got {len(rep['by_day'])}")

# 5c. Create bookings with known prices, verify revenue
# Find a court with price_per_slot set
r = httpx.get(f"{BASE}/bookings/grid/{loc_id}", headers=hdr(tok_alice), params={"date": "2026-06-03"})
courts_with_price = [c for c in r.json().get("courts", []) if c.get("price_per_slot")]
if courts_with_price:
    c_price = courts_with_price[0]
    price = c_price["price_per_slot"]
    free_p = next((s for s in c_price["slots"] if s["status"] == "free"), None)
    if free_p:
        rb = httpx.post(f"{BASE}/bookings/admin", headers=hdr(tok_alice), json={
            "court_id": c_price["court_id"], "date": "2026-06-03",
            "slot_starts": [free_p["slot_start"]], "payment_status": "card"
        })
        if rb.status_code == 201 and rb.json()["booked"]:
            bid = rb.json()["booked"][0]["id"]
            # Get report for that specific day
            r2 = httpx.get(f"{BASE}/bookings/reports", headers=hdr(tok_alice),
                           params={"location_id": loc_id, "date_from": "2026-06-03", "date_to": "2026-06-03"})
            if r2.status_code == 200:
                day_data = r2.json()["by_day"][0] if r2.json()["by_day"] else {}
                check("Revenue matches price_per_slot * 1 booking",
                      abs(day_data.get("revenue", 0) - price) < 0.01,
                      f"expected {price}, got {day_data.get('revenue', 0)}")
            # Cleanup
            httpx.delete(f"{BASE}/bookings/{bid}", headers=hdr(tok_alice))
else:
    print("  ⚠️  No courts with price_per_slot — skipping revenue accuracy check")

# 5d. Invalid date range → 400 или 422
r = httpx.get(f"{BASE}/bookings/reports", headers=hdr(tok_alice),
              params={"location_id": loc_id, "date_from": "2026-06-30", "date_to": "2026-06-01"})
check("Report invalid date range → 4xx", r.status_code in (400, 422), f"got {r.status_code}: {r.text[:80]}")


# ─── 6. Edge cases ────────────────────────────────────────────────────────────

print("\n═══ 6. EDGE CASES ════════════════════════════════════")

# 6a. Admin books same slot twice → second in failed
court_e, slot_e = get_free_slot("2026-06-10")
r1 = httpx.post(f"{BASE}/bookings/admin", headers=hdr(tok_alice), json={
    "court_id": court_e, "date": "2026-06-10", "slot_starts": [slot_e]
})
check("First admin booking → 201", r1.status_code == 201)
bid_e = r1.json()["booked"][0]["id"] if r1.status_code == 201 and r1.json()["booked"] else None

r2 = httpx.post(f"{BASE}/bookings/admin", headers=hdr(tok_alice), json={
    "court_id": court_e, "date": "2026-06-10", "slot_starts": [slot_e]
})
check("Duplicate admin booking → slot in failed", r2.status_code == 201 and len(r2.json()["failed"]) > 0,
      f"status={r2.status_code}, failed={r2.json().get('failed')}")

if bid_e:
    httpx.delete(f"{BASE}/bookings/{bid_e}", headers=hdr(tok_alice))

# 6b. Player books then cancels own booking
r3 = httpx.post(f"{BASE}/bookings", headers=hdr(tok_boris), json={
    "court_id": court_e, "date": "2026-06-11", "slot_start": slot_e
})
check("Player books own slot → 201", r3.status_code == 201, r3.text[:80])
if r3.status_code == 201:
    pbid = r3.json()["id"]
    r4 = httpx.delete(f"{BASE}/bookings/{pbid}", headers=hdr(tok_boris))
    check("Player cancels own booking → 204", r4.status_code == 204, r4.text[:80])

# 6c. Cancel non-existent booking → 404
r5 = httpx.delete(f"{BASE}/bookings/00000000-0000-0000-0000-000000000000", headers=hdr(tok_alice))
check("Cancel non-existent booking → 404", r5.status_code == 404, r5.text[:80])

# 6d. Lock non-existent court → 404
r6 = httpx.post(f"{BASE}/bookings/lock", headers=hdr(tok_alice), json={
    "court_id": "00000000-0000-0000-0000-000000000000",
    "date": "2026-06-01", "slot_start": "10:00"
})
check("Lock non-existent court → 404", r6.status_code == 404, f"got {r6.status_code}: {r6.text[:80]}")

# 6e. Lock already-booked slot → 409
court_b, slot_b = get_free_slot("2026-06-12")
rb1 = httpx.post(f"{BASE}/bookings/admin", headers=hdr(tok_alice), json={
    "court_id": court_b, "date": "2026-06-12", "slot_starts": [slot_b]
})
if rb1.status_code == 201 and rb1.json()["booked"]:
    bid_b = rb1.json()["booked"][0]["id"]
    r6b = httpx.post(f"{BASE}/bookings/lock", headers=hdr(tok_alice), json={
        "court_id": court_b, "date": "2026-06-12", "slot_start": slot_b
    })
    check("Lock already-booked slot → 409", r6b.status_code == 409, f"got {r6b.status_code}: {r6b.text[:80]}")
    httpx.delete(f"{BASE}/bookings/{bid_b}", headers=hdr(tok_alice))

# 6e. Reports for non-existent location → 404
r7 = httpx.get(f"{BASE}/bookings/reports", headers=hdr(tok_alice),
               params={"location_id": "00000000-0000-0000-0000-000000000000",
                       "date_from": "2026-06-01", "date_to": "2026-06-30"})
check("Report non-existent location → 404", r7.status_code == 404, f"got {r7.status_code}: {r7.text[:80]}")


# ─── Summary ──────────────────────────────────────────────────────────────────

print(f"\n{'═'*54}")
print(f"  ИТОГО: {_pass} passed, {_fail} failed")
if _errors:
    print("\n  Failures:")
    for e in _errors:
        print(f"    {e}")
print(f"{'═'*54}\n")

exit(1 if _fail > 0 else 0)
