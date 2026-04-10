import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { audioEngine } from '../audio/audioEngine';

// Instant in, 0.4s ease out — mirrors App.jsx overlayTransition
function overlayTransition(visible) {
  return { duration: visible ? 0 : 0.4, ease: 'easeOut' }
}

const iconVariants = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 20 } },
  exit: { scale: 0.6, opacity: 0, transition: { duration: 0.1 } },
};

// Single right-pointing chevron, x=[1,12] y=[3,21], r=2 rounded corners.
// All six vertices (outer top-left, tip, outer bottom-left, inner bottom-left,
// inner notch, inner top-left) are rounded with quadratic bezier arcs.
const CHEVRON_PATH =
  'M1 5 Q1 3 2.5 4.3 L10.5 10.7 Q12 12 10.5 13.3 L2.5 19.7 Q1 21 1 19 L1 18 Q1 16 2.7 14.9 L5.3 13.1 Q7 12 5.3 10.9 L2.7 9.1 Q1 8 1 6 Z'

function PrevIcon() {
  // Two left-pointing chevrons: mirror the base path via translate+scale(-1,1).
  // Left chevron  → translate(14,0) scale(-1,1) → x=[2,13]  tip at x=2
  // Right chevron → translate(23,0) scale(-1,1) → x=[11,22] tip at x=11
  // 2px overlap, 2px margin each side in 24px viewBox.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d={CHEVRON_PATH} transform="translate(14,0) scale(-1,1)" />
      <path d={CHEVRON_PATH} transform="translate(23,0) scale(-1,1)" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M7.5 4.5 L19 12 L7.5 19.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="2" />
      <rect x="14" y="4" width="4" height="16" rx="2" />
    </svg>
  );
}

function NextIcon() {
  // Two right-pointing chevrons using the same base path.
  // Left chevron  → translate(1,0)  → x=[2,13]  tip at x=13
  // Right chevron → translate(10,0) → x=[11,22] tip at x=22
  // 2px overlap, 2px margin each side in 24px viewBox.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d={CHEVRON_PATH} transform="translate(1,0)" />
      <path d={CHEVRON_PATH} transform="translate(10,0)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MixerIcon — masks from mixer_6_closed.svg / mixer_5_open.svg
// Each row uses a shared spring MotionValue that drives BOTH the hole in the
// masked path and the circle cx — they cannot desync.
// ---------------------------------------------------------------------------

// Cubic bezier approximation constant for a smooth circle (4 arcs).
const KAPPA = 0.5523

// Builds the rectangle + circle-hole compound path for one row.
// The hole winding matches the closed-state originals (consistent direction
// avoids morph artifacts when interpolating between cx positions).
// Verified: buildRowPath(32, 12) produces the exact closed-state top-row path.
function buildRowPath(cx, cy) {
  const r = 3          // hole radius — matches original SVG paths
  const k = r * KAPPA  // control-point offset ≈ 1.6569
  return (
    `M6 ${cy + r}V${cy - r}H42V${cy + r}H6Z` +
    `M${cx + r} ${cy}` +
    `C${cx + r} ${cy - k} ${cx + k} ${cy - r} ${cx} ${cy - r}` +
    `C${cx - k} ${cy - r} ${cx - r} ${cy - k} ${cx - r} ${cy}` +
    `C${cx - r} ${cy + k} ${cx - k} ${cy + r} ${cx} ${cy + r}` +
    `C${cx + k} ${cy + r} ${cx + r} ${cy + k} ${cx + r} ${cy}Z`
  )
}

// cx positions resolved from each SVG's matrix transforms.
// Closed: matrix(-1 0 0 1 e f) on cx=3 → x' = -3+e
// Open:   matrix(1 0 0 -1 e f) on cx=3 → x' =  3+e
const MIXER_CIRCLES = [
  { cy: 12, closedCx: 32, openCx: 16 },
  { cy: 24, closedCx: 18, openCx: 30 },
  { cy: 36, closedCx: 32, openCx: 16 },
]

function MixerIcon({ active }) {
  // One raw + spring pair per row. Both the masked path and the circle read
  // from the same spring — the hole always matches the circle position.
  const raw0 = useMotionValue(active ? MIXER_CIRCLES[0].openCx : MIXER_CIRCLES[0].closedCx)
  const raw1 = useMotionValue(active ? MIXER_CIRCLES[1].openCx : MIXER_CIRCLES[1].closedCx)
  const raw2 = useMotionValue(active ? MIXER_CIRCLES[2].openCx : MIXER_CIRCLES[2].closedCx)
  const s0 = useSpring(raw0, { stiffness: 300, damping: 25 })
  const s1 = useSpring(raw1, { stiffness: 300, damping: 25 })
  const s2 = useSpring(raw2, { stiffness: 300, damping: 25 })

  useEffect(() => {
    raw0.set(active ? MIXER_CIRCLES[0].openCx : MIXER_CIRCLES[0].closedCx)
    raw1.set(active ? MIXER_CIRCLES[1].openCx : MIXER_CIRCLES[1].closedCx)
    raw2.set(active ? MIXER_CIRCLES[2].openCx : MIXER_CIRCLES[2].closedCx)
  }, [active])

  // Path d — hole position tracks the spring
  const d0 = useTransform(s0, cx => buildRowPath(cx, 12))
  const d1 = useTransform(s1, cx => buildRowPath(cx, 24))
  const d2 = useTransform(s2, cx => buildRowPath(cx, 36))

  // fillOpacity: 1 (filled) at closedCx, 0 (hollow) at openCx
  const fo0 = useTransform(s0, [MIXER_CIRCLES[0].closedCx, MIXER_CIRCLES[0].openCx], [1, 0])
  const fo1 = useTransform(s1, [MIXER_CIRCLES[1].closedCx, MIXER_CIRCLES[1].openCx], [1, 0])
  const fo2 = useTransform(s2, [MIXER_CIRCLES[2].closedCx, MIXER_CIRCLES[2].openCx], [1, 0])

  return (
    <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
      <defs>
        {/* Static masks — define the rounded-cap line shape for each row */}
        <mask id="mx-m12" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="6" y="10" width="36" height="4">
          <line x1="8" y1="12" x2="40" y2="12" stroke="white" strokeWidth="4" strokeLinecap="round"/>
        </mask>
        <mask id="mx-m24" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="6" y="22" width="36" height="4">
          <line x1="8" y1="24" x2="40" y2="24" stroke="white" strokeWidth="4" strokeLinecap="round"/>
        </mask>
        <mask id="mx-m36" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="6" y="34" width="36" height="4">
          <line x1="8" y1="36" x2="40" y2="36" stroke="white" strokeWidth="4" strokeLinecap="round"/>
        </mask>
      </defs>
      {/* Masked rows — path hole moves with the spring */}
      <g mask="url(#mx-m12)"><motion.path d={d0} fill="white"/></g>
      <g mask="url(#mx-m24)"><motion.path d={d1} fill="white"/></g>
      <g mask="url(#mx-m36)"><motion.path d={d2} fill="white"/></g>
      {/* Circles — cx is the same spring driving the path hole above */}
      <motion.circle cx={s0} cy={12} r={4.5} stroke="white" strokeWidth={3} fill="white" style={{ fillOpacity: fo0 }}/>
      <motion.circle cx={s1} cy={24} r={4.5} stroke="white" strokeWidth={3} fill="white" style={{ fillOpacity: fo1 }}/>
      <motion.circle cx={s2} cy={36} r={4.5} stroke="white" strokeWidth={3} fill="white" style={{ fillOpacity: fo2 }}/>
    </svg>
  )
}

export default function TransportPill({ mixerOpen = false, onMixerOpenChange, showControls = true, projectLoaded = false, onBoundsChange, scrollerRef }) {
  const [isPlaying, setIsPlaying] = useState(audioEngine.isPlaying);

  useEffect(() => {
    const off = audioEngine.on('stateChange', ({ isPlaying }) => setIsPlaying(isPlaying));
    return off;
  }, []);

  const wrapperRef = useRef(null)
  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (!el || !onBoundsChange) return
    function measure() { onBoundsChange(el.getBoundingClientRect().top) }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [onBoundsChange])

  const visible = projectLoaded && showControls

  return (
    <motion.div
      ref={wrapperRef}
      style={styles.transportWrapper}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={overlayTransition(visible)}
      onWheel={e => scrollerRef?.current?.scrollBy(0, e.deltaY)}
    >
      {/* Prev / Play / Next — centered */}
      <div style={styles.transportGroup}>
        <button style={{ ...styles.btn, pointerEvents: visible ? 'auto' : 'none' }} onClick={() => audioEngine.seek(0)} aria-label="Previous">
          <PrevIcon />
        </button>

        <button
          style={{ ...styles.btn, ...styles.playBtn, pointerEvents: visible ? 'auto' : 'none' }}
          onClick={() => audioEngine.togglePlay()}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.span key="pause" variants={iconVariants} initial="initial" animate="animate" exit="exit" style={styles.iconWrap}>
                <PauseIcon />
              </motion.span>
            ) : (
              <motion.span key="play" variants={iconVariants} initial="initial" animate="animate" exit="exit" style={styles.iconWrap}>
                <PlayIcon />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button style={{ ...styles.btn, pointerEvents: visible ? 'auto' : 'none' }} onClick={() => audioEngine.seek(0)} aria-label="Next">
          <NextIcon />
        </button>
      </div>

      {/* Mixer — right side of the same transport row */}
      <button
        style={{
          ...styles.mixerBtn,
          ...(mixerOpen ? styles.mixerBtnActive : {}),
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={() => onMixerOpenChange?.(!mixerOpen)}
        aria-label={mixerOpen ? 'Close mixer' : 'Open mixer'}
      >
        <MixerIcon active={mixerOpen} />
      </button>
    </motion.div>
  );
}

const styles = {
  transportWrapper: {
    position: 'fixed',
    top: '82vh',
    left: 0,
    width: '100vw',
    transform: 'translateY(-50%)',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  transportGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0px',
    pointerEvents: 'none',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    padding: 0,
  },
  playBtn: {
    width: '72px',
    height: '72px',
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  mixerBtn: {
    position: 'absolute',
    top: '50%',
    right: '6vw',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 0.15s ease',
  },
  mixerBtnActive: {
    color: 'rgba(255,255,255,0.95)',
  },
};
