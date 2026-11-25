import { useState, useEffect, useCallback } from 'react'
import { analyticsApi, HeatmapResponse, RevenueResponse, TrainersResponse } from '../api/analytics'
import { courtsApi, LocationBrief } from '../api/courts'

// ─── стили ───────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  card:  { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  inp:   { padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' },
  btn:   { padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  th:    { padding: '9px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' as const },
  td:    { padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  label: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' as const },
}

// ─── helpers ─────────────────────────────────────────────────
const DOW_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8) // 08…21

function today()    { return new Date().toISOString().slice(0, 10) }
function monthAgo() {
  const d = new Date(); d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

function heatColor(count: number, max: number): string {
  if (max === 0 || count === 0) return 'var(--surface-2)'
  const ratio = count / max
  if (ratio < 0.25) return '#1a6f3c44'
  if (ratio < 0.5)  return '#1a6f3c88'
  if (ratio < 0.75) return '#22c55eaa'
  return '#22c55e'
}

// ─── DateRange компонент ──────────────────────────────────────
function DateRange({ from, to, onChange }: {
  from: string; to: string
  onChange: (from: string, to: string) => void
}) {
  const presets = [
    { label: '7 дн.', days: 7 }, { label: '30 дн.', days: 30 },
    { label: '90 дн.', days: 90 },
  ]
  const applyPreset = (days: number) => {
    const t = new Date(); const f = new Date(); f.setDate(t.getDate() - days + 1)
    onChange(f.toISOString().slice(0, 10), t.toISOString().slice(0, 10))
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {presets.map(p => (
        <button key={p.days} onClick={() => applyPreset(p.days)}
          style={{ ...s.btn, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 12px', fontSize: 12 }}>
          {p.label}
        </button>
      ))}
      <input type="date" value={from} onChange={e => onChange(e.target.value, to)} style={s.inp} />
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
      <input type="date" value={to} onChange={e => onChange(from, e.target.value)} style={s.inp} />
    </div>
  )
}

// ─── HEATMAP TAB ─────────────────────────────────────────────
function HeatmapTab({ locations }: { locations: LocationBrief[] }) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [dateFrom, setDateFrom] = useState(monthAgo())
  const [dateTo, setDateTo]     = useState(today())
  const [data, setData]         = useState<HeatmapResponse | null>(null)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    try { setData(await analyticsApi.heatmap(locationId, dateFrom, dateTo)) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [locationId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const cellMap = new Map<string, number>()
  data?.cells.forEach(c => cellMap.set(`${c.dow}-${c.hour}`, c.count))
  const max = data?.max_count ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <span style={s.label}>Локация</span>
          <select value={locationId} onChange={e => setLocationId(e.target.value)} style={s.inp}>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <span style={s.label}>Период</span>
          <DateRange from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
        </div>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && data && (
        <div style={{ ...s.card, overflow: 'auto' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
            Загрузка кортов — броней за период (час × день недели)
          </div>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...s.th, minWidth: 44 }}>Час</th>
                {DOW_LABELS.map(d => (
                  <th key={d} style={{ ...s.th, textAlign: 'center', minWidth: 56 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(h => (
                <tr key={h}>
                  <td style={{ ...s.td, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {String(h).padStart(2, '0')}:00
                  </td>
                  {DOW_LABELS.map((_, dow) => {
                    const cnt = cellMap.get(`${dow}-${h}`) ?? 0
                    return (
                      <td key={dow} style={{ ...s.td, textAlign: 'center', padding: 3 }}>
                        <div style={{
                          width: 48, height: 28, borderRadius: 4, margin: '0 auto',
                          background: heatColor(cnt, max),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: cnt > 0 ? 600 : 400,
                          color: cnt / (max || 1) > 0.5 ? '#fff' : 'var(--text-muted)',
                        }}>
                          {cnt > 0 ? cnt : ''}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            Интенсивность:
            {[0.1, 0.35, 0.6, 0.85, 1].map(r => (
              <div key={r} style={{ width: 20, height: 14, borderRadius: 3, background: heatColor(r * max, max) }} />
            ))}
            <span>от 0 до {max}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── REVENUE TAB ─────────────────────────────────────────────
const PAY_LABELS: Record<string, string> = {
  cash: '💵 Наличные', card: '💳 Карта', sbp: '📱 СБП', subscription: '🎫 Абонемент'
}
const PAY_COLORS: Record<string, string> = {
  cash: '#22c55e', card: '#3b82f6', sbp: '#f59e0b', subscription: '#a855f7'
}

function RevenueTab() {
  const [dateFrom, setDateFrom] = useState(monthAgo())
  const [dateTo, setDateTo]     = useState(today())
  const [data, setData]         = useState<RevenueResponse | null>(null)
  const [loading, setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await analyticsApi.revenue(dateFrom, dateTo)) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const doExport = async () => {
    setExporting(true)
    try { await analyticsApi.exportRevenue(dateFrom, dateTo) }
    catch { alert('Ошибка экспорта') } finally { setExporting(false) }
  }

  const maxTotal = data ? Math.max(...data.items.map(i => i.total), 1) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <span style={s.label}>Период</span>
          <DateRange from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
        </div>
        <button onClick={doExport} disabled={exporting || !data}
          style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117', marginTop: 18 }}>
          {exporting ? '...' : '⬇ Excel'}
        </button>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && data && (
        <>
          {/* Итого карточки */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {(['cash', 'card', 'sbp', 'subscription'] as const).map(k => (
              <div key={k} style={{ ...s.card, borderLeft: `3px solid ${PAY_COLORS[k]}` }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{PAY_LABELS[k]}</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: PAY_COLORS[k] }}>
                  {data.totals[k].toLocaleString('ru')} ₽
                </div>
              </div>
            ))}
            <div style={{ ...s.card, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>💰 Итого</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>
                {data.totals.total.toLocaleString('ru')} ₽
              </div>
            </div>
          </div>

          {/* Бар-чарт по дням */}
          <div style={s.card}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Выручка по дням</div>
            {data.items.length === 0
              ? <div style={{ color: 'var(--text-muted)' }}>Нет данных за период</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.items.map(item => (
                    <div key={item.day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 90, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(item.day + 'T12:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div style={{ flex: 1, height: 20, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                        {(['cash', 'card', 'sbp', 'subscription'] as const).map(k => {
                          const w = item.total > 0 ? (item[k] / maxTotal) * 100 : 0
                          return w > 0 ? (
                            <div key={k} style={{ width: `${w}%`, background: PAY_COLORS[k], minWidth: 2 }} title={`${PAY_LABELS[k]}: ${item[k]} ₽`} />
                          ) : null
                        })}
                      </div>
                      <div style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        {item.total.toLocaleString('ru')} ₽
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </>
      )}
    </div>
  )
}

// ─── TRAINERS TAB ─────────────────────────────────────────────
function TrainersTab() {
  const [dateFrom, setDateFrom] = useState(monthAgo())
  const [dateTo, setDateTo]     = useState(today())
  const [data, setData]         = useState<TrainersResponse | null>(null)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await analyticsApi.trainers(dateFrom, dateTo)) }
    catch { /* ignore */ } finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <span style={s.label}>Период</span>
        <DateRange from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
      </div>

      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && data && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={s.th}>#</th>
                <th style={s.th}>Тренер</th>
                <th style={s.th}>Ник</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Тренировок</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Часов</th>
                <th style={s.th}>Нагрузка</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Нет тренировок за период
                </td></tr>
              )}
              {data.items.map((t, i) => {
                const maxHours = data.items[0]?.hours ?? 1
                const pct = Math.round((t.hours / maxHours) * 100)
                return (
                  <tr key={t.trainer_id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)' }}>
                    <td style={{ ...s.td, color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                    <td style={{ ...s.td, fontWeight: 500 }}>{t.last_name} {t.first_name}</td>
                    <td style={{ ...s.td, color: 'var(--text-muted)', fontSize: 12 }}>@{t.nickname}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{t.sessions}</td>
                    <td style={{ ...s.td, textAlign: 'center', fontWeight: 600 }}>{t.hours} ч</td>
                    <td style={{ ...s.td, minWidth: 140 }}>
                      <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── EXPORT TAB ───────────────────────────────────────────────
function ExportTab({ locations }: { locations: LocationBrief[] }) {
  const [dateFrom, setDateFrom] = useState(monthAgo())
  const [dateTo, setDateTo]     = useState(today())
  const [locationId, setLocationId] = useState('')
  const [loading, setLoading]   = useState<string | null>(null)

  const doExport = async (type: 'bookings' | 'revenue') => {
    setLoading(type)
    try {
      if (type === 'bookings') await analyticsApi.exportBookings(dateFrom, dateTo, locationId || undefined)
      else await analyticsApi.exportRevenue(dateFrom, dateTo)
    } catch { alert('Ошибка экспорта') } finally { setLoading(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 540 }}>
      <div style={s.card}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Параметры экспорта</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <span style={s.label}>Период</span>
            <DateRange from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }} />
          </div>
          <div>
            <span style={s.label}>Локация (для отчёта броней)</span>
            <select value={locationId} onChange={e => setLocationId(e.target.value)} style={s.inp}>
              <option value="">Все локации</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { type: 'bookings' as const, icon: '📅', title: 'Реестр броней', desc: 'Все брони за период: корт, игрок, время' },
          { type: 'revenue' as const,  icon: '💰', title: 'Отчёт по выручке', desc: 'По дням: наличные, карта, СБП, абонемент, итого' },
        ].map(item => (
          <div key={item.type} style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
            <button onClick={() => doExport(item.type)} disabled={loading === item.type}
              style={{ ...s.btn, background: loading === item.type ? 'var(--border)' : 'var(--accent)',
                color: loading === item.type ? 'var(--text-muted)' : '#0f1117', flexShrink: 0 }}>
              {loading === item.type ? '...' : '⬇ Excel'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
type Tab = 'heatmap' | 'revenue' | 'trainers' | 'export'
const TABS: { id: Tab; label: string }[] = [
  { id: 'heatmap',  label: '🔥 Загрузка кортов' },
  { id: 'revenue',  label: '💰 Выручка' },
  { id: 'trainers', label: '👨‍🏫 Тренеры' },
  { id: 'export',   label: '📊 Экспорт' },
]

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('heatmap')
  const [locations, setLocations] = useState<LocationBrief[]>([])

  useEffect(() => {
    courtsApi.listLocations().then(setLocations)
  }, [])

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      <h2 style={{ fontSize: 17, fontWeight: 700 }}>📊 Аналитика</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'fit-content', overflow: 'hidden', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '9px 20px', background: tab === t.id ? 'var(--surface-2)' : 'transparent',
              border: 'none', color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: tab === t.id ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'heatmap'  && <HeatmapTab  locations={locations} />}
      {tab === 'revenue'  && <RevenueTab />}
      {tab === 'trainers' && <TrainersTab />}
      {tab === 'export'   && <ExportTab   locations={locations} />}
    </div>
  )
}
