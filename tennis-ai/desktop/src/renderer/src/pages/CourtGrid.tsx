import { useState, useEffect, useCallback, useRef } from 'react'
import { bookingsApi, LocationInfo, LocationGrid, SlotInfo, AdminBookingCreate, SlotLockResponse } from '../api/bookings'
import { playersApi, PlayerPublic } from '../api/players'
import { queueApi } from '../api/queue'

const TODAY = new Date().toISOString().slice(0, 10)

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Не оплачено' },
  { value: 'cash',   label: 'Наличные' },
  { value: 'card',   label: 'Карта' },
  { value: 'sbp',    label: 'СБП' },
]
const PAYMENT_LABELS: Record<string, string> = { unpaid: 'Не оплачено', cash: 'Наличные', card: 'Карта', sbp: 'СБП' }
const PAYMENT_COLORS: Record<string, string> = { unpaid: '#f59e0b', cash: '#22c55e', card: '#3b82f6', sbp: '#8b5cf6' }

// ─── helpers ─────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)
}

function slotsRange(start: string, end: string): string[] {
  const slots: string[] = []
  let [h, m] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  while (h * 60 + m < eh * 60 + em) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
    m += 30; if (m >= 60) { h++; m = 0 }
  }
  return slots
}

function addHalfHour(t: string): string {
  let [h, m] = t.split(':').map(Number)
  m += 30; if (m >= 60) { h++; m = 0 }
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function formatCountdown(expiresAt: string): string {
  const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${m}:${String(s).padStart(2,'0')}`
}

// ─── стили ───────────────────────────────────────────────────

const MODAL_BG: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
  zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const MODAL: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 24, width: 440, maxHeight: '90vh', overflow: 'auto',
}
const INP: React.CSSProperties = {
  padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%',
}
const BTN = (bg: string, color = '#fff'): React.CSSProperties => ({
  padding: '9px 18px', border: 'none', borderRadius: 'var(--radius)',
  fontWeight: 600, fontSize: 13, cursor: 'pointer', background: bg, color,
})
const ctrlStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none',
}

// ─── Модалка деталей занятого слота ──────────────────────────

interface BookingDetailProps {
  slot: SlotInfo
  courtName: string
  date: string
  onClose: () => void
  onCancel: (cancelSeries: boolean) => void
  onAddQueue: () => void
}

function BookingDetailModal({ slot, courtName, date, onClose, onCancel, onAddQueue }: BookingDetailProps) {
  const [cancelling, setCancelling] = useState(false)

  const doCancel = async (cancelSeries: boolean) => {
    if (!slot.booking_id) return
    const msg = cancelSeries
      ? `Отменить ВСЮ СЕРИЮ периодической брони для ${slot.player_name}?`
      : `Отменить бронь ${slot.slot_start}–${slot.slot_end} для ${slot.player_name}?`
    if (!confirm(msg)) return
    setCancelling(true)
    try { onCancel(cancelSeries) }
    finally { setCancelling(false) }
  }

  const isPeriodic = slot.is_periodic
  const payLabel = slot.payment_status ? PAYMENT_LABELS[slot.payment_status] ?? slot.payment_status : null
  const payColor = slot.payment_status ? PAYMENT_COLORS[slot.payment_status] ?? 'var(--text-muted)' : 'var(--text-muted)'

  const dateLabel = new Date(date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })

  return (
    <div style={MODAL_BG} onClick={onClose}>
      <div style={MODAL} onClick={e => e.stopPropagation()}>
        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%',
            background: isPeriodic ? 'rgba(139,92,246,0.15)' : 'var(--slot-booked-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700,
            color: isPeriodic ? '#8b5cf6' : 'var(--slot-booked)', flexShrink: 0 }}>
            {initials(slot.player_name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{slot.player_name ?? 'Аноним'}</div>
            {slot.player_nickname && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{slot.player_nickname}</div>
            )}
            {isPeriodic && (
              <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 2 }}>🔁 Периодическая бронь</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Инфо */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { icon: '🎾', label: 'Корт',   value: courtName },
            { icon: '📅', label: 'Дата',   value: dateLabel },
            { icon: '⏰', label: 'Время',  value: `${slot.slot_start} – ${slot.slot_end}` },
            ...(slot.player_phone ? [{ icon: '📞', label: 'Телефон', value: slot.player_phone }] : []),
            ...(slot.notes        ? [{ icon: '💬', label: 'Заметка', value: slot.notes }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>{row.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{row.value}</span>
            </div>
          ))}
          {/* Статус оплаты */}
          {payLabel && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>💳</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 70, flexShrink: 0 }}>Оплата</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: payColor,
                background: `${payColor}22`, padding: '2px 8px', borderRadius: 6 }}>
                {payLabel}
              </span>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => doCancel(false)} disabled={cancelling}
            style={BTN(cancelling ? 'var(--border)' : 'var(--danger)')}>
            {cancelling ? '...' : '✕ Отменить'}
          </button>
          {isPeriodic && (
            <button onClick={() => doCancel(true)} disabled={cancelling}
              style={BTN(cancelling ? 'var(--border)' : '#dc2626')}>
              🔁 Отменить серию
            </button>
          )}
          <button onClick={onAddQueue} style={BTN('var(--surface-2)', 'var(--text)')}>
            ⏳ Очередь
          </button>
          <button onClick={onClose} style={{ ...BTN('transparent', 'var(--text-muted)'), border: '1px solid var(--border)' }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Модалка новой брони ──────────────────────────────────────

interface NewBookingProps {
  courtId: string
  courtName: string
  date: string
  selectedSlots: string[]
  onClose: () => void
  onBooked: (msg: string) => void
}

function NewBookingModal({ courtId, courtName, date, selectedSlots, onClose, onBooked }: NewBookingProps) {
  const [search, setSearch]         = useState('')
  const [players, setPlayers]       = useState<PlayerPublic[]>([])
  const [player, setPlayer]         = useState<PlayerPublic | null>(null)
  const [notes, setNotes]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [timeFrom, setTimeFrom]     = useState(selectedSlots[0] ?? '08:00')
  const [timeTo, setTimeTo]         = useState(
    selectedSlots.length > 1
      ? addHalfHour(selectedSlots[selectedSlots.length - 1])
      : addHalfHour(selectedSlots[0] ?? '08:00')
  )
  // Статус оплаты
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  // Периодическая бронь
  const [isPeriodic, setIsPeriodic]   = useState(false)
  const [dayOfWeek, setDayOfWeek]     = useState<number>(0)
  const [validUntil, setValidUntil]   = useState('')
  // 7-минутная блокировка
  const [lock, setLock]             = useState<SlotLockResponse | null>(null)
  const [lockCountdown, setLockCountdown] = useState('')
  const lockRef = useRef<SlotLockResponse | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // При открытии модалки — ставим блокировку на первый слот
  useEffect(() => {
    const firstSlot = selectedSlots[0]
    if (!firstSlot) return
    let cancelled = false
    bookingsApi.lockSlot(courtId, date, firstSlot).then(l => {
      if (cancelled) {
        bookingsApi.unlockSlot(l.id).catch(() => {})
        return
      }
      setLock(l)
      lockRef.current = l
    }).catch(() => {
      // 409 = уже заблокировано другим — можно продолжить, просто нет таймера
    })
    return () => { cancelled = true }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Таймер обратного отсчёта
  useEffect(() => {
    if (!lock) return
    timerRef.current = setInterval(() => {
      const remaining = new Date(lock.expires_at).getTime() - Date.now()
      if (remaining <= 0) {
        setLockCountdown('Истекло')
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        setLockCountdown(formatCountdown(lock.expires_at))
      }
    }, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [lock])

  // При закрытии — снимаем блокировку
  const handleClose = useCallback(() => {
    if (lockRef.current) {
      bookingsApi.unlockSlot(lockRef.current.id).catch(() => {})
      lockRef.current = null
    }
    onClose()
  }, [onClose])

  // Генерируем варианты времени 08:00–21:30
  const timeOptions: string[] = []
  for (let h = 8; h <= 21; h++)
    for (const m of [0, 30])
      timeOptions.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  timeOptions.push('22:00')

  const finalSlots = slotsRange(timeFrom, timeTo)
  const dateLabel = new Date(date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })

  const doSearch = async () => {
    if (!search.trim()) return
    const params = search.startsWith('+') || /^\d{10,11}$/.test(search.replace(/\D/g,''))
      ? { phone: search.trim() }
      : { nickname: search.trim() }
    setPlayers(await playersApi.search(params))
  }

  const submit = async (anonymous = false) => {
    if (finalSlots.length === 0) { alert('Выберите корректный диапазон времени'); return }
    if (finalSlots.length < 2) { alert('Минимум 1 час — расширьте выбор времени'); return }
    if (isPeriodic && !validUntil) { alert('Укажите дату окончания абонемента'); return }
    setLoading(true)
    try {
      const payload: AdminBookingCreate = {
        court_id: courtId, date,
        slot_starts: finalSlots,
        user_id: anonymous ? undefined : player?.id,
        notes: notes || undefined,
        payment_status: paymentStatus,
        is_periodic: isPeriodic,
        day_of_week: isPeriodic ? dayOfWeek : undefined,
        valid_until: isPeriodic ? validUntil : undefined,
      }
      const res = await bookingsApi.adminCreate(payload)
      // Освобождаем блокировку (после успешной брони бэкенд удаляет её сам, но лучше явно)
      if (lockRef.current) {
        bookingsApi.unlockSlot(lockRef.current.id).catch(() => {})
        lockRef.current = null
      }
      const perLabel = isPeriodic ? ' (абонемент)' : ''
      const msg = res.failed.length === 0
        ? `✅ Забронировано ${res.booked.length} слот(а)${perLabel} ${timeFrom}–${timeTo}${player ? ` для ${player.last_name} ${player.first_name}` : ''}`
        : `⚠️ Забронировано: ${res.booked.length}${perLabel}, занято: ${res.failed.length}`
      onBooked(msg)
      onClose()
    } catch (e: unknown) {
      const detail = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail
      alert(detail ?? 'Ошибка бронирования')
    } finally { setLoading(false) }
  }

  return (
    <div style={MODAL_BG} onClick={handleClose}>
      <div style={MODAL} onClick={e => e.stopPropagation()}>
        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>🎾 Новая бронь</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {courtName} · {dateLabel}
            </div>
          </div>
          {/* Таймер блокировки */}
          {lock && lockCountdown && lockCountdown !== 'Истекло' && (
            <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)',
              padding: '4px 10px', borderRadius: 6, marginRight: 8 }}>
              🔒 {lockCountdown}
            </div>
          )}
          {lockCountdown === 'Истекло' && (
            <div style={{ fontSize: 11, color: 'var(--danger)', marginRight: 8 }}>⚠️ Время истекло</div>
          )}
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Время */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Время</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={timeFrom} onChange={e => setTimeFrom(e.target.value)} style={{ ...INP, width: 'auto' }}>
              {timeOptions.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <select value={timeTo} onChange={e => setTimeTo(e.target.value)} style={{ ...INP, width: 'auto' }}>
              {timeOptions.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ background: 'var(--surface-2)', padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {finalSlots.length > 0 ? `${finalSlots.length * 0.5} ч` : '—'}
            </span>
          </div>
          {/* Быстрые кнопки длительности */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>Быстро:</span>
            {[1, 1.5, 2].map(h => {
              const active = finalSlots.length === Math.round(h * 2)
              return (
                <button
                  key={h}
                  onClick={() => {
                    const [hh, mm] = timeFrom.split(':').map(Number)
                    const totalMin = hh * 60 + mm + Math.round(h * 60)
                    const eh = Math.floor(totalMin / 60)
                    const em = totalMin % 60
                    const newEnd = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
                    if (timeOptions.includes(newEnd)) setTimeTo(newEnd)
                    else alert('Не хватает времени в дне')
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'var(--surface-2)',
                    color: active ? '#fff' : 'var(--text)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}>
                  {h === 1.5 ? '1.5 ч' : `${h} ч`}
                </button>
              )
            })}
          </div>
        </div>

        {/* Статус оплаты */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Статус оплаты</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PAYMENT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPaymentStatus(opt.value)}
                style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${paymentStatus === opt.value ? PAYMENT_COLORS[opt.value] : 'var(--border)'}`,
                  background: paymentStatus === opt.value ? `${PAYMENT_COLORS[opt.value]}22` : 'var(--surface-2)',
                  color: paymentStatus === opt.value ? PAYMENT_COLORS[opt.value] : 'var(--text-muted)',
                  fontSize: 12, fontWeight: paymentStatus === opt.value ? 700 : 400, cursor: 'pointer' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Периодическая бронь */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={isPeriodic} onChange={e => setIsPeriodic(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#8b5cf6' }} />
            <span style={{ fontSize: 13, color: isPeriodic ? '#8b5cf6' : 'var(--text)' }}>
              🔁 Периодическая бронь (абонемент)
            </span>
          </label>
          {isPeriodic && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.25)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>День недели</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DAY_NAMES.map((d, i) => (
                    <button key={i} onClick={() => setDayOfWeek(i)}
                      style={{ padding: '4px 10px', borderRadius: 6,
                        border: `1px solid ${dayOfWeek === i ? '#8b5cf6' : 'var(--border)'}`,
                        background: dayOfWeek === i ? 'rgba(139,92,246,0.2)' : 'var(--surface-2)',
                        color: dayOfWeek === i ? '#8b5cf6' : 'var(--text-muted)',
                        fontSize: 12, fontWeight: dayOfWeek === i ? 700 : 400, cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Действует до</div>
                <input type="date" value={validUntil} min={date}
                  onChange={e => setValidUntil(e.target.value)} style={{ ...INP, width: 'auto' }} />
              </div>
            </div>
          )}
        </div>

        {/* Поиск игрока */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Игрок</div>
          {player ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--slot-free-bg)', border: '1px solid var(--slot-free)', borderRadius: 'var(--radius)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{player.last_name} {player.first_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{player.nickname}</div>
              </div>
              <button onClick={() => { setPlayer(null); setPlayers([]) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="Ник или +79991234567" style={INP} />
                <button onClick={doSearch}
                  style={{ ...BTN('var(--surface-2)', 'var(--text)'), border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  Найти
                </button>
              </div>
              {players.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflow: 'auto' }}>
                  {players.map(p => (
                    <div key={p.id} onClick={() => setPlayer(p)}
                      style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                        background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <span style={{ fontWeight: 500 }}>{p.last_name} {p.first_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>@{p.nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Заметка */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Заметка (необязательно)</div>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Корпоратив, день рождения..."
            style={INP} />
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => submit(false)} disabled={loading || !player}
            style={BTN(!player || loading ? 'var(--border)' : 'var(--accent)', !player || loading ? 'var(--text-muted)' : '#0f1117')}>
            {loading ? '...' : `✓ Забронировать${player ? ` для ${player.first_name}` : ''}`}
          </button>
          <button onClick={() => submit(true)} disabled={loading}
            style={{ ...BTN('var(--surface-2)', 'var(--text)'), border: '1px solid var(--border)' }}>
            👤 Без игрока
          </button>
          <button onClick={handleClose}
            style={{ ...BTN('transparent', 'var(--text-muted)'), border: '1px solid var(--border)' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Queue modal ─────────────────────────────────────────────

function addMinutesStr(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function QueueAddModal({ courtId, date, slot, onClose, onAdded }: {
  courtId: string; date: string; slot: SlotInfo; onClose: () => void; onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [players, setPlayers] = useState<PlayerPublic[]>([])
  const [selected, setSelected] = useState<PlayerPublic | null>(null)
  const [loading, setLoading] = useState(false)
  const [anyCourt, setAnyCourt] = useState(true)
  const [durationH, setDurationH] = useState(1)
  const [acceptPartial, setAcceptPartial] = useState(false)

  const slotEnd = addMinutesStr(slot.slot_start, Math.round(durationH * 60))

  const doSearch = async () => {
    if (!search.trim()) return
    const params = search.startsWith('+') ? { phone: search.trim() } : { nickname: search.trim() }
    setPlayers(await playersApi.search(params))
  }

  const add = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await queueApi.add({
        court_id: courtId, date,
        slot_start: slot.slot_start + ':00',
        slot_end: slotEnd + ':00',
        min_duration: Math.round(durationH * 60),
        accept_partial: acceptPartial,
        user_id: selected.id,
        any_court: anyCourt,
      })
      onAdded(); onClose()
    } catch (e: unknown) {
      const detail = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail
      alert(detail ?? 'Ошибка')
    } finally { setLoading(false) }
  }

  return (
    <div style={MODAL_BG} onClick={onClose}>
      <div style={{ ...MODAL, width: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⏳ В очередь</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Слот {slot.slot_start}–{slot.slot_end} занят
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Сколько хочет играть</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {[1, 1.5, 2].map(h => (
            <button key={h} onClick={() => setDurationH(h)}
              style={{ flex: 1, padding: '6px 0', borderRadius: 6,
                border: `1px solid ${durationH === h ? 'var(--accent)' : 'var(--border)'}`,
                background: durationH === h ? 'var(--accent)' : 'var(--surface-2)',
                color: durationH === h ? '#0f1117' : 'var(--text)',
                fontSize: 12, fontWeight: durationH === h ? 700 : 500, cursor: 'pointer' }}>
              {h === 1.5 ? '1.5 ч' : `${h} ч`}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
          Интервал ожидания: {slot.slot_start} – {slotEnd}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 6, background: anyCourt ? 'var(--slot-mine-bg)' : 'var(--surface-2)', border: `1px solid ${anyCourt ? 'var(--accent)' : 'var(--border)'}` }}>
          <input type="checkbox" checked={anyCourt} onChange={e => setAnyCourt(e.target.checked)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Любой корт этой локации</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Уведомим при освобождении любого корта в это время
            </div>
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer', padding: '8px 10px', borderRadius: 6, background: acceptPartial ? 'var(--slot-mine-bg)' : 'var(--surface-2)', border: `1px solid ${acceptPartial ? 'var(--accent)' : 'var(--border)'}` }}>
          <input type="checkbox" checked={acceptPartial} onChange={e => setAcceptPartial(e.target.checked)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Согласен на меньшее время</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Уведомить, даже если окно меньше {Math.round(durationH * 60)} мин
            </div>
          </div>
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Ник или +79991234567" style={INP} />
          <button onClick={doSearch} style={{ ...BTN('var(--surface-2)', 'var(--text)'), border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Найти</button>
        </div>
        {players.map(p => (
          <div key={p.id} onClick={() => setSelected(p)}
            style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: selected?.id === p.id ? 'var(--slot-mine-bg)' : 'var(--surface-2)',
              border: `1px solid ${selected?.id === p.id ? 'var(--slot-mine)' : 'var(--border)'}` }}>
            <span style={{ fontWeight: 500 }}>{p.last_name} {p.first_name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>@{p.nickname}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={add} disabled={!selected || loading}
            style={BTN(!selected ? 'var(--border)' : 'var(--accent)', !selected ? 'var(--text-muted)' : '#0f1117')}>
            {loading ? '...' : 'Добавить'}
          </button>
          <button onClick={onClose} style={{ ...BTN('transparent', 'var(--text)'), border: '1px solid var(--border)' }}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ─── Ячейка слота ────────────────────────────────────────────

interface SlotCellProps {
  slot: SlotInfo
  isSelected: boolean
  onMouseDown: () => void
  onMouseEnter: () => void
  onMouseUp: () => void
  onClick: () => void
}

function SlotCell({ slot, isSelected, onMouseDown, onMouseEnter, onMouseUp, onClick }: SlotCellProps) {
  const { status } = slot
  const isFree         = status === 'free'
  const isBooked       = status === 'booked'
  const isMine         = status === 'mine'
  const isLocked       = status === 'locked'
  const isPeriodic     = status === 'periodic'
  const isPeriodicMine = status === 'periodic_mine'
  const isOccupied     = isBooked || isMine || isPeriodic || isPeriodicMine

  const payColor = slot.payment_status ? PAYMENT_COLORS[slot.payment_status] : null

  let bg = 'var(--surface-2)'
  let border = 'var(--border)'
  let textColor = 'var(--text-muted)'
  let cursor: React.CSSProperties['cursor'] = 'pointer'

  if (isSelected) {
    bg = '#22c55e33'; border = '#22c55e'; textColor = '#22c55e'
  } else if (isFree) {
    bg = 'var(--slot-free-bg)'; border = 'var(--slot-free)'; textColor = 'var(--slot-free)'
  } else if (isBooked) {
    bg = 'var(--slot-booked-bg)'; border = 'transparent'; textColor = 'var(--slot-booked)'
  } else if (isMine) {
    bg = '#1d4ed8'; border = '#3b82f6'; textColor = '#ffffff'
  } else if (isPeriodic) {
    bg = 'rgba(139,92,246,0.12)'; border = '#8b5cf6'; textColor = '#8b5cf6'
  } else if (isPeriodicMine) {
    bg = 'rgba(139,92,246,0.25)'; border = '#8b5cf6'; textColor = '#c4b5fd'
  } else if (isLocked) {
    bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.4)'; textColor = '#ef4444'; cursor = 'not-allowed'
  }

  return (
    <div
      style={{ width: '100%', minWidth: 90, padding: '5px 6px', background: bg,
        border: `1px solid ${border}`, borderRadius: 5, color: textColor, fontSize: 11, cursor,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, userSelect: 'none',
        position: 'relative' }}
      onMouseDown={isLocked ? undefined : onMouseDown}
      onMouseEnter={isLocked ? undefined : onMouseEnter}
      onMouseUp={isLocked ? undefined : onMouseUp}
      onClick={isLocked ? undefined : onClick}
    >
      {isFree && <span style={{ fontWeight: 500 }}>Свободно</span>}
      {isSelected && <span style={{ fontWeight: 600 }}>Выбрано</span>}
      {isLocked && (
        <>
          <span style={{ fontSize: 13 }}>🔒</span>
          <span style={{ fontSize: 9, opacity: 0.8 }}>Занято</span>
        </>
      )}
      {isOccupied && (
        <>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>
            {initials(slot.player_name)}
          </span>
          <span style={{ fontSize: 10, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {slot.player_name ?? 'Аноним'}
          </span>
          {slot.player_phone && (
            <span style={{ fontSize: 9, opacity: 0.75, maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {slot.player_phone}
            </span>
          )}
          {/* Маркер оплаты */}
          {payColor && (
            <div style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7,
              borderRadius: '50%', background: payColor }} title={PAYMENT_LABELS[slot.payment_status!] ?? ''} />
          )}
          {/* Иконка периодической */}
          {(isPeriodic || isPeriodicMine) && (
            <span style={{ fontSize: 8, opacity: 0.85 }}>🔁</span>
          )}
        </>
      )}
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────

interface DragState { courtId: string; startIdx: number; endIdx: number }

const POLL_INTERVAL = 10_000  // обновлять грид каждые 10 секунд

export default function CourtGrid() {
  const [locations, setLocations] = useState<LocationInfo[]>([])
  const [locationId, setLocationId] = useState('')
  const [date, setDate] = useState(TODAY)
  const [grid, setGrid] = useState<LocationGrid | null>(null)
  const [loading, setLoading] = useState(false)
  const [gridError, setGridError] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean }>({ msg: '', ok: true })

  // Модалки
  const [detailSlot, setDetailSlot]   = useState<{ slot: SlotInfo; courtId: string; courtName: string } | null>(null)
  const [newBooking, setNewBooking]   = useState<{ courtId: string; courtName: string; slots: string[] } | null>(null)
  const [queueSlot, setQueueSlot]     = useState<{ courtId: string; slot: SlotInfo } | null>(null)

  // Drag
  const [drag, setDrag]           = useState<DragState | null>(null)
  const [wasDragging, setWasDragging] = useState(false)
  const dragRef = useRef<DragState | null>(null)

  // Polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    bookingsApi.listLocations().then(locs => {
      setLocations(locs)
      if (locs.length) setLocationId(locs[0].id)
    })
  }, [])

  const loadGrid = useCallback(async (silent = false) => {
    if (!locationId || !date) return
    if (!silent) { setLoading(true); setGridError('') }
    try { setGrid(await bookingsApi.getGrid(locationId, date)) }
    catch { if (!silent) setGridError('Не удалось загрузить расписание.') }
    finally { if (!silent) setLoading(false) }
  }, [locationId, date])

  // Первоначальная загрузка
  useEffect(() => { loadGrid() }, [loadGrid])

  // Polling каждые 10 секунд (тихое обновление)
  useEffect(() => {
    pollRef.current = setInterval(() => {
      // Не обновляем если открыта модалка брони (пользователь заполняет форму)
      if (!newBooking) loadGrid(true)
    }, POLL_INTERVAL)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadGrid, newBooking])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast({ msg: '', ok: true }), 4000)
  }

  const timeSlots = grid?.courts[0]?.slots.map(s => s.slot_start) ?? []

  // ── drag handlers ──
  const onMouseDown = (courtId: string, slotIdx: number, slot: SlotInfo) => {
    if (slot.status !== 'free') return
    const d: DragState = { courtId, startIdx: slotIdx, endIdx: slotIdx }
    setDrag(d); dragRef.current = d; setWasDragging(false)
  }

  const onMouseEnter = (courtId: string, slotIdx: number) => {
    if (!dragRef.current || dragRef.current.courtId !== courtId) return
    const upd = { ...dragRef.current, endIdx: slotIdx }
    dragRef.current = upd; setDrag({ ...upd })
    if (slotIdx !== dragRef.current.startIdx) setWasDragging(true)
  }

  const onMouseUp = (courtId: string, courtName: string) => {
    const d = dragRef.current
    if (!d || d.courtId !== courtId) { setDrag(null); dragRef.current = null; return }

    const lo = Math.min(d.startIdx, d.endIdx)
    const hi = Math.max(d.startIdx, d.endIdx)
    setDrag(null); dragRef.current = null

    const court = grid?.courts.find(c => c.court_id === courtId)
    if (!court) return

    const slots = court.slots
      .slice(lo, hi + 1)
      .filter(s => s.status === 'free')
      .map(s => s.slot_start)

    if (slots.length === 0) return

    if (lo === hi && !wasDragging) {
      setWasDragging(false); return
    }

    setWasDragging(false)
    setNewBooking({ courtId, courtName, slots })
  }

  const onClick = (courtId: string, courtName: string, slot: SlotInfo) => {
    if (wasDragging) return
    if (slot.status === 'free') {
      // Автоматически выделяем 2 слота (1 час) если следующий свободен
      const court = grid?.courts.find(c => c.court_id === courtId)
      const slots = [slot.slot_start]
      if (court) {
        const idx = court.slots.findIndex(s => s.slot_start === slot.slot_start)
        if (idx >= 0 && idx + 1 < court.slots.length && court.slots[idx + 1].status === 'free') {
          slots.push(court.slots[idx + 1].slot_start)
        }
      }
      setNewBooking({ courtId, courtName, slots })
    } else if (['booked', 'mine', 'periodic', 'periodic_mine'].includes(slot.status)) {
      setDetailSlot({ slot, courtId, courtName })
    }
    // 'locked' — не открываем модалку
  }

  const isSelected = (courtId: string, slotIdx: number) => {
    if (!drag || drag.courtId !== courtId) return false
    const lo = Math.min(drag.startIdx, drag.endIdx)
    const hi = Math.max(drag.startIdx, drag.endIdx)
    return slotIdx >= lo && slotIdx <= hi
  }

  const handleCancelBooking = async (bookingId: string | null, cancelSeries: boolean) => {
    if (!bookingId) return
    try {
      await bookingsApi.cancel(bookingId, cancelSeries)
      setDetailSlot(null)
      loadGrid()
      showToast(cancelSeries ? 'Серия броней отменена' : 'Бронь отменена')
    } catch {
      alert('Ошибка отмены')
    }
  }

  // ── Навигация по дням ──
  const shiftDate = (days: number) => {
    const d = new Date(date + 'T12:00')
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  const dateLabel = new Date(date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const isToday = date === TODAY

  // ── Статистика ──
  const totalSlots    = grid?.courts.reduce((s, c) => s + c.slots.length, 0) ?? 0
  const freeSlots     = grid?.courts.reduce((s, c) => s + c.slots.filter(sl => sl.status === 'free').length, 0) ?? 0
  const periodicSlots = grid?.courts.reduce((s, c) => s + c.slots.filter(sl => sl.status === 'periodic' || sl.status === 'periodic_mine').length, 0) ?? 0
  const bookedSlots   = totalSlots - freeSlots

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
      onMouseUp={() => { if (drag) { setDrag(null); dragRef.current = null } }}>

      {/* Модалки */}
      {detailSlot && (
        <BookingDetailModal
          slot={detailSlot.slot}
          courtName={detailSlot.courtName}
          date={date}
          onClose={() => setDetailSlot(null)}
          onCancel={(cs) => handleCancelBooking(detailSlot.slot.booking_id, cs)}
          onAddQueue={() => {
            const s = detailSlot
            setDetailSlot(null)
            setQueueSlot({ courtId: s.courtId, slot: s.slot })
          }}
        />
      )}
      {newBooking && (
        <NewBookingModal
          courtId={newBooking.courtId}
          courtName={newBooking.courtName}
          date={date}
          selectedSlots={newBooking.slots}
          onClose={() => setNewBooking(null)}
          onBooked={msg => { loadGrid(); showToast(msg) }}
        />
      )}
      {queueSlot && (
        <QueueAddModal
          courtId={queueSlot.courtId}
          date={date}
          slot={queueSlot.slot}
          onClose={() => setQueueSlot(null)}
          onAdded={() => { setQueueSlot(null); showToast('Добавлено в очередь') }}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, flexShrink: 0 }}>Шахматка кортов</h2>
        <select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ ...ctrlStyle, marginLeft: 'auto' }}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.court_count} корт.)</option>)}
        </select>
      </div>

      {/* Навигация по дате */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => shiftDate(-1)} style={{ ...ctrlStyle, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize' }}>{dateLabel}</span>
          {isToday && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Сегодня</span>}
        </div>
        <button onClick={() => shiftDate(1)} style={{ ...ctrlStyle, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>›</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...ctrlStyle, width: 140 }} />
        <button onClick={() => loadGrid()} disabled={loading}
          style={{ padding: '8px 14px', background: loading ? 'var(--border)' : 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius)', color: loading ? 'var(--text-muted)' : '#0f1117',
            fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {loading ? '...' : '↻'}
        </button>
      </div>

      {/* Статистика + легенда */}
      {grid && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--slot-free)' }}>● Свободно: {freeSlots}</span>
            <span style={{ fontSize: 12, color: 'var(--slot-booked)' }}>● Занято: {bookedSlots - periodicSlots}</span>
            {periodicSlots > 0 && (
              <span style={{ fontSize: 12, color: '#8b5cf6' }}>🔁 Абонемент: {periodicSlots}</span>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Загрузка: {totalSlots > 0 ? Math.round(bookedSlots/totalSlots*100) : 0}%</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Легенда оплаты */}
            {Object.entries(PAYMENT_COLORS).map(([k, c]) => (
              <span key={k} style={{ fontSize: 11, color: c, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }}/>
                {PAYMENT_LABELS[k]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.msg && (
        <div style={{ padding: '10px 16px', borderRadius: 'var(--radius)', fontSize: 13,
          background: toast.ok ? 'var(--surface-2)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${toast.ok ? 'var(--border)' : 'rgba(239,68,68,0.35)'}` }}>
          {toast.msg}
        </div>
      )}

      {gridError && (
        <div style={{ padding: '9px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', color: '#fca5a5', fontSize: 13 }}>
          {gridError}
        </div>
      )}

      {!grid && !loading && !gridError && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>Выберите локацию</div>
      )}
      {grid && grid.courts.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>Нет активных кортов</div>
      )}

      {/* Таблица */}
      {grid && grid.courts.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', userSelect: 'none' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                  borderRight: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
                  textAlign: 'left', position: 'sticky', top: 0, left: 0, zIndex: 20, minWidth: 68 }}>
                  Время
                </th>
                {grid.courts.map(c => (
                  <th key={c.court_id} style={{ padding: '10px 12px', background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
                    fontSize: 13, color: 'var(--text)', fontWeight: 600, textAlign: 'center',
                    position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', minWidth: 110 }}>
                    {c.court_name}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>
                      {c.sport}{c.is_singles_only ? ' · одиночный' : ''}
                      {c.price_per_slot != null && ` · ${c.price_per_slot}₽`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((ts, rowIdx) => (
                <tr key={ts} style={{ background: rowIdx % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)' }}>
                  <td style={{ padding: '4px 16px', borderBottom: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12,
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600,
                    position: 'sticky', left: 0, zIndex: 5,
                    background: rowIdx % 2 === 0 ? 'var(--bg)' : '#131620' }}>
                    {ts}
                  </td>
                  {grid.courts.map(court => {
                    const slot = court.slots.find(s => s.slot_start === ts)
                    const slotIdx = timeSlots.indexOf(ts)
                    const sel = isSelected(court.court_id, slotIdx)

                    return (
                      <td key={court.court_id}
                        style={{ padding: '3px 4px', borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                        {slot ? (
                          <SlotCell
                            slot={slot}
                            isSelected={sel}
                            onMouseDown={() => onMouseDown(court.court_id, slotIdx, slot)}
                            onMouseEnter={() => onMouseEnter(court.court_id, slotIdx)}
                            onMouseUp={() => onMouseUp(court.court_id, court.court_name)}
                            onClick={() => onClick(court.court_id, court.court_name, slot)}
                          />
                        ) : (
                          <span style={{ color: 'var(--border)', fontSize: 10 }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
