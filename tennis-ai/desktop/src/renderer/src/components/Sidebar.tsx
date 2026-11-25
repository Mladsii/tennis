import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const NAV = [
  { to: '/grid', label: 'Шахматка', icon: '⊞' },
  { to: '/courts', label: 'Корты', icon: '🎾' },
  { to: '/players', label: 'Игроки', icon: '👤' },
  { to: '/trainings', label: 'Тренировки', icon: '📋' },
  { to: '/competitions', label: 'Соревнования', icon: '🏆' },
  { to: '/cash', label: 'Касса', icon: '💰' },
  { to: '/subscriptions', label: 'Абонементы', icon: '🎫' },
  { to: '/equipment', label: 'Инвентарь', icon: '🏸' },
  { to: '/queue', label: 'Очередь', icon: '⏳' },
  { to: '/analytics', label: 'Аналитика', icon: '📊' },
  { to: '/reports', label: 'Отчёты', icon: '📈' },
  { to: '/qr', label: 'QR-сканер', icon: '📷' },
]

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside
      style={{
        width: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>
          🎾 Tennis Club
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>
          Управление клубом
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              color: isActive ? 'var(--text)' : 'var(--text-muted)',
              background: isActive ? 'var(--surface-2)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              marginBottom: 2,
              fontSize: 13,
              transition: 'all 0.12s',
            })}
          >
            <span style={{ fontSize: 15 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '9px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
            fontSize: 13,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--danger)'
            e.currentTarget.style.borderColor = 'var(--danger)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          <span>⎋</span> Выйти
        </button>
      </div>
    </aside>
  )
}
