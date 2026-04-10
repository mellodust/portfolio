import { useRef, useState, useLayoutEffect, useEffect, useMemo } from 'react'
import { motion, useMotionValue, useVelocity, useMotionValueEvent, animate, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../audio/audioEngine'

const DEG_PER_SEC = 33 * 6  // 33 RPM = 198°/sec at 1× speed

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeCardWidth() {
  return Math.min(360, Math.max(200, window.innerWidth * 0.22))
}

function parseAspectRatio(str) {
  const [w, h] = (str || '4:3').split(':').map(Number)
  return w / h
}

// ---------------------------------------------------------------------------
// Parallax constants
// ---------------------------------------------------------------------------

// Parallax offset expressed as a fraction of viewport width.
// Decoupled from card dimensions so changing card aspect ratio never alters parallax feel.
const PARALLAX_SHIFT_VW = 0.03
// OVERSCAN is computed per-render in PortfolioGrid because it depends on the ratio of
// viewport width to card width, both of which change at runtime.

// ---------------------------------------------------------------------------
// VideoThumbnail
// ---------------------------------------------------------------------------

function VideoThumbnail({ videoUrl, thumbnailClips }) {
  const ref     = useRef(null)
  const clipIdx = useRef(0)

  useEffect(() => {
    const video = ref.current
    if (!video || !thumbnailClips?.length) return

    const seek = () => {
      clipIdx.current = 0
      const clip = thumbnailClips[0]
      video.currentTime          = clip.in
      video.style.objectPosition = clip.position ?? 'center center'
    }

    const onTimeUpdate = () => {
      const clip = thumbnailClips[clipIdx.current]
      if (video.currentTime >= clip.out) {
        // Advance the index ref before seeking — this is the guard.
        // Any timeupdate events that fire before the seek settles will check
        // the new clip's out point, not the old one, preventing double-firing.
        const prevIdx = clipIdx.current
        clipIdx.current = (clipIdx.current + 1) % thumbnailClips.length
        const next = thumbnailClips[clipIdx.current]

        video.currentTime = next.in

        // objectPosition only changes when the clip index actually advances.
        // This is the hard cut: timecode and crop position switch simultaneously,
        // and the position never bleeds into the wrong clip.
        if (clipIdx.current !== prevIdx) {
          video.style.objectPosition = next.position ?? 'center center'
        }
      }
    }

    video.addEventListener('loadedmetadata', seek)
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => {
      video.removeEventListener('loadedmetadata', seek)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [thumbnailClips])

  return (
    <video ref={ref} src={videoUrl} muted autoPlay playsInline preload="auto" style={styles.media} />
  )
}

// ---------------------------------------------------------------------------
// CardDisc — spinning disc for the back face of a music card
// ---------------------------------------------------------------------------

function CardDisc() {
  const discRef      = useRef(null)
  const rotationRef  = useRef(0)
  const lastTimeRef  = useRef(null)
  const spinStateRef = useRef({ isPlaying: false, direction: 1, scrubVelocity: 0 })

  useEffect(() => {
    const offTick  = audioEngine.on('tick',        ({ spinState }) => { spinStateRef.current = spinState })
    const offState = audioEngine.on('stateChange', ({ spinState }) => { spinStateRef.current = spinState })
    return () => { offTick(); offState() }
  }, [])

  useEffect(() => {
    let rafId
    function tick(time) {
      if (lastTimeRef.current !== null) {
        const dt = (time - lastTimeRef.current) / 1000
        const { isPlaying, direction, scrubVelocity } = spinStateRef.current
        if (isPlaying && dt > 0 && dt < 0.1) {
          rotationRef.current += DEG_PER_SEC * scrubVelocity * direction * dt
        }
      }
      lastTimeRef.current = time
      if (discRef.current) discRef.current.style.transform = `rotate(${rotationRef.current}deg)`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafId); lastTimeRef.current = null }
  }, [])

  return (
    <div style={styles.cardDiscOuter}>
      <div ref={discRef} style={styles.cardDisc}>
        <div style={styles.cardDiscSpindle} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TypeFilterButtons — project type filter toggles, bottom-left
// ---------------------------------------------------------------------------

function TypeFilterButtons({ filter, onToggle }) {
  return (
    <div style={styles.filterButtons}>
      {[
        { key: 'music', label: 'Catalog' },
        { key: 'video', label: 'Audio Post' },
      ].map(({ key, label }) => (
        <div key={key} style={styles.filterRow}>
          <button
            style={{
              ...styles.filterToggle,
              background: filter[key] ? 'rgba(255,255,255,0.85)' : 'transparent',
            }}
            onClick={() => onToggle(key)}
            aria-label={`${filter[key] ? 'Hide' : 'Show'} ${label}`}
          />
          <span style={styles.filterLabel}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CarouselCard — outer moves with carousel, inner parallaxes
// ---------------------------------------------------------------------------

function CarouselCard({ slotIndex, project, rawPos, flippedId, strideRef, cardWidthRef }) {
  // xMv drives the Framer Motion x transform — updated imperatively, not animated.
  // Framer Motion merges it with the animated opacity/scale without conflict.
  const xMv     = useMotionValue(0)
  const innerRef = useRef(null)  // parallax — video cards only

  const isMusic   = project.type === 'music'
  const isFlipped = isMusic && project.id === flippedId

  function apply(pos) {
    const stride = strideRef.current
    const offset = slotIndex - pos
    // x = offset*stride re-centers card: left:50% + x positions center at 50%+offset*stride
    xMv.set(offset * stride - cardWidthRef.current / 2)
    if (innerRef.current) {
      innerRef.current.style.transform = `translate3d(${-offset * stride * PARALLAX_SHIFT_VW}px, 0, 0)`
    }
  }

  useMotionValueEvent(rawPos, 'change', apply)
  useLayoutEffect(() => { apply(rawPos.get()) })

  return (
    <motion.div
      data-slot-index={slotIndex}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 'var(--card-w)',
        height: 'var(--card-h)',
        borderRadius: 16,
        cursor: 'pointer',
        willChange: 'transform',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
        overflow: 'visible',
        perspective: isMusic ? '800px' : undefined,
        x: xMv,
        y: '-50%',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
    >
      {isMusic ? (
        // 3D flip container — rotates around Y axis
        <motion.div
          style={styles.flipper}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 35, mass: 0.8 }}
        >
          {/* Front face — artwork */}
          <div style={styles.face}>
            {project.artwork
              ? <img src={project.artwork} alt="" style={styles.faceImg} draggable={false} />
              : <div style={styles.placeholder} />
            }
          </div>

          {/* Back face — spinning disc, pre-rotated 180° */}
          <div style={{ ...styles.face, transform: 'rotateY(180deg)', background: '#0a0a0a' }}>
            <CardDisc />
          </div>
        </motion.div>
      ) : (
        // Video card — clip wrapper keeps video inside card bounds;
        // outer overflow:visible lets the text label below show through
        <div style={styles.videoClip}>
          <div
            ref={innerRef}
            style={{
              position: 'absolute',
              width: 'var(--inner-w)',
              height: 'var(--inner-h)',
              left: 'var(--inner-left)',
              top: 'var(--inner-top)',
              willChange: 'transform',
            }}
          >
            <VideoThumbnail
              videoUrl={project.videoUrl}
              thumbnailClips={project.thumbnailClips}
            />
          </div>
        </div>
      )}

      {/* Title + artist — sits below the card, scrolls with it */}
      <div style={styles.cardLabel}>
        <span style={styles.cardTitle}>{project.title}</span>
        <span style={styles.cardArtist}>{project.artist}</span>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// PortfolioGrid — flat infinite horizontal scroll carousel
// ---------------------------------------------------------------------------

export default function PortfolioGrid({
  projects,
  videoRef,
  onProjectLoad,
  onVideoSlide = false,
  dragSensitivity = 1.0,
  dragZoneBottom = window.innerHeight * 0.5,
}) {
  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------

  const [filter, setFilter] = useState({ music: true, video: true })

  function handleToggleFilter(key) {
    setFilter(prev => {
      const next = { ...prev, [key]: !prev[key] }
      // Enforce: at least one type must remain active
      if (!next.music && !next.video) return prev
      return next
    })
  }

  const filteredProjects = useMemo(
    () => projects.filter(p => filter[p.type] !== false),
    [projects, filter]
  )

  const L = filteredProjects.length

  // Clone layout: [filteredProjects × 3]
  const allCards = [...filteredProjects, ...filteredProjects, ...filteredProjects]

  const containerRef = useRef(null)

  const [cardWidth, setCardWidth] = useState(computeCardWidth)
  const [loadedId, setLoadedId]   = useState(null)
  const [flippedId, setFlippedId] = useState(null)
  const [centerIdx, setCenterIdx] = useState(0)

  const gap        = Math.round(cardWidth * 0.08)
  const stride     = cardWidth + gap
  const aspectRatio = parseAspectRatio('1:1')
  const cardHeight  = Math.round(cardWidth / aspectRatio)

  // OVERSCAN: inner must be wide enough so the maximum parallax shift never exposes a black edge.
  const maxParallaxPx = PARALLAX_SHIFT_VW * window.innerWidth
  const OVERSCAN      = 1 + 2 * maxParallaxPx / cardWidth

  // Inner media dimensions
  const srcAspect      = projects[0]?.aspectRatio || '4:3'
  const [sw, sh]       = srcAspect.split(':').map(Number)
  const videoHWRatio   = sh / sw
  const innerWidth     = Math.round(cardWidth * OVERSCAN)
  const innerHeight    = Math.round(Math.max(cardHeight * 1.05, innerWidth * videoHWRatio))
  const innerLeft      = -Math.round((innerWidth  - cardWidth)  / 2)
  const innerTop       = -Math.round((innerHeight - cardHeight) / 2)

  const strideRef   = useRef(stride)
  strideRef.current = stride

  const cardWidthRef   = useRef(cardWidth)
  cardWidthRef.current = cardWidth

  // rawPos in index-space. Starts at L (first real project).
  const rawPos   = useMotionValue(L)
  const velMv    = useVelocity(rawPos)
  const animCtrl = useRef(null)
  const isWrapping = useRef(false)

  // ---------------------------------------------------------------------------
  // Reset carousel position when filter changes (L changes)
  // ---------------------------------------------------------------------------

  const prevLRef = useRef(L)
  useEffect(() => {
    if (L === prevLRef.current) return
    prevLRef.current = L
    animCtrl.current?.stop()
    rawPos.set(L)
  }, [L, rawPos])

  // ---------------------------------------------------------------------------
  // Position tracking — wrapping + centerIdx update
  // ---------------------------------------------------------------------------

  useMotionValueEvent(rawPos, 'change', (pos) => {
    let p = pos

    if (!isWrapping.current) {
      if (pos < L) {
        isWrapping.current = true
        const vel = velMv.get()
        animCtrl.current?.stop()
        p = pos + L
        rawPos.set(p)
        if (Math.abs(vel) > 1) {
          animCtrl.current = animate(rawPos, p, {
            type: 'inertia', velocity: vel, power: 0.3, timeConstant: 500,
          })
        }
        Promise.resolve().then(() => { isWrapping.current = false })
      } else if (pos >= 2 * L) {
        isWrapping.current = true
        const vel = velMv.get()
        animCtrl.current?.stop()
        p = pos - L
        rawPos.set(p)
        if (Math.abs(vel) > 1) {
          animCtrl.current = animate(rawPos, p, {
            type: 'inertia', velocity: vel, power: 0.3, timeConstant: 500,
          })
        }
        Promise.resolve().then(() => { isWrapping.current = false })
      }
    }

    const nearestSlot = Math.max(L, Math.min(2 * L - 1, Math.round(p)))
    const projIdx     = nearestSlot - L
    setCenterIdx(prev => prev !== projIdx ? projIdx : prev)
  })

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onResize() { setCardWidth(computeCardWidth()) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ---------------------------------------------------------------------------
  // Wheel / trackpad
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      animCtrl.current?.stop()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5
        ? e.deltaX
        : e.deltaY * 0.3
      rawPos.set(rawPos.get() + delta / strideRef.current)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [rawPos])

  // ---------------------------------------------------------------------------
  // Pointer / drag
  // ---------------------------------------------------------------------------

  const dragStart = useRef(null)
  const didDrag   = useRef(false)
  const isLoading = useRef(false)

  function onPointerDown(e) {
    if (e.clientY >= dragZoneBottom) return
    animCtrl.current?.stop()
    didDrag.current   = false
    dragStart.current = { x: e.clientX, y: e.clientY, pos: rawPos.get() }
  }

  function onPointerMove(e) {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y

    if (!didDrag.current) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      if (Math.abs(dy) > Math.abs(dx)) { dragStart.current = null; return }
      didDrag.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    rawPos.set(dragStart.current.pos - dx * dragSensitivity / strideRef.current)
  }

  function onPointerUp() {
    if (!dragStart.current) return
    dragStart.current = null
    if (!didDrag.current) return

    const vel = velMv.get()
    animCtrl.current = animate(rawPos, rawPos.get(), {
      type: 'inertia',
      velocity: vel,
      power: 0.3,
      timeConstant: 500,
    })
  }

  function onPointerCancel() {
    dragStart.current = null
  }

  function onClick(e) {
    if (didDrag.current) return
    const cardEl = e.target.closest('[data-slot-index]')
    if (!cardEl) return
    handleTap(parseInt(cardEl.dataset.slotIndex, 10))
  }

  // ---------------------------------------------------------------------------
  // Tap → snap to center + load project
  // ---------------------------------------------------------------------------

  async function handleTap(slotIndex) {
    if (isLoading.current) return
    const projIdx = slotIndex % L                    // 0..L-1
    const project = filteredProjects[projIdx]
    if (!project) return

    if (project.type === 'music') {
      // Flip the card in place — no snap, no scroll
      setFlippedId(project.id)
    } else {
      // Video: unflip any previously selected music card, snap to center
      setFlippedId(null)
      const target = projIdx + L
      animCtrl.current?.stop()
      animCtrl.current = animate(rawPos, target, {
        type: 'spring', stiffness: 300, damping: 35, mass: 0.8,
      })
    }

    isLoading.current = true
    onProjectLoad?.(project)
    try {
      audioEngine.pause()
      await Promise.all(project.stems.map(s => audioEngine.loadStem(s.id, s.url)))
      if (project.type === 'video' && videoRef?.current) {
        audioEngine.setMode('video', videoRef.current)
      } else {
        audioEngine.setMode('audio')
      }
      setLoadedId(project.id)
      audioEngine.play()
    } catch (err) {
      console.error('[PortfolioGrid] stem load error:', err)
    } finally {
      isLoading.current = false
    }
  }

  const activeProject = filteredProjects[centerIdx]

  // CSS custom properties drive all dimensions
  const cssVars = {
    '--card-w':    `${cardWidth}px`,
    '--card-h':    `${cardHeight}px`,
    '--inner-w':   `${innerWidth}px`,
    '--inner-h':   `${innerHeight}px`,
    '--inner-left':`${innerLeft}px`,
    '--inner-top': `${innerTop}px`,
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{ ...styles.container, ...cssVars }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
      >
        <AnimatePresence>
          {allCards.map((project, slotIndex) => (
            <CarouselCard
              key={`${project.id}-${Math.floor(slotIndex / L)}`}
              slotIndex={slotIndex}
              project={project}
              rawPos={rawPos}
              flippedId={flippedId}
              strideRef={strideRef}
              cardWidthRef={cardWidthRef}
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {!onVideoSlide && (
          <motion.div
            key="filter-buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ pointerEvents: 'none' }}
          >
            <TypeFilterButtons filter={filter} onToggle={handleToggleFilter} />
          </motion.div>
        )}
      </AnimatePresence>

    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  flipper: {
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d',
    position: 'relative',
    borderRadius: 16,
  },
  face: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    overflow: 'hidden',
    background: '#111',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  },
  faceImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
  },
  cardDiscOuter: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDisc: {
    width: '88%',
    height: '88%',
    borderRadius: '50%',
    background: 'radial-gradient(circle at center, #2a2a2a 0%, #111 70%)',
    willChange: 'transform',
    position: 'relative',
  },
  cardDiscSpindle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '6%',
    height: '6%',
    borderRadius: '50%',
    background: '#0a0a0a',
  },
  container: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    touchAction: 'pan-y',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'grab',
  },
  media: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    background: '#1a1a1a',
  },
  // Clips overscanned video inside card bounds while outer card stays overflow:visible
  videoClip: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    overflow: 'hidden',
    background: '#111',
  },
  cardLabel: {
    position: 'absolute',
    top: 'calc(100% + 12px)',
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  cardTitle: {
    display: 'block',
    color: 'rgba(255,255,255,0.9)',
    fontSize: '10px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  cardArtist: {
    display: 'block',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '10px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
  // Filter toggles — mirror of StemWaveform's metaOverlay/muteToggle/label styles.
  // bottom: calc(30vh - 20px) positions the container so Audio Post row (bottom, 64px)
  // centres at calc(30vh + 12px), matching the mx (Music) stem toggle row on the right.
  filterButtons: {
    position: 'fixed',
    left: '6vw',
    bottom: 'calc(30vh - 20px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  filterRow: {
    height: '64px',   // matches CANVAS_H — same centre-to-centre spacing as stem rows
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    pointerEvents: 'none',
  },
  filterLabel: {
    fontSize: '10px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  filterToggle: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '1.5px solid rgba(255,255,255,0.45)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.15s ease',
    pointerEvents: 'auto',
  },
}
