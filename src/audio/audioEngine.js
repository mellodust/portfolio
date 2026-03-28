/**
 * audioEngine.js
 *
 * Singleton Web Audio API engine for multi-stem synchronized playback.
 *
 * Graph:
 *   [BufferSource] → [stemGain] ─┐
 *   [BufferSource] → [stemGain] ─┼→ [masterGain] → [analyser] → destination
 *   [BufferSource] → [stemGain] ─┘
 *
 * Usage:
 *   import { audioEngine } from './audioEngine';
 *   await audioEngine.loadStem('drums', '/stems/drums.mp3');
 *   audioEngine.play();
 */

class AudioEngine {
  constructor() {
    // Core context
    this._ctx = null;
    this._masterGain = null;
    this._analyser = null;

    // Stems: Map<id, { buffer, source, gainNode, muted }>
    this._stems = new Map();

    // Playhead tracking
    // _startOffset: position in the timeline (seconds) at the moment play() was called
    // _startTime:   AudioContext.currentTime at that moment
    // currentTime = _startOffset + (ctx.currentTime - _startTime)   [while playing]
    this._isPlaying = false;
    this._startOffset = 0;
    this._startTime = 0;
    this._duration = 0;

    // Project mode
    this._mode = 'audio'; // 'audio' | 'video'
    this._videoEl = null;

    // Spin state (for driving artwork rotation)
    this._spinState = {
      isPlaying: false,
      direction: 1,       // 1 = forward, -1 = reverse (reverse via seek)
      scrubVelocity: 0,   // units/sec — how fast the head is moving
    };
    this._prevTickTime = 0;
    this._prevTickPos = 0;
    this._rafId = null;

    // Event listeners: Map<event, Set<fn>>
    this._listenerMap = new Map();
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  /**
   * Creates the AudioContext and master graph.
   * Safe to call multiple times — only runs once.
   * Must be called (directly or via loadStem/play) inside a user gesture.
   */
  async init() {
    if (this._ctx) return;

    this._ctx = new (window.AudioContext || window.webkitAudioContext)();

    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 1;

    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = 2048;
    this._analyser.smoothingTimeConstant = 0.8;

    this._masterGain.connect(this._analyser);
    this._analyser.connect(this._ctx.destination);
  }

  // ---------------------------------------------------------------------------
  // Stem loading
  // ---------------------------------------------------------------------------

  /**
   * Fetch, decode, and register an audio stem.
   * @param {string} id    - Unique identifier for this stem.
   * @param {string} url   - URL of the audio file.
   */
  async loadStem(id, url) {
    await this.init();

    const response = await fetch(url);
    if (!response.ok) throw new Error(`audioEngine: failed to fetch stem "${id}" from ${url}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);

    // Create a persistent gain node for this stem (survives play/pause cycles)
    const gainNode = this._ctx.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(this._masterGain);

    this._stems.set(id, {
      buffer: audioBuffer,
      source: null,   // recreated on each play
      gainNode,
      muted: false,
    });

    this._duration = Math.max(this._duration, audioBuffer.duration);
    this._emit('stemLoaded', { id, duration: audioBuffer.duration });
  }

  // ---------------------------------------------------------------------------
  // Transport
  // ---------------------------------------------------------------------------

  play() {
    if (this._isPlaying || !this._ctx || this._stems.size === 0) return;

    if (this._ctx.state === 'suspended') this._ctx.resume();

    const offset = Math.max(0, Math.min(this._startOffset, this._duration));
    this._createAndStartSources(offset);

    this._isPlaying = true;
    this._startTime = this._ctx.currentTime;
    this._startOffset = offset;

    this._spinState.isPlaying = true;
    this._spinState.direction = 1;

    this._startRaf();
    this._emit('stateChange', this._buildState());
  }

  pause() {
    if (!this._isPlaying) return;

    // Snapshot position before stopping
    this._startOffset = this.currentTime;
    this._stopAllSources();

    this._isPlaying = false;
    this._spinState.isPlaying = false;
    this._spinState.scrubVelocity = 0;

    this._stopRaf();
    this._syncVideo();
    this._emit('stateChange', this._buildState());
  }

  togglePlay() {
    if (this._isPlaying) this.pause();
    else this.play();
  }

  /**
   * Move the playhead to `time` seconds.
   * If playing, seamlessly restarts all stems from the new position.
   */
  seek(time) {
    const clampedTime = Math.max(0, Math.min(time, this._duration));
    const wasPlaying = this._isPlaying;

    if (wasPlaying) {
      this._stopAllSources();
      this._isPlaying = false;
      this._stopRaf();
    }

    // Compute velocity for spin state (negative = scrubbing backward)
    const delta = clampedTime - this._startOffset;
    this._spinState.direction = delta >= 0 ? 1 : -1;
    this._spinState.scrubVelocity = 0; // reset; RAF will recompute

    this._startOffset = clampedTime;

    if (wasPlaying) {
      this.play();
    } else {
      this._syncVideo();
      this._emit('stateChange', this._buildState());
    }
  }

  // ---------------------------------------------------------------------------
  // Stem controls
  // ---------------------------------------------------------------------------

  muteStem(id) {
    const stem = this._stems.get(id);
    if (!stem || stem.muted) return;
    stem.gainNode.gain.setTargetAtTime(0, this._ctx.currentTime, 0.01);
    stem.muted = true;
    this._emit('stateChange', this._buildState());
  }

  unmuteStem(id) {
    const stem = this._stems.get(id);
    if (!stem || !stem.muted) return;
    stem.gainNode.gain.setTargetAtTime(1, this._ctx.currentTime, 0.01);
    stem.muted = false;
    this._emit('stateChange', this._buildState());
  }

  toggleMuteStem(id) {
    const stem = this._stems.get(id);
    if (!stem) return;
    if (stem.muted) this.unmuteStem(id);
    else this.muteStem(id);
  }

  isStemMuted(id) {
    return this._stems.get(id)?.muted ?? false;
  }

  // ---------------------------------------------------------------------------
  // Master volume
  // ---------------------------------------------------------------------------

  /** @param {number} value  0–1 */
  setMasterVolume(value) {
    if (!this._masterGain) return;
    this._masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, value)),
      this._ctx.currentTime,
      0.015
    );
  }

  getMasterVolume() {
    return this._masterGain?.gain.value ?? 1;
  }

  // ---------------------------------------------------------------------------
  // Project mode
  // ---------------------------------------------------------------------------

  /**
   * @param {'audio'|'video'} mode
   * @param {HTMLVideoElement|null} videoEl  Required when mode === 'video'.
   */
  setMode(mode, videoEl = null) {
    this._mode = mode;
    this._videoEl = videoEl ?? null;

    if (mode === 'video' && videoEl) {
      // Mute the video element — audio comes entirely from Web Audio
      videoEl.muted = true;
      videoEl.playsInline = true;
      this._syncVideo();
    }
  }

  // ---------------------------------------------------------------------------
  // Analyser access
  // ---------------------------------------------------------------------------

  /** Returns the raw AnalyserNode for custom visualizer wiring. */
  getAnalyserNode() {
    return this._analyser;
  }

  /**
   * Fills and returns a Uint8Array of frequency magnitude data (0–255).
   * Suitable for bar/spectrum visualizers.
   */
  getFrequencyData() {
    if (!this._analyser) return new Uint8Array(0);
    const data = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteFrequencyData(data);
    return data;
  }

  /**
   * Fills and returns a Uint8Array of time-domain waveform data (0–255, center = 128).
   * Suitable for oscilloscope / waveform visualizers.
   */
  getTimeDomainData() {
    if (!this._analyser) return new Uint8Array(0);
    const data = new Uint8Array(this._analyser.frequencyBinCount);
    this._analyser.getByteTimeDomainData(data);
    return data;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Live playhead position in seconds. */
  get currentTime() {
    if (this._isPlaying && this._ctx) {
      const elapsed = this._ctx.currentTime - this._startTime;
      return Math.min(this._startOffset + elapsed, this._duration);
    }
    return this._startOffset;
  }

  get duration() {
    return this._duration;
  }

  get isPlaying() {
    return this._isPlaying;
  }

  /**
   * Snapshot of all engine state.
   * @returns {{
   *   isPlaying: boolean,
   *   currentTime: number,
   *   duration: number,
   *   stems: Record<string, { muted: boolean, duration: number }>,
   *   spinState: { isPlaying: boolean, direction: number, scrubVelocity: number },
   * }}
   */
  getState() {
    return this._buildState();
  }

  // ---------------------------------------------------------------------------
  // Event subscription
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to engine events.
   *
   * Events:
   *   'stateChange'  — fired on play/pause/seek/mute changes
   *   'stemLoaded'   — fired when a stem finishes loading
   *   'tick'         — fired every animation frame while playing
   *   'ended'        — fired when playback reaches the end
   *
   * @param {string} event
   * @param {function} fn
   * @returns {function}  Unsubscribe function.
   */
  on(event, fn) {
    if (!this._listenerMap.has(event)) this._listenerMap.set(event, new Set());
    this._listenerMap.get(event).add(fn);
    return () => this._listenerMap.get(event)?.delete(fn);
  }

  off(event, fn) {
    this._listenerMap.get(event)?.delete(fn);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _createAndStartSources(offset) {
    for (const stem of this._stems.values()) {
      // Disconnect any previous source
      if (stem.source) {
        try { stem.source.disconnect(); } catch {}
      }

      const source = this._ctx.createBufferSource();
      source.buffer = stem.buffer;
      source.connect(stem.gainNode);
      source.start(0, offset);
      stem.source = source;
    }
  }

  _stopAllSources() {
    for (const stem of this._stems.values()) {
      if (stem.source) {
        try { stem.source.stop(); } catch {}
        stem.source = null;
      }
    }
  }

  _syncVideo() {
    if (this._mode !== 'video' || !this._videoEl) return;
    const pos = this.currentTime;

    if (this._isPlaying) {
      this._videoEl.currentTime = pos;
      this._videoEl.play().catch(() => {});
    } else {
      this._videoEl.pause();
      this._videoEl.currentTime = pos;
    }
  }

  _startRaf() {
    this._prevTickTime = performance.now();
    this._prevTickPos = this.currentTime;

    const tick = () => {
      if (!this._isPlaying) return;

      const pos = this.currentTime;
      const now = performance.now();
      const dt = (now - this._prevTickTime) / 1000;

      // Compute instantaneous velocity and smooth it (EMA)
      if (dt > 0) {
        const rawVelocity = (pos - this._prevTickPos) / dt;
        this._spinState.scrubVelocity =
          this._spinState.scrubVelocity * 0.75 + rawVelocity * 0.25;
      }
      this._prevTickPos = pos;
      this._prevTickTime = now;

      // Drift correction for video
      if (this._mode === 'video' && this._videoEl) {
        const drift = Math.abs(this._videoEl.currentTime - pos);
        if (drift > 0.15) this._videoEl.currentTime = pos;
      }

      // End-of-file detection
      if (pos >= this._duration && this._duration > 0) {
        this._onEnded();
        return;
      }

      this._emit('tick', {
        currentTime: pos,
        spinState: { ...this._spinState },
      });

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  _stopRaf() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _onEnded() {
    this._stopAllSources();
    this._isPlaying = false;
    this._startOffset = 0; // rewind to start
    this._spinState.isPlaying = false;
    this._spinState.scrubVelocity = 0;
    this._stopRaf();
    this._syncVideo();
    this._emit('ended', {});
    this._emit('stateChange', this._buildState());
  }

  _buildState() {
    const stems = {};
    for (const [id, stem] of this._stems) {
      stems[id] = {
        muted: stem.muted,
        duration: stem.buffer?.duration ?? 0,
      };
    }
    return {
      isPlaying: this._isPlaying,
      currentTime: this.currentTime,
      duration: this._duration,
      stems,
      spinState: { ...this._spinState },
    };
  }

  _emit(event, data) {
    this._listenerMap.get(event)?.forEach(fn => fn(data));
  }
}

// Singleton export — import this directly anywhere in the app
export const audioEngine = new AudioEngine();
