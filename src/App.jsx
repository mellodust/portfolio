import { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BuilderComponent, builder, useIsPreviewing } from '@builder.io/react'
import { audioEngine } from './audio/audioEngine'
import TransportPill from './components/TransportPill'
import VideoModule from './components/VideoModule'
import MusicModule from './components/MusicModule'
import PortfolioGrid from './components/PortfolioGrid'
import { StemWaveformStack } from './components/StemWaveform'
import './App.css'

const PROJECT_TEMPLATE = {
  title: 'Soundworks',
  artist: 'mellodust',
  type: 'video',
  artwork: null,
  aspectRatio: '4:3',
  videoUrl: '/assets/20260326/soundworks_20260326_video.mp4',
  thumbnailClips: [
    { in: 50.459, out: 52.1, position: 'left center'   },
    { in: 54.4,   out: 55.1, position: 'center center' },
  ],
  stems: [
    { id: 'dx', name: 'DX', url: '/src/assets/20260326/soundworks_20260326_dx.aac' },
    { id: 'fx', name: 'FX', url: '/src/assets/20260326/soundworks_20260326_fx.aac' },
    { id: 'mx', name: 'MX', url: '/src/assets/20260326/soundworks_20260326_mx.aac' },
  ],
}

const PROJECTS = [1, 2, 3, 4, 5].map(n => ({
  ...PROJECT_TEMPLATE,
  id: `soundworks-${n}`,
  ...(n === 1 ? { type: 'music' } : {}),
}))

const VIDEO_SRC = '/assets/20260326/soundworks_20260326_video.mp4'

const WAVEFORM_STEMS = [
  {
    id: 'dx',
    name: 'Dialogue',
    duration: 97.6213,
    peaks: [0,0,0,0,0,0,0,0,0.1217,0.3373,0.2405,0.3035,0.2543,0.0443,0.0058,0.0068,0.0624,0.0903,0.0745,0.0082,0.0157,0.0097,0.012,0.0099,0.0149,0.0174,0.0187,0.0245,0.0094,0.0093,0.008,0.0144,0.0105,0.0105,0.0084,0.0765,0.1118,0.0109,0.0133,0.0103,0.0088,0.5019,0.4529,0.6329,0.5853,0.3671,0.0151,0.0879,0.0541,0.0116,0.0085,0.0105,0.0089,0.0077,0.0087,0.0097,0.0121,0.0075,0.0087,0.0106,0.0086,0.2938,0.3542,0.1307,0.5498,0.4632,0.0354,0.0052,0.018,0.0053,0.1084,0.1192,0.0911,0.0406,0.0143,0.4368,0.9608,1,0.64,0.0303,0.4725,0.235,0.1376,0.0598,0.6187,0.3895,0.1041,0.2925,0.1844,0.6115,0.2005,0.1477,0.1447,0.0216,0.0181,0.65,0.7314,0.2338,0.6107,0.6459,0.4704,0.4362,0.4002,0.399,0.33,0.2323,0.2104,0.3916,0.5544,0.5514,0.5301,0.678,0.6687,0.5803,0.5108,0.1848,0.0028,0.0037,0.0002,0,0,0,0.0041,0.0062,0.006,0.0062,0.0053,0.0056,0.0061,0.0049,0.0055,0.0065,0.0048,0.021,0.0221,0.0057,0.0414,0.1681,0.2639,0.0932,0.0128,0.0149,0.0163,0.0159,0.0091,0,0,0.0002,0.0212,0.0075,0.0065,0.0237,0.0272,0.0205,0.022,0.0296,0.0307,0.0221,0.0153,0.0194,0.0162,0.0152,0.0214,0.0202,0.0562,0.0196,0.0155,0.0133,0.0138,0.0153,0.0057,0.0115,0.0064,0.0071,0.0242,0.0171,0.0143,0.0092,0.0062,0.0055,0.0055,0.0109,0.0098,0.0101,0.0154,0.0381,0.0149,0.0189,0.0148,0.0125,0.2273,0.0159,0.0052,0.0067,0.4681,0.2893,0.443,0.392,0.0635,0.0065,0.0119,0.4582,0.0053,0.0062,0.0056,0.0091,0.005,0.0062,0.007,0.0067,0.007,0.0187,0.0631,0.2153,0.1589,0.0088,0.023,0.0137,0.2764,0.5755,0.0206,0.4443,0.461,0.3042,0.0061,0.009,0.0099,0.0092,0.0085,0.0071,0.0112,0.456,0.0715,0.0071,0.0078,0.0084,0.0083,0.0102,0.0102,0.0079,0.6634,0.5121,0.0134,0.0146,0.0096,0.0139,0.0114,0.0143,0.0119,0.0107,0.0132,0.0408,0.5372,0.4289,0.3925,0.0359,0.1128,0.1136,0.0702,0.051,0.0187,0.0176,0.0195,0.0286,0.0172,0.083,0.0989,0.0592,0.0194,0.0181,0.0177,0.3313,0.1195,0.0183,0.0145,0.0385,0.0054,0.0071,0.0075,0.0075,0.0075,0.0077,0.0065,0.066,0.0124,0.0097,0.0084,0.0079,0.0137,0.0127,0.0109,0.0213,0.0004,0,0,0,0,0,0,0],
  },
  {
    id: 'fx',
    name: 'Effects',
    duration: 97.6213,
    peaks: [0.0176,0.05,0.0625,0.0949,0.1385,0.1406,0.254,0.5172,0.5613,0.5467,0.2728,0.2738,0.3196,0.1905,0.2083,0.2161,0.2319,0.2361,0.2519,0.2473,0.3026,0.2597,0.263,0.2834,0.3314,0.2575,0.4361,0.4455,0.0759,0.0649,0.1645,0.2017,0.1456,0.2362,0.2161,0.24,0.2281,0.1554,0.1068,0.1002,0.1434,0.2551,0.138,0.0524,0.2057,0.1384,0.1489,0.0668,0.1413,0.2818,0.6672,0.8959,0.6533,0.4816,0.3805,0.4053,0.7419,0.4273,0.3776,0.5925,1,0.9787,0.8712,0.5508,0.36,0.9516,0.4484,0.2193,0.3516,0.0972,0.08,0.2484,0.9704,0.9272,0.4873,0.2461,0.1665,0.2188,0.1019,0.1193,0.1621,0.2274,0.4227,0.2659,0.2922,0.1873,0.0493,0.0927,0.1939,0.1434,0.2652,0.4486,0.0511,0.0385,0.0235,0.0178,0.0144,0.1285,0.1056,0.0367,0.1011,0.3524,0.0613,0.1295,0.0928,0.1862,0.1922,0.1199,0.2211,0.256,0.4554,0.5901,0.5615,0.4327,0.4063,0.6048,0.5847,0.0416,0.0011,0.0006,0.0619,0.1473,0.1334,0.0429,0.0442,0.1639,0.298,0.3445,0.3099,0.2407,0.0844,0.0591,0.0686,0.1219,0.1686,0.0383,0.1127,0.267,0.0898,0.0521,0.1914,0.115,0.0495,0.048,0.0453,0.0258,0.0378,0.0854,0.0403,0.02,0.0069,0.0007,0.0008,0.0008,0.1244,0.1064,0.348,0.34,0.4792,0.1989,0.1128,0.064,0.1074,0.0857,0.1713,0.0711,0.0308,0.0684,0.0574,0.2374,0.3425,0.3054,0.3296,0.3642,0.4797,0.4439,0.4163,0.2502,0.4329,0.4234,0.3256,0.221,0.2394,0.168,0.2616,0.358,0.197,0.1004,0.0628,0.0774,0.1942,0.2899,0.3847,0.6418,0.7418,0.6451,0.3146,0.9231,0.2715,0.1988,0.2006,0.2722,0.1848,0.1145,0.1878,0.2449,0.2158,0.1803,0.1215,0.0358,0.0543,0.0665,0.0826,0.2223,0.5915,0.4412,0.5412,0.6341,0.4088,0.5058,0.4984,0.5212,0.6223,0.6697,0.4917,0.6118,0.3297,0.3411,0.3008,0.2276,0.2959,0.5928,0.363,0.1786,0.1296,0.2692,0.3713,0.7624,0.2287,0.4365,0.1865,0.4191,0.3998,0.6323,0.2923,0.1708,0.164,0.1076,0.0968,0.0841,0.1273,0.1231,0.1139,0.1223,0.0975,0.0773,0.0798,0.0822,0.0819,0.0675,0.0817,0.1912,0.2117,0.1296,0.1266,0.1317,0.5126,0.2243,0.3241,0.7286,0.4001,0.5556,0.288,0.2474,0.2183,0.1292,0.1755,0.092,0.0874,0.0797,0.0995,0.1195,0.0962,0.2787,0.2341,0.282,0.2564,0.1931,0.1726,0.1485,0.0505,0.047,0.0522,0.0541,0.1428,0.1446,0.0228,0.0001,0.0001,0],
  },
  {
    id: 'mx',
    name: 'Music',
    duration: 97.6213,
    peaks: [0,0,0,0,0,0,0,0,0.0097,0.0434,0.1699,0.1528,0.2957,0.3423,0.5395,0.227,0.37,0.2739,0.0689,0.0948,0.3246,0.1652,0.1273,0.3149,0.3969,0.295,0.3215,0.3155,0.4187,0.2942,0.2692,0.2108,0.4673,0.1178,0.299,0.231,0.0978,0.1569,0.1453,0.147,0.3279,0.3587,0.3114,0.3321,0.2542,0.1906,0.4602,0.126,0.0677,0.2439,0.128,0.1407,0.1214,0.093,0.28,0.4961,0.5254,0.4677,0.4793,0.3201,0.537,0.349,0.1392,0.2991,0.6321,0.158,0.1706,0.2906,0.3876,0.3479,0.3539,0.3474,0.3825,0.2543,0.4328,0.2208,0.1528,0.1729,0.3259,0.097,0.0955,0.3582,0.4989,0.3398,0.3003,0.2662,0.2612,0.2238,0.1993,0.4269,0.2699,0.1666,0.0864,0.1452,0.1253,0.2723,0.0757,0.1912,0.3934,0.3155,0.412,0.3137,0.4354,0.2237,0.4554,0.1189,0.1151,0.2648,0.1122,0.1143,0.4351,0.14,0.3278,0.4068,0.3969,0.2564,0.53,0.0241,0.0005,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.0032,0.0086,0.0145,0.0172,0.0382,0.0545,0.0589,0.0377,0.0097,0.0006,0,0,0,0,0,0,0.0003,0,0.0149,0.0047,0.0636,0.165,0.2953,0.4276,0.3046,0.447,0.3389,0.44,0.5163,0.6542,0.4196,0.5159,0.5017,0.3444,0.2769,0.5278,0.6515,0.4135,0.4714,0.4561,0.4332,0.4343,0.8862,0.9508,0.6293,0.7958,0.4808,0.3755,0.5329,0.2675,0.2008,0.5504,0.6632,0.405,0.5177,0.558,0.3571,0.1497,0.2976,0.6698,0.6314,0.6606,0.4684,0.4004,0.8672,0.6608,0.664,0.8622,0.7912,0.7144,0.8119,1,0.6777,0.5887,0.6431,0.754,0.7193,0.3549,0.4137,0.5655,0.5024,0.9613,0.8566,0.8233,0.701,0.5303,0.8409,0.6548,0.4654,0.5149,0.5128,0.3053,0.4487,0.455,0.6821,0.6292,0.6828,0.6423,0.481,0.5753,0.8217,0.8033,0.7216,0.5062,0.4067,0.5075,0.6789,0.9623,0.6627,0.7421,0.7672,0.8206,0.4735,0.3947,0.3243,0.2295,0.1433,0.4207,0.2465,0.2442,0.1709,0.2888,0.4374,0.3082,0.413,0.4164,0.2383,0.1591,0.2124,0.4709,0.3671,0.2357,0.391,0.2613,0.3686,0.4282,0.5467,0.7141,0.4552,0.4515,0.1045,0.2304,0.464,0.852,0.6008,0.3032,0.1092,0.3383,0.4084,0.3657,0.3562,0.1646,0.0144,0.1815,0.1327,0.0549,0.0507,0.0308,0.0282,0.0164,0.0046,0.0026,0.1225,0.0185,0.0455,0.0049,0.0026],
  },
]

// Shared Framer Motion transition: instant in, 0.4s ease out
function overlayTransition(visible) {
  return { duration: visible ? 0 : 0.4, ease: 'easeOut' }
}

function App() {
  const videoRef = useRef(null)
  const scrollerRef = useRef(null)
  const isPreviewing = useIsPreviewing()
  const [builderContent, setBuilderContent] = useState(null)

  useEffect(() => {
    builder.get('page', { url: '/' }).promise().then(setBuilderContent)
  }, [])
  const [projectLoaded, setProjectLoaded] = useState(false)
  const [loadedProject, setLoadedProject] = useState(null)
  const [onVideoSlide, setOnVideoSlide] = useState(false)
  const [mixerOpen, setMixerOpen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // Refs so callbacks stay stable and closures never go stale
  const inactivityTimer = useRef(null)
  const isPlayingRef = useRef(audioEngine.isPlaying)

  function clearTimer() {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current)
      inactivityTimer.current = null
    }
  }

  // Stable activity handler — shows controls immediately, restarts hide timer
  const onActivity = useCallback(() => {
    setShowControls(true)
    clearTimer()
    if (isPlayingRef.current) {
      inactivityTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [])

  // Track play/pause from audio engine
  useEffect(() => {
    const off = audioEngine.on('stateChange', ({ isPlaying }) => {
      isPlayingRef.current = isPlaying
      if (!isPlaying) {
        // Paused — always show controls
        clearTimer()
        setShowControls(true)
      } else {
        // Started playing — begin inactivity countdown
        onActivity()
      }
    })
    return () => { off(); clearTimer() }
  }, [onActivity])

  // Attach/detach activity listeners when on the video slide
  useEffect(() => {
    if (!onVideoSlide) {
      clearTimer()
      setShowControls(true)
      return
    }
    document.addEventListener('mousemove', onActivity)
    document.addEventListener('touchstart', onActivity, { passive: true })
    return () => {
      document.removeEventListener('mousemove', onActivity)
      document.removeEventListener('touchstart', onActivity)
    }
  }, [onVideoSlide, onActivity])

  // Detect which slide is visible via IntersectionObserver on the video slide
  const videoSlideRef = useRef(null)
  useEffect(() => {
    const el = videoSlideRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setOnVideoSlide(entry.intersectionRatio >= 0.5),
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  function scrollToVideo() {
    scrollerRef.current?.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
  }

  function handleProjectLoad(project) {
    setLoadedProject(project)
    setProjectLoaded(true)
    if (project.type !== 'music') scrollToVideo()
  }

  const effectiveShowControls = !onVideoSlide || showControls
  const showWaveform = projectLoaded

  const [deckTop, setDeckTop] = useState(null)
  const [transportTop, setTransportTop] = useState(null)
  const dragZoneBottom = deckTop !== null && transportTop !== null
    ? Math.min(deckTop, transportTop)
    : window.innerHeight * 0.5

  return (
    <>
      <div ref={scrollerRef} style={{ ...styles.scroller, overflowY: projectLoaded ? 'scroll' : 'hidden' }}>
        <section style={styles.slide}>
          <div style={styles.gridZone}>
            <PortfolioGrid
              projects={PROJECTS}
              videoRef={videoRef}
              onProjectLoad={handleProjectLoad}
              onVideoSlide={onVideoSlide}
              dragZoneBottom={dragZoneBottom}
            />
          </div>
        </section>
        <div ref={videoSlideRef}>
          {loadedProject?.type === 'music' ? (
            <MusicModule artwork={loadedProject.artwork} mixerOpen={mixerOpen} deckVisible={onVideoSlide && showControls} />
          ) : (
            <VideoModule videoSrc={VIDEO_SRC} videoRef={videoRef} mixerOpen={mixerOpen} deckVisible={onVideoSlide && showControls} />
          )}
        </div>
      </div>

      {/* Waveform stack — fixed, visible whenever a project is loaded */}
      {showWaveform && (
        <motion.div
          style={styles.waveformFloat}
          animate={{ opacity: effectiveShowControls ? 1 : 0 }}
          transition={overlayTransition(effectiveShowControls)}
        >
          <StemWaveformStack stems={WAVEFORM_STEMS} mixerOpen={mixerOpen} showControls={effectiveShowControls} showContainer={false} containerMode="dark" containerBlur={20} scrollerRef={scrollerRef} onBoundsChange={setDeckTop} />
        </motion.div>
      )}

      <TransportPill
        mixerOpen={mixerOpen}
        onMixerOpenChange={setMixerOpen}
        showControls={effectiveShowControls}
        projectLoaded={projectLoaded}
        onBoundsChange={setTransportTop}
        scrollerRef={scrollerRef}
      />

      <AnimatePresence>
        {!onVideoSlide && (
          <motion.div
            key="footer-buttons"
            style={styles.footerButtons}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onWheel={e => scrollerRef.current?.scrollBy(0, e.deltaY)}
          >
            {['Contact', 'Disclaimer', 'Credits', 'About'].map(label => (
              <button key={label} style={{ ...styles.footerBtn, pointerEvents: !onVideoSlide ? 'auto' : 'none' }}>{label}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {(builderContent || isPreviewing) && (
        <BuilderComponent model="page" content={builderContent} />
      )}
    </>
  )
}

const styles = {
  scroller: {
    height: '100vh',
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    scrollBehavior: 'smooth',
  },
  slide: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    flexShrink: 0,
    scrollSnapAlign: 'start',
    position: 'relative',
  },
  gridZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '50vh',
  },
  footerButtons: {
    position: 'fixed',
    top: 'calc(82vh + 32px)',
    left: 0,
    width: '100vw',
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  footerBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 0',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '10px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  waveformFloat: {
    position: 'fixed',
    bottom: 'calc(30vh - 56px)',
    left: 0,
    width: '100vw',
    zIndex: 999,
    pointerEvents: 'none',
  },
}

export default App
