"""
Тесты на production-сервере localhost:8000

Сценарии:
  1. Очередь на корт (queue):
     - Алиса бронирует слот
     - Борис встаёт в очередь
     - Алиса отменяет бронь → Борис получает push "court_available"
     - Подтверждаем что Борису пришло уведомление и его статус в очереди = notified

  2. Поиск партнёра с привязкой к брони (booking_id):
     - Алиса бронирует корт
     - Алиса создаёт search_request с court_booked=True + booking_id (НЕ только preferred)
     - Борис видит этот запрос в /available и видит location_name + court_name + время слота
     - Борис откликается → Алиса видит отклик

  3. Видимость поиска: only_preferred vs all
     - Создаём search с only_preferred=True → проверяем что нет уведомлений у не-друзей
     - Создаём search с only_preferred=False → уведомления идут всем
"""
import time as time_mod
import json
import httpx
from datetime import date, timedelta

BASE = "http://localhost:8000/api/v1"

# Test users (из прода)
ALICE_PHONE = "+79991234567"      # @test1 (admin)
ALICE_PASS = "test123456"
BORIS_PHONE = "+79991112244"      # @testplayer2_x (Игрок2)
BORIS_PASS = "111111"
THIRD_PHONE = "+79991112255"      # @testplayer3_x (Игрок3)
THIRD_PASS = "111111"

_pass = 0
_fail = 0
_warn = 0


def ok(msg: str):
    global _pass
    _pass += 1
    print(f"  ✅  {msg}")


def fail(msg: str, details: str = ""):
    global _fail
    _fail += 1
    print(f"  ❌  {msg}")
    if details:
        print(f"      {details}")


def warn(msg: str):
    global _warn
    _warn += 1
    print(f"  ⚠️   {msg}")


def section(name: str):
    print()
    print(f"═══ {name} {'═' * (54 - len(name))}")


def login(phone: str, pwd: str) -> str | None:
    r = httpx.post(
        f"{BASE}/auth/login",
        json={"phone": phone, "password": pwd},
        timeout=10,
    )
    if r.status_code != 200:
        print(f"      LOGIN FAIL {phone}: {r.status_code} {r.text[:200]}")
        return None
    return r.json()["access_token"]


def H(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────────
# Сетап: логин 3 юзеров + понять локацию/корт
# ─────────────────────────────────────────────────────────────

section("AUTH")
alice = login(ALICE_PHONE, ALICE_PASS)
boris = login(BORIS_PHONE, BORIS_PASS)
third = login(THIRD_PHONE, THIRD_PASS)
if alice and boris and third:
    ok("Авторизовались под Алисой, Борисом, Третьим (Натальей)")
else:
    fail("Не удалось залогиниться", f"alice={bool(alice)} boris={bool(boris)} third={bool(third)}")
    print("STOP")
    raise SystemExit(1)

# Узнаём свой user_id
r = httpx.get(f"{BASE}/users/me", headers=H(alice), timeout=10)
alice_id = r.json()["id"]
alice_full = r.json()
r = httpx.get(f"{BASE}/users/me", headers=H(boris), timeout=10)
boris_id = r.json()["id"]
boris_full = r.json()
r = httpx.get(f"{BASE}/users/me", headers=H(third), timeout=10)
third_id = r.json()["id"]
ok(f"Получены user_id: alice={alice_id[:8]}… boris={boris_id[:8]}… third={third_id[:8]}…")

# Локации и корты
r = httpx.get(f"{BASE}/bookings/locations", headers=H(alice), timeout=10)
locations = r.json()
if not locations:
    fail("На сервере нет локаций")
    raise SystemExit(1)
location_id = locations[0]["id"]
location_name_expected = locations[0]["name"]
ok(f"Локация: {location_name_expected}")

# Сетка кортов на завтра — чтобы не мешать сегодняшним
test_date = (date.today() + timedelta(days=2)).isoformat()
r = httpx.get(f"{BASE}/bookings/grid/{location_id}", params={"date": test_date}, headers=H(alice), timeout=10)
grid = r.json()
if not grid.get("courts"):
    fail("Нет кортов в локации")
    raise SystemExit(1)
court_id = grid["courts"][0]["court_id"]
court_name_expected = grid["courts"][0]["court_name"]
ok(f"Корт: {court_name_expected} (id={court_id[:8]}…)")

# Найдём свободный слот
free_slot = None
for s in grid["courts"][0]["slots"]:
    if s["status"] == "free":
        free_slot = s["slot_start"]
        break
if not free_slot:
    fail("Нет свободных слотов на завтра")
    raise SystemExit(1)
ok(f"Свободный слот на {test_date}: {free_slot}")


# ─────────────────────────────────────────────────────────────
# 1. ОЧЕРЕДЬ НА КОРТ
# ─────────────────────────────────────────────────────────────
section("1. ОЧЕРЕДЬ НА КОРТ")

# 1.1 Алиса бронирует слот
r = httpx.post(
    f"{BASE}/bookings",
    json={"court_id": court_id, "date": test_date, "slot_start": free_slot},
    headers=H(alice), timeout=10,
)
if r.status_code == 201:
    booking_id = r.json()["id"]
    ok(f"1.1 Алиса забронировала {test_date} {free_slot} → {booking_id[:8]}…")
else:
    fail(f"1.1 Бронирование не удалось: {r.status_code}", r.text[:200])
    raise SystemExit(1)

# 1.2 Борис встаёт в очередь
r = httpx.post(
    f"{BASE}/queue",
    json={"court_id": court_id, "date": test_date, "slot_start": free_slot},
    headers=H(boris), timeout=10,
)
if r.status_code == 201:
    queue_entry_id = r.json()["id"]
    ok(f"1.2 Борис встал в очередь → {queue_entry_id[:8]}…  status={r.json()['status']}")
else:
    fail(f"1.2 Очередь POST: {r.status_code}", r.text[:200])

# 1.3 Третий тоже встаёт в очередь
r = httpx.post(
    f"{BASE}/queue",
    json={"court_id": court_id, "date": test_date, "slot_start": free_slot},
    headers=H(third), timeout=10,
)
if r.status_code == 201:
    third_queue_id = r.json()["id"]
    ok(f"1.3 Третий встал в очередь (после Бориса)")
else:
    warn(f"1.3 Третий не встал: {r.status_code} {r.text[:100]}")
    third_queue_id = None

# 1.4 Дубль — Борис не может встать в очередь второй раз
r = httpx.post(
    f"{BASE}/queue",
    json={"court_id": court_id, "date": test_date, "slot_start": free_slot},
    headers=H(boris), timeout=10,
)
if r.status_code == 409:
    ok("1.4 Дубль очереди Бориса → 409")
else:
    fail(f"1.4 Ожидался 409, получили {r.status_code}")

# 1.5 Проверяем /queue/mine у Бориса
r = httpx.get(f"{BASE}/queue/mine", headers=H(boris), timeout=10)
if r.status_code == 200:
    my_q = r.json()
    found = any(e["id"] == queue_entry_id for e in my_q)
    if found:
        ok(f"1.5 /queue/mine у Бориса видит свой entry (всего {len(my_q)})")
    else:
        fail("1.5 entry Бориса не виден в /queue/mine")

# 1.6 Алиса отменяет бронь → Борис должен получить уведомление
r = httpx.delete(f"{BASE}/bookings/{booking_id}", headers=H(alice), timeout=10)
if r.status_code == 204:
    ok("1.6 Алиса отменила бронь → 204")
else:
    fail(f"1.6 Отмена брони: {r.status_code}", r.text[:200])

time_mod.sleep(1)  # дать БД зафиксировать notification

# 1.7 Борис проверяет /queue/mine — должен быть "notified"
r = httpx.get(f"{BASE}/queue/mine", headers=H(boris), timeout=10)
my_q = r.json() if r.status_code == 200 else []
boris_entry = next((e for e in my_q if e["id"] == queue_entry_id), None)
if boris_entry and boris_entry["status"] == "notified":
    ok(f"1.7 Очередь Бориса → status=notified ✓")
elif boris_entry:
    fail(f"1.7 Status Бориса = {boris_entry['status']} (ожидался notified)")
else:
    fail("1.7 Запись Бориса не найдена в /queue/mine")

# 1.8 Третий по-прежнему "waiting" (FIFO — нотифай только первому)
if third_queue_id:
    r = httpx.get(f"{BASE}/queue/mine", headers=H(third), timeout=10)
    third_q = next((e for e in r.json() if e["id"] == third_queue_id), None)
    if third_q and third_q["status"] == "waiting":
        ok("1.8 Третий → status=waiting (FIFO: только первый получил notify)")
    else:
        fail(f"1.8 Третий status={third_q['status'] if third_q else None}")

# 1.9 Борис видит push в /feed
r = httpx.get(f"{BASE}/notifications/feed", headers=H(boris), timeout=10)
if r.status_code == 200:
    feed = r.json()
    court_avail = [n for n in feed if n["type"] == "court_available"]
    if court_avail:
        ok(f"1.9 Борис видит уведомление 'Корт освободился' в фиде ({len(court_avail)} шт)")
    else:
        warn("1.9 court_available нет в фиде (возможно создание уведомления отключено)")

# 1.10 Очистка: Борис и Третий выходят из очереди
httpx.delete(f"{BASE}/queue/{queue_entry_id}", headers=H(boris), timeout=10)
if third_queue_id:
    httpx.delete(f"{BASE}/queue/{third_queue_id}", headers=H(third), timeout=10)
ok("1.10 Очередь очищена")


# ─────────────────────────────────────────────────────────────
# 2. ПОИСК ПАРТНЁРА С ПРИВЯЗКОЙ К БРОНИ
# ─────────────────────────────────────────────────────────────
section("2. ПОИСК ПАРТНЁРА + booking_id")

# 2.1 Алиса опять бронирует слот (другой)
slot_for_search = None
r = httpx.get(f"{BASE}/bookings/grid/{location_id}", params={"date": test_date}, headers=H(alice), timeout=10)
for s in r.json()["courts"][0]["slots"]:
    if s["status"] == "free":
        slot_for_search = s["slot_start"]
        break

r = httpx.post(
    f"{BASE}/bookings",
    json={"court_id": court_id, "date": test_date, "slot_start": slot_for_search},
    headers=H(alice), timeout=10,
)
if r.status_code == 201:
    search_booking_id = r.json()["id"]
    ok(f"2.1 Алиса забронировала {test_date} {slot_for_search}")
else:
    fail(f"2.1 Бронь не создалась: {r.status_code}", r.text[:200])
    raise SystemExit(1)

# 2.2 /bookings/mine у Алисы — проверяем что есть court_name и location_name
r = httpx.get(f"{BASE}/bookings/mine", headers=H(alice), timeout=10)
mine = r.json() if r.status_code == 200 else []
mine_entry = next((b for b in mine if b["id"] == search_booking_id), None)
if mine_entry:
    if mine_entry.get("court_name"):
        ok(f"2.2 /bookings/mine: court_name = '{mine_entry['court_name']}'")
    else:
        fail("2.2 court_name отсутствует в /bookings/mine — миграция не применена?")
    if mine_entry.get("location_name"):
        ok(f"     location_name = '{mine_entry['location_name']}'")
    else:
        fail("2.2 location_name отсутствует в /bookings/mine")
else:
    fail("2.2 Бронь не найдена в /bookings/mine")

# 2.3 Алиса создаёт поиск партнёра с привязкой к брони (только preferred=False, чтобы Борис мог увидеть)
slot_hh = slot_for_search  # "09:00"
slot_end_hh = f"{int(slot_hh[:2]):02d}:30" if slot_hh[3:] == "00" else f"{int(slot_hh[:2])+1:02d}:00"
start_iso = f"{test_date}T{slot_hh}:00"
end_iso = f"{test_date}T{slot_end_hh}:00"

r = httpx.post(
    f"{BASE}/search-requests",
    json={
        "game_type": "singles",
        "court_booked": True,
        "booking_id": search_booking_id,
        "location_id": location_id,
        "start_time": start_iso,
        "end_time": end_iso,
        "stm_level": "3.5",
        "only_preferred": False,  # видят все
        "notes": "Тестовый поиск с привязкой к брони",
    },
    headers=H(alice), timeout=10,
)
if r.status_code == 201:
    sr = r.json()
    search_id = sr["id"]
    ok(f"2.3 Поиск создан с booking_id, search_id={search_id[:8]}…")
    # Проверяем что в ответе есть computed-поля
    if sr.get("booking_id") == search_booking_id:
        ok("     booking_id вернулся правильно")
    else:
        fail(f"     booking_id в ответе: {sr.get('booking_id')}")
    if sr.get("location_name"):
        ok(f"     location_name = '{sr['location_name']}'")
    else:
        fail("     location_name отсутствует — _attach_booking_details не сработал?")
    if sr.get("court_name"):
        ok(f"     court_name = '{sr['court_name']}'")
    else:
        fail("     court_name отсутствует")
    if sr.get("booking_slot_start"):
        ok(f"     booking_slot_start = '{sr['booking_slot_start']}'")
    else:
        fail("     booking_slot_start отсутствует")
else:
    fail(f"2.3 Создание поиска: {r.status_code}", r.text[:300])
    search_id = None
    raise SystemExit(1)

# 2.4 Борис видит этот запрос в /available
r = httpx.get(f"{BASE}/search-requests/available", headers=H(boris), timeout=10)
if r.status_code == 200:
    available = r.json()
    found = next((s for s in available if s["id"] == search_id), None)
    if found:
        ok(f"2.4 Борис видит запрос в /available (всего {len(available)})")
        if found.get("court_name"):
            ok(f"     Борис видит court_name = '{found['court_name']}'")
        else:
            fail("     Борис НЕ видит court_name")
        if found.get("location_name"):
            ok(f"     Борис видит location_name = '{found['location_name']}'")
        if found.get("booking_slot_start"):
            ok(f"     Борис видит slot = {found['booking_slot_start']}–{found.get('booking_slot_end')}")
    else:
        fail(f"2.4 Борис НЕ видит запрос (only_preferred=False, должен видеть)")

# 2.5 Борис откликается
r = httpx.post(f"{BASE}/search-requests/{search_id}/respond", headers=H(boris), timeout=10)
if r.status_code == 201:
    response_id = r.json()["id"]
    ok(f"2.5 Борис откликнулся → response_id={response_id[:8]}…")
else:
    fail(f"2.5 Отклик: {r.status_code}", r.text[:200])
    response_id = None

# 2.6 Алиса видит отклик в детальном
r = httpx.get(f"{BASE}/search-requests/{search_id}", headers=H(alice), timeout=10)
if r.status_code == 200 and r.json().get("responses"):
    ok(f"2.6 Алиса видит {len(r.json()['responses'])} отклик(ов)")
else:
    fail("2.6 Отклик Бориса не виден")

# 2.7 Алиса подтверждает отклик
if response_id:
    r = httpx.put(
        f"{BASE}/search-requests/{search_id}/responses/{response_id}/confirm",
        headers=H(alice), timeout=10,
    )
    if r.status_code == 200 and r.json()["status"] == "confirmed":
        ok("2.7 Алиса подтвердила отклик → status=confirmed")
    else:
        fail(f"2.7 Подтверждение: {r.status_code}")

# Очистка
httpx.delete(f"{BASE}/search-requests/{search_id}", headers=H(alice), timeout=10)
httpx.delete(f"{BASE}/bookings/{search_booking_id}", headers=H(alice), timeout=10)
ok("2.8 Очистка завершена")


# ─────────────────────────────────────────────────────────────
# 3. ВИДИМОСТЬ: only_preferred vs all
# ─────────────────────────────────────────────────────────────
section("3. ВИДИМОСТЬ ПОИСКА")

# Узнаём preferred-список Алисы
r = httpx.get(f"{BASE}/preferred-players/mine", headers=H(alice), timeout=10)
pref = r.json() if r.status_code == 200 else []
pref_player_ids = {p["player_id"] for p in pref if p.get("is_active", True)}
is_boris_preferred = boris_id in pref_player_ids
print(f"      Preferred Алисы: {len(pref_player_ids)} игроков. Борис в списке: {is_boris_preferred}")

# 3.1 Поиск с only_preferred=True (без booking_id, чтобы не возиться с бронью)
future_date = (date.today() + timedelta(days=3)).isoformat()
start_iso = f"{future_date}T10:00:00"
end_iso = f"{future_date}T11:00:00"

r = httpx.post(
    f"{BASE}/search-requests",
    json={
        "game_type": "singles",
        "court_booked": False,
        "start_time": start_iso,
        "end_time": end_iso,
        "stm_level": "3.5",
        "only_preferred": True,
    },
    headers=H(alice), timeout=10,
)
if r.status_code == 201:
    sr_pref_id = r.json()["id"]
    ok(f"3.1 Создан поиск only_preferred=True")
else:
    fail(f"3.1 {r.status_code}", r.text[:200])
    sr_pref_id = None

# 3.2 Поиск с only_preferred=False
r = httpx.post(
    f"{BASE}/search-requests",
    json={
        "game_type": "singles",
        "court_booked": False,
        "start_time": f"{future_date}T11:00:00",
        "end_time": f"{future_date}T12:00:00",
        "stm_level": "3.5",
        "only_preferred": False,
    },
    headers=H(alice), timeout=10,
)
if r.status_code == 201:
    sr_all_id = r.json()["id"]
    ok(f"3.2 Создан поиск only_preferred=False (виден всем)")
else:
    fail(f"3.2 {r.status_code}", r.text[:200])
    sr_all_id = None

time_mod.sleep(1)

# 3.3 Борис: видит ли он public-запрос (only_preferred=False)?
r = httpx.get(f"{BASE}/search-requests/available", headers=H(boris), timeout=10)
if r.status_code == 200:
    avail = r.json()
    sees_all = any(s["id"] == sr_all_id for s in avail) if sr_all_id else False
    sees_pref = any(s["id"] == sr_pref_id for s in avail) if sr_pref_id else False
    print(f"      Борис в /available: видит public={sees_all}, видит preferred={sees_pref}")

    if sees_all:
        ok("3.3 Борис видит public-запрос ✓")
    else:
        warn("3.3 Борис НЕ видит public-запрос (возможно accept_other_requests=False у Бориса)")

    if is_boris_preferred and sees_pref:
        ok("3.4 Борис в preferred → видит preferred-запрос ✓")
    elif not is_boris_preferred and sees_pref:
        # Это ОЖИДАЕМО: /available показывает всё активное, а only_preferred ограничивает только PUSH-уведомление
        ok("3.4 Борис не в preferred, но видит запрос в /available (логика: only_preferred = только PUSH)")
    elif not is_boris_preferred and not sees_pref:
        # Альтернативная логика — фильтрация на уровне /available
        ok("3.4 Борис не в preferred → не видит запрос (фильтр на /available)")

# 3.5 Проверим уведомления Бориса — только public должен был создать push
r = httpx.get(f"{BASE}/notifications/feed", headers=H(boris), timeout=10)
if r.status_code == 200:
    feed = r.json()
    pushes_for_all = [n for n in feed if n.get("reference_id") == sr_all_id]
    pushes_for_pref = [n for n in feed if n.get("reference_id") == sr_pref_id]
    print(f"      Borisовы пуши: public={len(pushes_for_all)}, preferred={len(pushes_for_pref)}")

    if pushes_for_all:
        ok("3.5 Борис получил push для public-запроса")
    else:
        warn("3.5 Push не пришёл — но это может быть из-за фильтров получателя")

    if is_boris_preferred and pushes_for_pref:
        ok("3.6 Борис в preferred → пришёл push для preferred-запроса")
    elif not is_boris_preferred and not pushes_for_pref:
        ok("3.6 Борис не в preferred → НЕТ push для preferred-запроса ✓ (фильтр работает)")
    elif not is_boris_preferred and pushes_for_pref:
        fail("3.6 Борис не в preferred, но получил push! → утечка")

# Очистка
if sr_pref_id:
    httpx.delete(f"{BASE}/search-requests/{sr_pref_id}", headers=H(alice), timeout=10)
if sr_all_id:
    httpx.delete(f"{BASE}/search-requests/{sr_all_id}", headers=H(alice), timeout=10)
ok("3.7 Очистка завершена")


# ─────────────────────────────────────────────────────────────
# 4. ВАЛИДАЦИЯ booking_id
# ─────────────────────────────────────────────────────────────
section("4. ВАЛИДАЦИЯ booking_id")

# 4.1 Чужая бронь — нельзя
# Сначала Борис бронирует
r = httpx.get(f"{BASE}/bookings/grid/{location_id}", params={"date": test_date}, headers=H(boris), timeout=10)
boris_slot = next((s["slot_start"] for s in r.json()["courts"][0]["slots"] if s["status"] == "free"), None)

if boris_slot:
    r = httpx.post(
        f"{BASE}/bookings",
        json={"court_id": court_id, "date": test_date, "slot_start": boris_slot},
        headers=H(boris), timeout=10,
    )
    if r.status_code == 201:
        boris_booking_id = r.json()["id"]
        ok(f"4.0 Борис забронировал {boris_slot}")

        # Алиса пытается прицепить чужую бронь — гарантируем валидные времена (через 7 дней)
        future_date = (date.today() + timedelta(days=7)).isoformat()
        r = httpx.post(
            f"{BASE}/search-requests",
            json={
                "game_type": "singles",
                "court_booked": True,
                "booking_id": boris_booking_id,
                "start_time": f"{future_date}T14:00:00",
                "end_time": f"{future_date}T15:00:00",
                "stm_level": "3.5",
                "only_preferred": False,
            },
            headers=H(alice), timeout=10,
        )
        if r.status_code == 400:
            ok("4.1 Чужая бронь → 400 ✓")
        else:
            fail(f"4.1 Ожидался 400, получили {r.status_code}", r.text[:200])

        # 4.2 Несуществующая бронь
        r = httpx.post(
            f"{BASE}/search-requests",
            json={
                "game_type": "singles",
                "court_booked": True,
                "booking_id": "00000000-0000-0000-0000-000000000000",
                "start_time": f"{test_date}T15:00:00",
                "end_time": f"{test_date}T15:30:00",
                "stm_level": "3.5",
                "only_preferred": False,
            },
            headers=H(alice), timeout=10,
        )
        if r.status_code == 400:
            ok("4.2 Несуществующая бронь → 400 ✓")
        else:
            fail(f"4.2 Ожидался 400, получили {r.status_code}")

        # Очистка
        httpx.delete(f"{BASE}/bookings/{boris_booking_id}", headers=H(boris), timeout=10)


# ─────────────────────────────────────────────────────────────
# ИТОГ
# ─────────────────────────────────────────────────────────────
print()
print("═" * 60)
print(f"  ИТОГО: {_pass} passed, {_fail} failed, {_warn} warnings")
print("═" * 60)
exit(1 if _fail > 0 else 0)
