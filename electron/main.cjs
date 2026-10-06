// Reframer desktop shell.
//
// Runs Reframer's local server (the Next.js app in standalone mode) as a child
// process using Electron's bundled Node, then opens it in a window. Everything
// stays on this machine: projects, keys and renders live in the user's app
// data folder, and the server only listens on 127.0.0.1.

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const DEV_URL = process.env.REFRAMER_DEV_URL;
const isDev = Boolean(DEV_URL);

/** @type {import("node:child_process").ChildProcess | null} */
let server = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let baseUrl = "";

const logFile = () => path.join(app.getPath("logs"), "server.log");
const log = (chunk) => {
  try {
    fs.mkdirSync(path.dirname(logFile()), { recursive: true });
    fs.appendFileSync(logFile(), chunk);
  } catch {
    // logging must never crash the app
  }
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const waitForServer = async (url, timeoutMs = 90_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (server && server.exitCode !== null) throw new Error(`The local server exited (code ${server.exitCode}). See ${logFile()}`);
    try {
      const res = await fetch(`${url}/api/settings`);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`The local server didn't start within ${timeoutMs / 1000}s. See ${logFile()}`);
};

const startServer = async () => {
  if (isDev) return DEV_URL;
  const root = path.join(process.resourcesPath, "app-server");
  const port = await freePort();
  server = spawn(process.execPath, [path.join(root, "server.js")], {
    cwd: root,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      REFRAMER_DATA_DIR: path.join(app.getPath("userData"), "data"),
      REFRAMER_REMOTION_BUNDLE: path.join(process.resourcesPath, "remotion-bundle"),
      REFRAMER_DESKTOP: "1",
    },
  });
  server.stdout?.on("data", log);
  server.stderr?.on("data", log);
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
};

const isAppUrl = (url) => {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#16171b",
    title: "Reframer",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Links to the outside world open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: "allow" };
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });

  void mainWindow.loadURL(baseUrl);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

const buildMenu = () => {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Open data folder", click: () => shell.openPath(path.join(app.getPath("userData"), "data")) },
        { label: "Open server log", click: () => shell.openPath(logFile()) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// Renderer helpers (exposed through preload.cjs).
ipcMain.handle("reframer:show-item", (_event, filePath) => {
  if (typeof filePath === "string" && fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});

const stopServer = () => {
  if (server && server.exitCode === null) server.kill();
  server = null;
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    try {
      baseUrl = await startServer();
    } catch (err) {
      dialog.showErrorBox("Reframer couldn't start", err instanceof Error ? err.message : String(err));
      app.quit();
      return;
    }
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", stopServer);
  process.on("exit", stopServer);
}
