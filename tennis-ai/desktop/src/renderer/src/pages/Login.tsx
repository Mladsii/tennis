import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}

export default function Login() {
  const { login, isLoading, error, accessToken } = useAuthStore()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('+7')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (accessToken) navigate('/', { replace: true })
  }, [accessToken, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(phone, password)
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: 380,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 40,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎾</div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Tennis Club Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
            Система управления теннисным клубом
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            Номер телефона
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+70001110001"
            required
            style={{ ...fieldStyle, marginBottom: 14 }}
          />

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            Пароль
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ ...fieldStyle, marginBottom: 20 }}
          />

          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius)',
                color: '#fca5a5',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '11px',
              background: isLoading ? 'var(--border)' : 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: isLoading ? 'var(--text-muted)' : '#0f1117',
              fontWeight: 700,
              fontSize: 14,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
