
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { DAWAgentService } = require('./ai/agents/daw-agent.service');

// ─────────────────────────────────────────────────────────────────────────────
// Paths — use process.env directly to avoid calling app.getPath before setPath
// ─────────────────────────────────────────────────────────────────────────────
const appDataBase = process.env.APPDATA
    || path.join(require('os').homedir(), 'AppData', 'Roaming');
const localAppDataBase = process.env.LOCALAPPDATA
    || path.join(require('os').homedir(), 'AppData', 'Local');

const userDataDir    = path.join(appDataBase,      'electron-daw');
const sessionDataDir = path.join(localAppDataBase, 'electron-daw', 'session-data');
const cacheDir       = path.join(sessionDataDir,   'cache');

// Set custom paths BEFORE any Chromium initialisation
app.setPath('userData',    userDataDir);
app.setPath('sessionData', sessionDataDir);

// Suppress "Unable to move the cache: Access is denied" errors on Windows.
// GPU shader cache and network cache both trigger this when Chromium tries to
// migrate an existing cache to the new sessionData path.
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-dir', cacheDir);

// Suppress "Passthrough is not supported, GL is disabled, ANGLE is ..."
// Windows software rendering fallback — explicitly route to SwiftShader so
// Chromium doesn't attempt native OpenGL passthrough and then warn about it.
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// Create directories up front so Chromium never needs to move anything
fs.mkdirSync(userDataDir,    { recursive: true });
fs.mkdirSync(sessionDataDir, { recursive: true });
fs.mkdirSync(cacheDir,       { recursive: true });
fs.mkdirSync(path.join(userDataDir, 'projects'), { recursive: true });

// Remove stale cache dirs that Chromium would otherwise try (and fail) to migrate
for (const stale of ['Cache', 'Code Cache', 'GPUCache']) {
    const stalePath = path.join(sessionDataDir, stale);
    if (fs.existsSync(stalePath)) {
        try { fs.rmSync(stalePath, { recursive: true, force: true }); } catch (_) {}
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional MongoDB
// ─────────────────────────────────────────────────────────────────────────────
try {
    const mongoose = require('mongoose');
    require('./mongodb_schema');
    mongoose.set('strictQuery', false);
    mongoose.connect('mongodb://localhost:27017/electronDAW', {
        useNewUrlParser: true, useUnifiedTopology: true,
    })
        .then(() => console.log('MongoDB connected'))
        .catch(err => console.log('MongoDB not available - continuing without DB:', err?.message || err));
} catch (e) {
    console.log('Mongoose module not found, continuing without DB');
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Window
// ─────────────────────────────────────────────────────────────────────────────
const dawAI = new DAWAgentService();

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
    });
    win.loadFile(path.join(__dirname, 'index.html'));
    // win.webContents.openDevTools(); // Uncomment to debug renderer
};

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC Handlers  (renderer uses window.electronAPI.invoke(channel, data))
// ─────────────────────────────────────────────────────────────────────────────

ipcMain.handle('list-projects', async () => {
    try {
        const projectsDir = path.join(userDataDir, 'projects');
        const files = fs.readdirSync(projectsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
        return { success: true, projects: files };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-project', async (_e, projectData) => {
    try {
        const name = (projectData.name || 'project').replace(/[^\w\s-]/g, '_');
        const savePath = path.join(userDataDir, 'projects', `${name}.json`);
        fs.writeFileSync(savePath, JSON.stringify(projectData, null, 2), 'utf8');
        return { success: true, message: `Saved: ${name}` };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('load-project', async (_e, projectName) => {
    try {
        const loadPath = path.join(userDataDir, 'projects', `${projectName}.json`);
        const data = JSON.parse(fs.readFileSync(loadPath, 'utf8'));
        return { success: true, project: data };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('load-audio-file', async (_e, filePath) => {
    try {
        const buffer = fs.readFileSync(filePath);
        return { success: true, buffer: buffer.buffer.slice(0) };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('load-samples-directory', async (_e, dirPath) => {
    try {
        // If no path given, show a folder picker
        let targetDir = dirPath;
        if (!targetDir) {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select Samples Folder',
            });
            if (result.canceled || !result.filePaths.length) {
                return { success: true, samples: [] };
            }
            targetDir = result.filePaths[0];
        }
        if (!fs.existsSync(targetDir)) return { success: true, samples: [] };
        const files = fs.readdirSync(targetDir)
            .filter(f => /\.(wav|mp3|ogg|flac|aif|aiff)$/i.test(f))
            .map(f => ({ name: f, path: path.join(targetDir, f) }));
        return { success: true, samples: files };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('ai-list-commands', async () => {
    return {
        success: true,
        commands: [
            // Drum generation
            'generate-drum-pattern',
            'make-trap-drum-pattern',

            // Bass generation
            'create-bassline',
            'generate-bassline-in-key',

            // Melody / harmony
            'create-melody-from-chords',
            'create-8-bar-melody',
            'generate-chord-progression',

            // Full track / arrangement
            'generate-full-idea',
            'ai-arrangement-suggestions',

            // Conversational / diagnostics
            'explain-mix-needs',
            'fix-timing',
        ],
    };
});

ipcMain.handle('ai-run-command', async (_e, request = {}) => {
    try {
        const command = request.command;
        const payload = request.payload || {};
        const result = await dawAI.runCommand(command, payload);
        return { success: true, result };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
