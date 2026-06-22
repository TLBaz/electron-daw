const Meyda = require('meyda');

class MeydaAnalyzerService {
  analyzeFrame(signal, sampleRate = 44100) {
    return Meyda.extract([
      'rms',
      'zcr',
      'spectralCentroid',
      'spectralFlatness',
      'chroma',
      'mfcc',
    ], signal, {
      sampleRate,
      bufferSize: signal.length,
      numberOfMFCCCoefficients: 13,
    });
  }

  summarizeMix(frames = []) {
    if (!frames.length) {
      return { insight: 'No frames provided.' };
    }

    const avgRms = frames.reduce((s, f) => s + (f.rms || 0), 0) / frames.length;
    const avgFlatness = frames.reduce((s, f) => s + (f.spectralFlatness || 0), 0) / frames.length;

    const notes = [];
    if (avgRms < 0.05) notes.push('Mix is quiet. Increase gain staging.');
    if (avgFlatness > 0.5) notes.push('Mix is noisy/harsh. Consider subtractive EQ.');
    if (!notes.length) notes.push('Mix energy profile looks stable.');

    return { avgRms, avgFlatness, notes };
  }
}

module.exports = { MeydaAnalyzerService };
