/**
 * Bassline-in-key workflow: generates a bassline in a target key + mode.
 */
class BasslineInKeyWorkflow {
  async run({ orchestrator, key = 'F', mode = 'minor', style = null, prompt = '' } = {}) {
    if (!orchestrator || typeof orchestrator.generateBassline !== 'function') {
      throw new Error('BasslineInKeyWorkflow requires orchestrator.generateBassline');
    }

    const s = style || (prompt ? prompt : 'dark rolling bass');

    return orchestrator.generateBassline({
      key,
      mode,
      style: s,
      // orchestrator also returns midiClip (scribbletune JSON) for DAW pattern injection
    });
  }
}

module.exports = { BasslineInKeyWorkflow };
