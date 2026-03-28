import { useState, useEffect } from 'react'
import TransportPill from './components/TransportPill'
import { audioEngine } from './audio/audioEngine'
import './App.css'

const STEMS = [
  { id: 'dx', url: '/src/assets/20260326/soundworks_20260326_dx.aac' },
  { id: 'fx', url: '/src/assets/20260326/soundworks_20260326_fx.aac' },
  { id: 'mx', url: '/src/assets/20260326/soundworks_20260326_mx.aac' },
]

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    audioEngine.setMode('audio')

    Promise.all(STEMS.map(({ id, url }) => audioEngine.loadStem(id, url)))
      .then(() => setLoading(false))
      .catch(err => {
        console.error('Failed to load stems:', err)
        setError(err.message)
      })
  }, [])

  return (
    <>
      <main />
      {loading && !error && <div style={styles.overlay}>Loading…</div>}
      {error && <div style={styles.overlay}>Failed to load audio: {error}</div>}
      {!loading && <TransportPill />}
    </>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    letterSpacing: '0.05em',
    pointerEvents: 'none',
  },
}

export default App
