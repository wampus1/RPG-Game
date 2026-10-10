// (Round 81) Tessera as a desktop app: the game in a window of its own,
// its server (the game's files, the LAN relay, finding worlds nearby: see
// tools/server.mjs) running inside it, and everything it keeps kept in
// its own data folder (see data.js): on Windows,
// %APPDATA%\Tessera (saves in its saves folder).
//
// Run from the game's folder with `npm run app`; built into Tessera.exe,
// an installer, with `npm run dist:win` (see README).
import { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
import { startServer } from '../tools/server.mjs';
import { DataFolder } from './data.js';
import { findOldStores, readOldStore, readExportFile, describe } from './carry.js';
import { GAME_VERSION } from '../src/version.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Its data folder: %APPDATA%\Tessera (Windows), ~/.config/Tessera (Linux),
// ~/Library/Application Support/Tessera (Mac). (TESSERA_APP_DATA: another,
// for trying things out.)
app.setName('Tessera');
app.setPath('userData', process.env.TESSERA_APP_DATA ? path.resolve(process.env.TESSERA_APP_DATA) : path.join(app.getPath('appData'), 'Tessera'));
if (process.platform === 'win32') app.setAppUserModelId('com.tessera.game');

let win = null;
let data = null;
let srv = null;
// (The window's close, once the game's said it may: see the close below.)
let closing = false;
let ackTimer = null;

// One copy at a time (two would write the same saves): a second one just
// brings this one forward.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(boot);
}

async function boot() {
  data = new DataFolder(app.getPath('userData'));
  Menu.setApplicationMenu(null);
  try {
    srv = await startServer({
      root,
      // (8080, as `npm start` uses, so friends join at the same address;
      // the next free one if that's taken.)
      port: Number(process.env.TESSERA_PORT) || 8080,
      tries: 12,
      // (Friends' machines' accounts, kept for them; this machine's own
      // worlds are the app's, in its data folder.)
      dataDir: path.join(data.dir, 'lan'),
      localSaves: false,
      lan: process.env.TESSERA_LAN !== 'off',
      log: (m) => console.log(m),
    });
  } catch (e) {
    dialog.showErrorBox('Tessera', `The game couldn't start: ${e && e.message ? e.message : e}`);
    app.exit(1);
    return;
  }
  listen();
  openWindow();
}

// ------------------------------------------------------------ the window
const STATE = () => path.join(data.dir, 'window.json');

function windowState() {
  let st = {};
  try {
    st = JSON.parse(fs.readFileSync(STATE(), 'utf8')) || {};
  } catch {
    st = {};
  }
  // (Where it was, if that's still on a screen.)
  if (st.x !== undefined && !screen.getAllDisplays().some((d) => st.x + 100 > d.workArea.x && st.x < d.workArea.x + d.workArea.width - 100 && st.y >= d.workArea.y - 20 && st.y < d.workArea.y + d.workArea.height - 100)) {
    delete st.x;
    delete st.y;
  }
  return st;
}

function keepWindowState() {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try {
    fs.writeFileSync(STATE(), JSON.stringify({ ...b, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }));
  } catch {
    // (Next time, its usual size.)
  }
}

function iconPath() {
  for (const p of [path.join(root, 'build', 'icon.png'), path.join(process.resourcesPath || '', 'icon.png')]) if (fs.existsSync(p)) return p;
  return undefined;
}

// The game's own address (anything else opens in your browser).
function ours(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname) && Number(u.port) === srv.port;
  } catch {
    return false;
  }
}

function openWindow() {
  const st = windowState();
  win = new BrowserWindow({
    width: st.width || 1280,
    height: st.height || 760,
    x: st.x,
    y: st.y,
    minWidth: 640,
    minHeight: 400,
    title: 'Tessera',
    backgroundColor: '#07060b',
    icon: iconPath(),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // (Music from the title on, without a click first.)
      autoplayPolicy: 'no-user-gesture-required',
      // (A world you host goes on while the window's minimised: see the
      // timer at the end of src/main.js.)
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => {
    if (st.maximized) win.maximize();
    if (st.fullscreen) win.setFullScreen(true);
    win.show();
  });
  const wc = win.webContents;
  wc.on('will-navigate', (e, url) => {
    if (ours(url)) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) && !ours(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // F11 (or Alt+Enter): the whole screen. F12: the developer tools (for
  // telling what's gone wrong).
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    } else if (input.key === 'F12') {
      wc.toggleDevTools();
      e.preventDefault();
    }
  });
  // (The game asks before it's left with play unsaved, itself: see the
  // close below. Nothing else holds the window open.)
  wc.on('will-prevent-unload', (e) => e.preventDefault());
  wc.on('render-process-gone', (e, d) => {
    if (d.reason === 'clean-exit' || closing) return;
    const r = dialog.showMessageBoxSync(win, { type: 'error', title: 'Tessera', message: 'The game stopped unexpectedly.', detail: `(${d.reason}) What you last saved is safe in your saves folder. Start it again?`, buttons: ['Start again', 'Quit'], defaultId: 0, cancelId: 1 });
    if (r === 0) wc.reload();
    else {
      closing = true;
      win.close();
    }
  });
  // The window's close (its X, Alt+F4, the title's Quit): the game's asked
  // first (with play unsaved, it asks you: save, don't, or back), and
  // says when it's done. (No answer at all, the game not there to give
  // one: it closes.)
  win.on('close', (e) => {
    keepWindowState();
    if (closing || wc.isDestroyed() || wc.isCrashed()) return;
    e.preventDefault();
    wc.send('tessera:close-asked');
    clearTimeout(ackTimer);
    ackTimer = setTimeout(() => {
      closing = true;
      win.close();
    }, 3000);
  });
  win.on('session-end', () => {
    closing = true;
    data.flush();
  });
  win.on('closed', () => {
    win = null;
  });
  win.loadURL(`http://localhost:${srv.port}/`);
}

app.on('window-all-closed', () => app.quit());

// Everything written before it goes.
let settled = false;
app.on('before-quit', (e) => {
  if (settled || !data) return;
  e.preventDefault();
  data.settle().catch(() => {}).finally(() => {
    settled = true;
    Promise.resolve(srv && srv.close()).catch(() => {}).finally(() => app.quit());
    // (A connection that won't close shan't keep it open.)
    setTimeout(() => app.exit(0), 1500).unref();
  });
});

// ------------------------------------------------------------ the page's asks
function listen() {
  // (Only the game's own page asks.)
  const game = (e) => e.senderFrame && ours(e.senderFrame.url);
  const sync = (ch, fn) => ipcMain.on(ch, (e, ...a) => {
    e.returnValue = game(e) ? fn(...a) : null;
  });
  const on = (ch, fn) => ipcMain.on(ch, (e, ...a) => {
    if (!game(e)) return;
    try {
      fn(...a);
    } catch (err) {
      console.error(err);
    }
  });
  const handle = (ch, fn) => ipcMain.handle(ch, (e, ...a) => {
    if (!game(e)) throw new Error('Not the game.');
    return fn(...a);
  });
  sync('tessera:info', () => ({ version: GAME_VERSION, dataDir: data.dir, savesDir: data.savesDir, port: srv.port, platform: process.platform }));
  sync('tessera:kv-all', () => data.all());
  on('tessera:kv-set', (k, v) => data.set(k, v));
  on('tessera:kv-del', (k) => data.del(k));
  handle('tessera:db-get', (k) => data.getBlob(k));
  handle('tessera:db-put', (k, t) => data.putBlob(k, t));
  handle('tessera:db-del', (k) => data.delBlob(k));
  handle('tessera:open-folder', async (which) => {
    const d = which === 'data' ? data.dir : data.savesDir;
    fs.mkdirSync(d, { recursive: true });
    return (await shell.openPath(d)) || null;
  });
  // Worlds from the browser version (see carry.js).
  handle('tessera:carry-find', () => describe(findOldStores({ home: os.homedir(), appRoot: app.isPackaged ? path.dirname(process.execPath) : root, extra: process.env.TESSERA_OLD ? [process.env.TESSERA_OLD] : [] })));
  handle('tessera:carry-read', (dir) => readOldStore(dir));
  handle('tessera:carry-pick', async (kind) => {
    const r = await dialog.showOpenDialog(win, kind === 'file'
      ? { title: 'The file the browser version saved your worlds to', properties: ['openFile'], filters: [{ name: 'Tessera worlds', extensions: ['tessera', 'json', 'gz'] }, { name: 'All files', extensions: ['*'] }] }
      : { title: 'The folder you played the browser version from (or its saves folder)', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths.length) return null;
    return kind === 'file' ? readExportFile(r.filePaths[0]) : readOldStore(r.filePaths[0]);
  });
  on('tessera:close-ack', () => clearTimeout(ackTimer));
  on('tessera:close-now', () => {
    clearTimeout(ackTimer);
    closing = true;
    if (win) win.close();
  });
}
