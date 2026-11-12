// v1.0.3: one place that decides how BlackQuill looks.
//
// The table's look (style and icon pack) is stored on the server in system/settings.json
// and is used by everyone: the login page, the campaign pages and the Admin Console.
// The DM (Settings > Styles / Icons) and the admin (Admin Console > Settings) change it.
// A player can pick a different style or icon pack for their own browser only; that
// choice wins on that browser until they go back to the table's look.
import { STYLE_PRESETS, STYLE_KEYS, applyStyleVars } from './stylePresets.js';

const STYLE_OVERRIDE_KEY = 'blackquill-my-style';      // { file, ...theme keys }
const ICON_OVERRIDE_KEY = 'blackquill-my-icon-pack';   // pack name
const LEGACY_KEYS = ['blackquill-style', 'blackquill-style-file', 'blackquill-icon-set'];

let instance = { activeStyle: 'default-style.json', activeIconPack: 'default', style: null };
const listeners = new Set();

function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key, value) { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {} }

// Before v1.0.3 every browser kept its own style, which hid the table's style. Drop those once.
LEGACY_KEYS.forEach((k) => write(k, null));

function onlyThemeKeys(style) {
  const out = { file: style?.file || '' };
  STYLE_KEYS.forEach((k) => { if (style?.[k]) out[k] = style[k]; });
  return out;
}

export function presetFor(file) {
  return STYLE_PRESETS.find((p) => p.file === file) || null;
}

// The table's style as a full style object (server file, else built-in preset, else Default).
export function tableStyle() {
  return { ...(presetFor(instance.activeStyle) || STYLE_PRESETS[0]), ...(instance.style || {}), file: instance.activeStyle };
}
export function tableStyleFile() { return instance.activeStyle || 'default-style.json'; }
export function tableIconPack() { return instance.activeIconPack || 'default'; }

export function myStyle() {
  try { return JSON.parse(read(STYLE_OVERRIDE_KEY) || 'null'); } catch { return null; }
}
export function myIconPack() { return read(ICON_OVERRIDE_KEY) || ''; }

// What this browser shows now.
export function currentStyle() { return myStyle() || tableStyle(); }
export function currentStyleFile() { return myStyle()?.file || tableStyleFile(); }
export function currentIconPack() { return myIconPack() || tableIconPack(); }

export function applyCurrentStyle() { applyStyleVars(currentStyle()); }

function changed() { applyCurrentStyle(); listeners.forEach((fn) => { try { fn(); } catch {} }); }
export function onAppearanceChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function loadAppearance() {
  try {
    const res = await fetch('/api/template/appearance');
    if (res.ok) instance = { ...instance, ...(await res.json()) };
  } catch {}
  changed();
  return instance;
}

// DM/admin: change the table's look for everyone. Clears this browser's own choice.
export async function saveTableAppearance(updates) {
  const res = await fetch('/api/template/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Could not save (${res.status})`);
  instance = { ...instance, ...data };
  if (updates.activeStyle !== undefined) write(STYLE_OVERRIDE_KEY, null);
  if (updates.activeIconPack !== undefined) write(ICON_OVERRIDE_KEY, null);
  changed();
  return instance;
}

// Player (or anyone): this browser only. null goes back to the table's look.
export function setMyStyle(style) { write(STYLE_OVERRIDE_KEY, style ? JSON.stringify(onlyThemeKeys(style)) : null); changed(); }
export function setMyIconPack(pack) { write(ICON_OVERRIDE_KEY, pack || null); changed(); }
