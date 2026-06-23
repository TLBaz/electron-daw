const { AIMusicOrchestrator } = require('../orchestration/ai-music-orchestrator');

class DAWAgentService {
  constructor(orchestrator = new AIMusicOrchestrator()) {
    this.orchestrator = orchestrator;
  }

  async runCommand(command, payload = {}) {
    switch (command) {
      // -------------------- Drums --------------------
      case 'generate-drum-pattern':
        return this.orchestrator.generateDrums(payload);

      case 'make-trap-drum-pattern': {
        const prompt = payload.prompt || 'trap drum pattern (tight 808 sidechain-ready, rolling hats)';
        const bars = payload.bars || 4;
        return this.orchestrator.generateDrums({ ...payload, prompt, duration: bars * 2, name: 'trap_drums' });
      }

      // -------------------- Bass --------------------
      case 'create-bassline':
        return this.orchestrator.generateBassline(payload);

      case 'generate-bassline-in-key': {
        const key = payload.key || 'F';
        const mode = payload.mode || 'minor';
        const style = payload.style || payload.prompt || 'dark rolling bass';
        return this.orchestrator.generateBassline({ ...payload, key, mode, style });
      }

      // -------------------- Melody / Harmony --------------------
      case 'create-melody-from-chords':
        return this.orchestrator.generateMelodyFromChords(payload);

      case 'create-8-bar-melody': {
        const chords = payload.chords || ['Fm', 'Db', 'Ab', 'Eb'];
        const prompt = payload.prompt || 'create an 8-bar melodic hook with tasteful variation';
        const duration = payload.duration || 16;
        return this.orchestrator.generateMelodyFromChords({ ...payload, chords, prompt, duration });
      }

      case 'generate-chord-progression': {
        // Not implemented yet in orchestrator
        return {
          ok: false,
          message: 'Chord progression generation is not implemented yet. Next step will add orchestrator + theory wiring.',
          provider: 'daw-agent',
        };
      }

      // -------------------- Full track / Arrangement --------------------
      case 'generate-full-idea':
        return this.orchestrator.generateFullIdea(payload);

      case 'ai-arrangement-suggestions': {
        // Not implemented yet in orchestrator
        return {
          ok: false,
          message: 'AI arrangement suggestions are not implemented yet. Next step will expand orchestrator + conversational tooling.',
          provider: 'daw-agent',
        };
      }

      // -------------------- Conversational / Diagnostics --------------------
      case 'explain-mix-needs':
        return this.orchestrator.explainMixNeeds(payload);

      case 'fix-timing':
        return this.orchestrator.fixTimingIssues(payload);

      default:
        return {
          ok: false,
          message: `Unknown DAW AI command: ${command}`,
        };
    }
  }
}

module.exports = { DAWAgentService };
