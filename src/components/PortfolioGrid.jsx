import { useRef, useState, useLayoutEffect, useEffect } from 'react'
import { motion, useMotionValue, useVelocity, useMotionValueEvent, animate, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../audio/audioEngine'

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
// CarouselCard — outer moves with carousel, inner parallaxes
// ---------------------------------------------------------------------------

function CarouselCard({ slotIndex, project, rawPos, loadedIdRef, strideRef }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)

  function apply(pos) {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer) return
    const stride = strideRef.current
    const offset = slotIndex - pos
    const x      = offset * stride
    const scale  = project.id === loadedIdRef.current ? 1.15 : 1.0
    outer.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, 0) scale(${scale})`
    if (inner) {
      // cardPositionFromCenter = offset * stride
      // parallaxOffset = cardPositionFromCenter * PARALLAX_SHIFT_VW  (viewportWidth cancels)
      inner.style.transform = `translate3d(${-offset * stride * PARALLAX_SHIFT_VW}px, 0, 0)`
    }
  }

  useMotionValueEvent(rawPos, 'change', apply)
  useLayoutEffect(() => { apply(rawPos.get()) })

  return (
    <div
      ref={outerRef}
      data-slot-index={slotIndex}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        // Width and height set dynamically — inline style is recalculated on resize via
        // parent re-render (cardWidth state drives a key prop, see PortfolioGrid)
        width: 'var(--card-w)',
        height: 'var(--card-h)',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#111',
        cursor: 'pointer',
        willChange: 'transform',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Inner media layer — OVERSCAN wide, tall enough for full vertical coverage.
          Precisely centered so ±PARALLAX_SHIFT shift never exposes a black edge.
          Card's overflow:hidden clips the excess. */}
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
        {project.type === 'video' ? (
          <VideoThumbnail
            videoUrl={project.videoUrl}
            thumbnailClips={project.thumbnailClips}
          />
        ) : (
          <div style={styles.placeholder} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Title variants
// ---------------------------------------------------------------------------

const titleVariants = {
  initial: { scale: 0.85, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 20 } },
  exit:    { scale: 0.85, opacity: 0, transition: { duration: 0.1 } },
}

// ---------------------------------------------------------------------------
// PortfolioGrid — flat infinite horizontal scroll carousel
// ---------------------------------------------------------------------------

export default function PortfolioGrid({
  projects,
  videoRef,
  onProjectLoad,
  showTitle    = true,
  dragSensitivity = 1.0,
  dragZoneBottom = window.innerHeight * 0.5,
}) {
  const L = projects.length

  // Clone layout: [projects × 3]
  //   Indices  0..L-1   → left clones   (mirrors real, enables leftward infinite scroll)
  //   Indices  L..2L-1  → real zone     (starting position, rawPos begins here)
  //   Indices  2L..3L-1 → right clones  (mirrors real, enables rightward infinite scroll)
  const allCards = [...projects, ...projects, ...projects]

  const containerRef = useRef(null)

  const [cardWidth, setCardWidth] = useState(computeCardWidth)
  const [loadedId, setLoadedId]   = useState(null)
  const [centerIdx, setCenterIdx] = useState(0)

  // Refs so apply() always reads the latest values without stale closures
  const loadedIdRef      = useRef(loadedId)
  loadedIdRef.current    = loadedId

  const gap        = Math.round(cardWidth * 0.08)
  const stride     = cardWidth + gap
  const aspectRatio = parseAspectRatio('1:1')
  const cardHeight  = Math.round(cardWidth / aspectRatio)

  // OVERSCAN: inner must be wide enough so the maximum parallax shift never exposes a black edge.
  // Max shift in pixels = PARALLAX_SHIFT_VW * viewportWidth (constant regardless of card ratio).
  // Expressed relative to cardWidth to get the required fractional overscan per side.
  const maxParallaxPx = PARALLAX_SHIFT_VW * window.innerWidth
  const OVERSCAN      = 1 + 2 * maxParallaxPx / cardWidth

  // Inner media dimensions — fully derived from OVERSCAN so no black edges at any card ratio.
  // Height uses the larger of a 5% vertical buffer and the inner width scaled by the source
  // video's h/w ratio, ensuring full coverage regardless of source aspect ratio.
  const srcAspect      = projects[0]?.aspectRatio || '4:3'
  const [sw, sh]       = srcAspect.split(':').map(Number)
  const videoHWRatio   = sh / sw
  const innerWidth     = Math.round(cardWidth * OVERSCAN)
  const innerHeight    = Math.round(Math.max(cardHeight * 1.05, innerWidth * videoHWRatio))
  const innerLeft      = -Math.round((innerWidth  - cardWidth)  / 2)
  const innerTop       = -Math.round((innerHeight - cardHeight) / 2)

  const strideRef   = useRef(stride)
  strideRef.current = stride

  // rawPos in index-space. 0 = slot 0 at center. Starts at L (first real project).
  const rawPos   = useMotionValue(L)
  const velMv    = useVelocity(rawPos)
  const animCtrl = useRef(null)
  const isWrapping = useRef(false)

  // ---------------------------------------------------------------------------
  // Position tracking — wrapping + centerIdx update
  // ---------------------------------------------------------------------------

  useMotionValueEvent(rawPos, 'change', (pos) => {
    let p = pos

    if (!isWrapping.current) {
      if (pos < L) {
        // Entered left clone zone — silently jump to equivalent real position
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
        // Entered right clone zone — silently jump to equivalent real position
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

    // Always update centered project (clamp to real zone for index computation)
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

    // Velocity-based inertia, no snapping, no min/max — free spin
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

  // Tap detection via event delegation — reads data-slot-index
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
    const target  = projIdx + L                      // snap to real zone equivalent
    const project = projects[projIdx]
    if (!project) return

    animCtrl.current?.stop()
    animCtrl.current = animate(rawPos, target, {
      type: 'spring', stiffness: 300, damping: 35, mass: 0.8,
    })

    isLoading.current = true
    onProjectLoad?.()
    try {
      audioEngine.pause()
      await Promise.all(project.stems.map(s => audioEngine.loadStem(s.id, s.url)))
      if (videoRef?.current) audioEngine.setMode('video', videoRef.current)
      setLoadedId(project.id)
      audioEngine.play()
    } catch (err) {
      console.error('[PortfolioGrid] stem load error:', err)
    } finally {
      isLoading.current = false
    }
  }

  const activeProject = projects[centerIdx]

  // CSS custom properties drive all dimensions — avoids prop-drilling into each card's style
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
        {allCards.map((project, slotIndex) => (
          <CarouselCard
            key={slotIndex}
            slotIndex={slotIndex}
            project={project}
            rawPos={rawPos}
            loadedIdRef={loadedIdRef}
            strideRef={strideRef}
          />
        ))}
      </div>

      {showTitle && (
        <div style={styles.titleDisplay}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={activeProject?.id}
              style={styles.titleText}
              variants={titleVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {activeProject?.title}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
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
  titleDisplay: {
    position: 'fixed',
    bottom: 'calc(96px + env(safe-area-inset-bottom))',
    left: 'calc(24px + env(safe-area-inset-left))',
    pointerEvents: 'none',
    zIndex: 999,
  },
  titleText: {
    display: 'block',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
}
