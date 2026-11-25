import { useState, useEffect } from 'react'
import { subscriptionsApi, SubscriptionPlan } from '../api/subscriptions'
import { playersApi, PlayerPublic } from '../api/players'

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  inp:  { padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none' },
  btn:  { padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
}

function PlanCard({ plan, onSell, onToggle }: {
  plan: SubscriptionPlan
  onSell: (plan: SubscriptionPlan) => void
  onToggle: (plan: SubscriptionPlan) => void
}) {
  return (
    <div style={{ ...s.card, opacity: plan.is_active ? 1 : 0.5 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{plan.name}</div>
      {plan.description && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>{plan.description}</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { label: '⏱ Часов', value: `${plan.hours_total} ч` },
          { label: '📅 Срок', value: `${plan.validity_days} дн.` },
          { label: '💰 Цена', value: `${Number(plan.price).toLocaleString('ru')} ₽` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 9px', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}: </span><span style={{ fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {plan.is_active && (
          <button onClick={() => onSell(plan)} style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117', flex: 1 }}>
            Продать
          </button>
        )}
        <button onClick={() => onToggle(plan)}
          style={{ ...s.btn, background: 'transparent', border: `1px solid ${plan.is_active ? 'var(--danger)' : 'var(--accent)'}`,
            color: plan.is_active ? 'var(--danger)' : 'var(--accent)' }}>
          {plan.is_active ? 'Откл.' : 'Вкл.'}
        </button>
      </div>
    </div>
  )
}

function SellModal({ plan, onClose, onSold }: {
  plan: SubscriptionPlan; onClose: () => void; onSold: () => void
}) {
  const [search, setSearch] = useState('')
  const [players, setPlayers] = useState<PlayerPublic[]>([])
  const [selected, setSelected] = useState<PlayerPublic | null>(null)
  const [loading, setLoading] = useState(false)

  const doSearch = async () => {
    if (!search.trim()) return
    const params = search.startsWith('+') ? { phone: search.trim() } : { nickname: search.trim() }
    setPlayers(await playersApi.search(params))
  }

  const sell = async () => {
    if (!selected) return
    setLoading(true)
    try {
      await subscriptionsApi.sell(plan.id, selected.id)
      onSold()
      onClose()
    } catch { alert('Ошибка продажи') } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...s.card, width: 400 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Продать абонемент</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          «{plan.name}» — {Number(plan.price).toLocaleString('ru')} ₽
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Ник или +79991234567" style={{ ...s.inp, flex: 1 }} />
          <button onClick={doSearch} style={{ ...s.btn, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Найти
          </button>
        </div>
        {players.map(p => (
          <div key={p.id} onClick={() => setSelected(p)}
            style={{ padding: '9px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: selected?.id === p.id ? 'var(--slot-mine-bg)' : 'var(--surface-2)',
              border: `1px solid ${selected?.id === p.id ? 'var(--slot-mine)' : 'var(--border)'}` }}>
            <span style={{ fontWeight: 500 }}>{p.last_name} {p.first_name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>@{p.nickname}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={sell} disabled={!selected || loading}
            style={{ ...s.btn, background: !selected ? 'var(--border)' : 'var(--accent)', color: !selected ? 'var(--text-muted)' : '#0f1117', flex: 1 }}>
            {loading ? '...' : 'Продать'}
          </button>
          <button onClick={onClose} style={{ ...s.btn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

function AddPlanForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState('')
  const [hours, setHours] = useState('')
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await subscriptionsApi.createPlan({ name, description: desc || undefined, price: Number(price), hours_total: Number(hours), validity_days: Number(days) })
      setName(''); setDesc(''); setPrice(''); setHours(''); setDays('30'); setOpen(false)
      onAdded()
    } catch { alert('Ошибка создания плана') } finally { setLoading(false) }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117', alignSelf: 'flex-start' }}>
      + Новый план
    </button>
  )

  return (
    <form onSubmit={submit} style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600 }}>Новый тарифный план</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Название" required style={{ ...s.inp, minWidth: 180 }} />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание (необяз.)" style={{ ...s.inp, minWidth: 180 }} />
        <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Цена ₽" type="number" required style={{ ...s.inp, width: 100 }} />
        <input value={hours} onChange={e => setHours(e.target.value)} placeholder="Часов" type="number" required style={{ ...s.inp, width: 80 }} />
        <input value={days} onChange={e => setDays(e.target.value)} placeholder="Дней" type="number" required style={{ ...s.inp, width: 80 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={loading} style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117' }}>
          {loading ? '...' : 'Создать'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ ...s.btn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Отмена
        </button>
      </div>
    </form>
  )
}

export default function Subscriptions() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [sellPlan, setSellPlan] = useState<SubscriptionPlan | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const loadPlans = async () => {
    setLoading(true)
    try { setPlans(await subscriptionsApi.listPlans(showInactive)) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPlans() }, [showInactive])

  const togglePlan = async (plan: SubscriptionPlan) => {
    await subscriptionsApi.updatePlan(plan.id, { is_active: !plan.is_active })
    loadPlans()
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sellPlan && <SellModal plan={sellPlan} onClose={() => setSellPlan(null)} onSold={loadPlans} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>🎫 Абонементы</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Показать неактивные
        </label>
      </div>

      <AddPlanForm onAdded={loadPlans} />

      {loading && <div style={{ color: 'var(--text-muted)' }}>Загрузка...</div>}

      {!loading && plans.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 32 }}>
          Тарифных планов пока нет. Создайте первый.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {plans.map(p => (
          <PlanCard key={p.id} plan={p} onSell={setSellPlan} onToggle={togglePlan} />
        ))}
      </div>
    </div>
  )
}
