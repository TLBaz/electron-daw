const { AIMusicOrchestrator } = require('../orchestration/ai-music-orchestrator');

class DAWAgentService {
  constructor(orchestrator = new AIMusicOrchestrator()) {
    this.orchestrator = orchestrator;
  }

  async runCommand(command, payload = {}) {
    switch (command) {
      case 'generate-drum-pattern':
        return this.orchestrator.generateDrums(payload);
      case 'create-bassline':
        return this.orchestrator.generateBassline(payload);
      case 'create-melody-from-chords':
        return this.orchestrator.generateMelodyFromChords(payload);
      case 'generate-full-idea':
        return this.orchestrator.generateFullIdea(payload);
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
