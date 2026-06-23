/**
 * Create an 8-bar melody workflow (chords-hinted).
 * Uses orchestrator.generateMelodyFromChords until chord progression generator is added.
 */
class Create8BarMelodyWorkflow {
  async run({ orchestrator, chords = ['Fm', 'Db', 'Ab', 'Eb'], prompt = '', duration = 16 } = {}) {
    if (!orchestrator || typeof orchestrator.generateMelodyFromChords !== 'function') {
      throw new Error('Create8BarMelodyWorkflow requires orchestrator.generateMelodyFromChords');
    }

    const p = prompt || 'Create an 8-bar melody with clear motifs and tasteful variation';
    return orchestrator.generateMelodyFromChords({
      chords,
      prompt: p,
      duration,
    });
  }
}

module.exports = { Create8BarMelodyWorkflow };
