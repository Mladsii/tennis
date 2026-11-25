import { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import { playersApi, PlayerPublic } from '../api/players'

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn:  { padding: '9px 18px', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
}

// Периодичность сканирования кадров (мс)
const SCAN_INTERVAL = 250

function PlayerCard({ player }: { player: PlayerPublic }) {
  const badges = [
    { label: 'NTRP', value: player.ntrp_level, color: '#3b82f6' },
    { label: 'STM',  value: player.stm_level,  color: '#f59e0b' },
    { label: 'Elo',  value: String(player.elo_rating), color: '#a855f7' },
    { label: 'Стаж', value: `${player.years_playing} лет`, color: '#22c55e' },
  ]
  return (
    <div style={{ ...s.card, display: 'flex', gap: 16, alignItems: 'flex-start', border: '1px solid var(--accent)' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
        {player.first_name[0]}{player.last_name[0]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>
          {player.last_name} {player.first_name}
          {player.patronymic ? ` ${player.patronymic}` : ''}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>@{player.nickname}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {badges.map(b => (
            <span key={b.label} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
              color: b.color, background: b.color + '22', border: `1px solid ${b.color}44` }}>
              {b.label}: {b.value}
            </span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 28 }}>✅</div>
    </div>
  )
}

export default function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'loading' | 'found' | 'error'>('idle')
  const [player, setPlayer] = useState<PlayerPublic | null>(null)
  const [lastCode, setLastCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [manualLoading, setManualLoading] = useState(false)

  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setActive(false)
    setStatus('idle')
  }, [])

  const lookupUser = useCallback(async (code: string) => {
    if (code === lastCode) return
    setLastCode(code)
    setStatus('loading')
    setPlayer(null)
    setErrorMsg('')
    try {
      // QR содержит: никнейм, phone, или user_id
      let results: PlayerPublic[] = []
      if (code.startsWith('+') || /^\d{11}$/.test(code)) {
        results = await playersApi.search({ phone: code })
      } else if (/^[0-9a-f-]{36}$/i.test(code)) {
        // UUID — прямой запрос
        const p = await playersApi.getById(code)
        results = [p]
      } else {
        results = await playersApi.search({ nickname: code })
      }
      if (results.length > 0) {
        setPlayer(results[0])
        setStatus('found')
      } else {
        setErrorMsg(`Игрок не найден: «${code}»`)
        setStatus('error')
        setTimeout(() => { setStatus('scanning'); setLastCode('') }, 2500)
      }
    } catch {
      setErrorMsg('Ошибка при поиске игрока')
      setStatus('error')
      setTimeout(() => { setStatus('scanning'); setLastCode('') }, 2500)
    }
  }, [lastCode])

  const startCamera = useCallback(async () => {
    setPlayer(null)
    setLastCode('')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
      setStatus('scanning')

      timerRef.current = setInterval(() => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imgData.data, imgData.width, imgData.height)
        if (result?.data) lookupUser(result.data.trim())
      }, SCAN_INTERVAL)
    } catch {
      setErrorMsg('Нет доступа к камере. Разрешите доступ в настройках.')
      setStatus('error')
    }
  }, [lookupUser])

  useEffect(() => () => stopCamera(), [stopCamera])

  const reset = () => {
    setPlayer(null)
    setLastCode('')
    setErrorMsg('')
    setStatus('scanning')
  }

  const manualSearch = async () => {
    if (!manualInput.trim()) return
    setManualLoading(true)
    setPlayer(null)
    setErrorMsg('')
    try {
      const q = manualInput.trim()
      const results = q.startsWith('+') || /^\d{11}$/.test(q)
        ? await playersApi.search({ phone: q })
        : await playersApi.search({ nickname: q })
      if (results.length > 0) { setPlayer(results[0]); setStatus('found') }
      else { setErrorMsg(`Игрок не найден: «${q}»`); setStatus('error') }
    } catch { setErrorMsg('Ошибка поиска') } finally { setManualLoading(false) }
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 700 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700 }}>📷 QR-сканер игроков</h2>

      {/* Камера */}
      <div style={s.card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Сканер камеры</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Направьте камеру на QR-код карточки игрока
            </div>
          </div>
          {!active
            ? <button onClick={startCamera} style={{ ...s.btn, background: 'var(--accent)', color: '#0f1117' }}>▶ Включить</button>
            : <button onClick={stopCamera} style={{ ...s.btn, background: 'var(--danger)', color: '#fff' }}>■ Стоп</button>
          }
        </div>

        {/* Видео */}
        <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden',
          display: active ? 'block' : 'none', aspectRatio: '16/9' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {/* Прицел */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 200, height: 200, border: `3px solid ${status === 'found' ? '#22c55e' : status === 'loading' ? '#f59e0b' : '#fff'}`,
              borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', transition: 'border-color 0.2s' }}>
              {[['0 0', 'top left'], ['0 auto 0 0', 'top right'], ['auto 0 0', 'bottom left'], ['auto auto 0 0', 'bottom right']].map(([m, key]) => (
                <div key={key} style={{ position: 'absolute', inset: m === '0 0' ? '-3px auto auto -3px' :
                  m === '0 auto 0 0' ? '-3px -3px auto auto' : m === 'auto 0 0' ? 'auto auto -3px -3px' : 'auto -3px -3px auto',
                  width: 20, height: 20, border: `3px solid ${status === 'found' ? '#22c55e' : '#fff'}`,
                  borderRadius: key.includes('top left') ? '8px 0 0 0' : key.includes('top right') ? '0 8px 0 0' :
                    key.includes('bottom left') ? '0 0 0 8px' : '0 0 8px 0' }} />
              ))}
            </div>
          </div>
          {/* Статус */}
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center' }}>
            <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: 'rgba(0,0,0,0.7)', color: status === 'found' ? '#22c55e' : status === 'loading' ? '#f59e0b' :
                status === 'error' ? '#ef4444' : '#fff' }}>
              {status === 'scanning' ? '🔍 Сканирование...' : status === 'loading' ? '⏳ Поиск игрока...' :
                status === 'found' ? '✅ Игрок найден!' : status === 'error' ? `❌ ${errorMsg}` : ''}
            </span>
          </div>
        </div>

        {!active && (
          <div style={{ height: 180, background: 'var(--surface-2)', borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            📷 Камера не активна
          </div>
        )}
      </div>

      {/* Ручной ввод */}
      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>🔎 Ручной поиск</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={manualInput} onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && manualSearch()}
            placeholder="Ник или +79991234567"
            style={{ padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, outline: 'none', flex: 1 }} />
          <button onClick={manualSearch} disabled={manualLoading || !manualInput.trim()}
            style={{ ...s.btn, background: manualLoading ? 'var(--border)' : 'var(--accent)',
              color: manualLoading ? 'var(--text-muted)' : '#0f1117' }}>
            {manualLoading ? '...' : 'Найти'}
          </button>
        </div>
      </div>

      {/* Результат */}
      {player && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PlayerCard player={player} />
          <button onClick={reset}
            style={{ ...s.btn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', alignSelf: 'flex-start' }}>
            ↩ Сканировать следующего
          </button>
        </div>
      )}
    </div>
  )
}
