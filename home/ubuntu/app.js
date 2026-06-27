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
        this.sampleLibrary = null;
        this.projectManager = null;
        this.uiController = null;

        this.choiceSamples = [];
        this.state = {
            selectedTrack: null,
            selectedClip: null,
            isRecording: false,
            metronomeEnabled: false,
        };
        this.init();
    }

    pickBestChoiceSamples(samples, targetCount = 24) {
        if (!Array.isArray(samples) || !samples.length) return [];

        const typeScore = {
            kick: 120,
            snare: 110,
            hihat: 100,
            clap: 95,
            vocal: 90,
            bass: 105,
            loop: 70,
            synth: 60,
            other: 20,
        };

        const keywordBoosts = [
            { re: /(one[\s\-_]?shot|oneshot)/i, boost: 35 },
            { re: /(kit|drumkit)/i, boost: 18 },
            { re: /(loop|groove|beat)/i, boost: 16 },
            { re: /(stem)/i, boost: 10 },
            { re: /(vocal|vox)/i, boost: 10 },
            { re: /(fx|hit)/i, boost: 6 },
        ];

        const scored = samples.map((s) => {
            const name = (s.name || '').toLowerCase();
            const category = (s.category || '').toLowerCase();
            const type = (s.type || '').toLowerCase();

            let score = (typeScore[type] ?? 0);

            // Prefer obvious musical role keywords (roughly aligns with SampleLibraryService.detectType)
            if (name.includes('kick') || name.includes('bd_')) score += 30;
            if (name.includes('snare') || name.includes('sd_')) score += 30;
            if (name.includes('hat')) score += 20;
            if (name.includes('clap')) score += 15;
            if (name.includes('vocal') || name.includes('vox')) score += 15;
            if (name.includes('bass') || name.includes('sub')) score += 22;

            // Small diversity: category name contribution
            if (category && category !== 'uncategorized') score += 6;

            // Keyword-based boosts
            for (const k of keywordBoosts) {
                if (k.re.test(name)) score += k.boost;
            }

            // Ensure stable ordering: slight tie-break by string hash
            const hash = (name.length ? name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 0) % 1000;
            score += hash / 1000;

            return { s, score };
        });

        scored.sort((a, b) => b.score - a.score);

        // Diversity quotas by type
        const desiredTypes = ['kick', 'snare', 'hihat', 'clap', 'bass', 'vocal', 'loop', 'synth', 'other'];
        const quotas = {
            kick: 3,
            snare: 3,
            hihat: 3,
            clap: 1,
            bass: 3,
            vocal: 2,
            loop: 4,
            synth: 2,
            other: 3,
        };

        const picked = [];
        const pickedByType = {};

        for (const { s } of scored) {
            const t = (s.type || 'other').toLowerCase();
            const wanted = quotas[t] ?? 0;
            if (!wanted) continue;

            pickedByType[t] = pickedByType[t] || 0;
            if (pickedByType[t] < wanted) {
                picked.push(s);
                pickedByType[t] += 1;
            }

            if (picked.length >= targetCount) break;
        }

        // Backfill if quotas were too strict / too few samples
        if (picked.length < targetCount) {
            for (const { s } of scored) {
                if (picked.length >= targetCount) break;
                if (!picked.some((x) => x.path === s.path)) picked.push(s);
            }
        }

        return picked.slice(0, targetCount);
    }

    async init() {
        try {
            // Initialize audio systems
            this.audioEngine = new AudioEngine();
            this.audioLoader = new AudioLoader(this.audioEngine);
            this.transport = new Transport(this.audioEngine);
            this.transport.setSampleBufferProvider((p) => this.audioLoader.getCachedBuffer(p));
            this.sampleBrowser = new SampleBrowser(this.audioEngine, this.audioLoader);
            this.sampleLibrary = new SampleLibraryService();

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
                    .then((r) => {
                        if (r.success && r.samples.length) {
                            // Preload curated choice samples immediately
                            self.choiceSamples = self.pickBestChoiceSamples(r.samples, 24);
                            if (self.uiController) self.uiController.renderChoiceSamples(self.choiceSamples);

                            // Load full list into browser (and render to All Samples list)
                            self.sampleBrowser.loadFromPaths(r.samples);

                            if (self.sampleLibrary) self.sampleLibrary.setSamples(r.samples);
                        }
                    })
                    .catch((e) => { console.log("Samples not found:", e); });
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
            // Keep preloaded choice samples visible; render full list into "All Samples"
            this.uiController.renderSampleList(samples, 'all');
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

        // This app's HTML currently uses static track/mixer markup.
        // Only use dynamic renderers if the corresponding containers exist.
        const tracksListEl = document.getElementById('tracks-list');
        const mixerTracksEl = document.getElementById('mixer-tracks');

        if (tracksListEl) {
            this.uiController.renderTracks(this.audioEngine.tracks);
        } else {
            this.uiController.setupStaticTracks(this.audioEngine.tracks);
        }

        if (mixerTracksEl) {
            this.uiController.renderMixer(this.audioEngine.tracks);
        } else {
            this.uiController.setupStaticMixer(this.audioEngine.tracks);
        }
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
        this.setupFileMenu();
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
        // Quick-access toolbar buttons delegate to the central _fileAction dispatcher
        const btnNew  = document.getElementById('btn-new');
        const btnSave = document.getElementById('btn-save');
        const btnOpen = document.getElementById('btn-open');

        if (btnNew)  btnNew.addEventListener('click',  () => this._fileAction('new'));
        if (btnSave) btnSave.addEventListener('click', () => this._fileAction('save'));
        if (btnOpen) btnOpen.addEventListener('click', () => this._fileAction('open'));

        // Double-click project name to rename inline
        const projectName = document.getElementById('project-name');
        if (projectName) {
            projectName.addEventListener('dblclick', () => this._fileAction('rename'));
        }
    }

    // ─── File Menu Dropdown ───────────────────────────────────────────────────

    setupFileMenu() {
        const trigger  = document.getElementById('btn-file-menu');
        const dropdown = document.getElementById('file-dropdown');
        if (!trigger || !dropdown) return;

        // Toggle on trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            this._closeAllDropdowns();
            if (!isOpen) {
                dropdown.classList.add('open');
                this._populateRecentProjects();
            }
        });

        // Close when clicking outside
        document.addEventListener('click', () => this._closeAllDropdowns());
        dropdown.addEventListener('click', (e) => e.stopPropagation());

        // Wire menu items (skip 'recent' — handled by CSS hover submenu)
        dropdown.querySelectorAll('.file-dropdown-item[data-action]').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action === 'recent') return;
                this._closeAllDropdowns();
                this._fileAction(action);
            });
        });

        // Recent project sub-items (delegated)
        document.addEventListener('click', (e) => {
            const sub = e.target.closest('.recent-project-item');
            if (sub) { this._closeAllDropdowns(); this._fileAction('load-recent', sub.dataset.name); }
        });

        // Alt+F toggles the menu
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyF') {
                e.preventDefault();
                trigger.click();
            }
        });
    }

    _closeAllDropdowns() {
        document.querySelectorAll('.file-dropdown.open').forEach(d => d.classList.remove('open'));
    }

    _populateRecentProjects() {
        const list = document.getElementById('recent-projects-list');
        if (!list) return;
        const recent = this.app.projectManager.getRecentProjects();
        if (!recent.length) {
            list.innerHTML = '<div class="file-dropdown-item file-dropdown-empty">No recent projects</div>';
            return;
        }
        list.innerHTML = recent.map(name =>
            `<div class="file-dropdown-item recent-project-item" data-name="${name.replace(/"/g, '&quot;')}">
                <span class="fd-icon">🎵</span>
                <span class="fd-label">${name}</span>
             </div>`
        ).join('');
    }

    // ─── Central file action dispatcher ──────────────────────────────────────

    async _fileAction(action, data) {
        const pm  = this.app.projectManager;
        const api = window.electronAPI;

        switch (action) {

            case 'new': {
                if (pm.unsavedChanges && !confirm('New project? Unsaved changes will be lost.')) return;
                const name = prompt('Project name:', 'Beats2026') || 'Beats2026';
                pm.newProject(name);
                pm.addToRecent(name);
                break;
            }

            case 'open': {
                if (pm.unsavedChanges && !confirm('Open project? Unsaved changes will be lost.')) return;
                const result = await pm.openFromDialog();
                if (result && !result.success && !result.canceled) {
                    await this._showProjectListPicker(); // Fallback when no Electron dialog
                }
                break;
            }

            case 'save': {
                const project = pm.getCurrentProject();
                try {
                    if (api) {
                        const r = await api.invoke('save-project', project);
                        if (r.success) {
                            pm.addToRecent(project.name);
                            pm.unsavedChanges = false;
                            this.clearUnsavedIndicator();
                            this.showNotification(`Saved: ${project.name}`, 'success');
                            return;
                        }
                    }
                } catch (_) {}
                pm.saveCurrentProject(); // localStorage fallback
                break;
            }

            case 'save-as': {
                const current = document.getElementById('project-name')?.textContent || 'Beats2026';
                const newName = prompt('Save As:', current);
                if (!newName) return;
                const r = await pm.saveProjectAs(newName);
                if (r?.success && !r?.canceled) {
                    document.getElementById('project-name').textContent = newName;
                    this.clearUnsavedIndicator();
                    this.showNotification(`Saved as: ${newName}`, 'success');
                }
                break;
            }

            case 'rename': {
                const el = document.getElementById('project-name');
                if (!el) return;
                const newName = prompt('Rename project:', el.textContent);
                if (newName && newName !== el.textContent) {
                    el.textContent = newName;
                    pm.markUnsaved();
                    this.showNotification(`Renamed to: ${newName}`, 'info');
                }
                break;
            }

            case 'load-recent': {
                if (!data) return;
                if (pm.unsavedChanges && !confirm(`Load "${data}"? Unsaved changes will be lost.`)) return;
                const r = await pm.loadProjectByName(data);
                if (!r.success) this.showNotification(`Failed to load: ${data}`, 'error');
                break;
            }

            case 'all-projects': {
                await this._showProjectListPicker();
                break;
            }

            case 'import': {
                if (!api) { this.showNotification('Import requires desktop app.', 'error'); return; }
                const r = await api.invoke('load-samples-directory');
                if (r.success && r.samples?.length) {
                    this.app.sampleBrowser.loadFromPaths(r.samples);
                    if (this.app.sampleLibrary) this.app.sampleLibrary.setSamples(r.samples);
                    this.showNotification(`Imported ${r.samples.length} samples.`, 'success');
                } else if (r.success) {
                    this.showNotification('No audio files found in that folder.', 'info');
                }
                break;
            }

            case 'export': {
                this.showNotification('Bouncing mix…', 'info');
                await this._exportMix();
                break;
            }

            case 'settings': {
                // Scroll inspector to bottom to reveal settings section
                const inspector = document.getElementById('inspector-content');
                if (inspector) inspector.scrollTop = inspector.scrollHeight;
                this.showNotification('Settings: adjust parameters in the Inspector panel →', 'info');
                break;
            }

            case 'quit': {
                if (pm.unsavedChanges) {
                    const save = confirm('Save before quitting?');
                    if (save) await this._fileAction('save');
                }
                if (api) api.invoke('quit-app').catch(() => window.close());
                else window.close();
                break;
            }
        }
    }

    // ─── Project list picker (fallback for when no OS dialog) ────────────────

    async _showProjectListPicker() {
        try {
            const projects = await this.app.projectManager.listAllProjects();
            if (!projects.length) { this.showNotification('No saved projects found.', 'info'); return; }
            const list = projects.map((p, i) => `${i + 1}. ${p}`).join('\n');
            const input = prompt(`Saved projects — type name to load:\n\n${list}`);
            if (input && projects.includes(input.trim())) {
                await this.app.projectManager.loadProjectByName(input.trim());
            }
        } catch { this.showNotification('Could not list projects.', 'error'); }
    }

    // ─── WAV export via OfflineAudioContext ───────────────────────────────────

    async _exportMix() {
        try {
            const sampleRate = 44100;
            const duration   = 8; // seconds
            const offline    = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
            const gain       = offline.createGain();
            gain.gain.value  = 0.9;
            gain.connect(offline.destination);

            const rendered  = await offline.startRendering();
            const wav       = this._bufferToWav(rendered);
            const url       = URL.createObjectURL(wav);
            const a         = document.createElement('a');
            a.href          = url;
            const pName     = document.getElementById('project-name')?.textContent || 'mix';
            a.download      = `${pName.replace(/\s+/g, '_')}_export.wav`;

            // Some Electron builds require the click to happen after being in DOM.
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            this.showNotification('Mix exported to Downloads!', 'success');
        } catch (e) {
            const msg = e?.message || String(e);
            this.showNotification('Export failed: ' + msg, 'error');
        }
    }


    _bufferToWav(buf) {
        if (!buf) throw new Error('No audio buffer to export');
        const ch  = buf.numberOfChannels;
        const sr  = buf.sampleRate;
        if (!Number.isFinite(sr) || sr <= 0) throw new Error('Invalid sample rate');
        if (!Number.isFinite(buf.length) || buf.length <= 0) throw new Error('Rendered buffer is empty');

        const len = buf.length * ch * 2;
        const ab  = new ArrayBuffer(44 + len);
        const v   = new DataView(ab);
        const s   = (o, t) => { for (let i=0;i<t.length;i++) v.setUint8(o+i, t.charCodeAt(i)); };
        s(0,'RIFF'); v.setUint32(4,36+len,true); s(8,'WAVE'); s(12,'fmt ');
        v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,ch,true);
        v.setUint32(24,sr,true); v.setUint32(28,sr*ch*2,true); v.setUint16(32,ch*2,true);
        v.setUint16(34,16,true); s(36,'data'); v.setUint32(40,len,true);
        let o=44;
        for (let i=0;i<buf.length;i++) for (let c=0;c<ch;c++) {
            const x = Math.max(-1,Math.min(1,buf.getChannelData(c)[i]));
            v.setInt16(o, x<0 ? x*32768 : x*32767, true); o+=2;
        }
        return new Blob([ab], {type:'audio/wav'});
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
        const choicePool = this.app.choiceSamples || [];

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
                return { query: prompt, choiceSamples: choicePool };
            case 'find-kicks':
                return { query: 'kick', choiceSamples: choicePool };
            case 'find-snares':
                return { query: 'snare', choiceSamples: choicePool };
            case 'find-bass':
                return { query: 'bass', choiceSamples: choicePool };
            case 'find-vocals':
                return { query: 'vocal', choiceSamples: choicePool };
            case 'random-inspiration':
                return { query: '', choiceSamples: choicePool };

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
            const ctrl = e.ctrlKey || e.metaKey;

            // Space: Play/Pause
            if (e.code === 'Space' && !this.isInputFocused()) {
                e.preventDefault();
                if (this.app.transport.isPlaying) this.app.transport.pause();
                else this.app.transport.play();
            }

            // Ctrl+S: Save
            if (ctrl && !e.shiftKey && e.code === 'KeyS') {
                e.preventDefault();
                this._fileAction('save');
            }

            // Ctrl+Shift+S: Save As
            if (ctrl && e.shiftKey && e.code === 'KeyS') {
                e.preventDefault();
                this._fileAction('save-as');
            }

            // Ctrl+N: New
            if (ctrl && e.code === 'KeyN') {
                e.preventDefault();
                this._fileAction('new');
            }

            // Ctrl+O: Open
            if (ctrl && e.code === 'KeyO') {
                e.preventDefault();
                this._fileAction('open');
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

    setupStaticTracks(tracks) {
        const clipAreas = [
            { trackId: 'track-1', elId: 'track-1-clips' },
            { trackId: 'track-2', elId: 'track-2-clips' },
            { trackId: 'track-3', elId: 'track-3-clips' },
        ];

        for (const { trackId, elId } of clipAreas) {
            const clipsArea = document.getElementById(elId);
            if (!clipsArea) continue;

            // Drag/drop (add sample clips)
            clipsArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                clipsArea.style.backgroundColor = 'rgba(0, 136, 255, 0.1)';
            });

            clipsArea.addEventListener('dragleave', () => {
                clipsArea.style.backgroundColor = '';
            });

            clipsArea.addEventListener('drop', (e) => {
                e.preventDefault();
                clipsArea.style.backgroundColor = '';
                const data = e.dataTransfer.getData('application/json');
                if (!data) return;

                const sampleData = JSON.parse(data);
                if (sampleData.type === 'sample') {
                    this.app.sampleBrowser.addSampleToTrack(sampleData.path, trackId, 0);
                    this.app.markProjectModified();
                }
            });
        }
    }

    setupStaticMixer(tracks) {
        // Wire mute/solo buttons that exist in index.html.
        // Header buttons:
        const headerMuteSolo = [
            { trackId: 'track-1', headerId: 'track-header-1' },
            { trackId: 'track-2', headerId: 'track-header-2' },
            { trackId: 'track-3', headerId: 'track-header-3' },
        ];

        for (const { trackId, headerId } of headerMuteSolo) {
            const header = document.getElementById(headerId);
            if (!header) continue;

            const muteBtn = header.querySelector('.track-btn-mute');
            const soloBtn = header.querySelector('.track-btn-solo');

            muteBtn?.addEventListener('click', () => {
                const track = this.app.audioEngine.getTrackById?.(trackId);
                if (track) track.isMuted = !track.isMuted;
                this.app.audioEngine.setTrackMute(trackId, !!track?.isMuted);
                muteBtn.classList.toggle('active', !!track?.isMuted);
                this.app.markProjectModified();
            });

            soloBtn?.addEventListener('click', () => {
                const track = this.app.audioEngine.getTrackById?.(trackId);
                if (track) track.isSolo = !track.isSolo;
                this.app.audioEngine.setTrackSolo(trackId, !!track?.isSolo);
                soloBtn.classList.toggle('active', !!track?.isSolo);
                this.app.markProjectModified();
            });
        }

        // Mixer panel faders/buttons:
        const mixerChannels = [
            { trackId: 'track-1', faderIndex: 1, meterId: 'fader-value-1', channelIndex: 0 },
            { trackId: 'track-2', faderIndex: 2, meterId: 'fader-value-2', channelIndex: 1 },
            { trackId: 'track-3', faderIndex: 3, meterId: 'fader-value-3', channelIndex: 2 },
        ];

        const mixerPanel = document.querySelector('.mixer-panel .mixer-content');
        if (!mixerPanel) return;

        const channels = mixerPanel.querySelectorAll('.mixer-channel');
        mixerChannels.forEach((cfg, i) => {
            const channelEl = channels[cfg.channelIndex] || channels[i];
            if (!channelEl) return;

            const fader = channelEl.querySelector('.mixer-fader');
            const muteBtn = channelEl.querySelector('.mixer-btn-mute');
            const soloBtn = channelEl.querySelector('.mixer-btn-solo');
            const valueEl = document.getElementById(cfg.meterId);

            fader?.addEventListener('input', (e) => {
                const db = parseInt(e.target.value);
                this.app.audioEngine.setTrackVolume(cfg.trackId, db);
                if (valueEl) valueEl.textContent = `${db} dB`;
                this.app.markProjectModified();
            });

            muteBtn?.addEventListener('click', () => {
                const track = this.app.audioEngine.getTrackById?.(cfg.trackId);
                if (track) track.isMuted = !track.isMuted;
                this.app.audioEngine.setTrackMute(cfg.trackId, !!track?.isMuted);
                muteBtn.classList.toggle('active', !!track?.isMuted);
                this.app.markProjectModified();
            });

            soloBtn?.addEventListener('click', () => {
                const track = this.app.audioEngine.getTrackById?.(cfg.trackId);
                if (track) track.isSolo = !track.isSolo;
                this.app.audioEngine.setTrackSolo(cfg.trackId, !!track?.isSolo);
                soloBtn.classList.toggle('active', !!track?.isSolo);
                this.app.markProjectModified();
            });
        });
    }

    renderChoiceSamples(samples) {
        // Dedicated pinned section in the Samples tab
        const list = document.getElementById('choice-samples-list');
        if (!list) return;
        this.renderSampleList(samples, 'choice');
    }

    renderSampleList(samples, mode = 'all') {
        // mode:
        //  - 'choice' → #choice-samples-list (preloaded/pinned)
        //  - 'all'    → #all-samples-list (full library)
        let list = null;

        if (mode === 'choice') list = document.getElementById('choice-samples-list');
        if (mode === 'all') list = document.getElementById('all-samples-list');

        // Back-compat fallback
        if (!list) list = document.getElementById('samples-list') || document.getElementById('samples-tree');
        if (!list) return;

        list.innerHTML = '';
        (samples || []).forEach(file => {
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

// Surface runtime errors (so "nothing works" becomes actionable)
window.addEventListener('error', (e) => {
    try {
        console.error('[Renderer Error]', e.error || e.message);
    } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
    try {
        console.error('[Unhandled Rejection]', e.reason || e);
    } catch (_) {}
});

// Initialize app when DOM is ready
const startApp = () => {
    try {
        window.daw = new DAWApplication();
    } catch (e) {
        console.error('[DAW init failure]', e);
        alert('DAW init failure: ' + (e?.message || e));
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startApp());
} else {
    startApp();
}
