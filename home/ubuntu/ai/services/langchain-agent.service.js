const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

class LangChainAgentService {
  constructor({ orchestrator } = {}) {
    this.orchestrator = orchestrator;
  }

  buildTools() {
    return [
      // -------------------- Drums --------------------
      new DynamicStructuredTool({
        name: 'generateDrums',
        description: 'Generate a drum pattern or loop from style prompt.',
        schema: z.object({
          prompt: z.string(),
          bars: z.number().optional(),
        }),
        func: async ({ prompt, bars }) => {
          const result = await this.orchestrator.generateDrums({
            prompt,
            duration: (bars || 4) * 2,
          });
          return JSON.stringify(result);
        },
      }),

      // -------------------- Bass --------------------
      new DynamicStructuredTool({
        name: 'generateBassline',
        description: 'Generate bassline notes in key + style.',
        schema: z.object({
          key: z.string().optional(),
          mode: z.string().optional(),
          style: z.string().optional(),
        }),
        func: async ({ key, mode, style }) => {
          const result = await this.orchestrator.generateBassline({
            key: key || 'F',
            mode: mode || 'minor',
            style: style || 'dark rolling bass',
          });
          return JSON.stringify(result);
        },
      }),

      // -------------------- Harmony / Chords --------------------
      new DynamicStructuredTool({
        name: 'generateChordProgression',
        description: 'Generate a chord progression using tonal harmony.',
        schema: z.object({
          key: z.string().optional(),
          mode: z.string().optional(),
          degrees: z.array(z.string()).optional(),
        }),
        func: async ({ key, mode, degrees }) => {
          const result = await this.orchestrator.generateChordProgression({
            key: key || 'F',
            mode: mode || 'minor',
            degrees: degrees || ['i', 'VI', 'III', 'VII'],
          });
          return JSON.stringify(result);
        },
      }),

      // -------------------- Melody --------------------
      new DynamicStructuredTool({
        name: 'create8BarMelody',
        description: 'Create an 8-bar melody (uses melody-from-chords).',
        schema: z.object({
          chords: z.array(z.string()).optional(),
          prompt: z.string().optional(),
        }),
        func: async ({ chords, prompt }) => {
          const result = await this.orchestrator.generateMelodyFromChords({
            chords: chords || ['Fm', 'Db', 'Ab', 'Eb'],
            prompt: prompt || 'create an 8-bar melody with a clear motif and variation',
            duration: 16,
          });
          return JSON.stringify(result);
        },
      }),

      // -------------------- Arrangement --------------------
      new DynamicStructuredTool({
        name: 'aiArrangementSuggestions',
        description: 'Suggest an arrangement structure (intro/build/drop/break/outro).',
        schema: z.object({
          prompt: z.string().optional(),
        }),
        func: async ({ prompt }) => {
          const result = await this.orchestrator.aiArrangementSuggestions({ prompt: prompt || '' });
          return JSON.stringify(result);
        },
      }),

      // -------------------- Diagnostics --------------------
      new DynamicStructuredTool({
        name: 'explainMixNeeds',
        description: 'Explain what this mix needs (EQ, compression, stereo, arrangement tips).',
        schema: z.object({
          context: z.string().optional(),
        }),
        func: async ({ context }) => {
          const result = await this.orchestrator.explainMixNeeds({ context: context || '' });
          return JSON.stringify(result);
        },
      }),

      new DynamicStructuredTool({
        name: 'fixTimingIssues',
        description: 'Suggest concrete fixes for timing issues (quantize, groove preservation).',
        schema: z.object({
          loopDescription: z.string().optional(),
          context: z.string().optional(),
        }),
        func: async ({ loopDescription, context }) => {
          const result = await this.orchestrator.fixTimingIssues({
            loopDescription: loopDescription || '',
            context: context || '',
          });
          return JSON.stringify(result);
        },
      }),
    ];
  }

  async planTask(userRequest) {
    const q = String(userRequest || '').toLowerCase();
    const tools = this.buildTools();

    // Very lightweight routing until full agent-tool parsing is introduced.
    let tool = null;

    if (q.includes('trap') && (q.includes('drum') || q.includes('beat'))) {
      tool = tools.find((t) => t.name === 'generateDrums');
      const out = await tool.func({ prompt: userRequest || 'trap drums', bars: 4 });
      return { ok: true, selectedTool: tool.name, output: out };
    }

    if (q.includes('chord') || q.includes('progression')) {
      tool = tools.find((t) => t.name === 'generateChordProgression');
      const out = await tool.func({});
      return { ok: true, selectedTool: tool.name, output: out };
    }

    if (q.includes('melody') || q.includes('8-bar')) {
      tool = tools.find((t) => t.name === 'create8BarMelody');
      const out = await tool.func({});
      return { ok: true, selectedTool: tool.name, output: out };
    }

    if (q.includes('arrangement') || q.includes('structure') || q.includes('intro') || q.includes('drop')) {
      tool = tools.find((t) => t.name === 'aiArrangementSuggestions');
      const out = await tool.func({ prompt: userRequest || '' });
      return { ok: true, selectedTool: tool.name, output: out };
    }

    if (q.includes('timing') || q.includes('quantiz') || q.includes('late') || q.includes('early') || q.includes('off grid')) {
      tool = tools.find((t) => t.name === 'fixTimingIssues');
      const out = await tool.func({ loopDescription: userRequest || '' });
      return { ok: true, selectedTool: tool.name, output: out };
    }

    if (q.includes('mix needs') || q.includes('what this mix needs') || q.includes('explain what this mix needs') || q.includes('mix')) {
      tool = tools.find((t) => t.name === 'explainMixNeeds');
      const out = await tool.func({ context: userRequest || '' });
      return { ok: true, selectedTool: tool.name, output: out };
    }

    if (q.includes('bass')) {
      tool = tools.find((t) => t.name === 'generateBassline');
      const out = await tool.func({ key: 'F', mode: 'minor', style: 'groovy' });
      return { ok: true, selectedTool: tool.name, output: out };
    }

    // default fallback: drums
    tool = tools.find((t) => t.name === 'generateDrums');
    const out = await tool.func({ prompt: userRequest || 'modern punchy drums', bars: 4 });
    return { ok: true, selectedTool: tool.name, output: out };
  }
}

module.exports = { LangChainAgentService };
