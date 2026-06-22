// ruler.js

class RulerRenderer {
  constructor(rulerEl, transport) {
    this.rulerEl = rulerEl;
    this.transport = transport;
    this.playheadEl = document.getElementById('playhead');
    this.trackWidthPx = 30; // rough
    this.barsVisible = 4;

    this._raf = null;
  }

  startTracking() {
    // We update playhead based on transport current beat.
    const tick = () => {
      if (!this.playheadEl) return;
      const beat = this.transport.getCurrentBeat();
      // Map beats -> pixels. Each beat approx 30px.
      const px = beat * 30;
      // Clamp within ruler width for aesthetics.
      this.playheadEl.style.left = `${px}px`;
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  updatePlayhead() {
    // no-op (handled by tick)
  }
}

window.RulerRenderer = RulerRenderer;

