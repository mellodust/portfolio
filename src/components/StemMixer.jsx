import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioEngine } from '../audio/audioEngine';

const mixerVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.96,
    transition: { type: 'spring', stiffness: 400, damping: 32 },
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 32 },
  },
};

export default function StemMixer({ stems, isOpen }) {
  // Mirror muted state from the engine
  const [mutedMap, setMutedMap] = useState(() => {
    const map = {};
    for (const stem of stems) map[stem.id] = audioEngine.isStemMuted(stem.id);
    return map;
  });

  useEffect(() => {
    const off = audioEngine.on('stateChange', ({ stems: stemStates }) => {
      if (!stemStates) return;
      setMutedMap(prev => {
        const next = { ...prev };
        for (const id of Object.keys(stemStates)) next[id] = stemStates[id].muted;
        return next;
      });
    });
    return off;
  }, []);

  function toggle(id) {
    if (mutedMap[id]) audioEngine.unmuteStem(id);
    else audioEngine.muteStem(id);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={styles.mixer}
          variants={mixerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {stems.map(stem => (
            <div key={stem.id} style={styles.row}>
              <span style={styles.label}>{stem.name}</span>
              <button
                style={{ ...styles.toggle, ...(mutedMap[stem.id] ? styles.toggleOff : styles.toggleOn) }}
                onClick={() => toggle(stem.id)}
                aria-label={`${mutedMap[stem.id] ? 'Unmute' : 'Mute'} ${stem.name}`}
              >
                <motion.span
                  style={styles.toggleKnob}
                  animate={{ x: mutedMap[stem.id] ? 2 : 22 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const styles = {
  mixer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 16px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
    marginBottom: '8px',
    minWidth: '200px',
    pointerEvents: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 4px',
  },
  label: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '13px',
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  toggle: {
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.2s ease',
  },
  toggleOn: {
    background: 'rgba(255,255,255,0.9)',
  },
  toggleOff: {
    background: 'rgba(255,255,255,0.2)',
  },
  toggleKnob: {
    display: 'block',
    position: 'absolute',
    top: '3px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#0a0a0a',
  },
};
