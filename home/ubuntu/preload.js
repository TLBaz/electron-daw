// Preload script - exposes Electron APIs to renderer process
// contextIsolation: true — everything must go through contextBridge

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_CHANNELS = [
    'list-projects',
    'save-project',
    'load-project',
    'load-audio-file',
    'load-samples-directory',
    'ai-run-command',
    'ai-list-commands',
];

contextBridge.exposeInMainWorld('electronAPI', {
    // Flag the renderer can check to confirm preload loaded
    preloadReady: true,

    // invoke: request/response (pairs with ipcMain.handle in main process)
    invoke: (channel, data) => {
        if (ALLOWED_CHANNELS.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
        return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    },

    // send: fire-and-forget (kept for legacy compatibility)
    send: (channel, data) => {
        if (ALLOWED_CHANNELS.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    // on: listen for messages pushed from main process
    on: (channel, callback) => {
        if (ALLOWED_CHANNELS.includes(channel)) {
            ipcRenderer.on(channel, (_event, data) => callback(data));
        }
    },
});

console.log('[preload] Electron API exposed to renderer');

