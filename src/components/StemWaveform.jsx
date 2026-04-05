import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { audioEngine } from '../audio/audioEngine'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_W = 2
const BAR_GAP = 1.5
const BAR_STRIDE = BAR_W + BAR_GAP
const CANVAS_H = 64

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Canvas draw — called imperatively, never through React
// ---------------------------------------------------------------------------

function drawWaveform(canvas, peaks, duration, currentTime, muted = false) {
  const W = canvas.offsetWidth
  const H = canvas.offsetHeight
  if (!W || !H || !peaks?.length || !duration) return

  const dpr = window.devicePixelRatio || 1
  const pw = Math.round(W * dpr)
  const ph = Math.round(H * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }

  const ctx = canvas.getContext('2d')
  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, W, H)

  const totalWaveformWidth = peaks.length * BAR_STRIDE
  const cx = W / 2
  const cy = H / 2
  const maxBarH = cy - 3
  const scrollOffset = (currentTime / duration) * totalWaveformWidth

  for (let i = 0; i < peaks.length; i++) {
    const x = (cx - scrollOffset) + i * BAR_STRIDE
    if (x + BAR_W < 0 || x > W) continue

    const barTime = (i / peaks.length) * duration
    const played = barTime <= currentTime
    const barH = Math.max(1.5, peaks[i] * maxBarH)

    if (muted) {
      ctx.fillStyle = played ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)'
    } else {
      ctx.fillStyle = played ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.16)'
    }
    ctx.beginPath()
    ctx.roundRect(Math.round(x), cy - barH, BAR_W, barH * 2, BAR_W / 2)
    ctx.fill()
  }

  // (playhead is a separate DOM element — not drawn on canvas)
}

// ---------------------------------------------------------------------------
// StemWaveform — single canvas row
// ---------------------------------------------------------------------------

export default function StemWaveform({ peaks, duration, muted = false, showControls = true, scrollerRef }) {
  const canvasRef = useRef(null)
  const currentTimeRef = useRef(audioEngine.currentTime)
  const mutedRef = useRef(muted)
  const dragRef = useRef(null)

  // Sync mutedRef and redraw when muted prop changes between renders
  useEffect(() => {
    mutedRef.current = muted
    const canvas = canvasRef.current
    if (canvas) drawWaveform(canvas, peaks, duration, currentTimeRef.current, muted)
  }, [muted, peaks, duration])

  // Engine subscriptions — imperative draw on every tick/stateChange
  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (canvas) drawWaveform(canvas, peaks, duration, currentTimeRef.current, mutedRef.current)
    }
    const offTick = audioEngine.on('tick', ({ currentTime }) => {
      currentTimeRef.current = currentTime
      draw()
    })
    const offState = audioEngine.on('stateChange', ({ currentTime }) => {
      currentTimeRef.current = currentTime
      draw()
    })
    draw()
    return () => { offTick(); offState() }
  }, [peaks, duration])

  // ResizeObserver — redraw on container size changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      drawWaveform(canvas, peaks, duration, currentTimeRef.current, mutedRef.current)
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [peaks, duration])

  // Forward wheel events to the scroller container — prevents canvas from blocking vertical scroll
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function onWheel(e) {
      scrollerRef?.current?.scrollBy(0, e.deltaY)
    }
    canvas.addEventListener('wheel', onWheel, { passive: true })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [scrollerRef])

  // Seek helpers
  function canvasXToTime(canvasX) {
    if (!duration || !peaks?.length) return null
    const W = canvasRef.current.offsetWidth
    const totalWaveformWidth = peaks.length * BAR_STRIDE
    const cx = W / 2
    const scrollOffset = (currentTimeRef.current / duration) * totalWaveformWidth
    return Math.max(0, Math.min(duration, ((scrollOffset + canvasX - cx) / totalWaveformWidth) * duration))
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startTime: currentTimeRef.current }
    audioEngine.beginScrub()
  }

  function onPointerMove(e) {
    if (!dragRef.current) return
    const { startX, startTime } = dragRef.current
    const deltaX = e.clientX - startX
    const totalWaveformWidth = peaks.length * BAR_STRIDE
    audioEngine.scrubTo(Math.max(0, Math.min(duration, startTime - (deltaX / totalWaveformWidth) * duration)))
  }

  function onPointerUp() {
    if (!dragRef.current) return
    dragRef.current = null
    audioEngine.endScrub()
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ ...styles.canvas, pointerEvents: showControls ? 'auto' : 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { if (dragRef.current) { dragRef.current = null; audioEngine.endScrub() } }}
    />
  )
}

// ---------------------------------------------------------------------------
// MuteToggle — small circle button in each expanded row
// ---------------------------------------------------------------------------

function MuteToggle({ stemId, muted, showControls = true }) {
  return (
    <button
      style={{
        ...styles.muteToggle,
        background: muted ? 'transparent' : 'rgba(255,255,255,0.85)',
        pointerEvents: showControls ? 'auto' : 'none',
      }}
      onClick={() => muted ? audioEngine.unmuteStem(stemId) : audioEngine.muteStem(stemId)}
      aria-label={muted ? `Unmute ${stemId}` : `Mute ${stemId}`}
    />
  )
}

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

// Expanded stem rows — stagger in per index, collapse simultaneously
const expandedVariants = {
  initial: { height: 0, opacity: 0 },
  animate: (i) => ({
    height: CANVAS_H,
    opacity: 1,
    transition: { type: 'spring', stiffness: 380, damping: 36, delay: i * 0.04 },
  }),
  exit: { height: 0, opacity: 0, transition: { type: 'spring', stiffness: 420, damping: 36 } },
}

// Collapsed single summed row
const collapsedVariants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: CANVAS_H, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 36 } },
  exit:    { height: 0, opacity: 0, transition: { type: 'spring', stiffness: 420, damping: 36 } },
}


// ---------------------------------------------------------------------------
// StemWaveformStack
// ---------------------------------------------------------------------------

export function StemWaveformStack({ stems, mixerOpen, showControls = true, showContainer = false, containerMode = 'dark', containerBlur = 20, scrollerRef, onBoundsChange }) {
  const [currentTime, setCurrentTime] = useState(audioEngine.currentTime)

  // Mirror mute state from engine
  const [mutedMap, setMutedMap] = useState(() => {
    const map = {}
    stems.forEach(s => { map[s.id] = audioEngine.isStemMuted(s.id) })
    return map
  })

  useEffect(() => {
    const offTick = audioEngine.on('tick', ({ currentTime }) => setCurrentTime(currentTime))
    const offState = audioEngine.on('stateChange', ({ currentTime, stems: stemStates }) => {
      setCurrentTime(currentTime)
      if (stemStates) {
        setMutedMap(prev => {
          const next = { ...prev }
          for (const id of Object.keys(stemStates)) {
            if (id in next) next[id] = stemStates[id].muted
          }
          return next
        })
      }
    })
    return () => { offTick(); offState() }
  }, [])

  // Average peaks of only the unmuted stems — recalculates on mute changes
  const collapsedPeaks = useMemo(() => {
    const active = stems.filter(s => !mutedMap[s.id])
    if (!active.length) return stems[0]?.peaks.map(() => 0) ?? []
    const len = active[0].peaks.length
    const out = new Array(len).fill(0)
    for (const s of active) for (let i = 0; i < len; i++) out[i] += s.peaks[i]
    return out.map(v => v / active.length)
  }, [stems, mutedMap])

  const maxDuration = stems[0]?.duration ?? 0

  const containerRef = useRef(null)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !onBoundsChange) return
    function measure() { onBoundsChange(el.getBoundingClientRect().top) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [onBoundsChange])

  const containerStyle = showContainer ? {
    background: containerMode === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.4)',
    backdropFilter: `blur(${containerBlur}px)`,
    WebkitBackdropFilter: `blur(${containerBlur}px)`,
    border: containerMode === 'light' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '12px 0',
  } : {}

  return (
    <>
      <div ref={containerRef} style={containerStyle}>
        {/* Waveform rows + playhead + time display */}
        <div style={styles.stack}>
          <div style={styles.rowsContainer}>
            <AnimatePresence mode="sync" initial={false}>
              {mixerOpen ? (
                [...stems].reverse().map((stem, i) => (
                  <motion.div
                    key={stem.id}
                    custom={i}
                    variants={expandedVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={styles.row}>
                      <div style={styles.canvasWrapper}>
                        <StemWaveform
                          peaks={stem.peaks}
                          duration={stem.duration}
                          muted={mutedMap[stem.id]}
                          showControls={showControls}
                          scrollerRef={scrollerRef}
                        />
                      </div>
                      <div style={styles.metaOverlay}>
                        <span style={styles.label}>{stem.name}</span>
                        <MuteToggle stemId={stem.id} muted={mutedMap[stem.id]} showControls={showControls} />
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  key="collapsed"
                  variants={collapsedVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ overflow: 'hidden' }}
                >
                  <div style={styles.row}>
                    <div style={styles.canvasWrapper}>
                      <StemWaveform
                        peaks={collapsedPeaks}
                        duration={maxDuration}
                        showControls={showControls}
                        scrollerRef={scrollerRef}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Playhead — extends 12px beyond top and bottom of all rows */}
            <div style={styles.playhead} />
          </div>

          {/* Time display — always visible */}
          <div style={styles.timeRow}>
            <span style={styles.timeText}>{formatTime(currentTime)} / {formatTime(maxDuration)}</span>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  canvas: {
    display: 'block',
    width: '100%',
    height: `${CANVAS_H}px`,
    cursor: 'ew-resize',
    touchAction: 'pan-y',
    pointerEvents: 'auto',
  },
  stack: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  rowsContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column-reverse', // stem[0] anchors at bottom; new rows grow upward
  },
  row: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    height: `${CANVAS_H}px`,
    boxSizing: 'border-box',
  },
  canvasWrapper: {
    // Fixed 55vw centered in the full-width row — identical in both collapsed and expanded modes.
    width: '55vw',
    marginLeft: 'calc(50% - 27.5vw)',
    flexShrink: 0,
    WebkitMaskImage: 'linear-gradient(to right, transparent 0%, white 15%, white 85%, transparent 100%)',
    maskImage: 'linear-gradient(to right, transparent 0%, white 15%, white 85%, transparent 100%)',
    touchAction: 'pan-y',
    pointerEvents: 'none',
  },
  metaOverlay: {
    // Absolutely positioned so it never affects canvas dimensions.
    // right: 6vw aligns toggles with the mixer button (also at right: 6vw).
    position: 'absolute',
    right: '6vw',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    pointerEvents: 'none',
  },
  playhead: {
    position: 'absolute',
    top: '-12px',    // 12px beyond the top of the waveform rows
    bottom: '-12px', // 12px beyond the bottom of the waveform rows
    // Canvas is 55vw centered in the 100vw row; its center is exactly at 50%.
    left: '50%',
    width: '1px',
    transform: 'translateX(-0.5px)',
    background: 'rgba(255,255,255,0.95)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  label: {
    flexShrink: 0,
    fontSize: '10px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  muteToggle: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '1.5px solid rgba(255,255,255,0.45)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.15s ease',
  },
  timeRow: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '20px', // 12px playhead extension + 8px breathing room
  },
  timeText: {
    fontSize: '11px',
    fontFamily: 'ui-monospace, "SF Mono", monospace',
    color: 'rgba(255,255,255,0.45)',
    fontVariantNumeric: 'tabular-nums',
  },
}
