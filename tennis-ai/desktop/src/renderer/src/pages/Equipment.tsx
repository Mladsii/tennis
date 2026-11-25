import { useState, useEffect, useCallback } from 'react'
import { equipmentApi, EquipmentItem, EquipmentRental } from '../api/equipment'
import { courtsApi, LocationBrief } from '../api/courts'

const TYPE_LABEL: Record<string, string> = { racket: '🎾 Ракетка', balls: '🎱 Мячи', basket: '🧺 Корзина', other: '📦 Прочее' }
const TYPE_LIST = ['racket', 'balls', 'basket', 'other'] as const

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  inp:  { padding: '7px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' },
  btn:  { padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  th:   { padding: '9px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0 },
  td:   { padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' as const },
}

function AddItemForm({ locationId, onAdded }: { locationId: string; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<typeof TYPE_LIST[number]>('racket')
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await equipmentApi.create({ location_id: locationId, name: name.trim(), equipment_type: type, quantity_total: Number(qty), price_per_hour: price ? Number(price) : undefined })
      setName(''); setQty('1'); setPrice(''); onAdded()
    } catch { alert('Ошибка добавления') } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} style={{ ...s.card }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>➕ Добавить инвентарь</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ракетка Wilson Pro" required style={{ ...s.inp, minWidth: 160 }} />
        <select value={type} onChange={e => setType(e.target.value as typeof type)} style={s.inp}>
          {TYPE_LIST.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <input value={qty} onChange={e => setQty(e.target.value)} type="number" min="1" placeholder="Кол-во" style={{ ...s.inp, width: 80 }} />
        <input value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="₽/час (необяз.)" style={{ ...s.inp, width: 110 }} />
        <button type="submit" disabled={loading || !name.trim()} style={{ ...s.btn, background: loading ? 'var(--border)' : 'var(--accent)', color: loading ? 'var(--text-muted)' : '#0f1117' }}>
          {loading ? '...' : 'Добавить'}
        </button>
      </div>
    </form>
  )
}

export default function Equipment() {
  const [locations, setLocations] = useState<LocationBrief[]>([])
  const [locationId, setLocationId] = useState('')
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [rentals, setRentals] = useState<EquipmentRental[]>([])
  const [tab, setTab] = useState<'inventory' | 'rentals'>('inventory')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    courtsApi.listLocations().then(locs => { setLocations(locs); if (locs.length) setLocationId(locs[0].id) })
  }, [])

  const loadItems = useCallback(async () => {
    if (!locationId) return
    const [inv, rnt] = await Promise.all([
      equipmentApi.list({ location_id: locationId }),
      equipmentApi.listRentals({ location_id: locationId }),
    ])
    setItems(inv); setRentals(rnt)
  }, [locationId])

  useEffect(() => { loadItems() }, [loadItems])

  const toggleActive = async (item: EquipmentItem) => {
    await equipmentApi.update(item.id, { is_active: !item.is_active })
    loadItems()
  }

  const rent = async (itemId: string) => {
    try { await equipmentApi.rent({ equipment_id: itemId }); showToast('Выдано'); loadItems() }
    catch (e: unknown) { showToast((e as {response?: {data?: {detail?: string}}})?.response?.data?.detail ?? 'Ошибка') }
  }

  const returnItem = async (rentalId: string) => {
    try { await equipmentApi.returnRental(rentalId); showToast('Возвращено'); loadItems() }
    catch { showToast('Ошибка возврата') }
  }

  const selStyle: React.CSSProperties = { padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>🏸 Инвентарь</h2>
        <select value={locationId} onChange={e => setLocationId(e.target.value)} style={{ ...selStyle, marginLeft: 'auto' }}>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {toast && <div style={{ padding: '8px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>{toast}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', width: 'fit-content', overflow: 'hidden' }}>
        {(['inventory', 'rentals'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', background: tab === t ? 'var(--surface-2)' : 'transparent', border: 'none',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)', fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: 'pointer' }}>
            {t === 'inventory' ? 'Склад' : `Аренда (${rentals.length})`}
          </button>
        ))}
      </div>

      {tab === 'inventory' && locationId && <AddItemForm locationId={locationId} onAdded={loadItems} />}

      {tab === 'inventory' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={s.th}>Наименование</th><th style={s.th}>Тип</th>
              <th style={{ ...s.th, textAlign: 'center' }}>Всего</th><th style={{ ...s.th, textAlign: 'center' }}>Свободно</th>
              <th style={s.th}>₽/час</th><th style={s.th}>Статус</th><th style={s.th}>Действия</th>
            </tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--text-muted)' }}>Нет инвентаря</td></tr>}
              {items.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)', opacity: item.is_active ? 1 : 0.45 }}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{item.name}</td>
                  <td style={s.td}>{TYPE_LABEL[item.equipment_type] ?? item.equipment_type}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{item.quantity_total}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: item.quantity_available > 0 ? 'var(--slot-free)' : 'var(--danger)' }}>
                      {item.quantity_available}
                    </span>
                  </td>
                  <td style={s.td}>{item.price_per_hour ? `${item.price_per_hour} ₽` : '—'}</td>
                  <td style={s.td}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      color: item.is_active ? 'var(--slot-free)' : 'var(--slot-booked)',
                      background: item.is_active ? 'var(--slot-free-bg)' : 'var(--slot-booked-bg)' }}>
                      {item.is_active ? 'Активен' : 'Откл.'}
                    </span>
                  </td>
                  <td style={{ ...s.td, display: 'flex', gap: 5 }}>
                    {item.is_active && item.quantity_available > 0 && (
                      <button onClick={() => rent(item.id)} style={{ ...s.btn, background: 'var(--slot-mine-bg)', color: 'var(--slot-mine)', border: '1px solid var(--slot-mine)44' }}>
                        Выдать
                      </button>
                    )}
                    <button onClick={() => toggleActive(item)}
                      style={{ ...s.btn, background: 'transparent', border: `1px solid ${item.is_active ? 'var(--danger)' : 'var(--accent)'}`,
                        color: item.is_active ? 'var(--danger)' : 'var(--accent)' }}>
                      {item.is_active ? 'Откл.' : 'Вкл.'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'rentals' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>
              <th style={s.th}>Инвентарь</th><th style={s.th}>Игрок</th>
              <th style={s.th}>Кол-во</th><th style={s.th}>Выдано</th><th style={s.th}>Действия</th>
            </tr></thead>
            <tbody>
              {rentals.length === 0 && <tr><td colSpan={5} style={{ ...s.td, textAlign: 'center', color: 'var(--text-muted)' }}>Нет активных аренд</td></tr>}
              {rentals.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'rgba(255,255,255,0.018)' }}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{r.equipment.name}</td>
                  <td style={s.td}>{r.user ? `${r.user.last_name} ${r.user.first_name}` : '—'}</td>
                  <td style={s.td}>{r.quantity} шт.</td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap', fontSize: 12 }}>
                    {new Date(r.rented_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={s.td}>
                    <button onClick={() => returnItem(r.id)} style={{ ...s.btn, background: 'var(--slot-free-bg)', color: 'var(--slot-free)', border: '1px solid var(--slot-free)44' }}>
                      Вернуть
                    </button>
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
