import { useState, useEffect, useCallback } from 'react'
import { cashApi, CashSession, CashTransaction, CashReport } from '../api/cash'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const PAYMENT_TYPES = [
  { value: 'cash',         label: '💵 Наличные',  color: '#22c55e' },
  { value: 'card',         label: '💳 Карта',     color: '#3b82f6' },
  { value: 'sbp',          label: '📱 СБП',       color: '#f59e0b' },
  { value: 'subscription', label: '🎫 Абонемент', color: '#a855f7' },
] as const

type PayType = typeof PAYMENT_TYPES[number]['value']

const TYPE_COLOR: Record<string, string> = Object.fromEntries(PAYMENT_TYPES.map(p => [p.value, p.color]))

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  inp:  { padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' },
  btn:  { padding: '10px 18px', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
}

function ReportModal({ report, onClose }: { report: CashReport; onClose: () => void }) {
  const handlePrint = () => window.print()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...s.card, width: 420, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, textAlign: 'center' }}>Z-Отчёт по смене</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>
          {fmt(report.session.opened_at)} — {report.session.closed_at ? fmt(report.session.closed_at) : 'открыта'}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          {[
            ['💵 Наличные', report.total_cash],
            ['💳 Карта', report.total_card],
            ['📱 СБП', report.total_sbp],
            ['🎫 Абонемент', report.total_subscription],
          ].map(([label, val]) => (
            <tr key={String(label)}>
              <td style={{ padding: '5px 0', color: 'var(--text-muted)', fontSize: 13 }}>{label}</td>
              <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 500 }}>{Number(val).toFixed(2)} ₽</td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td style={{ padding: '8px 0', fontWeight: 700 }}>ИТОГО</td>
            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, fontSize: 16, color: 'var(--accent)' }}>
              {Number(report.total_all).toFixed(2)} ₽
            </td>
          </tr>
        </table>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          Транзакций: {report.transaction_count}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrint} style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117', flex: 1 }}>🖨️ Печать</button>
          <button onClick={onClose} style={{ ...s.btn, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', flex: 1 }}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

export default function Cash() {
  const [session, setSession] = useState<CashSession | null | 'loading'>('loading')
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [amount, setAmount] = useState('')
  const [payType, setPayType] = useState<PayType>('cash')
  const [desc, setDesc] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState('')
  const [report, setReport] = useState<CashReport | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadSession = useCallback(async () => {
    try {
      const s = await cashApi.currentSession()
      setSession(s)
      if (s) {
        const txs = await cashApi.listTransactions(s.id)
        setTransactions(txs)
      }
    } catch { setSession(null) }
  }, [])

  useEffect(() => { loadSession() }, [loadSession])

  const openSession = async () => {
    setProcessing(true)
    try { setSession(await cashApi.openSession()); setTransactions([]) }
    catch (e: unknown) { showToast((e as {response?: {data?: {detail?: string}}})?.response?.data?.detail ?? 'Ошибка') }
    finally { setProcessing(false) }
  }

  const closeSession = async () => {
    if (!session || session === 'loading') return
    if (!confirm('Закрыть смену и получить Z-отчёт?')) return
    setProcessing(true)
    try {
      const r = await cashApi.getReport((session as CashSession).id)
      await cashApi.closeSession((session as CashSession).id)
      setReport(r)
      setSession(null)
      setTransactions([])
    } catch (e: unknown) { showToast((e as {response?: {data?: {detail?: string}}})?.response?.data?.detail ?? 'Ошибка') }
    finally { setProcessing(false) }
  }

  const addTransaction = async () => {
    if (!session || session === 'loading' || !amount || Number(amount) <= 0) return
    setProcessing(true)
    try {
      const tx = await cashApi.createTransaction({ amount: Number(amount), payment_type: payType, description: desc })
      setTransactions(prev => [tx, ...prev])
      setAmount(''); setDesc('')
      showToast(`Принято ${Number(amount).toFixed(2)} ₽`)
    } catch (e: unknown) { showToast((e as {response?: {data?: {detail?: string}}})?.response?.data?.detail ?? 'Ошибка') }
    finally { setProcessing(false) }
  }

  const refund = async (txId: string) => {
    if (!confirm('Оформить возврат?')) return
    try {
      const updated = await cashApi.refundTransaction(txId)
      setTransactions(prev => prev.map(t => t.id === txId ? updated : t))
      showToast('Возврат оформлен')
    } catch { showToast('Ошибка возврата') }
  }

  const totalToday = transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + Number(t.amount), 0)

  if (session === 'loading') return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Загрузка...</div>

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {report && <ReportModal report={report} onClose={() => setReport(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>💰 Касса</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {session ? (
            <>
              <span style={{ color: 'var(--slot-free)', fontSize: 12, fontWeight: 600 }}>● Смена открыта</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>с {fmt((session as CashSession).opened_at)}</span>
              <button onClick={closeSession} disabled={processing}
                style={{ ...s.btn, background: 'var(--danger)', color: '#fff', padding: '7px 14px', fontSize: 12 }}>
                Закрыть смену
              </button>
            </>
          ) : (
            <button onClick={openSession} disabled={processing}
              style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117' }}>
              Открыть смену
            </button>
          )}
        </div>
      </div>

      {toast && <div style={{ padding: '8px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13 }}>{toast}</div>}

      {!session && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 48 }}>
          Нет открытой смены. Откройте смену для начала работы.
        </div>
      )}

      {session && (
        <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>
          {/* Left: payment form */}
          <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={s.card}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Принять оплату</div>

              {/* Amount */}
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Сумма, ₽</label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0"
                placeholder="0.00" style={{ ...s.inp, marginTop: 4, marginBottom: 12, fontSize: 20, fontWeight: 700 }} />

              {/* Payment type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {PAYMENT_TYPES.map(pt => (
                  <button key={pt.value} onClick={() => setPayType(pt.value)}
                    style={{ padding: '9px 6px', borderRadius: 'var(--radius)', border: `2px solid ${payType === pt.value ? pt.color : 'var(--border)'}`,
                      background: payType === pt.value ? pt.color + '22' : 'transparent', color: payType === pt.value ? pt.color : 'var(--text-muted)',
                      fontWeight: payType === pt.value ? 700 : 400, fontSize: 12, cursor: 'pointer' }}>
                    {pt.label}
                  </button>
                ))}
              </div>

              {/* Description */}
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Комментарий</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Бронь корт 1, 18:00..."
                style={{ ...s.inp, marginTop: 4, marginBottom: 14 }} />

              <button onClick={addTransaction} disabled={processing || !amount || Number(amount) <= 0}
                style={{ ...s.btn, width: '100%', background: !amount ? 'var(--border)' : 'var(--accent)',
                  color: !amount ? 'var(--text-muted)' : '#0f1117', padding: 13, fontSize: 15 }}>
                ✓ Провести
              </button>
            </div>

            {/* Today total */}
            <div style={{ ...s.card, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>Итого за смену</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{totalToday.toFixed(2)} ₽</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>{transactions.filter(t => t.status === 'completed').length} операций</div>
            </div>
          </div>

          {/* Right: transactions */}
          <div style={{ flex: 1, overflow: 'auto', ...s.card, padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
              Операции смены
            </div>
            {transactions.length === 0 && (
              <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>Операций ещё нет</div>
            )}
            {transactions.map(tx => {
              const color = TYPE_COLOR[tx.payment_type] ?? 'var(--text-muted)'
              return (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderBottom: '1px solid var(--border)', opacity: tx.status === 'refunded' ? 0.45 : 1 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {tx.description || PAYMENT_TYPES.find(p => p.value === tx.payment_type)?.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(tx.created_at)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: tx.status === 'refunded' ? 'var(--text-muted)' : color, flexShrink: 0 }}>
                    {tx.status === 'refunded' ? '—' : '+'}{Number(tx.amount).toFixed(2)} ₽
                  </div>
                  {tx.status === 'completed' && (
                    <button onClick={() => refund(tx.id)}
                      style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border)',
                        borderRadius: 4, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                      Возврат
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
