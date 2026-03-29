import { useState, useEffect, useRef } from 'react'
import TransportPill from './components/TransportPill'
import VideoModule from './components/VideoModule'
import { audioEngine } from './audio/audioEngine'
import './App.css'

const STEMS = [
  { id: 'dx', url: '/src/assets/20260326/soundworks_20260326_dx.aac' },
  { id: 'fx', url: '/src/assets/20260326/soundworks_20260326_fx.aac' },
  { id: 'mx', url: '/src/assets/20260326/soundworks_20260326_mx.aac' },
]

const VIDEO_SRC = '/assets/20260326/soundworks_20260326_video.mp4'

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)

  useEffect(() => {
    audioEngine.setMode('audio')

    Promise.all(STEMS.map(({ id, url }) => audioEngine.loadStem(id, url)))
      .then(() => {
        audioEngine.setMode('video', videoRef.current)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load stems:', err)
        setError(err.message)
      })
  }, [])

  return (
    <>
      {/* Scroll container */}
      <div style={styles.scroller}>
        {/* Slide 1 — portfolio grid */}
        <section style={styles.slide}>
          {loading && !error && <div style={styles.overlay}>Loading…</div>}
          {error && <div style={styles.overlay}>Failed to load audio: {error}</div>}
        </section>

        {/* Slide 2 — video (always in DOM) */}
        <VideoModule videoSrc={VIDEO_SRC} videoRef={videoRef} />
      </div>

      {/* Transport pill — fixed, above everything */}
      {!loading && <TransportPill />}
    </>
  )
}

const styles = {
  scroller: {
    height: '100vh',
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    scrollBehavior: 'smooth',
  },
  slide: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    flexShrink: 0,
    scrollSnapAlign: 'start',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
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
