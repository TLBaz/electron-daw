class ToneSequencerService {
  constructor() {
    this.isBrowser = typeof window !== 'undefined';
  }

  getTone() {
    if (!this.isBrowser || !window.Tone) {
      throw new Error('Tone.js not available. Load Tone in renderer scope.');
    }
    return window.Tone;
  }

  async startTransport(bpm = 120) {
    const Tone = this.getTone();
    await Tone.start();
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.start();
    return { ok: true, bpm };
  }

  createDrumLoop(pattern = [1, 0, 0, 0, 1, 0, 1, 0], sampleUrl = null) {
    const Tone = this.getTone();
    const player = new Tone.Player(sampleUrl || 'samples/kick.wav').toDestination();

    const seq = new Tone.Sequence((time, step) => {
      if (step === 1) {
        player.start(time);
      }
    }, pattern, '16n');

    seq.start(0);
    return { ok: true, sequence: seq };
  }
}

module.exports = { ToneSequencerService };
