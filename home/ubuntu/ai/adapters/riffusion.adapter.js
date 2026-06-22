const { spawn } = require('child_process');
const path = require('path');
const { FileStorageService } = require('../services/file-storage.service');

class RiffusionAdapter {
  constructor(options = {}) {
    this.pythonBin = options.pythonBin || 'python';
    this.scriptPath = options.scriptPath
      || path.join(process.cwd(), 'ai', 'python', 'riffusion_generate.py');
    this.storage = options.storage || new FileStorageService();
  }

  generate(params = {}) {
    return new Promise((resolve, reject) => {
      const outPath = params.outputPath
        || this.storage.buildOutputPath(params.name || 'riffusion', '.wav');

      const payload = {
        prompt: params.prompt || 'lush ambient synth pad with soft drums',
        negativePrompt: params.negativePrompt || '',
        style: params.style || 'ambient',
        duration: Number(params.duration || 8),
        outputPath: outPath,
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
          return reject(new Error(`Riffusion failed (${code}): ${stderr || stdout}`));
        }
        resolve({
          ok: true,
          provider: 'riffusion',
          outputPath: outPath,
          logs: stdout.trim(),
        });
      });
    });
  }
}

module.exports = { RiffusionAdapter };
