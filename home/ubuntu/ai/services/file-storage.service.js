const fs = require('fs');
const path = require('path');

class FileStorageService {
  constructor(baseDir = path.join(process.cwd(), 'ai', 'outputs')) {
    this.baseDir = baseDir;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  buildOutputPath(fileName, ext = '.wav') {
    const safeName = String(fileName || 'untitled')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const stamped = `${Date.now()}_${safeName}${ext}`;
    return path.join(this.baseDir, stamped);
  }

  ensureDirFor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  saveJson(fileName, payload) {
    const target = this.buildOutputPath(fileName, '.json');
    this.ensureDirFor(target);
    fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
    return target;
  }

  fileExists(filePath) {
    return fs.existsSync(filePath);
  }
}

module.exports = { FileStorageService };
