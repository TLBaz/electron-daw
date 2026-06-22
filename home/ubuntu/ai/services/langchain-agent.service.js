const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

class LangChainAgentService {
  constructor({ orchestrator } = {}) {
    this.orchestrator = orchestrator;
  }

  buildTools() {
    return [
      new DynamicStructuredTool({
        name: 'generateDrums',
        description: 'Generate a drum pattern or loop from style prompt.',
        schema: z.object({
          prompt: z.string(),
          bars: z.number().optional(),
        }),
        func: async ({ prompt, bars }) => {
          const result = await this.orchestrator.generateDrums({ prompt, duration: (bars || 2) * 2 });
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: 'generateBassline',
        description: 'Generate bassline notes in key + style.',
        schema: z.object({
          key: z.string(),
          mode: z.string().optional(),
          style: z.string().optional(),
        }),
        func: async ({ key, mode, style }) => {
          const result = await this.orchestrator.generateBassline({ key, mode, style });
          return JSON.stringify(result);
        },
      }),
    ];
  }

  async planTask(userRequest) {
    const q = String(userRequest || '').toLowerCase();
    const tools = this.buildTools();

    const tool = q.includes('bass')
      ? tools.find(t => t.name === 'generateBassline')
      : tools.find(t => t.name === 'generateDrums');

    if (!tool) {
      return {
        ok: false,
        message: 'No local tool available.',
      };
    }

    if (tool.name === 'generateBassline') {
      const out = await tool.func({ key: 'F', mode: 'minor', style: 'groovy' });
      return { ok: true, selectedTool: tool.name, output: out };
    }

    const out = await tool.func({ prompt: userRequest || 'modern drums', bars: 4 });
    return { ok: true, selectedTool: tool.name, output: out };
  }
}

module.exports = { LangChainAgentService };
