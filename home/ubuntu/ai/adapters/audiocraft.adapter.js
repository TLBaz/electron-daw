const { spawn } = require('child_process');
const path = require('path');
const { FileStorageService } = require('../services/file-storage.service');

class AudiocraftAdapter {
  constructor(options = {}) {
    this.pythonBin = options.pythonBin || 'python';
    this.scriptPath = options.scriptPath
      || path.join(__dirname, '..', 'python', 'audiocraft_generate.py');
    this.storage = options.storage || new FileStorageService();
  }

  generate(params = {}) {
    return new Promise((resolve, reject) => {
      const outPath = params.outputPath
        || this.storage.buildOutputPath(params.name || 'musicgen', '.wav');

      const payload = {
        prompt: params.prompt || 'energetic electronic groove',
        duration: Number(params.duration || 8),
        mode: params.mode || 'full_track',
        outputPath: outPath,
        model: params.model || 'facebook/musicgen-medium',
      };

      const child = spawn(this.pythonBin, [this.scriptPath, JSON.stringify(payload)], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        stdout += String(d);
      });
      child.stderr.on('data', (d) => {
        stderr += String(d);
      });

      child.on('error', (err) => reject(err));

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Audiocraft failed (${code}): ${stderr || stdout}`));
        }
        resolve({
          ok: true,
          provider: 'audiocraft',
          outputPath: outPath,
          logs: stdout.trim(),
        });
      });
    });
  }
}

module.exports = { AudiocraftAdapter };
