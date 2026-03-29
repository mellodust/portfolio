import { useState, useEffect } from 'react'

export default function VideoModule({ videoSrc, videoRef }) {
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
