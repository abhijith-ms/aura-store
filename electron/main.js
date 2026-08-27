import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import '../server/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const VIEW = process.env.AURA_VIEW || '';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '..', 'assets', 'aura-store.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://localhost:${PORT}${VIEW}`);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
