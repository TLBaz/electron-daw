/**
 * Chord progression workflow (placeholder until orchestrator exposes a real method).
 */
class GenerateChordProgressionWorkflow {
  async run({ orchestrator, key = 'F', mode = 'minor', degrees } = {}) {
    if (!orchestrator) throw new Error('GenerateChordProgressionWorkflow requires orchestrator');

    if (typeof orchestrator.generateChordProgression !== 'function') {
      return {
        ok: false,
        provider: 'daw-workflow',
        message: 'Chord progression generation is not implemented yet in orchestrator.',
      };
    }

    return orchestrator.generateChordProgression({ key, mode, degrees });
  }
}

module.exports = { GenerateChordProgressionWorkflow };
