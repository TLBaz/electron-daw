/**
 * Arrangement suggestions workflow (placeholder until orchestrator implements it).
 */
class AIArrangementSuggestionsWorkflow {
  async run({ orchestrator, prompt = '' } = {}) {
    if (!orchestrator) throw new Error('AIArrangementSuggestionsWorkflow requires orchestrator');

    if (typeof orchestrator.aiArrangementSuggestions !== 'function') {
      return {
        ok: false,
        provider: 'daw-workflow',
        message: 'Arrangement suggestions are not implemented yet.',
        prompt,
      };
    }

    return orchestrator.aiArrangementSuggestions({ prompt });
  }
}

module.exports = { AIArrangementSuggestionsWorkflow };
