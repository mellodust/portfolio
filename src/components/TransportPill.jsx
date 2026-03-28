import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioEngine } from '../audio/audioEngine';

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

export default function TransportPill() {
  const [isPlaying, setIsPlaying] = useState(audioEngine.isPlaying);

  useEffect(() => {
    const off = audioEngine.on('stateChange', ({ isPlaying }) => setIsPlaying(isPlaying));
    return off;
  }, []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.pill}>
        <button style={styles.btn} onClick={() => audioEngine.seek(0)} aria-label="Previous">
          <PrevIcon />
        </button>

        <button style={{ ...styles.btn, ...styles.playBtn }} onClick={() => audioEngine.togglePlay()} aria-label={isPlaying ? 'Pause' : 'Play'}>
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
  pill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 20px',
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
  iconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
};
