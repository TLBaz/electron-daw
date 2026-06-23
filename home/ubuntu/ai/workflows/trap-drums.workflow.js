/**
 * Trap drum workflow: generates a drum loop targeting a typical trap feel.
 * Returns { ok, provider, outputPath, logs } from the underlying orchestrator.
 */
class TrapDrumsWorkflow {
  async run({ orchestrator, prompt, bars = 4, duration = null, mode = null } = {}) {
    if (!orchestrator || typeof orchestrator.generateDrums !== 'function') {
      throw new Error('TrapDrumsWorkflow requires orchestrator.generateDrums');
    }

    const p = prompt || 'trap drum pattern (tight 808 sidechain-ready, rolling hats)';
    const dur = duration ?? bars * 2; // keep consistent with existing orchestrator contract

    return orchestrator.generateDrums({
      prompt: p,
      duration: dur,
      name: mode || 'trap_drums',
    });
  }
}

module.exports = { TrapDrumsWorkflow };
