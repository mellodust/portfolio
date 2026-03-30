import { useRef } from 'react'
import TransportPill from './components/TransportPill'
import VideoModule from './components/VideoModule'
import PortfolioGrid from './components/PortfolioGrid'
import './App.css'

const PROJECTS = [
  {
    id: 'soundworks',
    title: 'Soundworks',
    type: 'video',
    videoUrl: '/assets/20260326/soundworks_20260326_video.mp4',
    thumbnailIn: 0,
    thumbnailOut: 3,
    stems: [
      { id: 'dx', name: 'DX', url: '/src/assets/20260326/soundworks_20260326_dx.aac' },
      { id: 'fx', name: 'FX', url: '/src/assets/20260326/soundworks_20260326_fx.aac' },
      { id: 'mx', name: 'MX', url: '/src/assets/20260326/soundworks_20260326_mx.aac' },
    ],
  },
]

const VIDEO_SRC = '/assets/20260326/soundworks_20260326_video.mp4'

function App() {
  const videoRef = useRef(null)
  const scrollerRef = useRef(null)

  function scrollToVideo() {
    scrollerRef.current?.scrollTo({ top: window.innerHeight, behavior: 'smooth' })
  }

  return (
    <>
      <div ref={scrollerRef} style={styles.scroller}>
        <section style={styles.slide}>
          <PortfolioGrid
            projects={PROJECTS}
            videoRef={videoRef}
            onProjectLoad={scrollToVideo}
          />
        </section>
        <VideoModule videoSrc={VIDEO_SRC} videoRef={videoRef} />
      </div>
      <TransportPill />
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
}

export default App
