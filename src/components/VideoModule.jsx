import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function VideoModule({ videoSrc, videoRef, mixerOpen = false, deckVisible = false }) {
  const [videoError, setVideoError] = useState(null)

  useEffect(() => {
    console.log('[VideoModule] videoSrc:', videoSrc)
  }, [videoSrc])

  function handleError(e) {
    const err = e.target.error
    const message = err ? `${err.code}: ${err.message}` : 'Unknown video error'
    console.error('[VideoModule] video load error:', message, e)
    setVideoError(message)
  }

  return (
    <section style={styles.section}>
      <video
        ref={videoRef}
        src={videoSrc}
        style={styles.video}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        onError={handleError}
      />
      <motion.div
        style={styles.deckSurface}
        animate={{ height: mixerOpen ? '75vh' : '60vh', opacity: deckVisible ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36, opacity: { duration: deckVisible ? 0 : 0.4, ease: 'easeOut' } }}
      />
      {videoError && (
        <div style={styles.errorOverlay}>
          <p style={styles.errorText}>Video failed to load</p>
          <p style={styles.errorDetail}>{videoError}</p>
        </div>
      )}
    </section>
  )
}

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
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
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
  errorOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    pointerEvents: 'none',
  },
  errorText: {
    margin: 0,
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
  },
  errorDetail: {
    margin: 0,
    color: 'rgba(255,255,255,0.3)',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
}
