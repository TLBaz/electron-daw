// sequencer.js
// Minimal FL-style step sequencer grid (16 steps x N tracks)

class StepSequencer {
  constructor({ containerEl, tracksProvider, transport, bpmProvider }) {
    this.containerEl = containerEl;
    this.tracksProvider = tracksProvider;
    this.transport = transport;
    this.bpmProvider = bpmProvider;

    this.steps = 16;
    this.stepRes = 1; // 1 = step = 1/16

    // data: { [trackId]: { [stepIndex]: { active, velocity } } }
    this.data = {};

    this.pixelsPerStep = 32;
    this.cellHeight = 20;

    this._activeStep = 0;

    this._onGridClick = this._onGridClick.bind(this);
    this._onGridMouseMove = this._onGridMouseMove.bind(this);

    this.dragMode = false;
    this.dragValue = true;

    // Selection state
    this.selectedCells = new Set(); // stores "trackId:stepIndex" strings
    this.multiSelectMode = false;
    this.selectionStart = null;

    this._render();
  }

  ensureTrack(trackId) {
    if (!this.data[trackId]) {
      this.data[trackId] = {};
      for (let i = 0; i < this.steps; i++) {
        this.data[trackId][i] = { active: false, velocity: 100 };
      }
    }
  }

  _render() {
    const tracks = this.tracksProvider();
    this.containerEl.innerHTML = '';

    // Wrapper
    const grid = document.createElement('div');
    grid.className = 'step-seq-grid';

    // header row (step numbers)
    const header = document.createElement('div');
    header.className = 'step-seq-header';
    header.style.display = 'grid';
    header.style.gridTemplateColumns = `60px repeat(${this.steps}, ${this.pixelsPerStep}px)`;

    const lbl = document.createElement('div');
    lbl.className = 'step-seq-cell step-seq-label';
    lbl.textContent = 'Track';
    header.appendChild(lbl);

    for (let s = 0; s < this.steps; s++) {
      const cell = document.createElement('div');
      cell.className = 'step-seq-cell';
      cell.textContent = s + 1;
      cell.dataset.step = String(s);
      header.appendChild(cell);
    }

    // body
    const body = document.createElement('div');
    body.className = 'step-seq-body';
    body.style.display = 'grid';
    body.style.gridTemplateColumns = `60px repeat(${this.steps}, ${this.pixelsPerStep}px)`;

    tracks.forEach((t) => {
      this.ensureTrack(t.id);

      const nameCell = document.createElement('div');
      nameCell.className = 'step-seq-cell step-seq-track';
      nameCell.textContent = t.name;
      nameCell.dataset.trackId = t.id;
      body.appendChild(nameCell);

      for (let s = 0; s < this.steps; s++) {
        const c = document.createElement('div');
        c.className = 'step-seq-cell step-seq-step';
        c.style.height = `${this.cellHeight}px`;
        c.dataset.trackId = t.id;
        c.dataset.step = String(s);
        c.dataset.active = 'false';

        if (this.data[t.id][s]?.active) {
          c.classList.add('active');
          c.dataset.active = 'true';
        }

        this.updateVelocityClass(c, this.data[t.id][s]?.velocity || 100);

        body.appendChild(c);
      }
    });

    grid.appendChild(header);
    grid.appendChild(body);

    this.containerEl.appendChild(grid);

    // Event delegation
    grid.addEventListener('click', this._onGridClick);
    grid.addEventListener('mousemove', this._onGridMouseMove);
    grid.addEventListener('mousedown', (e) => {
      const target = e.target;
      if (target?.classList?.contains('step-seq-step')) {
        this.dragMode = true;
        this.dragValue = !this._cellIsActive(target);
        this._setCell(target, this.dragValue);
      }
    });
    window.addEventListener('mouseup', () => {
      this.dragMode = false;
    });

    // Delete key support
    const onKeyDown = (e) => {
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (this.selectedCells.size > 0) {
          this.deleteSelectedCells();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    this.gridEl = grid;
    this.bodyEl = body;
    this._keyDownHandler = onKeyDown;
  }

  _cellIsActive(el) {
    return el.classList.contains('active');
  }

  _setCell(el, value) {
    const trackId = el.dataset.trackId;
    const step = Number(el.dataset.step);
    this.ensureTrack(trackId);

    this.data[trackId][step].active = !!value;
    el.classList.toggle('active', !!value);
    el.dataset.active = value ? 'true' : 'false';

    // Update velocity class based on current value
    this.updateVelocityClass(el, this.data[trackId][step].velocity);

    // Mark for playback: for now, we map active steps to playing the first clip on that track.
    // If no clip exists, do nothing.
  }

  updateVelocityClass(el, velocity) {
    el.classList.remove('velocity-low', 'velocity-mid', 'velocity-high');
    if (velocity < 70) {
      el.classList.add('velocity-low');
    } else if (velocity < 90) {
      el.classList.add('velocity-mid');
    } else {
      el.classList.add('velocity-high');
    }
  }

  selectCell(trackId, step, multiSelect = false) {
    const key = `${trackId}:${step}`;
    if (multiSelect) {
      this.selectedCells.add(key);
    } else {
      this.selectedCells.clear();
      this.selectedCells.add(key);
    }
    this._updateSelectionUI();
  }

  deselectCell(trackId, step) {
    const key = `${trackId}:${step}`;
    this.selectedCells.delete(key);
    this._updateSelectionUI();
  }

  clearSelection() {
    this.selectedCells.clear();
    this._updateSelectionUI();
  }

  _updateSelectionUI() {
    if (!this.gridEl) return;
    this.gridEl.querySelectorAll('.step-seq-step.selected').forEach(el => {
      el.classList.remove('selected');
    });
    this.selectedCells.forEach(key => {
      const [trackId, step] = key.split(':');
      const el = this.gridEl.querySelector(`[data-track-id="${trackId}"][data-step="${step}"]`);
      if (el) el.classList.add('selected');
    });
  }

  deleteSelectedCells() {
    this.selectedCells.forEach(key => {
      const [trackId, step] = key.split(':');
      const el = this.gridEl?.querySelector(`[data-track-id="${trackId}"][data-step="${step}"]`);
      if (this.data[trackId]?.[Number(step)]) {
        this.data[trackId][Number(step)].active = false;
        if (el) {
          el.classList.remove('active');
          el.dataset.active = 'false';
        }
      }
    });
    this.clearSelection();
  }

  getData() {
    return JSON.parse(JSON.stringify(this.data));
  }

  setData(data) {
    if (data && typeof data === 'object') {
      this.data = JSON.parse(JSON.stringify(data));
      this._render();
    }
  }

  clearAllData() {
    this.data = {};
    this.clearSelection();
    this._render();
  }

  _onGridClick(e) {
    const t = e.target;
    if (!t?.classList?.contains('step-seq-step')) return;
    
    const trackId = t.dataset.trackId;
    const step = Number(t.dataset.step);
    
    // Ctrl/Cmd + Click for multi-select
    if (e.ctrlKey || e.metaKey) {
      this.selectCell(trackId, step, true);
    } else {
      const newVal = !this._cellIsActive(t);
      this._setCell(t, newVal);
      this.selectCell(trackId, step, false);
    }
  }

  _onGridMouseMove(e) {
    if (!this.dragMode) return;
    const el = e.target;
    if (!el?.classList?.contains('step-seq-step')) return;
    this._setCell(el, this.dragValue);
  }

  setActiveStep(stepIndex) {
    const s = ((stepIndex % this.steps) + this.steps) % this.steps;
    this._activeStep = s;

    if (!this.gridEl) return;

    // clear
    this.gridEl.querySelectorAll('.step-seq-step.active-step').forEach(el => {
      el.classList.remove('active-step');
    });

    // highlight across all tracks at column s
    const cells = this.gridEl.querySelectorAll(`.step-seq-step[data-step="${s}"]`);
    cells.forEach(el => el.classList.add('active-step'));
  }

  triggerStep(stepIndex) {
    // Simple playback: if track has active step, play first clip at that beat.
    // Clip engine already schedules based on clip.startBeat; to avoid large refactor,
    // we play immediately at current transport time.
    const beatNow = this.transport.getCurrentBeat();
    const secPerBeat = 60 / this.transport.bpm;

    // Convert step index to beat offset (16 steps per 4 beats bar => 1 step = 0.25 beat).
    const stepBeats = 0.25 * this.stepRes;

    const ctx = this.transport.engine?.ctx;
    if (!ctx) return;

    // Determine if we should play in this exact step moment.
    // We'll schedule a very near time.
    const whenSeconds = ctx.currentTime + 0.02;

    const tracks = this.tracksProvider();
    for (const t of tracks) {
      const td = this.data[t.id];
      if (!td) continue;
      if (!td[stepIndex]?.active) continue;

      const clip = t.clips?.[0];
      if (!clip) continue;

      // playClipAtClipTime expects clip + when.
      this.transport.engine.playClipAtClipTime(clip, whenSeconds, {
        getTrackIdForClip: () => t.id,
      });
    }
  }
}

window.StepSequencer = StepSequencer;

