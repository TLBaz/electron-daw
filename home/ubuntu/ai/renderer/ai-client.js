class AIClient {
  constructor(electronAPI = window.electronAPI) {
    this.electronAPI = electronAPI;
  }

  run(command, payload = {}) {
    if (!this.electronAPI || !this.electronAPI.invoke) {
      return Promise.reject(new Error('Electron AI IPC not available.'));
    }
    return this.electronAPI.invoke('ai-run-command', { command, payload });
  }

  generateDrums(prompt, bars = 4) {
    return this.run('generate-drum-pattern', {
      prompt,
      bars,
    });
  }

  generateBassline(key = 'F', mode = 'minor', style = 'dark') {
    return this.run('create-bassline', { key, mode, style });
  }

  generateMelody(chords = ['Fm', 'Db', 'Ab', 'Eb'], prompt = 'melodic lead') {
    return this.run('create-melody-from-chords', { chords, prompt, duration: 8 });
  }

  explainMixNeeds(context) {
    return this.run('explain-mix-needs', { context });
  }

  fixTiming(loopDescription, context = '') {
    return this.run('fix-timing', { loopDescription, context });
  }

  generateFullIdea(prompt = 'Generate a full 8-bar idea') {
    return this.run('generate-full-idea', { prompt, duration: 16 });
  }
}

window.AIClient = AIClient;
