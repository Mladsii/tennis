"""
Тест на проде 185 — БЕЗ новых полей booking_id/court_name
(пока новый ZIP не задеплоен).

Проверяем что работает СЕЙЧАС:
  1. Очередь на корт (полный цикл)
  2. Поиск партнёра БЕЗ booking_id, базовый функционал
  3. only_preferred логика
"""
import time as time_mod
import httpx
from datetime import date, timedelta

BASE = "http://localhost:8000/api/v1"

ALICE_PHONE = "+79991234567"
ALICE_PASS = "test123456"
BORIS_PHONE = "+79991112244"      # Игрок2
BORIS_PASS = "111111"
THIRD_PHONE = "+79991112255"      # Игрок3
THIRD_PASS = "111111"

_pass = 0
_fail = 0
_warn = 0


def ok(m): global _pass; _pass += 1; print(f"  ✅  {m}")
def fail(m, d=""): global _fail; _fail += 1; print(f"  ❌  {m}"); print(f"      {d}") if d else None
def warn(m): global _warn; _warn += 1; print(f"  ⚠️   {m}")
def section(n): print(); print(f"═══ {n} {'═'*(58-len(n))}")


def login(phone, pwd):
    r = httpx.post(f"{BASE}/auth/login", json={"phone": phone, "password": pwd}, timeout=10)
    return r.json()["access_token"] if r.status_code == 200 else None


def H(t): return {"Authorization": f"Bearer {t}"}


# ─── AUTH ────────────────────────────────────────────────────
section("AUTH")
alice = login(ALICE_PHONE, ALICE_PASS)
boris = login(BORIS_PHONE, BORIS_PASS)
third = login(THIRD_PHONE, THIRD_PASS)
assert alice and boris and third, "login failed"
ok("Логин Alice/Boris/Third — OK")

alice_id = httpx.get(f"{BASE}/users/me", headers=H(alice)).json()["id"]
boris_id = httpx.get(f"{BASE}/users/me", headers=H(boris)).json()["id"]
third_id = httpx.get(f"{BASE}/users/me", headers=H(third)).json()["id"]

# Cleanup: deactivate existing active search requests of all users
for token, uid, name in [(alice, alice_id, "alice"), (boris, boris_id, "boris"), (third, third_id, "third")]:
    r = httpx.get(f"{BASE}/search-requests/mine", headers=H(token))
    if r.status_code == 200:
        for sr in r.json():
            if sr.get("is_active"):
                httpx.delete(f"{BASE}/search-requests/{sr['id']}", headers=H(token))
ok("Очистили активные search_requests у всех 3 юзеров")

# Cleanup: leave any queue entries
for token in [alice, boris, third]:
    q = httpx.get(f"{BASE}/queue/mine", headers=H(token)).json()
    for e in q:
        if isinstance(e, dict) and e.get("id"):
            httpx.delete(f"{BASE}/queue/{e['id']}", headers=H(token))
ok("Очистили очереди у всех 3 юзеров")

# Локация/корт
loc = httpx.get(f"{BASE}/bookings/locations", headers=H(alice)).json()[0]
location_id = loc["id"]
test_date = (date.today() + timedelta(days=4)).isoformat()
grid = httpx.get(f"{BASE}/bookings/grid/{location_id}", params={"date": test_date}, headers=H(alice)).json()
court_id = grid["courts"][0]["court_id"]
court_name = grid["courts"][0]["court_name"]
free_slots = [s["slot_start"] for s in grid["courts"][0]["slots"] if s["status"] == "free"]
ok(f"Локация={loc['name']}, корт={court_name}, дата={test_date}, своб. слотов={len(free_slots)}")


# ─── 1. ОЧЕРЕДЬ ─────────────────────────────────────────────
section("1. ОЧЕРЕДЬ НА КОРТ — полный сценарий")
slot1 = free_slots[0]

# 1.1 Алиса бронирует
r = httpx.post(f"{BASE}/bookings",
               json={"court_id": court_id, "date": test_date, "slot_start": slot1},
               headers=H(alice))
bk = r.json()
booking_id = bk["id"]
ok(f"1.1 Алиса забронировала {slot1}")

# 1.2 Борис встаёт в очередь
r = httpx.post(f"{BASE}/queue",
               json={"court_id": court_id, "date": test_date, "slot_start": slot1},
               headers=H(boris))
if r.status_code != 201:
    fail(f"1.2 POST queue {r.status_code}", r.text[:200])
    print("STOP — нет смысла продолжать тесты очереди")
    raise SystemExit(1)
qb = r.json()
ok(f"1.2 Борис встал в очередь: status={qb['status']}")

# 1.3 Третий встаёт после Бориса
time_mod.sleep(0.5)  # гарантируем разное created_at
r = httpx.post(f"{BASE}/queue",
               json={"court_id": court_id, "date": test_date, "slot_start": slot1},
               headers=H(third))
if r.status_code != 201:
    fail(f"1.3 POST queue Третий {r.status_code}", r.text[:200])
    raise SystemExit(1)
qt = r.json()
ok(f"1.3 Третий встал в очередь (после Бориса)")

# 1.4 Дубль
r = httpx.post(f"{BASE}/queue",
               json={"court_id": court_id, "date": test_date, "slot_start": slot1},
               headers=H(boris))
if r.status_code == 409: ok("1.4 Дубль очереди → 409 ✓")
else: fail(f"1.4 Ожидался 409, получили {r.status_code}")

# 1.5 Borisовы записи
my_q = httpx.get(f"{BASE}/queue/mine", headers=H(boris)).json()
if any(e["id"] == qb["id"] for e in my_q): ok("1.5 Борис видит свою запись в /queue/mine")
else: fail("1.5 запись не найдена")

# 1.6 Алиса отменяет бронь
r = httpx.delete(f"{BASE}/bookings/{booking_id}", headers=H(alice))
if r.status_code == 204: ok("1.6 Бронь отменена → 204")
else: fail(f"1.6 {r.status_code}")

time_mod.sleep(2)

# 1.7 Борис: уведомлён
my_q = httpx.get(f"{BASE}/queue/mine", headers=H(boris)).json()
b_entry = next((e for e in my_q if e["id"] == qb["id"]), None)
if b_entry and b_entry["status"] == "notified":
    ok("1.7 Борис → status=notified (FIFO) ✓")
else:
    fail(f"1.7 Борис status={b_entry['status'] if b_entry else None}")

# 1.8 Третий — всё ещё waiting
my_q3 = httpx.get(f"{BASE}/queue/mine", headers=H(third)).json()
t_entry = next((e for e in my_q3 if e["id"] == qt["id"]), None)
if t_entry and t_entry["status"] == "waiting":
    ok("1.8 Третий → status=waiting ✓")
else:
    fail(f"1.8 третий status={t_entry['status'] if t_entry else None}")

# 1.9 Push в feed у Бориса
feed = httpx.get(f"{BASE}/feed", headers=H(boris)).json()
ca = [n for n in feed if n["type"] == "court_available"]
if ca: ok(f"1.9 Push 'Корт освободился' пришёл Борису (×{len(ca)})")
else: warn("1.9 Push отсутствует в фиде")

# 1.10 Выход из очереди
httpx.delete(f"{BASE}/queue/{qb['id']}", headers=H(boris))
httpx.delete(f"{BASE}/queue/{qt['id']}", headers=H(third))
ok("1.10 Очередь очищена")


# ─── 2. ПОИСК ПАРТНЁРА (БЕЗ booking_id) ─────────────────────
section("2. ПОИСК ПАРТНЁРА — только preferred")

future = (date.today() + timedelta(days=5)).isoformat()

# Boris создаёт public-поиск (only_preferred=False)
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": False,
    "start_time": f"{future}T10:00:00",
    "end_time": f"{future}T11:00:00",
    "stm_level": "35",
    "only_preferred": False,
    "notes": "Test public",
}, headers=H(boris))
if r.status_code == 201:
    pub_id = r.json()["id"]
    ok(f"2.1 Boris создал public-поиск ({future} 10:00-11:00)")
else:
    fail(f"2.1 {r.status_code}", r.text[:200])
    pub_id = None

# Третий создаёт preferred-only поиск
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": False,
    "start_time": f"{future}T11:00:00",
    "end_time": f"{future}T12:00:00",
    "stm_level": "35",
    "only_preferred": True,
}, headers=H(third))
if r.status_code == 201:
    pref_id = r.json()["id"]
    ok(f"2.2 Третий создал only_preferred=True поиск")
else:
    fail(f"2.2 {r.status_code}", r.text[:200])
    pref_id = None

time_mod.sleep(1)

# 2.3 Видимость в /available у Алисы
avail = httpx.get(f"{BASE}/search-requests/available", headers=H(alice)).json()
sees_pub = any(s["id"] == pub_id for s in avail) if pub_id else False
sees_pref = any(s["id"] == pref_id for s in avail) if pref_id else False
if sees_pub: ok(f"2.3 Алиса видит public-поиск Бориса в /available")
else: warn(f"2.3 Алиса НЕ видит public — возможно автор {boris_id[:8]}… отфильтрован чем-то")
print(f"      Алиса видит preferred-поиск: {sees_pref}")

# 2.4 Уведомления Алисы
feed = httpx.get(f"{BASE}/feed", headers=H(alice)).json()
pushes_pub = [n for n in feed if n.get("reference_id") == pub_id]
pushes_pref = [n for n in feed if n.get("reference_id") == pref_id]
print(f"      Алисе пришло пушей: public={len(pushes_pub)}, preferred={len(pushes_pref)}")

if pushes_pub:
    ok("2.4 Алиса получила push о public-запросе ✓")

# Проверим что Третий не получил push для своего же запроса (логично)
feed3 = httpx.get(f"{BASE}/feed", headers=H(third)).json()
pref_for_self = [n for n in feed3 if n.get("reference_id") == pref_id]
if not pref_for_self:
    ok("2.5 Автор НЕ получает push о собственном запросе ✓")

# 2.6 Отклик Алисы на public-поиск Бориса
if pub_id:
    r = httpx.post(f"{BASE}/search-requests/{pub_id}/respond", headers=H(alice))
    if r.status_code == 201:
        resp_id = r.json()["id"]
        ok("2.6 Алиса откликнулась на поиск Бориса")
    else:
        fail(f"2.6 {r.status_code}")
        resp_id = None

    # Дубль отклика
    r = httpx.post(f"{BASE}/search-requests/{pub_id}/respond", headers=H(alice))
    if r.status_code == 400:
        ok("2.7 Дубль отклика → 400 ✓")
    else:
        fail(f"2.7 ожидался 400, получили {r.status_code}")

    # Boris видит отклик в детальном
    detail = httpx.get(f"{BASE}/search-requests/{pub_id}", headers=H(boris)).json()
    if detail.get("responses") and any(rr["id"] == resp_id for rr in detail["responses"]):
        ok("2.8 Борис видит отклик Алисы в детальном")
    else:
        fail("2.8 отклик не виден")

    # Boris подтверждает
    if resp_id:
        r = httpx.put(f"{BASE}/search-requests/{pub_id}/responses/{resp_id}/confirm",
                      headers=H(boris))
        if r.status_code == 200 and r.json()["status"] == "confirmed":
            ok("2.9 Borisподтвердил отклик → confirmed ✓")
        else:
            fail(f"2.9 {r.status_code}")


# 2.10 Boris пытается ответить на свой же поиск → 400
if pub_id:
    r = httpx.post(f"{BASE}/search-requests/{pub_id}/respond", headers=H(boris))
    if r.status_code == 400:
        ok("2.10 Ответ на свой же поиск → 400 ✓")
    else:
        fail(f"2.10 {r.status_code}")

# Cleanup
if pub_id: httpx.delete(f"{BASE}/search-requests/{pub_id}", headers=H(boris))
if pref_id: httpx.delete(f"{BASE}/search-requests/{pref_id}", headers=H(third))
ok("2.11 Поиски деактивированы")


# ─── 3. ВАЛИДАЦИИ ──────────────────────────────────────────
section("3. ВАЛИДАЦИИ")

# 3.1 Время в прошлом
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": False,
    "start_time": "2020-01-01T10:00:00",
    "end_time": "2020-01-01T11:00:00",
    "stm_level": "35",
}, headers=H(boris))
if r.status_code == 422:
    ok("3.1 Прошедшая дата → 422 ✓")
else:
    fail(f"3.1 ожидался 422, получили {r.status_code}", r.text[:200])

# 3.2 Минуты не 00/30
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": False,
    "start_time": f"{future}T10:15:00",
    "end_time": f"{future}T11:00:00",
    "stm_level": "35",
}, headers=H(boris))
if r.status_code == 422:
    ok("3.2 Минуты не 00/30 → 422 ✓")
else:
    fail(f"3.2 ожидался 422, получили {r.status_code}", r.text[:200])

# 3.3 End <= Start
r = httpx.post(f"{BASE}/search-requests", json={
    "game_type": "singles",
    "court_booked": False,
    "start_time": f"{future}T11:00:00",
    "end_time": f"{future}T10:00:00",
    "stm_level": "35",
}, headers=H(boris))
if r.status_code == 422:
    ok("3.3 End < Start → 422 ✓")
else:
    fail(f"3.3 {r.status_code}")


# ─── 4. БРОНИРОВАНИЕ + ОТВЕТНЫЕ СЛОТЫ ─────────────────────
section("4. БРОНИРОВАНИЕ — базовое")

# 4.1 Игрок (Boris) бронирует свой слот
slot_b = free_slots[1] if len(free_slots) > 1 else free_slots[0]
r = httpx.post(f"{BASE}/bookings",
               json={"court_id": court_id, "date": test_date, "slot_start": slot_b},
               headers=H(boris))
if r.status_code == 201:
    boris_booking_id = r.json()["id"]
    ok(f"4.1 Boris забронировал {slot_b}")
else:
    fail(f"4.1 {r.status_code}", r.text[:200])
    boris_booking_id = None

# 4.2 Слот занят
if boris_booking_id:
    r = httpx.post(f"{BASE}/bookings",
                   json={"court_id": court_id, "date": test_date, "slot_start": slot_b},
                   headers=H(third))
    if r.status_code == 409:
        ok("4.2 Слот занят → 409 ✓")
    else:
        fail(f"4.2 ожидался 409, получили {r.status_code}", r.text[:200])

# 4.3 /bookings/mine содержит бронь
if boris_booking_id:
    mine = httpx.get(f"{BASE}/bookings/mine", headers=H(boris)).json()
    found = any(b["id"] == boris_booking_id for b in mine)
    if found:
        ok("4.3 /bookings/mine содержит бронь Бориса")

    # 4.3 Cleanup
    httpx.delete(f"{BASE}/bookings/{boris_booking_id}", headers=H(boris))
    ok("4.4 Бронь Бориса отменена")


print()
print("═" * 60)
print(f"  ИТОГО: {_pass} passed, {_fail} failed, {_warn} warnings")
print("═" * 60)
exit(1 if _fail > 0 else 0)
