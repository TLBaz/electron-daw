// audio-engine.js
// Minimal WebAudio engine + track/clip management.

class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Tracks: [{ id, name, volume, pan, isMuted, isSolo, clips: [{id, startBeat, duration, samplePath, sampleName}] }]
    this.tracks = [];

    this.master = {
      volumeDb: -6,
      isMuted: false,
    };

    this.onTimeUpdate = null; // optional callback
    this._clockTimer = null;

    this._activeSources = new Map(); // clipId -> source

    this._ensureMasterNodes();
  }

  _ensureMasterNodes() {
    // Create a master gain node.
    this.masterGain = this.ctx.createGain();
    this._setGainDb(this.masterGain, this.master.volumeDb);
    this.masterGain.connect(this.ctx.destination);
  }

  _setGainDb(gainNode, db) {
    const linear = Math.pow(10, db / 20);
    gainNode.gain.value = Number.isFinite(linear) ? linear : 1;
  }

  setMasterVolume(db) {
    this.master.volumeDb = db;
    if (this.masterGain) this._setGainDb(this.masterGain, db);
  }

  addTrack({ name }) {
    const id = `track-${this.tracks.length + 1}`;
    const track = {
      id,
      name,
      volumeDb: 0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      clips: [],
    };
    this.tracks.push(track);
    return track;
  }

  getTrackById(id) {
    return this.tracks.find(t => t.id === id);
  }

  setTrackMute(trackId, isMuted) {
    const t = this.getTrackById(trackId);
    if (!t) return;
    t.isMuted = !!isMuted;
  }

  setTrackSolo(trackId, isSolo) {
    const t = this.getTrackById(trackId);
    if (!t) return;
    t.isSolo = !!isSolo;
  }

  setTrackVolume(trackId, db) {
    const t = this.getTrackById(trackId);
    if (!t) return;
    t.volumeDb = db;
  }

  setTrackPan(trackId, pan) {
    const t = this.getTrackById(trackId);
    if (!t) return;
    t.pan = pan;
  }

  addClip(trackId, { id, samplePath, sampleName, startBeat, durationBeats }) {
    const t = this.getTrackById(trackId);
    if (!t) return;
    t.clips.push({
      id,
      samplePath,
      sampleName,
      startBeat,
      durationBeats: durationBeats ?? 1,
    });
    return t.clips[t.clips.length - 1];
  }

  clearClips() {
    for (const t of this.tracks) t.clips = [];
  }

  // Called by transport when playing.
  // startBeat is the beat position at which playback begins.
  playClipAtClipTime(clip, whenSeconds, transport) {
    // Respect mute/solo rules.
    const track = this.getTrackById(transport.getTrackIdForClip(clip.id));
    if (!track) return;

    const anySolo = this.tracks.some(tt => tt.isSolo);
    if (anySolo && !track.isSolo) return;
    if (track.isMuted) return;

    const volumeDb = track.volumeDb ?? 0;
    // Create nodes per playback.
    const gain = this.ctx.createGain();
    this._setGainDb(gain, volumeDb);

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Number(track.pan ?? 0) / 100; // map -100..100 -> -1..1-ish

    gain.connect(panner);
    panner.connect(this.masterGain);

    const buffer = transport.getSampleBuffer(clip.samplePath);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(whenSeconds);

    // Track for stop.
    this._activeSources.set(clip.id, source);

    // Cleanup when ended.
    source.onended = () => {
      try { source.disconnect(); } catch {}
      this._activeSources.delete(clip.id);
    };
  }

  stopAll() {
    for (const [, source] of this._activeSources.entries()) {
      try { source.stop(); } catch {}
    }
    this._activeSources.clear();
  }
}

window.AudioEngine = AudioEngine;

