/**
 * Explain-mix-needs workflow.
 */
class ExplainMixNeedsWorkflow {
  async run({ orchestrator, context = '' } = {}) {
    if (!orchestrator || typeof orchestrator.explainMixNeeds !== 'function') {
      throw new Error('ExplainMixNeedsWorkflow requires orchestrator.explainMixNeeds');
    }
    return orchestrator.explainMixNeeds({ context });
  }
}

module.exports = { ExplainMixNeedsWorkflow };
