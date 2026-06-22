const { AudiocraftAdapter } = require('../adapters/audiocraft.adapter');
const { RiffusionAdapter } = require('../adapters/riffusion.adapter');
const { ScribbletuneService } = require('../sequencers/scribbletune.service');
const { TonalService } = require('../theory/tonal.service');
const { LocalAdvisorService } = require('../services/local-advisor.service');

class AIMusicOrchestrator {
  constructor(options = {}) {
    this.audiocraft = new AudiocraftAdapter(options.audiocraft);
    this.riffusion = new RiffusionAdapter(options.riffusion);
    this.scribble = new ScribbletuneService();
    this.tonal = new TonalService();
    this.chat = new LocalAdvisorService(options.localAdvisor || {});
  }

  async generateDrums({ prompt = 'modern punchy drums', duration = 8 } = {}) {
    return this.audiocraft.generate({
      prompt,
      mode: 'drum_loop',
      duration,
      name: 'drums',
    });
  }

  async generateBassline({ key = 'F', mode = 'minor', style = 'groovy' } = {}) {
    const progression = this.tonal.getChordProgression(key, mode, ['i', 'VI', 'III', 'VII']);
    const roots = this.tonal.suggestBassNotes(progression).map((n) => `${n}2`);

    const midiClip = this.scribble.createBassline({
      notes: roots,
      pattern: 'x---x---x---x---',
    });

    return {
      ok: true,
      provider: 'scribbletune+tonal',
      key,
      mode,
      style,
      progression,
      midiClip,
    };
  }

  async generateMelodyFromChords({ chords = ['Fm', 'Db', 'Ab', 'Eb'], prompt = 'emotional melody', duration = 8 } = {}) {
    const chordHint = `Chords: ${chords.join(' - ')}`;
    return this.audiocraft.generate({
      prompt: `${prompt}. ${chordHint}`,
      mode: 'melody',
      duration,
      name: 'melody',
    });
  }

  async generateFullIdea({ prompt = '8-bar electronic idea', duration = 16 } = {}) {
    return this.audiocraft.generate({
      prompt,
      mode: 'full_track',
      duration,
      name: 'full_idea',
    });
  }

  async generateTexture({ prompt = 'ambient texture with airy pads', style = 'ambient', duration = 8 } = {}) {
    return this.riffusion.generate({
      prompt,
      style,
      duration,
      name: 'texture',
    });
  }

  async explainMixNeeds({ context = '' } = {}) {
    const response = await this.chat.ask({
      message: 'Explain what this mix needs and suggest concrete next actions.',
      context,
    });

    return {
      ok: true,
      provider: 'local-advisor',
      analysis: response.text,
    };
  }

  async fixTimingIssues({ loopDescription = '', context = '' } = {}) {
    const response = await this.chat.ask({
      message: `Fix timing issues in this loop: ${loopDescription}`,
      context,
    });

    return {
      ok: true,
      provider: 'local-advisor',
      suggestions: response.text,
    };
  }
}

module.exports = { AIMusicOrchestrator };
