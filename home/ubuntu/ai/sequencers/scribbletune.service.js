const scribble = require('scribbletune');

class ScribbletuneService {
  createBassline({ notes = ['F2', 'Ab2', 'C3', 'Eb3'], pattern = 'x---x---x---x---' } = {}) {
    return scribble.clip({
      notes,
      pattern,
      accent: 'x-xx-x-x-xx-x-x-',
      shuffle: 0.1,
    });
  }

  createChordArp({ chords = ['Fm', 'Db', 'Ab', 'Eb'], pattern = 'x-x-x-x-x-x-x-x-' } = {}) {
    return scribble.clip({
      notes: chords,
      pattern,
      sizzle: true,
    });
  }
}

module.exports = { ScribbletuneService };
