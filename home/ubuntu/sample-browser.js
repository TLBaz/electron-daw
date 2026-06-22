// sample-browser.js

class SampleBrowser {
  constructor(audioEngine, audioLoader) {
    this.engine = audioEngine;
    this.loader = audioLoader;

    this.onDirectoryLoaded = null;

    this.samples = [];
  }

  async loadFromPaths(paths) {
    // paths: [{name, path}]
    this.samples = paths || [];
    if (this.onDirectoryLoaded) this.onDirectoryLoaded(this.samples);
  }

  async addSampleToTrack(samplePath, trackId, startBeat) {
    // ensure buffer loaded
    try {
      if (!this.loader.getCachedBuffer(samplePath)) {
        await this.loader.loadWavToBuffer(samplePath);
      }
    } catch (e) {
      console.warn('Failed to decode sample:', samplePath, e);
    }

    const t = this.engine.getTrackById(trackId);
    if (!t) return null;

    const id = `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const sampleName = samplePath.split(/[\\/]/).pop();
    const clip = this.engine.addClip(trackId, {
      id,
      samplePath,
      sampleName,
      startBeat,
      durationBeats: 1,
    });

    return clip;
  }
}

window.SampleBrowser = SampleBrowser;

