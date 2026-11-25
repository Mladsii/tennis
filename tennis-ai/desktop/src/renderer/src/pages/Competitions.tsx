import { useState, useEffect } from 'react'
import { competitionsApi, CompetitionListItem } from '../api/competitions'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  registration: { label: 'Регистрация', color: 'var(--slot-free)' },
  ongoing: { label: 'Идёт', color: 'var(--slot-mine)' },
  finished: { label: 'Завершено', color: 'var(--text-muted)' },
  cancelled: { label: 'Отменено', color: 'var(--danger)' },
}

const th: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
  fontSize: 12,
  color: 'var(--text-muted)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 5,
}

const td: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  fontSize: 13,
  verticalAlign: 'middle',
}

export default function Competitions() {
  const [items, setItems] = useState<CompetitionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    competitionsApi
      .list()
      .then(setItems)
      .catch(() => setError('Не удалось загрузить соревнования'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Соревнования</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {!loading && `${items.length} записей`}
        </span>
      </div>

      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && !error && items.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>
          Соревнований пока нет
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Название</th>
                <th style={th}>Организатор</th>
                <th style={th}>Начало</th>
                <th style={th}>Конец</th>
                <th style={th}>Место</th>
                <th style={th}>Статус</th>
                <th style={{ ...th, textAlign: 'center' }}>Участников</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => {
                const s = STATUS_MAP[c.status] ?? { label: c.status, color: 'var(--text-muted)' }
                return (
                  <tr
                    key={c.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)' }}
                  >
                    <td style={{ ...td, fontWeight: 500 }}>{c.name}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 500 }}>
                        {c.organizer.last_name} {c.organizer.first_name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>
                        @{c.organizer.nickname}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(c.start_date)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(c.end_date)}</td>
                    <td style={{ ...td, color: c.location ? 'var(--text)' : 'var(--text-muted)' }}>
                      {c.location ?? '—'}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: s.color,
                          background: s.color + '22',
                          border: `1px solid ${s.color}44`,
                        }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          minWidth: 24,
                          padding: '2px 8px',
                          background: 'var(--slot-mine-bg)',
                          color: 'var(--slot-mine)',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {c.participant_count}
                      </span>
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
