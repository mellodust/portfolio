import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioEngine } from '../audio/audioEngine';
import StemMixer from './StemMixer';

const STEMS = [
  { id: 'dx', name: 'Dialogue' },
  { id: 'fx', name: 'Effects' },
  { id: 'mx', name: 'Music' },
];

const iconVariants = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 20 } },
  exit: { scale: 0.6, opacity: 0, transition: { duration: 0.1 } },
};

function PrevIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
    </svg>
  );
}

function MixerIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" opacity={active ? 1 : 0.7} />
      <line x1="4" y1="12" x2="20" y2="12" opacity={active ? 1 : 0.7} />
      <line x1="4" y1="18" x2="20" y2="18" opacity={active ? 1 : 0.7} />
      <circle cx="8" cy="6" r="2.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" />
      <circle cx="16" cy="12" r="2.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" />
      <circle cx="10" cy="18" r="2.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" />
    </svg>
  );
}

export default function TransportPill() {
  const [isPlaying, setIsPlaying] = useState(audioEngine.isPlaying);
  const [mixerOpen, setMixerOpen] = useState(false);

  useEffect(() => {
    const off = audioEngine.on('stateChange', ({ isPlaying }) => setIsPlaying(isPlaying));
    return off;
  }, []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.column}>
        <StemMixer stems={STEMS} isOpen={mixerOpen} />

        <div style={styles.pill}>
          <button style={styles.btn} onClick={() => audioEngine.seek(0)} aria-label="Previous">
            <PrevIcon />
          </button>

          <button
            style={{ ...styles.btn, ...styles.playBtn }}
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

          <button style={styles.btn} onClick={() => audioEngine.seek(0)} aria-label="Next">
            <NextIcon />
          </button>

          <div style={styles.divider} />

          <button
            style={{ ...styles.btn, ...(mixerOpen ? styles.mixerBtnActive : {}) }}
            onClick={() => setMixerOpen(o => !o)}
            aria-label={mixerOpen ? 'Close mixer' : 'Open mixer'}
          >
            <MixerIcon active={mixerOpen} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    pointerEvents: 'none',
    zIndex: 1000,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '44px',
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
    pointerEvents: 'auto',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'white',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s ease',
  },
  playBtn: {
    width: '56px',
    height: '56px',
    background: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
    overflow: 'hidden',
  },
  mixerBtnActive: {
    background: 'rgba(255, 255, 255, 0.15)',
  },
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  divider: {
    width: '1px',
    height: '24px',
    background: 'rgba(255,255,255,0.2)',
    margin: '0 4px',
  },
};
