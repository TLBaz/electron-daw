class MagentaAdapter {
  constructor() {
    this.isBrowser = typeof window !== 'undefined';
  }

  ensureBrowserRuntime() {
    if (!this.isBrowser) {
      throw new Error('MagentaAdapter must run in renderer/browser context.');
    }
    if (!window.mm) {
      throw new Error('Magenta.js is not loaded. Include @magenta/music in renderer bundle.');
    }
  }

  async generateMelody({ primer = [60], steps = 32, temperature = 1.1, checkpoint = 'melody_rnn' } = {}) {
    this.ensureBrowserRuntime();

    const model = new window.mm.MusicRNN(
      `https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/${checkpoint}`
    );
    await model.initialize();

    const primerSequence = {
      notes: primer.map((pitch, i) => ({
        pitch,
        startTime: i * 0.5,
        endTime: i * 0.5 + 0.5,
      })),
      totalTime: primer.length * 0.5,
    };

    const generated = await model.continueSequence(primerSequence, steps, temperature);
    return generated;
  }
}

module.exports = { MagentaAdapter };
