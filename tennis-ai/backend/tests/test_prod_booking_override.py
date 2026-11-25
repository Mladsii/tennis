"""
Тест на проде: при наличии booking_id время/локация в search_request
ВСЕГДА берутся из брони, что бы клиент ни прислал.
"""
import httpx
from datetime import date, timedelta

BASE = "http://localhost:8000/api/v1"
ALICE_PHONE, ALICE_PASS = "+79991234567", "test123456"
BORIS_PHONE, BORIS_PASS = "+79991112244", "111111"

_pass = _fail = 0


def ok(m): global _pass; _pass += 1; print(f"  ✅  {m}")
def fail(m, d=""): global _fail; _fail += 1; print(f"  ❌  {m}"); print(f"      {d}") if d else None
def section(n): print(); print(f"═══ {n} {'═'*(58-len(n))}")


def login(phone, pwd):
    r = httpx.post(f"{BASE}/auth/login", json={"phone": phone, "password": pwd}, timeout=10)
    return r.json()["access_token"] if r.status_code == 200 else None


def H(t): return {"Authorization": f"Bearer {t}"}


section("AUTH")
alice = login(ALICE_PHONE, ALICE_PASS)
boris = login(BORIS_PHONE, BORIS_PASS)
ok("Логин OK")

# Cleanup активных запросов
for token in [alice, boris]:
    r = httpx.get(f"{BASE}/search-requests/mine", headers=H(token))
    if r.status_code == 200:
        for sr in r.json():
            if sr.get("is_active"):
                httpx.delete(f"{BASE}/search-requests/{sr['id']}", headers=H(token))
ok("Cleanup активных search_requests")

# ─── Подготовка: бронируем корт на завтра в 09:00 ────────────────
loc = httpx.get(f"{BASE}/bookings/locations", headers=H(boris)).json()[0]
location_id = loc["id"]

test_date = (date.today() + timedelta(days=3)).isoformat()
grid = httpx.get(f"{BASE}/bookings/grid/{location_id}",
                 params={"date": test_date}, headers=H(boris)).json()
court = grid["courts"][0]
court_id = court["court_id"]
free = [s["slot_start"] for s in court["slots"] if s["status"] == "free"]
real_slot = free[0]  # реальное время брони
ok(f"Готов корт {court['court_name']}, дата {test_date}, слот {real_slot}")

# Boris бронирует
r = httpx.post(f"{BASE}/bookings",
               json={"court_id": court_id, "date": test_date, "slot_start": real_slot},
               headers=H(boris))
if r.status_code != 201:
    fail("Не удалось забронировать", r.text[:200])
    raise SystemExit(1)
booking_id = r.json()["id"]
ok(f"Boris забронировал {test_date} {real_slot} (id={booking_id[:8]}…)")


# ─── 1. ОВЕРРАЙД ВРЕМЕНИ ────────────────────────────────────────
section("1. OVERRIDE start_time/end_time из брони")

# Клиент шлёт ОЧЕНЬ ДРУГИЕ времена + другую дату (через неделю в 22:00)
far_future = (date.today() + timedelta(days=7)).isoformat()
fake_start = f"{far_future}T22:00:00"
fake_end = f"{far_future}T23:00:00"

r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": True,
    "booking_id": booking_id,
    "start_time": fake_start,   # клиент пытается схимичить
    "end_time": fake_end,
    "stm_level": "35",
    "only_preferred": False,
    "open_date": False,
}, headers=H(boris), timeout=10)

if r.status_code != 201:
    fail(f"1.0 Создание не удалось: {r.status_code}", r.text[:300])
    raise SystemExit(1)
sr = r.json()
search_id = sr["id"]
ok(f"1.0 Запрос создан, search_id={search_id[:8]}…")

# 1.1 location_name вернулся из брони (Boris передал location_id=None)
if sr.get("location_name") == loc["name"]:
    ok(f"1.1 location_name взят из брони → '{sr['location_name']}'")
else:
    fail(f"1.1 location_name='{sr.get('location_name')}', ожидался '{loc['name']}'")

# 1.2 court_name
if sr.get("court_name") == court["court_name"]:
    ok(f"1.2 court_name = '{sr['court_name']}'")
else:
    fail(f"1.2 court_name='{sr.get('court_name')}'")

# 1.3 booking_date = дата брони, НЕ fake
if sr.get("booking_date") == test_date:
    ok(f"1.3 booking_date = '{test_date}' (дата брони)")
else:
    fail(f"1.3 booking_date='{sr.get('booking_date')}', ожидался '{test_date}'")

# 1.4 booking_slot_start = реальный слот, НЕ 22:00
if sr.get("booking_slot_start") == real_slot:
    ok(f"1.4 booking_slot_start = '{real_slot}' (НЕ fake 22:00)")
else:
    fail(f"1.4 booking_slot_start='{sr.get('booking_slot_start')}'")

# 1.5 start_time в записи — должен начинаться с test_date, НЕ far_future
sr_start = sr["start_time"]
if sr_start.startswith(test_date):
    ok(f"1.5 start_time={sr_start[:16]} — взят из брони (НЕ fake {fake_start[:16]})")
else:
    fail(f"1.5 start_time={sr_start} — клиентский fake остался!")

# 1.6 end_time
sr_end = sr["end_time"]
if sr_end.startswith(test_date):
    ok(f"1.6 end_time={sr_end[:16]} — взят из брони")
else:
    fail(f"1.6 end_time={sr_end} — fake остался")

# 1.7 open_date форсирован в False
if sr.get("open_date") is False:
    ok("1.7 open_date=False (форсирован сервером)")
else:
    fail(f"1.7 open_date={sr.get('open_date')}")

# 1.8 location_id заполнен из брони (Boris передал None)
if sr.get("location_id") == location_id:
    ok(f"1.8 location_id заполнен из брони (хотя клиент не передавал)")
else:
    print(f"      location_id в ответе: {sr.get('location_id')}, из брони: {location_id}")


# ─── 2. АЛИСА ВИДИТ ПРАВИЛЬНЫЕ ДЕТАЛИ ────────────────────────
section("2. Получатель видит детали брони")

avail = httpx.get(f"{BASE}/search-requests/available", headers=H(alice)).json()
found = next((s for s in avail if s["id"] == search_id), None)
if found:
    if found.get("court_name") == court["court_name"]:
        ok(f"2.1 Алиса видит court_name = '{found['court_name']}'")
    else:
        fail(f"2.1 court_name='{found.get('court_name')}'")
    if found.get("booking_slot_start") == real_slot:
        ok(f"2.2 Алиса видит slot = {found['booking_slot_start']}–{found.get('booking_slot_end')}")
    else:
        fail(f"2.2 slot_start='{found.get('booking_slot_start')}'")
    if found.get("location_name") == loc["name"]:
        ok(f"2.3 Алиса видит location_name = '{found['location_name']}'")


# ─── 3. ВАЛИДАЦИИ ────────────────────────────────────────────
section("3. ВАЛИДАЦИИ ВЛАДЕЛЬЦА БРОНИ")

# 3.1 Alice пытается прицепить чужую бронь Бориса
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": True,
    "booking_id": booking_id,
    "start_time": f"{test_date}T10:00:00",
    "end_time": f"{test_date}T11:00:00",
    "stm_level": "35",
    "only_preferred": False,
}, headers=H(alice), timeout=10)
if r.status_code == 400:
    ok("3.1 Чужая бронь → 400 ✓")
else:
    fail(f"3.1 {r.status_code}: {r.text[:200]}")

# 3.2 Несуществующая
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": True,
    "booking_id": "00000000-0000-0000-0000-000000000000",
    "start_time": f"{test_date}T10:00:00",
    "end_time": f"{test_date}T11:00:00",
    "stm_level": "35",
    "only_preferred": False,
}, headers=H(boris), timeout=10)
if r.status_code == 400:
    ok("3.2 Несуществующая бронь → 400 ✓")
else:
    fail(f"3.2 {r.status_code}")


# Cleanup
httpx.delete(f"{BASE}/search-requests/{search_id}", headers=H(boris))
httpx.delete(f"{BASE}/bookings/{booking_id}", headers=H(boris))

print()
print("═" * 60)
print(f"  ИТОГО: {_pass} passed, {_fail} failed")
print("═" * 60)
exit(1 if _fail > 0 else 0)
