// transport.js

class Transport {
  constructor(audioEngine) {
    this.engine = audioEngine;

    this.bpm = 120;
    this.timeSignature = { top: 4, bottom: 4 };

    this.isPlaying = false;
    this.loopEnabled = false;
    this.loopStartBeat = 0;
    this.loopEndBeat = 16;

    // Beat clock state
    this._startPerf = 0;
    this._startBeat = 0;
    this._raf = null;

    this.onTick = null;
    this.onPlay = null;
    this.onPause = null;
    this.onStop = null;
    this.onBPMChange = null;

    this._scheduledBeat = new Set();

    this._sampleBufferProvider = null; // set by AudioEngine/controller
    this._clipOwnerProvider = null; // set by project/ui controller
  }

  setSampleBufferProvider(fn) {
    this._sampleBufferProvider = fn;
  }

  setClipOwnerProvider(fn) {
    this._clipOwnerProvider = fn;
  }

  getBeatInfo() {
    const beat = this.getCurrentBeat();
    const bar = Math.floor(beat / this.timeSignature.top) + 1;
    const withinBar = (beat % this.timeSignature.top);
    const beatNumber = Math.floor(withinBar) + 1;
    return { bar, beat: `${beatNumber}.${Math.floor(((beat - Math.floor(beat)) * 10))}` };
  }

  getCurrentBeat() {
    if (!this.isPlaying) return this._startBeat;
    const secPerBeat = 60 / this.bpm;
    const elapsedSec = (performance.now() - this._startPerf) / 1000;
    return this._startBeat + (elapsedSec / secPerBeat);
  }

  setBPM(bpm) {
    const next = Math.max(20, Math.min(300, Number(bpm) || 120));
    this.bpm = next;
    if (this.onBPMChange) this.onBPMChange();
  }

  toggleLoop(enabled, startBeat, endBeat) {
    this.loopEnabled = !!enabled;
    this.loopStartBeat = startBeat ?? 0;
    this.loopEndBeat = endBeat ?? 16;
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._startPerf = performance.now();
    this._scheduledBeat.clear?.();

    // Schedule audio on a small lookahead.
    const ctx = this.engine.ctx;
    const lookaheadMs = 80;

    const loopWrap = (beat) => {
      if (!this.loopEnabled) return beat;
      const len = this.loopEndBeat - this.loopStartBeat;
      if (len <= 0) return beat;
      while (beat >= this.loopEndBeat) {
        beat = this.loopStartBeat + (beat - this.loopEndBeat);
      }
      return beat;
    };

    const schedule = () => {
      if (!this.isPlaying) return;

      const nowBeat = this.getCurrentBeat();
      let nextBeat = nowBeat;
      const secPerBeat = 60 / this.bpm;

      const endBeat = loopWrap(nowBeat + (lookaheadMs / 1000) / secPerBeat);
      // Iterate beats in this window (integer beats only for simplicity)
      const startInt = Math.floor(nextBeat);
      const endInt = Math.floor(endBeat);

      for (let b = startInt; b <= endInt; b++) {
        if (this._scheduledBeat.has(b)) continue;
        this._scheduledBeat.add(b);

        // Find clips that start at this beat.
        for (const track of this.engine.tracks) {
          const anySolo = this.engine.tracks.some(t => t.isSolo);
          if (anySolo && !track.isSolo) continue;
          if (track.isMuted) continue;

          for (const clip of track.clips) {
            if (Math.abs(clip.startBeat - b) < 1e-6) {
              const whenSeconds = ctx.currentTime + (b - nowBeat) * secPerBeat;
              this.engine.playClipAtClipTime(clip, whenSeconds, {
                getTrackIdForClip: () => track.id,
                getSampleBuffer: (p) => this.getSampleBuffer(p),
              });
            }
          }
        }
      }

      // Tick UI
      if (this.onTick) {
        const beatInfo = this.getBeatInfo();
        this.onTick({
          time: this._formatTime(this.getCurrentBeat(), this.bpm),
          beatInfo,
          beat: this.getCurrentBeat(),
        });
      }

      // loop window reset
      if (this.loopEnabled && this.getCurrentBeat() >= this.loopEndBeat) {
        // allow rescheduling within loop
        this._scheduledBeat.clear();
        this._startBeat = this.loopStartBeat;
        this._startPerf = performance.now();
      }

      this._raf = requestAnimationFrame(schedule);
    };

    if (this.onPlay) this.onPlay();
    schedule();
  }

  pause() {
    if (!this.isPlaying) return;
    // For now, treat pause as stop of audio and keep beat position.
    this.isPlaying = false;
    this.engine.stopAll();
    if (this.onPause) this.onPause();
  }

  stop() {
    this.isPlaying = false;
    this.engine.stopAll();
    // Reset to loop start.
    this._startBeat = this.loopStartBeat;
    this._startPerf = performance.now();
    this._scheduledBeat.clear();
    if (this.onStop) this.onStop();
  }

  getSampleBuffer(samplePath) {
    return this._sampleBufferProvider ? this._sampleBufferProvider(samplePath) : null;
  }

  _formatTime(currentBeat, bpm) {
    // Convert beats -> seconds and format mm:ss.xx
    const sec = currentBeat * (60 / bpm);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(Math.floor(sec % 60)).padStart(2, '0');
    const xx = String(Math.floor((sec - Math.floor(sec)) * 100)).padStart(2, '0');
    return `${mm}:${ss}.${xx}`;
  }

  getBeatSeconds(beat) {
    return beat * (60 / this.bpm);
  }
}

window.Transport = Transport;

