import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { audioEngine } from '../audio/audioEngine'

const DEG_PER_SEC = 33 * 6  // 33 RPM = 198°/sec at 1× playback speed

// ---------------------------------------------------------------------------
// SpinningDisc
// ---------------------------------------------------------------------------

function SpinningDisc({ artwork }) {
  const discRef      = useRef(null)
  const rotationRef  = useRef(0)
  const lastTimeRef  = useRef(null)
  const spinStateRef = useRef({ isPlaying: false, direction: 1, scrubVelocity: 0 })

  // Mirror spinState from engine into ref — no re-renders needed
  useEffect(() => {
    const offTick  = audioEngine.on('tick',        ({ spinState }) => { spinStateRef.current = spinState })
    const offState = audioEngine.on('stateChange', ({ spinState }) => { spinStateRef.current = spinState })
    return () => { offTick(); offState() }
  }, [])

  // RAF loop — accumulates rotation, writes transform imperatively
  useEffect(() => {
    let rafId

    function tick(time) {
      if (lastTimeRef.current !== null) {
        const dt = (time - lastTimeRef.current) / 1000
        const { isPlaying, direction, scrubVelocity } = spinStateRef.current
        // Guard: skip frames > 100ms (tab hidden / resumed)
        if (isPlaying && dt > 0 && dt < 0.1) {
          rotationRef.current += DEG_PER_SEC * scrubVelocity * direction * dt
        }
      }
      lastTimeRef.current = time

      if (discRef.current) {
        discRef.current.style.transform = `rotate(${rotationRef.current}deg)`
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      lastTimeRef.current = null
    }
  }, [])

  return (
    <div style={styles.discOuter}>
      <div ref={discRef} style={styles.discBody}>
        {artwork
          ? <img src={artwork} alt="" style={styles.artworkImg} draggable={false} />
          : <div style={styles.artworkPlaceholder} />
        }
        {/* Centre spindle hole */}
        <div style={styles.spindle} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MusicModule
// ---------------------------------------------------------------------------

export default function MusicModule({ artwork, mixerOpen = false, deckVisible = false }) {
  return (
    <section style={styles.section}>
      <SpinningDisc artwork={artwork} />

      <motion.div
        style={styles.deckSurface}
        animate={{ height: mixerOpen ? '75vh' : '60vh', opacity: deckVisible ? 1 : 0 }}
        transition={{
          type: 'spring', stiffness: 380, damping: 36,
          opacity: { duration: deckVisible ? 0 : 0.4, ease: 'easeOut' },
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  section: {
    width: '100vw',
    height: '100vh',
    borderRadius: '44px',
    background: '#0a0a0a',
    overflow: 'hidden',
    flexShrink: 0,
    scrollSnapAlign: 'start',
    position: 'relative',
  },

  // Disc positioned so its centre sits at 35% from the top of the module
  discOuter: {
    position: 'absolute',
    top: '35%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '40vh',
    height: '40vh',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },

  discBody: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    overflow: 'hidden',
    position: 'relative',
    willChange: 'transform',
    background: '#111',
  },

  artworkImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    borderRadius: '50%',
  },

  artworkPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'radial-gradient(circle at center, #2a2a2a 0%, #111 70%)',
  },

  spindle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '2vh',
    height: '2vh',
    borderRadius: '50%',
    background: '#0a0a0a',
    zIndex: 1,
  },

  deckSurface: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black)',
    maskImage: 'linear-gradient(to bottom, transparent, black)',
    pointerEvents: 'none',
    zIndex: 2,
  },
}
