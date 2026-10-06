// Minimal, explicit bridge from the web UI to the desktop shell.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("reframerDesktop", {
  isDesktop: true,
  platform: process.platform,
  /** Reveals a finished export in Explorer / Finder. */
  showItemInFolder: (filePath) => ipcRenderer.invoke("reframer:show-item", filePath),
});
