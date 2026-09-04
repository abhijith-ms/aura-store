/**
 * manualInstalls.js — persistent record of apps installed outside pacman/
 * flatpak (AppImageHub catalog items, manually-added GitHub Releases).
 *
 * Neither `pacman -Q` nor `flatpak list` know about these, so this is the
 * only source of truth for what's installed, at what version, and where its
 * files live — needed for the Installed tab, uninstall, and update checks.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.homedir(), '.config', 'aura');
const STORE_FILE = path.join(STORE_DIR, 'manual-installs.json');

function readAll() {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(list) {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function listManualInstalls() {
  return readAll();
}

export function getManualInstall(id) {
  return readAll().find((e) => e.id === id) || null;
}

export function upsertManualInstall(entry) {
  const list = readAll();
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeAll(list);
  return entry;
}

export function removeManualInstall(id) {
  const list = readAll();
  const next = list.filter((e) => e.id !== id);
  writeAll(next);
  return next.length !== list.length;
}
