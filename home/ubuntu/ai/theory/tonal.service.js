const tonal = require('@tonaljs/tonal');

class TonalService {
  getScale(key = 'F', mode = 'minor') {
    const full = `${key} ${mode}`;
    return tonal.Scale.get(full);
  }

  getChordProgression(key = 'F', mode = 'minor', degrees = ['i', 'VI', 'III', 'VII']) {
    const scale = this.getScale(key, mode);
    const degreeMap = {
      i: 0,
      ii: 1,
      III: 2,
      iv: 3,
      V: 4,
      VI: 5,
      VII: 6,
    };

    return degrees.map((d) => {
      const idx = degreeMap[d] ?? 0;
      const root = scale.notes[idx] || scale.notes[0] || `${key}`;
      return tonal.Chord.detect([root, tonal.Note.transpose(root, '3m'), tonal.Note.transpose(root, '5P')])[0] || `${root}m`;
    });
  }

  suggestBassNotes(chords = []) {
    return chords.map((ch) => tonal.Chord.get(ch).tonic || 'F');
  }
}

module.exports = { TonalService };
