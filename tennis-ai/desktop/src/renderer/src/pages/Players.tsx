import { useState } from 'react'
import { playersApi, PlayerPublic } from '../api/players'

const inp: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  minWidth: 220,
}

const btn: React.CSSProperties = {
  padding: '8px 18px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 'var(--radius)',
  color: '#0f1117',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--surface-2)',
        border: '2px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function PlayerCard({ p }: { p: PlayerPublic }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '16px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <Avatar name={p.first_name} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {p.last_name} {p.first_name} {p.patronymic ?? ''}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
          @{p.nickname} · {p.gender === 'M' ? 'муж' : 'жен'}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'NTRP', value: p.ntrp_level },
            { label: 'STM', value: p.stm_level },
            { label: 'Elo', value: String(p.elo_rating) },
            { label: 'Стаж', value: `${p.years_playing} л.` },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{label} </span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Players() {
  const [mode, setMode] = useState<'nickname' | 'phone'>('nickname')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerPublic[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const params = mode === 'phone' ? { phone: query.trim() } : { nickname: query.trim() }
      setResults(await playersApi.search(params))
    } catch {
      setError('Игрок не найден или ошибка соединения')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700 }}>Поиск игроков</h2>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          {(['nickname', 'phone'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                padding: '8px 14px',
                background: mode === m ? 'var(--surface-2)' : 'transparent',
                border: 'none',
                color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: mode === m ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {m === 'nickname' ? 'По нику' : 'По телефону'}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'phone' ? '+79991234567' : 'Поиск по нику...'}
          style={inp}
        />
        <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Поиск...' : 'Найти'}
        </button>
      </form>

      {error && (
        <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>
      )}

      {results === null && (
        <div style={{ color: 'var(--text-muted)', marginTop: 32, textAlign: 'center' }}>
          Введите никнейм или номер телефона для поиска
        </div>
      )}

      {results !== null && results.length === 0 && !error && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Ничего не найдено</div>
      )}

      {results && results.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 12,
          }}
        >
          {results.map((p) => (
            <PlayerCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
