// ============================================
// DAW APPLICATION - Main Controller
// ============================================

class DAWApplication {
    constructor() {
        this.audioEngine = null;
        this.audioLoader = null;
        this.transport = null;
        this.aiClient = null;
        this.rulerRenderer = null;
        this.sampleBrowser = null;
        this.projectManager = null;
        this.uiController = null;
        this.state = {
            selectedTrack: null,
            selectedClip: null,
            isRecording: false,
            metronomeEnabled: false,
        };
        this.init();
    }

    async init() {
        try {
            // Initialize audio systems
            this.audioEngine = new AudioEngine();
            this.audioLoader = new AudioLoader(this.audioEngine);
            this.transport = new Transport(this.audioEngine);
            this.transport.setSampleBufferProvider((p) => this.audioLoader.getCachedBuffer(p));
            this.sampleBrowser = new SampleBrowser(this.audioEngine, this.audioLoader); this.sampleLibrary = new SampleLibraryService();
            if (typeof window.AIClient === 'function') {
                this.aiClient = new window.AIClient(window.electronAPI);
            }

            
            // Initialize UI
            this.uiController = new UIController(this);
            
            // Initialize managers
            this.projectManager = new ProjectManager(this.audioEngine, this.transport, this);

            // Setup ruler
            this.initializeRuler();

            // Setup FL-style step sequencer (16 steps grid)
            if (typeof window.initializeSequencerPanel === 'function') {
                window.initializeSequencerPanel(this);
                // Make sequencer available to project manager for persistence
                if (window.__stepSequencer) {
                    this.projectManager.sequencer = window.__stepSequencer;
                }
            }


            // Wire everything together
            this.wireUpSystems();
            
            // Load Splice samples on startup
            const splicePath = "C:\\Users\\beata\\Documents\\Splice\\Samples\\packs";
            const self = this;
            if (window.electronAPI) {
                window.electronAPI.invoke("load-samples-directory", splicePath)
                    .then(r => { if (r.success && r.samples.length) self.sampleBrowser.loadFromPaths(r.samples); if(self.sampleLibrary) self.sampleLibrary.setSamples(r.samples); })
                    .catch(e => { console.log("Samples not found:", e); });
            }
            // Create default project
            this.projectManager.newProject('Beats2026');
            
            console.log('âœ“ DAW Application initialized');
        } catch (error) {
            console.error('âœ— Initialization error:', error);
        }
    }

    wireUpSystems() {
        // Transport â†’ UI updates
        this.transport.onTick = (data) => {
            this.uiController.updateTimeDisplay(data);
            if (this.rulerRenderer) {
                this.rulerRenderer.updatePlayhead();
            }
        };

        this.transport.onPlay = () => {
            this.uiController.setPlayButtonActive(true);
        };

        this.transport.onPause = () => {
            this.uiController.setPlayButtonActive(false);
        };

        this.transport.onStop = () => {
            this.uiController.setPlayButtonActive(false);
            this.uiController.resetTimeDisplay();
        };

        // Audio Engine â†’ UI updates
        this.audioEngine.onTimeUpdate = (currentTime) => {
            const beatInfo = this.transport.getBeatInfo();
            this.uiController.updateBeatDisplay(beatInfo);
        };

        // Project Manager â†’ UI
        this.projectManager.onSaveDone = (data) => {
            this.uiController.showNotification(`Saved: ${data.message}`, 'success');
            this.uiController.clearUnsavedIndicator();
        };

        this.projectManager.onLoadDone = (data) => {
            this.uiController.showNotification(`Loaded: ${data.project.name}`, 'success');
            this.renderProject(data.project);
        };

        this.projectManager.onError = (error) => {
            this.uiController.showNotification(`Error: ${error}`, 'error');
        };

        this.projectManager.onModified = () => {
            this.uiController.showUnsavedIndicator();
        };

        // Sample Browser â†’ UI
        this.sampleBrowser.onDirectoryLoaded = (samples) => {
            this.uiController.renderSampleList(samples);
        };

        // Enable auto-save
        this.projectManager.enableAutoSave(30000);
    }

    initializeRuler() {
        const ruler = document.querySelector('.ruler');
        if (ruler) {
            this.rulerRenderer = new RulerRenderer(ruler, this.transport);
            this.rulerRenderer.startTracking();
        }
    }

    renderProject(project) {
        this.uiController.updateProjectName(project.name);
        this.uiController.renderTracks(this.audioEngine.tracks);
        this.uiController.renderMixer(this.audioEngine.tracks);
    }

    markProjectModified() {
        this.projectManager.markUnsaved();
        this.uiController.showUnsavedIndicator();
    }

    getState() {
        return this.state;
    }

    setState(key, value) {
        this.state[key] = value;
    }
}

// ============================================
// UI CONTROLLER - Bridges UI and audio systems
// ============================================

class UIController {
    constructor(app) {
        this.app = app;
        this.callbacks = {};
        this.init();
    }

    init() {
        this.setupTransportControls();
        this.setupProjectControls();
        this.setupViewControls();
        this.setupBrowserControls();
        this.setupAIControls();
        this.setupKeyboardShortcuts();
    }

    setupTransportControls() {
        // Play/Pause
        const btnPlay = document.getElementById('btn-play');
        if (btnPlay) {
            btnPlay.addEventListener('click', () => {
                if (this.app.transport.isPlaying) {
                    this.app.transport.pause();
                } else {
                    this.app.transport.play();
                }
            });
        }

        // Stop
        const btnStop = document.getElementById('btn-stop');
        if (btnStop) {
            btnStop.addEventListener('click', () => {
                this.app.transport.stop();
            });
        }

        // Loop
        const btnLoop = document.getElementById('btn-loop');
        if (btnLoop) {
            btnLoop.addEventListener('click', () => {
                const enabled = !this.app.transport.loopEnabled;
                this.app.transport.toggleLoop(enabled, 0, 16);
                btnLoop.classList.toggle('active', enabled);
            });
        }

        // Tempo
        const tempoInput = document.getElementById('tempo-input');
        if (tempoInput) {
            tempoInput.addEventListener('change', (e) => {
                const bpm = parseInt(e.target.value);
                this.app.transport.setBPM(bpm);
            });

            // Start tempo tracking
            this.app.transport.onBPMChange = () => {
                tempoInput.value = this.app.transport.bpm;
            };
        }

        // Record
        const btnRecord = document.getElementById('btn-record');
        if (btnRecord) {
            btnRecord.addEventListener('click', () => {
                this.app.state.isRecording = !this.app.state.isRecording;
                btnRecord.classList.toggle('active', this.app.state.isRecording);
            });
        }
    }

    setupProjectControls() {
        const btnNew = document.getElementById('btn-new');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                if (this.app.projectManager.unsavedChanges) {
                    if (!confirm('Create new project? Unsaved changes will be lost.')) {
                        return;
                    }
                }
                this.app.projectManager.newProject('Beats2026');
            });
        }

        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const project = {
                    name: document.querySelector('.project-name').textContent,
                    bpm: this.app.transport.bpm,
                    timeSignature: this.app.transport.timeSignature,
                    tracks: this.app.audioEngine.tracks,
                };
                this.app.projectManager.saveProject(project);
            });
        }

        const btnOpen = document.getElementById('btn-open');
        if (btnOpen) {
            btnOpen.addEventListener('click', async () => {
                if (window.electronAPI) {
                    try {
                        const result = await window.electronAPI.invoke('list-projects');
                        if (result.success) {
                            this.showNotification(`Projects: ${result.projects.join(', ') || 'none'}`, 'info');
                        }
                    } catch (e) {
                        console.warn('list-projects failed:', e);
                    }
                }
            });
        }
    }

    setupViewControls() {
        // Tab switching
        document.querySelectorAll('.browser-tabs .browser-tab, .browser-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target, '.browser-tabs', '.browser-content', null, '.browser-tab, .tab-btn', '.browser-content-item, .tab-content', 'tab-');
            });
        });

        document.querySelectorAll('.panel-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = e.target.closest('.bottom-panel') || e.target.closest('.left-panel');
                if (container) {
                    this.switchTab(e.target, '.panel-tabs', '.panel-content', container);
                }
            });
        });
    }

    setupBrowserControls() {
        const btnLoadSamples = document.getElementById('btn-load-samples');
        if (btnLoadSamples) {
            btnLoadSamples.addEventListener('click', async () => {
                if (window.electronAPI) {
                    try {
                        const result = await window.electronAPI.invoke('load-samples-directory');
                        if (result.success && result.samples.length) {
                            this.app.sampleBrowser.loadFromPaths(result.samples);
                        }
                    } catch (e) {
                        console.warn('load-samples-directory failed:', e);
                    }
                }
            });
        }
    }

    setupAIControls() {
        const btnRun = document.getElementById('btn-ai-run');
        if (!btnRun) return;

        btnRun.addEventListener('click', async () => {
            if (!this.app.aiClient) {
                this.showNotification('AI client unavailable in renderer.', 'error');
                return;
            }

            const commandEl = document.getElementById('ai-command');
            const promptEl = document.getElementById('ai-prompt');
            const trackEl = document.getElementById('ai-target-track');
            const resultEl = document.getElementById('ai-result');

            const command = commandEl?.value;
            const prompt = (promptEl?.value || '').trim();
            const targetTrack = trackEl?.value || 'track-1';

            try {
                btnRun.disabled = true;
                if (resultEl) resultEl.textContent = 'Running AI task...';

                const payload = this.buildAIPayload(command, prompt);
                const response = await this.app.aiClient.run(command, payload);

                if (!response?.success) {
                    throw new Error(response?.error || 'AI command failed');
                }

                const result = response.result || {};
                await this.handleAIResult(command, result, targetTrack);
                if (resultEl) {
                    resultEl.textContent = this.formatAIResult(result);
                }
            } catch (err) {
                console.error('AI command error:', err);
                if (resultEl) resultEl.textContent = `Error: ${err.message}`;
                this.showNotification(`AI error: ${err.message}`, 'error');
            } finally {
                btnRun.disabled = false;
            }
        });
    }

    buildAIPayload(command, prompt) {
        switch (command) {
            // -------------------- Drums --------------------
            case 'generate-drum-pattern':
                return { prompt: prompt || 'Generate a modern punchy drum groove', bars: 4, duration: 8 };

            case 'make-trap-drum-pattern':
                return { prompt: prompt || 'make a trap drum pattern', bars: 4 };

            // -------------------- Bass --------------------
            case 'create-bassline':
                return { key: 'F', mode: 'minor', style: prompt || 'dark rolling bass' };

            case 'generate-bassline-in-key': {
                return {
                    key: 'F',
                    mode: 'minor',
                    style: prompt || 'dark rolling bass',
                    prompt,
                };
            }

            // -------------------- Melody / Harmony --------------------
            case 'create-melody-from-chords':
                return { chords: ['Fm', 'Db', 'Ab', 'Eb'], prompt: prompt || 'Make an emotional hook melody', duration: 8 };

            case 'create-8-bar-melody': {
                return {
                    chords: ['Fm', 'Db', 'Ab', 'Eb'],
                    prompt: prompt || 'Create an 8-bar melody with clear motifs and variation',
                    duration: 16,
                };
            }

            case 'generate-chord-progression':
                return { prompt: prompt || 'Generate a chord progression for a minor electronic track in F' };

            // -------------------- Full track / Arrangement --------------------
            case 'generate-full-idea':
                return { prompt: prompt || 'Generate a full 8-bar idea', duration: 16 };

            case 'ai-arrangement-suggestions':
                return { prompt: prompt || 'Suggest arrangement for this idea (intro, build, drop, break, outro)' };

            // -------------------- Conversational / Diagnostics --------------------
            case 'explain-mix-needs':
                return { context: prompt || 'Kick is muddy, vocals are buried, stereo field feels narrow.' };

            case 'fix-timing':
                return { loopDescription: prompt || 'Hi-hats feel rushed against kick and snare.', context: '' };

            // sample browsing helpers (if wired in your backend)
            case 'search-samples':
                return { query: prompt };
            case 'find-kicks':
                return { query: 'kick' };
            case 'find-snares':
                return { query: 'snare' };
            case 'find-bass':
                return { query: 'bass' };
            case 'find-vocals':
                return { query: 'vocal' };
            case 'random-inspiration':
                return { query: '' };

            default:
                return { prompt };
        }
    }

    async handleAIResult(command, result, targetTrack) {
        if (result?.outputPath) {
            const clip = await this.app.sampleBrowser.addSampleToTrack(result.outputPath, targetTrack, 0);
            if (clip) {
                this.injectClipIntoStaticArrangement(targetTrack, clip);
                this.app.markProjectModified();
                this.showNotification('AI audio added to arrangement.', 'success');
            }
            return;
        }

        if (command === 'create-bassline' && result?.midiClip) {
            this.showNotification('Bassline pattern generated (MIDI clip JSON in result).', 'success');
            return;
        }

        this.showNotification('AI task completed.', 'success');
    }

    injectClipIntoStaticArrangement(trackId, clip) {
        const target = document.getElementById(`${trackId}-clips`);
        if (!target) return;

        const clipEl = document.createElement('div');
        clipEl.className = 'clip clip-blue draggable';
        clipEl.textContent = clip.sampleName || 'AI Clip';
        clipEl.style.left = `${Math.max(0, target.children.length - 1) * 140}px`;
        clipEl.style.width = '120px';
        clipEl.dataset.clipId = clip.id;

        target.appendChild(clipEl);
    }

    formatAIResult(result) {
        if (!result) return 'No result returned.';
        if (result.outputPath) return `Generated audio: ${result.outputPath}`;
        if (result.analysis) return result.analysis;
        if (result.suggestions) return result.suggestions;
        if (result.progression) return `Progression: ${result.progression.join(' - ')}`;
        return JSON.stringify(result);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Space: Play/Pause
            if (e.code === 'Space' && !this.isInputFocused()) {
                e.preventDefault();
                if (this.app.transport.isPlaying) {
                    this.app.transport.pause();
                } else {
                    this.app.transport.play();
                }
            }

            // Ctrl+S / Cmd+S: Save
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
                e.preventDefault();
                const project = {
                    name: document.querySelector('.project-name').textContent,
                    bpm: this.app.transport.bpm,
                    timeSignature: this.app.transport.timeSignature,
                    tracks: this.app.audioEngine.tracks,
                };
                this.app.projectManager.saveProject(project);
            }

            // Ctrl+N / Cmd+N: New
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyN') {
                e.preventDefault();
                if (this.app.projectManager.unsavedChanges) {
                    if (!confirm('Create new project? Unsaved changes will be lost.')) {
                        return;
                    }
                }
                this.app.projectManager.newProject('Beats2026');
            }
        });
    }

    switchTab(btn, tabsSelector, contentSelector, container, tabItemsSelector = '.tab-btn', panelSelector = '[id$="-panel"], [id^="tab-"]', panelPrefix = '') {
        const tabs = btn.closest(tabsSelector);
        const content = container || btn.closest('.left-panel') || btn.closest('.bottom-panel') || document.body;

        if (tabs) {
            tabs.querySelectorAll(tabItemsSelector).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        const tabId = btn.getAttribute('data-tab');
        if (tabId && content) {
            content.querySelectorAll(panelSelector).forEach(el => {
                if (el.classList.contains('mixer-panel') || el.classList.contains('piano-panel') || el.classList.contains('waveform-panel') ||
                    el.id.startsWith('tab-')) {
                    el.classList.remove('active');
                }
            });
            const panelId = panelPrefix ? `${panelPrefix}${tabId}` : `${tabId}-panel`;
            const activeContent = content.querySelector(`#${panelId}`) || content.querySelector(`#tab-${tabId}`);
            if (activeContent) {
                activeContent.classList.add('active');
            }
        }
    }

    updateTimeDisplay(data) {
        const display = document.getElementById('time-display');
        if (display && data.time) {
            display.textContent = data.time;
        }
    }

    updateBeatDisplay(beatInfo) {
        const display = document.getElementById('beat-display');
        if (display && beatInfo) {
            display.textContent = `${beatInfo.bar}.${beatInfo.beat}`;
        }
    }

    resetTimeDisplay() {
        const display = document.getElementById('time-display');
        if (display) {
            display.textContent = '00:00.00';
        }
        const beatDisplay = document.getElementById('beat-display');
        if (beatDisplay) {
            beatDisplay.textContent = '1.1';
        }
    }

    setPlayButtonActive(active) {
        const btn = document.getElementById('btn-play');
        if (btn) {
            btn.classList.toggle('active', active);
        }
    }

    updateProjectName(name) {
        const el = document.querySelector('.project-name');
        if (el) {
            el.textContent = name;
        }
    }

    showUnsavedIndicator() {
        const indicator = document.querySelector('.project-unsaved');
        if (indicator) {
            indicator.classList.add('active');
        }
    }

    clearUnsavedIndicator() {
        const indicator = document.querySelector('.project-unsaved');
        if (indicator) {
            indicator.classList.remove('active');
        }
    }

    renderTracks(tracks) {
        const list = document.getElementById('tracks-list');
        if (!list) return;

        list.innerHTML = '';
        tracks.forEach((track, idx) => {
            const trackEl = document.createElement('div');
            trackEl.className = 'track';
            trackEl.dataset.trackId = track.id;

            const clipsHtml = (track.clips || []).map((clip, i) => `
                <div class="clip variant-${String.fromCharCode(97 + (i % 4))}" data-clip-id="${clip.id}">
                    <div class="clip-waveform"></div>
                    <div class="clip-name">${clip.id.substring(0, 6)}</div>
                    <div class="clip-duration">${clip.duration || ''}s</div>
                </div>
            `).join('');

            trackEl.innerHTML = `
                <div class="track-header">
                    <div class="track-name">${track.name}</div>
                    <div class="track-controls">
                        <button class="track-btn track-btn-mute" title="Mute">M</button>
                        <button class="track-btn track-btn-solo" title="Solo">S</button>
                    </div>
                </div>
                <div class="track-clips">
                    ${clipsHtml}
                </div>
            `;

            // Mute handler
            trackEl.querySelector('.track-btn-mute')?.addEventListener('click', () => {
                track.isMuted = !track.isMuted;
                this.app.audioEngine.setTrackMute(track.id, track.isMuted);
                trackEl.querySelector('.track-btn-mute').classList.toggle('active');
                this.app.markProjectModified();
            });

            // Solo handler
            trackEl.querySelector('.track-btn-solo')?.addEventListener('click', () => {
                track.isSolo = !track.isSolo;
                this.app.audioEngine.setTrackSolo(track.id, track.isSolo);
                trackEl.querySelector('.track-btn-solo').classList.toggle('active');
                this.app.markProjectModified();
            });

            // Drag and drop clips
            const clipsArea = trackEl.querySelector('.track-clips');
            clipsArea?.addEventListener('dragover', (e) => {
                e.preventDefault();
                clipsArea.style.backgroundColor = 'rgba(0, 136, 255, 0.1)';
            });

            clipsArea?.addEventListener('dragleave', () => {
                clipsArea.style.backgroundColor = '';
            });

            clipsArea?.addEventListener('drop', (e) => {
                e.preventDefault();
                clipsArea.style.backgroundColor = '';
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    const sampleData = JSON.parse(data);
                    if (sampleData.type === 'sample') {
                        this.app.sampleBrowser.addSampleToTrack(sampleData.path, track.id, 0);
                        this.app.markProjectModified();
                    }
                }
            });

            list.appendChild(trackEl);
        });
    }

    renderMixer(tracks) {
        const mixer = document.getElementById('mixer-tracks');
        if (!mixer) return;

        mixer.innerHTML = '';
        tracks.forEach(track => {
            const channel = document.createElement('div');
            channel.className = 'mixer-channel';
            channel.dataset.trackId = track.id;

            channel.innerHTML = `
                <div class="mixer-channel-name" title="${track.name}">${track.name}</div>
                <div class="mixer-fader-wrapper">
                    <input type="range" class="mixer-fader vertical" min="-60" max="12" value="${track.volume || 0}" />
                    <div class="mixer-value">${track.volume || 0}dB</div>
                </div>
                <div class="mixer-meter">
                    <div class="mixer-meter-bar" style="height: 0%"></div>
                </div>
                <div class="mixer-buttons">
                    <button class="mixer-btn-mute ${track.isMuted ? 'active' : ''}">M</button>
                    <button class="mixer-btn-solo ${track.isSolo ? 'active' : ''}">S</button>
                </div>
            `;

            const fader = channel.querySelector('.mixer-fader');
            fader.addEventListener('input', (e) => {
                const db = parseInt(e.target.value);
                track.volume = db;
                this.app.audioEngine.setTrackVolume(track.id, db);
                channel.querySelector('.mixer-value').textContent = `${db}dB`;
                this.app.markProjectModified();
            });

            channel.querySelector('.mixer-btn-mute').addEventListener('click', () => {
                track.isMuted = !track.isMuted;
                this.app.audioEngine.setTrackMute(track.id, track.isMuted);
                channel.querySelector('.mixer-btn-mute').classList.toggle('active');
                this.app.markProjectModified();
            });

            channel.querySelector('.mixer-btn-solo').addEventListener('click', () => {
                track.isSolo = !track.isSolo;
                this.app.audioEngine.setTrackSolo(track.id, track.isSolo);
                channel.querySelector('.mixer-btn-solo').classList.toggle('active');
                this.app.markProjectModified();
            });

            mixer.appendChild(channel);
        });
    }

    renderSampleList(samples) {
        const list = document.getElementById('samples-list') || document.getElementById('samples-tree');
        if (!list) return;

        list.innerHTML = '';
        samples.forEach(file => {
            const item = document.createElement('div');
            item.className = 'tree-item';
            item.draggable = true;
            item.innerHTML = `
                <span class="tree-label">ðŸŽµ ${file.name}</span>
            `;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'sample',
                    path: file.path,
                    name: file.name,
                }));
            });

            list.appendChild(item);
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        const container = document.querySelector('.notification-container') || document.body;
        container.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 300ms ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    isInputFocused() {
        const el = document.activeElement;
        return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';
    }
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.daw = new DAWApplication();
    });
} else {
    window.daw = new DAWApplication();
}
