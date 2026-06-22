// audio-loader.js
// Loads WAV files (via fetch) and decodes into AudioBuffers.

class AudioLoader {
  constructor(audioEngine) {
    this.engine = audioEngine;
    this.cache = new Map(); // path -> { buffer }
  }

  async loadWavToBuffer(samplePath) {
    if (!samplePath) return null;
    if (this.cache.has(samplePath)) return this.cache.get(samplePath);

    // samplePath is usually a file path from local project.
    // For security, Electron renders local files; we'll request via fetch using file://.
    const url = samplePath.startsWith('file://') ? samplePath : `file://${samplePath}`;

    const resp = await fetch(url);
    const arr = await resp.arrayBuffer();
    const buffer = await this.engine.ctx.decodeAudioData(arr);
    const entry = { buffer };
    this.cache.set(samplePath, entry);
    return entry;
  }

  getCachedBuffer(samplePath) {
    return this.cache.get(samplePath)?.buffer || null;
  }
}

window.AudioLoader = AudioLoader;

