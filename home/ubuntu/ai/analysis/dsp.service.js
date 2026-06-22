const { FFT, IIRFilter } = require('dsp.js');

class DSPService {
  createFFT(bufferSize = 1024, sampleRate = 44100) {
    return new FFT(bufferSize, sampleRate);
  }

  spectrum(signal, sampleRate = 44100) {
    const fft = this.createFFT(signal.length, sampleRate);
    fft.forward(signal);
    return fft.spectrum;
  }

  lowPass(signal, sampleRate = 44100, cutoff = 6000, resonance = 0.5) {
    const filter = new IIRFilter('LP12', cutoff, resonance, sampleRate);
    return filter.process(signal);
  }
}

module.exports = { DSPService };
