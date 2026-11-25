import { useState, useEffect, useCallback } from 'react'
import { courtsApi, Court, LocationBrief, CourtCreate, LocationCreate } from '../api/courts'

const SURFACES = ['hard', 'clay', 'grass', 'carpet', 'acrylic']

const inp: React.CSSProperties = {
  padding: '7px 10px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
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

const SPORT_LABEL: Record<string, string> = { tennis: '🎾 Теннис', padel: '🏸 Падел' }
const TYPE_LABEL: Record<string, string> = { indoor: 'Крытый', outdoor: 'Открытый' }
const SURFACE_LABEL: Record<string, string> = {
  hard: 'Хард',
  clay: 'Грунт',
  grass: 'Трава',
  carpet: 'Ковёр',
  acrylic: 'Акрил',
}

function AddLocationForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !city.trim()) return
    setLoading(true)
    setError('')
    try {
      const payload: LocationCreate = { name: name.trim(), address: address.trim(), city: city.trim() }
      await courtsApi.createLocation(payload)
      setName(''); setAddress(''); setCity('')
      setOpen(false)
      onAdded()
    } catch {
      setError('Ошибка при создании локации')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          alignSelf: 'flex-start', padding: '8px 16px', background: 'transparent',
          border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
          color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
        }}
      >
        + Новая локация
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--surface)', border: '1px solid var(--accent)',
        borderRadius: 'var(--radius)', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>🏟️ Новая локация</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Название *</div>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Теннисный клуб Динамо" style={{ ...inp, minWidth: 200 }} required />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Город *</div>
          <input value={city} onChange={e => setCity(e.target.value)}
            placeholder="Нижний Новгород" style={{ ...inp, minWidth: 160 }} required />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Адрес</div>
          <input value={address} onChange={e => setAddress(e.target.value)}
            placeholder="ул. Ленина, 100" style={{ ...inp, minWidth: 200 }} />
        </div>
        <button type="submit" disabled={loading} style={{
          padding: '8px 18px', background: loading ? 'var(--border)' : 'var(--accent)',
          border: 'none', borderRadius: 'var(--radius)',
          color: loading ? 'var(--text-muted)' : '#0f1117',
          fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? '...' : 'Создать'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{
          padding: '8px 14px', background: 'transparent',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
        }}>
          Отмена
        </button>
      </div>
      {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}
    </form>
  )
}

function AddCourtForm({
  locationId,
  onAdded,
}: {
  locationId: string
  onAdded: () => void
}) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState<'tennis' | 'padel'>('tennis')
  const [courtType, setCourtType] = useState<'indoor' | 'outdoor'>('indoor')
  const [surface, setSurface] = useState('hard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const payload: CourtCreate = {
        name: name.trim(),
        sport,
        court_type: courtType,
        surface_type: surface,
      }
      await courtsApi.createCourt(locationId, payload)
      setName('')
      onAdded()
    } catch {
      setError('Ошибка при создании корта')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>➕ Добавить корт</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Название</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Корт 3"
            style={{ ...inp, minWidth: 140 }}
            required
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Вид спорта</div>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as 'tennis' | 'padel')}
            style={inp}
          >
            <option value="tennis">Теннис</option>
            <option value="padel">Падел</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Тип</div>
          <select
            value={courtType}
            onChange={(e) => setCourtType(e.target.value as 'indoor' | 'outdoor')}
            style={inp}
          >
            <option value="indoor">Крытый</option>
            <option value="outdoor">Открытый</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Покрытие</div>
          <select value={surface} onChange={(e) => setSurface(e.target.value)} style={inp}>
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {SURFACE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 18px',
            background: loading ? 'var(--border)' : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: loading ? 'var(--text-muted)' : '#0f1117',
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '...' : 'Добавить'}
        </button>
      </div>
      {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}
    </form>
  )
}

function CourtRow({
  court,
  locationId,
  onUpdated,
}: {
  court: Court
  locationId: string
  onUpdated: () => void
}) {
  const [editName, setEditName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    setSaving(true)
    try {
      await courtsApi.updateCourt(locationId, court.id, { is_active: !court.is_active })
      onUpdated()
    } finally {
      setSaving(false)
    }
  }

  const saveName = async () => {
    if (editName === null || editName.trim() === '' || editName.trim() === court.name) {
      setEditName(null)
      return
    }
    setSaving(true)
    try {
      await courtsApi.updateCourt(locationId, court.id, { name: editName.trim() })
      onUpdated()
    } finally {
      setSaving(false)
      setEditName(null)
    }
  }

  return (
    <tr style={{ opacity: court.is_active ? 1 : 0.45 }}>
      <td style={td}>
        {editName !== null ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName()
              if (e.key === 'Escape') setEditName(null)
            }}
            style={{ ...inp, width: 140 }}
          />
        ) : (
          <span
            title="Двойной клик для переименования"
            onDoubleClick={() => setEditName(court.name)}
            style={{ cursor: 'text', fontWeight: 500 }}
          >
            {court.name}
          </span>
        )}
      </td>
      <td style={td}>{SPORT_LABEL[court.sport] ?? court.sport}</td>
      <td style={td}>{TYPE_LABEL[court.court_type] ?? court.court_type}</td>
      <td style={td}>{SURFACE_LABEL[court.surface_type] ?? court.surface_type}</td>
      <td style={td}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: court.is_active ? 'var(--slot-free)' : 'var(--slot-booked)',
            background: court.is_active ? 'var(--slot-free-bg)' : 'var(--slot-booked-bg)',
            border: `1px solid ${court.is_active ? 'var(--slot-free)' : 'transparent'}44`,
          }}
        >
          {court.is_active ? 'Активен' : 'Отключён'}
        </span>
      </td>
      <td style={{ ...td, display: 'flex', gap: 6 }}>
        <button
          onClick={toggle}
          disabled={saving}
          style={{
            padding: '5px 10px',
            background: 'transparent',
            border: `1px solid ${court.is_active ? 'var(--danger)' : 'var(--accent)'}`,
            borderRadius: 5,
            color: court.is_active ? 'var(--danger)' : 'var(--accent)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {court.is_active ? 'Отключить' : 'Включить'}
        </button>
        <button
          onClick={() => setEditName(court.name)}
          style={{
            padding: '5px 10px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 5,
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Переим.
        </button>
      </td>
    </tr>
  )
}

export default function Courts() {
  const [locations, setLocations] = useState<LocationBrief[]>([])
  const [locationId, setLocationId] = useState('')
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(false)

  const loadLocations = useCallback(async () => {
    const locs = await courtsApi.listLocations()
    setLocations(locs)
    if (locs.length > 0) setLocationId(prev => prev || locs[0].id)
  }, [])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  const loadCourts = useCallback(async () => {
    if (!locationId) return
    setLoading(true)
    try {
      setCourts(await courtsApi.listCourts(locationId))
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    loadCourts()
  }, [loadCourts])

  const sel: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Управление кортами</h2>
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={{ ...sel, marginLeft: 'auto' }}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · {l.city}
            </option>
          ))}
        </select>
      </div>

      {/* Add location form */}
      <AddLocationForm onAdded={() => { loadLocations(); }} />

      {/* Add court form */}
      {locationId && <AddCourtForm locationId={locationId} onAdded={loadCourts} />}

      {/* Courts table */}
      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && courts.length === 0 && locationId && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>
          Нет кортов — добавьте первый
        </div>
      )}

      {!loading && courts.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Название</th>
                <th style={th}>Спорт</th>
                <th style={th}>Тип</th>
                <th style={th}>Покрытие</th>
                <th style={th}>Статус</th>
                <th style={th}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((c) => (
                <CourtRow key={c.id} court={c} locationId={locationId} onUpdated={loadCourts} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        💡 Двойной клик по названию — переименовать
      </div>
    </div>
  )
}
