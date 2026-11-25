import { useState, useEffect } from 'react'
import { trainingsApi, TrainingListItem } from '../api/trainings'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const SCHED_LABEL: Record<string, string> = {
  one_time: 'Разовая',
  weekly: 'Еженедельная',
}

const SCHED_COLOR: Record<string, string> = {
  one_time: 'var(--text-muted)',
  weekly: 'var(--slot-mine)',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: color + '22',
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  )
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

export default function Trainings() {
  const [items, setItems] = useState<TrainingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    trainingsApi
      .list()
      .then(setItems)
      .catch(() => setError('Не удалось загрузить тренировки'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Тренировки</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {!loading && `${items.length} записей`}
        </span>
      </div>

      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && !error && items.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>
          Тренировок пока нет
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Название</th>
                <th style={th}>Тип</th>
                <th style={th}>Начало</th>
                <th style={th}>Конец</th>
                <th style={th}>Место</th>
                <th style={th}>Организатор</th>
                <th style={{ ...th, textAlign: 'center' }}>Участников</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr
                  key={t.id}
                  style={{ background: i % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)' }}
                >
                  <td style={{ ...td, fontWeight: 500 }}>{t.title}</td>
                  <td style={td}>
                    <Badge
                      label={SCHED_LABEL[t.schedule_type] ?? t.schedule_type}
                      color={SCHED_COLOR[t.schedule_type] ?? 'var(--text-muted)'}
                    />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtDate(t.start_time)}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtDate(t.end_time)}
                  </td>
                  <td style={{ ...td, color: t.location ? 'var(--text)' : 'var(--text-muted)' }}>
                    {t.location ?? '—'}
                  </td>
                  <td style={td}>
                    <span style={{ fontWeight: 500 }}>
                      {t.organizer.last_name} {t.organizer.first_name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>
                      @{t.organizer.nickname}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        minWidth: 24,
                        padding: '2px 8px',
                        background: 'var(--slot-free-bg)',
                        color: 'var(--slot-free)',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {t.confirmed_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
