import { useState, useRef, useCallback } from 'react'

const NUM_PEAKS = 300

// ---------------------------------------------------------------------------
// Audio analysis
// ---------------------------------------------------------------------------

async function analyzeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  // Mix all channels down to mono by averaging
  const numChannels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const mono = new Float32Array(length)
  for (let c = 0; c < numChannels; c++) {
    const channelData = audioBuffer.getChannelData(c)
    for (let i = 0; i < length; i++) mono[i] += channelData[i] / numChannels
  }

  // Divide into NUM_PEAKS buckets, take peak absolute amplitude in each
  const bucketSize = Math.floor(length / NUM_PEAKS)
  const rawPeaks = new Float32Array(NUM_PEAKS)
  for (let b = 0; b < NUM_PEAKS; b++) {
    const start = b * bucketSize
    const end = start + bucketSize
    let peak = 0
    for (let i = start; i < end; i++) {
      const abs = Math.abs(mono[i])
      if (abs > peak) peak = abs
    }
    rawPeaks[b] = peak
  }

  // Normalize so max = 1
  const max = Math.max(...rawPeaks, 1e-6)
  const peaks = Array.from(rawPeaks).map(v => parseFloat((v / max).toFixed(4)))

  // Derive stem name from filename (strip extension)
  const stem = file.name.replace(/\.[^.]+$/, '')

  return {
    stem,
    duration: parseFloat(audioBuffer.duration.toFixed(4)),
    peaks,
  }
}

// ---------------------------------------------------------------------------
// Waveform preview — SVG bar chart
// ---------------------------------------------------------------------------

function WaveformPreview({ peaks }) {
  const W = 600
  const H = 120
  const barW = W / peaks.length
  const midY = H / 2

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={styles.svg}
      aria-label="Waveform preview"
    >
      {peaks.map((peak, i) => {
        const barH = Math.max(1, peak * midY)
        return (
          <rect
            key={i}
            x={i * barW}
            y={midY - barH}
            width={Math.max(1, barW - 0.5)}
            height={barH * 2}
            fill="rgba(255,255,255,0.75)"
          />
        )
      })}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// WaveformAnalyzer
// ---------------------------------------------------------------------------

export default function WaveformAnalyzer() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)
  const dragCounter = useRef(0)

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('audio/')) {
      setError('Please drop an audio file (mp3, aac, wav, etc.)')
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await analyzeAudioFile(file)
      setResult(data)
    } catch (err) {
      setError(`Analysis failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Drag and drop
  function onDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }
  function onDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileChange(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  async function copyToClipboard() {
    if (!result) return
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const jsonOutput = result ? JSON.stringify(result, null, 2) : null

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h1 style={styles.heading}>Waveform Analyzer</h1>
        <p style={styles.sub}>Drop an audio file to extract 300 normalized amplitude peaks.</p>

        {/* Drop zone */}
        <div
          style={{ ...styles.dropZone, ...(dragging ? styles.dropZoneActive : {}) }}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop audio file or click to browse"
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          {loading ? (
            <span style={styles.dropText}>Analyzing…</span>
          ) : dragging ? (
            <span style={styles.dropText}>Drop to analyze</span>
          ) : (
            <span style={styles.dropText}>
              Drop audio file here<br />
              <span style={styles.dropSub}>or click to browse</span>
            </span>
          )}
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {result && (
          <div style={styles.results}>
            {/* Meta row */}
            <div style={styles.metaRow}>
              <span style={styles.metaItem}>
                <span style={styles.metaLabel}>Stem</span>
                <span style={styles.metaValue}>{result.stem}</span>
              </span>
              <span style={styles.metaItem}>
                <span style={styles.metaLabel}>Duration</span>
                <span style={styles.metaValue}>{result.duration}s</span>
              </span>
              <span style={styles.metaItem}>
                <span style={styles.metaLabel}>Peaks</span>
                <span style={styles.metaValue}>{result.peaks.length}</span>
              </span>
            </div>

            {/* Waveform preview */}
            <WaveformPreview peaks={result.peaks} />

            {/* JSON output */}
            <div style={styles.jsonWrap}>
              <div style={styles.jsonHeader}>
                <span style={styles.jsonLabel}>JSON Output</span>
                <button style={styles.copyBtn} onClick={copyToClipboard}>
                  {copied ? 'Copied ✓' : 'Copy to clipboard'}
                </button>
              </div>
              <pre style={styles.jsonPre}>{jsonOutput}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: 'white',
    fontFamily: 'system-ui, sans-serif',
    padding: '48px 24px',
    boxSizing: 'border-box',
  },
  inner: {
    maxWidth: '680px',
    margin: '0 auto',
  },
  heading: {
    fontSize: '22px',
    fontWeight: 600,
    margin: '0 0 8px',
    letterSpacing: '0.02em',
  },
  sub: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.45)',
    margin: '0 0 32px',
  },
  dropZone: {
    border: '1.5px dashed rgba(255,255,255,0.2)',
    borderRadius: '16px',
    padding: '48px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    background: 'rgba(255,255,255,0.03)',
    outline: 'none',
  },
  dropZoneActive: {
    borderColor: 'rgba(255,255,255,0.6)',
    background: 'rgba(255,255,255,0.07)',
  },
  dropText: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
  },
  dropSub: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.3)',
  },
  error: {
    marginTop: '16px',
    fontSize: '13px',
    color: '#ff6b6b',
  },
  results: {
    marginTop: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  metaRow: {
    display: 'flex',
    gap: '32px',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metaLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
  svg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
  },
  jsonWrap: {
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  jsonHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  jsonLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  copyBtn: {
    padding: '6px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  jsonPre: {
    margin: 0,
    padding: '16px',
    fontSize: '11px',
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.6)',
    background: 'rgba(255,255,255,0.02)',
    overflowX: 'auto',
    maxHeight: '320px',
    overflowY: 'auto',
    fontFamily: 'ui-monospace, "SF Mono", monospace',
  },
}
