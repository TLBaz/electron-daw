/**
 * Fix timing workflow: asks advisor to suggest concrete timing corrections.
 */
class FixTimingWorkflow {
  async run({ orchestrator, loopDescription = '', context = '' } = {}) {
    if (!orchestrator || typeof orchestrator.fixTimingIssues !== 'function') {
      throw new Error('FixTimingWorkflow requires orchestrator.fixTimingIssues');
    }
    return orchestrator.fixTimingIssues({ loopDescription, context });
  }
}

module.exports = { FixTimingWorkflow };
