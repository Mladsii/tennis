import { useState, useEffect } from 'react'
import { bookingsApi, LocationInfo, CourtReport, DayRevenue } from '../api/bookings'

const TODAY = new Date().toISOString().slice(0, 10)
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}

const ctrlStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none',
}

const PRESETS = [
  { label: 'Сегодня',  from: TODAY,         to: TODAY },
  { label: '7 дней',   from: daysAgo(6),    to: TODAY },
  { label: '30 дней',  from: daysAgo(29),   to: TODAY },
  { label: 'Этот мес', from: TODAY.slice(0,7) + '-01', to: TODAY },
]

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function LoadBar({ pct }: { pct: number }) {
  const clamp = Math.min(100, Math.max(0, pct))
  const color = clamp >= 80 ? '#22c55e' : clamp >= 50 ? '#f59e0b' : '#94a3b8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${clamp}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color, minWidth: 34, textAlign: 'right' }}>{clamp.toFixed(0)}%</span>
    </div>
  )
}

export default function Reports() {
  const [locations, setLocations] = useState<LocationInfo[]>([])
  const [locationId, setLocationId] = useState('')
  const [dateFrom, setDateFrom]   = useState(daysAgo(6))
  const [dateTo, setDateTo]       = useState(TODAY)
  const [report, setReport]       = useState<CourtReport | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    bookingsApi.listLocations().then(locs => {
      setLocations(locs)
      if (locs.length) setLocationId(locs[0].id)
    })
  }, [])

  const load = async () => {
    if (!locationId) return
    setLoading(true); setError(''); setReport(null)
    try {
      setReport(await bookingsApi.getReport(locationId, dateFrom, dateTo))
    } catch (e: unknown) {
      const detail = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail
      setError(detail ?? 'Не удалось загрузить отчёт')
    } finally { setLoading(false) }
  }

  // Загружаем при выборе локации
  useEffect(() => { if (locationId) load() }, [locationId])  // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (from: string, to: string) => {
    setDateFrom(from); setDateTo(to)
  }

  // Максимальная выручка для масштабирования графика
  const maxRevenue = report ? Math.max(...report.by_day.map(d => d.revenue), 1) : 1

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>📊 Отчёты по выручке и загруженности</h2>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={locationId} onChange={e => setLocationId(e.target.value)} style={ctrlStyle}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        {/* Пресеты */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p.from, p.to)}
              style={{ padding: '7px 12px', border: `1px solid ${dateFrom === p.from && dateTo === p.to ? 'var(--accent)' : 'var(--border)'}`,
                background: dateFrom === p.from && dateTo === p.to ? 'rgba(234,179,8,0.1)' : 'var(--surface)',
                borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
              {p.label}
            </button>
          ))}
        </div>

        <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} style={{ ...ctrlStyle, width: 140 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
        <input type="date" value={dateTo} min={dateFrom} onChange={e => setDateTo(e.target.value)} style={{ ...ctrlStyle, width: 140 }} />

        <button onClick={load} disabled={loading}
          style={{ padding: '8px 18px', background: loading ? 'var(--border)' : 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius)', color: loading ? 'var(--text-muted)' : '#0f1117',
            fontWeight: 600, fontSize: 13, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? '...' : 'Загрузить'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius)', color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!report && !loading && !error && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>Выберите параметры и нажмите «Загрузить»</div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard
              label="Выручка за период"
              value={`${report.total_revenue.toLocaleString('ru-RU')} ₽`}
              sub={`${report.date_from} – ${report.date_to}`}
              color="#22c55e"
            />
            <StatCard
              label="Бронирований"
              value={String(report.total_bookings)}
              sub="активных броней"
            />
            <StatCard
              label="Уникальных игроков"
              value={String(report.total_visitors)}
            />
            <StatCard
              label="Средняя загрузка"
              value={`${report.avg_load_pct.toFixed(1)}%`}
              color={report.avg_load_pct >= 70 ? '#22c55e' : report.avg_load_pct >= 40 ? '#f59e0b' : '#94a3b8'}
            />
          </div>

          {/* Мини-график выручки */}
          {report.by_day.length > 1 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>График выручки по дням</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, overflow: 'hidden' }}>
                {report.by_day.map((d: DayRevenue) => {
                  const h = maxRevenue > 0 ? Math.round((d.revenue / maxRevenue) * 58) + 2 : 2
                  const dayLabel = new Date(d.date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                  return (
                    <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                      title={`${dayLabel}: ${d.revenue.toLocaleString('ru-RU')} ₽, ${d.bookings_count} броней`}>
                      <div style={{ width: '100%', maxWidth: 24, height: h, background: '#22c55e', borderRadius: '3px 3px 0 0',
                        opacity: d.revenue > 0 ? 1 : 0.25, minHeight: 2 }} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Детальная таблица по дням */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Дата', 'Выручка', 'Броней', 'Игроков', 'Занято', 'Свободно', 'Загрузка'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: 11, color: 'var(--text-muted)',
                      fontWeight: 600, textAlign: h === 'Дата' ? 'left' : 'right',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.by_day.map((d: DayRevenue, i: number) => {
                  const dow = new Date(d.date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short' })
                  const dateStr = new Date(d.date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                  const isWknd = [0, 6].includes(new Date(d.date + 'T12:00').getDay())
                  return (
                    <tr key={d.date} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)' }}>
                      <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--border)',
                        color: isWknd ? '#f59e0b' : 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 6 }}>{dow}</span>
                        {dateStr}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--border)',
                        textAlign: 'right', fontWeight: 700, color: d.revenue > 0 ? '#22c55e' : 'var(--text-muted)' }}>
                        {d.revenue > 0 ? `${d.revenue.toLocaleString('ru-RU')} ₽` : '—'}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        {d.bookings_count}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        {d.unique_visitors}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        {d.used_slots}
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', textAlign: 'right',
                        color: 'var(--text-muted)' }}>
                        {d.free_slots}
                      </td>
                      <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', minWidth: 100 }}>
                        <LoadBar pct={d.load_pct} />
                      </td>
                    </tr>
                  )
                })}
                {/* Итого */}
                <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                  <td style={{ padding: '9px 14px', fontSize: 13, borderTop: '2px solid var(--border)' }}>Итого</td>
                  <td style={{ padding: '9px 14px', fontSize: 13, borderTop: '2px solid var(--border)',
                    textAlign: 'right', color: '#22c55e' }}>
                    {report.total_revenue.toLocaleString('ru-RU')} ₽
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 13, borderTop: '2px solid var(--border)', textAlign: 'right' }}>
                    {report.total_bookings}
                  </td>
                  <td style={{ padding: '9px 14px', fontSize: 13, borderTop: '2px solid var(--border)', textAlign: 'right' }}>
                    {report.total_visitors}
                  </td>
                  <td colSpan={2} style={{ padding: '9px 14px', borderTop: '2px solid var(--border)' }} />
                  <td style={{ padding: '9px 14px', borderTop: '2px solid var(--border)', minWidth: 100 }}>
                    <LoadBar pct={report.avg_load_pct} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
