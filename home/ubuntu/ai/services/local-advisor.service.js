// Local no-cost production advisor.

class LocalAdvisorService {
  constructor() {
    this.provider = 'local-advisor';
  }

  async ask({ message = '', context = '' }) {
    const combined = `${message} ${context}`.toLowerCase();
    const suggestions = [];

    if (/mud|boomy|low.?end|kick.*bass|bass.*kick/.test(combined)) {
      suggestions.push('Low-end cleanup: high-pass non-bass tracks around 80-120 Hz and sidechain bass to kick (2-4 dB GR).');
      suggestions.push('Narrow kick fundamental (45-70 Hz) and trim bass around the same center to reduce masking.');
    }

    if (/harsh|bright|sibil|sharp|piercing/.test(combined)) {
      suggestions.push('Harshness control: dynamic EQ around 2.5-6 kHz on bright elements and use a gentle de-esser where needed.');
    }

    if (/vocal|buried|hidden|quiet vocal/.test(combined)) {
      suggestions.push('Vocal presence: add 1-3 dB around 2-4 kHz, reduce competing synths in that range, and add short slap delay for density.');
    }

    if (/stereo|narrow|width|wide/.test(combined)) {
      suggestions.push('Stereo image: keep sub below ~120 Hz mono; widen mids/highs with subtle M/S EQ and decorrelated short ambience.');
    }

    if (/timing|late|early|off.?grid|swing|quantiz/.test(combined)) {
      suggestions.push('Timing correction: quantize transients to 1/16 with 50-75% strength; preserve groove using 3-8 ms humanization on hats/percussion.');
      suggestions.push('Align loop starts to zero crossings and trim clip heads/tails to avoid flam/phase offsets.');
    }

    if (!suggestions.length) {
      suggestions.push('Start with gain staging: peak around -10 dBFS per channel and keep headroom on master.');
      suggestions.push('Apply subtractive EQ before compression; remove masking then shape dynamics.');
      suggestions.push('Check arrangement contrast: simplify low-mid layers when hook or vocal enters.');
    }

    return {
      ok: true,
      text: suggestions.join('\n'),
      raw: {
        provider: this.provider,
        count: suggestions.length,
      },
    };
  }
}

module.exports = { LocalAdvisorService };
