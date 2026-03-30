import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { audioEngine } from '../audio/audioEngine'

const CARD_GAP = 24

function getCardWidth() {
  return Math.min(280, window.innerWidth * 0.72)
}

// X position of the track so that card at `index` is centered in the viewport
function getTrackX(index, cardWidth) {
  return (window.innerWidth - cardWidth) / 2 - index * (cardWidth + CARD_GAP)
}

// ---------------------------------------------------------------------------
// VideoThumbnail — loops between thumbnailIn and thumbnailOut seconds
// ---------------------------------------------------------------------------

function VideoThumbnail({ videoUrl, thumbnailIn, thumbnailOut }) {
  const ref = useRef(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const seek = () => { video.currentTime = thumbnailIn }
    const loop = () => { if (video.currentTime >= thumbnailOut) seek() }
    video.addEventListener('loadedmetadata', seek)
    video.addEventListener('timeupdate', loop)
    return () => {
      video.removeEventListener('loadedmetadata', seek)
      video.removeEventListener('timeupdate', loop)
    }
  }, [thumbnailIn, thumbnailOut])

  return (
    <video
      ref={ref}
      src={videoUrl}
      muted
      autoPlay
      playsInline
      preload="auto"
      style={styles.media}
    />
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function Card({ project, isActive }) {
  return (
    <div style={{
      ...styles.card,
      opacity: isActive ? 1 : 0.4,
      transform: `scale(${isActive ? 1 : 0.92})`,
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      {project.type === 'video' ? (
        <VideoThumbnail
          videoUrl={project.videoUrl}
          thumbnailIn={project.thumbnailIn}
          thumbnailOut={project.thumbnailOut}
        />
      ) : (
        <img src={project.artworkUrl} style={styles.media} alt={project.title} />
      )}
      <div style={styles.cardLabel}>
        <span style={styles.cardTitle}>{project.title}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PortfolioGrid
// ---------------------------------------------------------------------------

export default function PortfolioGrid({ projects, videoRef, onProjectLoad }) {
  // Wrap items with clones for seamless infinite loop:
  // [lastClone, item0, item1, …, itemN, firstClone]
  const trackItems = [
    projects[projects.length - 1],
    ...projects,
    projects[0],
  ]

  const x = useMotionValue(getTrackX(1, getCardWidth()))
  const [visualIdx, setVisualIdx] = useState(1)
  const visualIdxRef = useRef(1)
  const animCtrl = useRef(null)

  const dragStartX = useRef(null)
  const dragStartY = useRef(null)
  const dragBaseX = useRef(0)
  const isDragging = useRef(false)

  // Snap track to a given track-space index, then handle clone jumps
  const snapTo = useCallback((vi) => {
    animCtrl.current?.stop()
    const cw = getCardWidth()

    animCtrl.current = animate(x, getTrackX(vi, cw), {
      type: 'spring', stiffness: 300, damping: 30, mass: 0.8,
    })

    animCtrl.current.then(() => {
      let finalVi = vi
      if (vi <= 0) {
        // Snapped to last-clone — instantly jump to real last item
        finalVi = trackItems.length - 2
        x.set(getTrackX(finalVi, cw))
      } else if (vi >= trackItems.length - 1) {
        // Snapped to first-clone — instantly jump to real first item
        finalVi = 1
        x.set(getTrackX(finalVi, cw))
      }
      visualIdxRef.current = finalVi
      setVisualIdx(finalVi)
    })
  }, [trackItems.length, x])

  // Arrow key navigation
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'ArrowLeft') snapTo(visualIdxRef.current - 1)
      else if (e.key === 'ArrowRight') snapTo(visualIdxRef.current + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [snapTo])

  // Reposition on resize without animation
  useEffect(() => {
    function onResize() {
      x.set(getTrackX(visualIdxRef.current, getCardWidth()))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [x])

  // Pointer / touch drag
  function onPointerDown(e) {
    animCtrl.current?.stop()
    dragStartX.current = e.clientX
    dragStartY.current = e.clientY
    dragBaseX.current = x.get()
    isDragging.current = false
  }

  function onPointerMove(e) {
    if (dragStartX.current === null) return
    const dx = e.clientX - dragStartX.current
    const dy = e.clientY - dragStartY.current

    if (!isDragging.current) {
      // Wait for minimum movement before committing to a direction
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      // If more vertical than horizontal, let the page scroller handle it
      if (Math.abs(dy) >= Math.abs(dx)) { dragStartX.current = null; return }
      isDragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    x.set(dragBaseX.current + dx)
  }

  function onPointerUp(e) {
    if (dragStartX.current === null) return
    const dx = e.clientX - dragStartX.current
    const wasDrag = isDragging.current
    dragStartX.current = null
    isDragging.current = false

    if (!wasDrag) {
      // Tap — load the currently centered project
      handleCardTap(projects[visualIdxRef.current - 1])
      return
    }

    const cw = getCardWidth()
    const vi = visualIdxRef.current
    if (dx < -(cw / 4)) snapTo(vi + 1)
    else if (dx > (cw / 4)) snapTo(vi - 1)
    else snapTo(vi)
  }

  function onPointerCancel() {
    dragStartX.current = null
    isDragging.current = false
    snapTo(visualIdxRef.current)
  }

  async function handleCardTap(project) {
    if (!project) return
    audioEngine.pause()
    try {
      await Promise.all(project.stems.map(s => audioEngine.loadStem(s.id, s.url)))
      if (videoRef?.current) audioEngine.setMode('video', videoRef.current)
      onProjectLoad?.()
      audioEngine.play()
    } catch (err) {
      console.error('[PortfolioGrid] Failed to load project stems:', err)
    }
  }

  const cw = getCardWidth()

  return (
    <div style={styles.container}>
      <motion.div
        style={{ ...styles.track, x }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {trackItems.map((project, i) => (
          <div key={`${project.id}-${i}`} style={{ width: cw, flexShrink: 0 }}>
            <Card project={project} isActive={i === visualIdx} />
          </div>
        ))}
      </motion.div>
    </div>
  )
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    // Allow vertical page scroll to pass through; horizontal is ours
    touchAction: 'pan-y',
  },
  track: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: `${CARD_GAP}px`,
    width: 'max-content',
    willChange: 'transform',
    cursor: 'grab',
    userSelect: 'none',
  },
  card: {
    height: '70vh',
    borderRadius: '24px',
    overflow: 'hidden',
    background: '#111',
    position: 'relative',
    cursor: 'pointer',
    willChange: 'transform, opacity',
  },
  media: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
  },
  cardLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '48px 20px 20px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: '15px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.03em',
  },
}
