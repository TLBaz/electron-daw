// sequencer-panel.js
// Wires StepSequencer into existing DAW state/UI.

(function () {
  function tracksProvider(app) {
    // Ensure we return lightweight track objects with {id, name, clips?}
    return (app.audioEngine?.tracks || []).map((t) => ({
      id: t.id,
      name: t.name,
      clips: t.clips,
    }));
  }

  function ensurePanel() {
    return document.getElementById('sequencer-panel') || document.querySelector('.daw-center .daw-arrangement');
  }

  window.initializeSequencerPanel = function initializeSequencerPanel(app) {
    const panel = ensurePanel();
    if (!panel) return;

    // Create container if missing
    let container = document.getElementById('step-sequencer-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'step-sequencer-container';
      container.style.height = '320px';
      container.style.overflow = 'auto';
      container.style.background = 'var(--color-bg-main)';
        // Genre dropdown for drum patterns
        var genreSelect = document.createElement('select');
        genreSelect.id = 'genre-pattern-select';
        genreSelect.style.margin = '8px';
        genreSelect.style.padding = '4px 8px';
        genreSelect.style.background = '#2a2a2a';
        genreSelect.style.color = '#ddd';
        genreSelect.innerHTML = '<option value=\'\'>Select Genre...</option>';
        var genres = ['trap','drill','boombap','jerseyclub','ukgarage','house','techno','dnb','lofi','hyperpop','phonk','emorap','synthwave','afrobeats','grime'];
        var genreNames = ['Trap','Drill','Boom Bap','Jersey Club','UK Garage','House','Techno','Drum & Bass','Lo-Fi','Hyperpop','Phonk','Emo Rap','Synthwave','Afro Beats','Grime'];
        for(var g=0; g<genres.length; g++) {
          var opt = document.createElement('option');
          opt.value = genres[g];
          opt.textContent = genreNames[g];
          genreSelect.appendChild(opt);
        }.panel.insertBefore(genreSelect, container);
        // Apply genre pattern on change
        genreSelect.addEventListener('change', function() {
          if(!this.value || !window.__stepSequencer) return;
          var gps = new window.GenreDrumPatternService();
          var p = gps.generateUniquePattern(this.value);
          var tracks = app.audioEngine.tracks; gps.applyToSequencer(window.__stepSequencer, tracks.map(t=>t.id), p.pattern);
          console.log('Loaded', p.genreName, 'pattern. Seed:', p.seed);
        });
      panel.appendChild(container);
    }

    // Instantiate if not already
    if (!window.__stepSequencer) {
      window.__stepSequencer = new window.StepSequencer({
        containerEl: container,
        tracksProvider: () => tracksProvider(app),
        transport: app.transport,
        bpmProvider: () => app.transport?.bpm,
      });
    } else {
      // Re-render to reflect tracks changes
      window.__stepSequencer = new window.StepSequencer({
        containerEl: container,
        tracksProvider: () => tracksProvider(app),
        transport: app.transport,
        bpmProvider: () => app.transport?.bpm,
      });
    }

    // Transport highlighting (step column) and playback triggering
    if (app.transport) {
      const oldTick = app.transport.onTick;
      let lastStepTriggered = -1;
      
      app.transport.onTick = (data) => {
        try {
          // Transport.getCurrentBeat() might exist; fallback to getBeatInfo()
          const beat = typeof app.transport.getCurrentBeat === 'function'
            ? app.transport.getCurrentBeat()
            : (data?.beatInfo ? data.beatInfo.beat : 0);

          // 16 steps per bar (4 beats) => step = beat*4
          const stepIndex = Math.floor((beat || 0) * 4);
          window.__stepSequencer.setActiveStep(stepIndex);
          
          // Trigger playback only once per step (avoid duplicate triggers)
          if (lastStepTriggered !== stepIndex && app.transport.isPlaying) {
            window.__stepSequencer.triggerStep(stepIndex);
            lastStepTriggered = stepIndex;
          }
        } catch (e) {}

        oldTick?.(data);
      };
    }
  };
})();

