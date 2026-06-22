// project-manager.js

// Very small persistence layer.
// Uses localStorage for UI projects.

class ProjectManager {
  constructor(audioEngine, transport, app) {
    this.audioEngine = audioEngine;
    this.transport = transport;
    this.app = app;
    this.sequencer = null; // will be set by app

    this.unsavedChanges = false;

    this.onSaveDone = null;
    this.onLoadDone = null;
    this.onError = null;
    this.onModified = null;

    this._autoSaveTimer = null;
  }

  enableAutoSave(ms) {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
    this._autoSaveTimer = setInterval(() => {
      if (this.unsavedChanges) this.saveCurrentProject();
    }, ms);
  }

  markUnsaved() {
    this.unsavedChanges = true;
    if (this.onModified) this.onModified();
  }

  newProject(name) {
    // reset engine
    this.audioEngine.tracks = [];

    // create 3 tracks by default (matches index.html)
    const t1 = this.audioEngine.addTrack({ name: 'Drums' });
    const t2 = this.audioEngine.addTrack({ name: 'Bass' });
    const t3 = this.audioEngine.addTrack({ name: 'Lead' });

    // clear selection
    this.app.state.selectedTrack = null;
    this.app.state.selectedClip = null;

    this.transport.stop();
    this.unsavedChanges = false;
    this.transport.bpm = 120;

    // update UI immediately
    const project = {
      name,
      bpm: this.transport.bpm,
      timeSignature: this.transport.timeSignature,
      tracks: this.audioEngine.tracks,
    };

    if (this.onLoadDone) this.onLoadDone({ project });
  }

  loadProject(project) {
    if (!project || !project.name) return;

    // reset engine
    this.audioEngine.tracks = [];

    // Restore tracks
    if (project.tracks && Array.isArray(project.tracks)) {
      project.tracks.forEach(trackData => {
        const track = this.audioEngine.addTrack({ name: trackData.name || 'Track' });
        track.volumeDb = trackData.volumeDb || 0;
        track.pan = trackData.pan || 0;
        track.isMuted = trackData.isMuted || false;
        track.isSolo = trackData.isSolo || false;
      });
    }

    // Restore transport settings
    this.transport.bpm = project.bpm || 120;
    this.transport.timeSignature = project.timeSignature || { beats: 4, noteValue: 4 };

    // Restore sequencer data if available
    if (project.sequencerData && this.sequencer) {
      this.sequencer.setData(project.sequencerData);
    }

    // clear selection
    this.app.state.selectedTrack = null;
    this.app.state.selectedClip = null;

    this.transport.stop();
    this.unsavedChanges = false;

    // Update UI immediately
    if (this.onLoadDone) this.onLoadDone({ project });
  }

  getCurrentProject() {
    const projectName = document.getElementById('project-name')?.textContent || 'Beats2026';
    const project = {
      name: projectName,
      bpm: this.transport.bpm,
      timeSignature: this.transport.timeSignature,
      tracks: this.audioEngine.tracks,
    };

    // Include sequencer data if available
    if (this.sequencer) {
      project.sequencerData = this.sequencer.getData();
    }

    return project;
  }

  saveProject(project) {
    try {
      localStorage.setItem(`daw-project-${project.name}`, JSON.stringify(project));
      this.unsavedChanges = false;
      if (this.onSaveDone) this.onSaveDone({ message: 'Saved project' });
    } catch (e) {
      if (this.onError) this.onError(e);
    }
  }

  saveCurrentProject() {
    const project = this.getCurrentProject();
    this.saveProject(project);
  }
}

window.ProjectManager = ProjectManager;

