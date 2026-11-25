import { useState, useEffect, useCallback } from 'react'
import { queueApi, QueueEntry } from '../api/queue'
import { courtsApi, LocationBrief, Court } from '../api/courts'
import { playersApi, PlayerPublic } from '../api/players'

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  inp:  { padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' },
  btn:  { padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  th:   { padding: '9px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0 },
  td:   { padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' as const },
}

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  waiting:  { text: 'Ожидает',   color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  notified: { text: 'Уведомлён', color: '#f59e0b',            bg: '#f59e0b22' },
  booked:   { text: 'Забронировал', color: 'var(--slot-free)', bg: 'var(--slot-free-bg)' },
  cancelled:{ text: 'Отменён',   color: 'var(--danger)',       bg: 'var(--slot-booked-bg)' },
}

const SLOT_TIMES: string[] = []
for (let h = 8; h <= 21; h++) {
  SLOT_TIMES.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 21) SLOT_TIMES.push(`${String(h).padStart(2, '0')}:30`)
}

function AddEntryForm({ courts, onAdded }: { courts: Court[]; onAdded: () => void }) {
  const [courtId, setCourtId] = useState(courts[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [slot, setSlot] = useState('08:00')
  const [search, setSearch] = useState('')
  const [players, setPlayers] = useState<PlayerPublic[]>([])
  const [selected, setSelected] = useState<PlayerPublic | null>(null)
  const [loading, setLoading] = useState(false)
  const [anyCourt, setAnyCourt] = useState(false)
  const [durationH, setDurationH] = useState(1)

  const slotEnd = (() => {
    const [h, m] = slot.split(':').map(Number)
    const total = h * 60 + m + Math.round(durationH * 60)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })()

  const doSearch = async () => {
    if (!search.trim()) return
    const params = search.startsWith('+') ? { phone: search.trim() } : { nickname: search.trim() }
    setPlayers(await playersApi.search(params))
  }

  const submit = async () => {
    if (!selected || !courtId) return
    setLoading(true)
    try {
      await queueApi.add({
        court_id: courtId, date,
        slot_start: slot + ':00',
        slot_end: slotEnd + ':00',
        min_duration: Math.round(durationH * 60),
        user_id: selected.id,
        any_court: anyCourt,
      })
      setSearch(''); setPlayers([]); setSelected(null); setAnyCourt(false); onAdded()
    } catch (e: unknown) {
      const detail = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail
      alert(detail ?? 'Ошибка добавления в очередь')
    } finally { setLoading(false) }
  }

  return (
    <div style={s.card}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>➕ Добавить в очередь</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <select value={courtId} onChange={e => setCourtId(e.target.value)} style={s.inp}>
          {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={s.inp} />
        <select value={slot} onChange={e => setSlot(e.target.value)} style={{ ...s.inp, width: 90 }}>
          {SLOT_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={durationH} onChange={e => setDurationH(Number(e.target.value))} style={{ ...s.inp, width: 80 }}>
          <option value={1}>1 ч</option>
          <option value={1.5}>1.5 ч</option>
          <option value={2}>2 ч</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>до {slotEnd}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '6px 10px', borderRadius: 6, border: `1px solid ${anyCourt ? 'var(--accent)' : 'var(--border)'}`, background: anyCourt ? 'var(--slot-mine-bg)' : 'transparent' }}>
          <input type="checkbox" checked={anyCourt} onChange={e => setAnyCourt(e.target.checked)} />
          Любой корт локации
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Ник или +79991234567" style={{ ...s.inp, flex: 1 }} />
        <button onClick={doSearch} style={{ ...s.btn, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Найти
        </button>
      </div>
      {players.map(p => (
        <div key={p.id} onClick={() => setSelected(p)}
          style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
            background: selected?.id === p.id ? 'var(--slot-mine-bg)' : 'var(--surface-2)',
            border: `1px solid ${selected?.id === p.id ? 'var(--slot-mine)' : 'var(--border)'}` }}>
          <span style={{ fontWeight: 500 }}>{p.last_name} {p.first_name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>@{p.nickname}</span>
        </div>
      ))}
      <button onClick={submit} disabled={loading || !selected || !courtId}
        style={{ ...s.btn, marginTop: 10, background: (!selected || !courtId) ? 'var(--border)' : 'var(--accent)', color: (!selected || !courtId) ? 'var(--text-muted)' : '#0f1117' }}>
        {loading ? '...' : 'Добавить'}
      </button>
    </div>
  )
}

export default function Queue() {
  const [locations, setLocations] = useState<LocationBrief[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [locationId, setLocationId] = useState('')
  const [courtId, setCourtId] = useState('all')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    courtsApi.listLocations().then(locs => {
      setLocations(locs)
      if (locs.length) setLocationId(locs[0].id)
    })
  }, [])

  useEffect(() => {
    if (!locationId) return
    courtsApi.listCourts(locationId).then(cs => {
      setCourts(cs)
      setCourtId('all')
    })
  }, [locationId])

  const load = useCallback(async () => {
    const params: { court_id?: string; date?: string } = { date }
    if (courtId !== 'all') params.court_id = courtId
    setEntries(await queueApi.list(params))
  }, [courtId, date])

  useEffect(() => { load() }, [load])

  const notify = async (entry: QueueEntry) => {
    try { await queueApi.notify(entry.id); showToast('Уведомление отправлено'); load() }
    catch { showToast('Ошибка') }
  }

  const remove = async (entry: QueueEntry) => {
    try { await queueApi.remove(entry.id); showToast('Удалено'); load() }
    catch { showToast('Ошибка удаления') }
  }

  const selStyle: React.CSSProperties = { padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>⏳ Очередь</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={locationId} onChange={e => setLocationId(e.target.value)} style={selStyle}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={courtId} onChange={e => setCourtId(e.target.value)} style={selStyle}>
            <option value="all">Все корты</option>
            {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={selStyle} />
        </div>
      </div>

      {toast && <div style={{ padding: '8px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>{toast}</div>}

      {courts.length > 0 && <AddEntryForm courts={courts} onAdded={load} />}

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>Игрок</th>
              <th style={s.th}>Корт</th>
              <th style={s.th}>Слот</th>
              <th style={s.th}>Статус</th>
              <th style={s.th}>Добавлен</th>
              <th style={s.th}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--text-muted)' }}>Очередь пуста</td></tr>
            )}
            {entries.map((e, i) => {
              const st = STATUS_LABEL[e.status] ?? STATUS_LABEL.waiting
              const baseCourtName = courts.find(c => c.id === e.court_id)?.name ?? e.court_name ?? e.court_id.slice(0, 8)
              const courtName = e.any_court
                ? `${e.location_name ?? 'Локация'} · любой корт`
                : baseCourtName
              const slotTime = e.slot_end
                ? `${e.slot_start?.slice(0, 5)}–${e.slot_end.slice(0, 5)} (мин. ${e.min_duration ?? 30} мин)`
                : e.slot_start?.slice(0, 5) ?? '—'
              const addedAt = new Date(e.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              return (
                <tr key={e.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)' }}>
                  <td style={{ ...s.td, color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                  <td style={{ ...s.td, fontWeight: 500 }}>
                    {e.user.last_name} {e.user.first_name}
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 5 }}>@{e.user.nickname}</span>
                  </td>
                  <td style={s.td}>{courtName}</td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>{e.date} {slotTime}</td>
                  <td style={s.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>
                      {st.text}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{addedAt}</td>
                  <td style={{ ...s.td }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {e.status === 'waiting' && (
                        <button onClick={() => notify(e)}
                          style={{ ...s.btn, background: 'var(--slot-mine-bg)', color: 'var(--slot-mine)', border: '1px solid var(--slot-mine)44' }}>
                          Уведомить
                        </button>
                      )}
                      {(e.status === 'waiting' || e.status === 'notified') && (
                        <button onClick={() => remove(e)}
                          style={{ ...s.btn, background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                          Удалить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
