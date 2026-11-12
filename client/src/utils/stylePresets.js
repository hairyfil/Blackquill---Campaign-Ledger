// Built-in styles shipped with the client. Style files found on the server
// (system/styles/) are listed alongside these; a server file with the same
// file name replaces the preset.
export const STYLE_KEYS = ['primary', 'secondary', 'accent', 'accentText', 'highlight', 'text', 'cardBg', 'cardText', 'dmWarning', 'fontHeader', 'fontBody'];

export const STYLE_PRESETS = [
  {
    file: 'default-style.json', name: 'Default', builtIn: true, description: 'Ink black and old gold.',
    primary: '#1C1C1E', secondary: '#2A2D34', accent: '#C2A96A', accentText: '#1c1a16', highlight: '#4DA3FF', text: '#EAE6D6',
    cardBg: '#F0E4C6', cardText: '#1f1a14', dmWarning: '#C94A4A', fontHeader: 'Cinzel, Georgia, serif', fontBody: 'Inter, Arial, sans-serif'
  },
  {
    file: 'builtin-parchment-day.json', name: 'Parchment Day', builtIn: true, description: 'Light theme for bright rooms.',
    primary: '#F4ECDA', secondary: '#E8DCC0', accent: '#8A5A1F', accentText: '#FFF8EA', highlight: '#2F5FA8', text: '#2A2118',
    cardBg: '#FFFBF2', cardText: '#2A2118', dmWarning: '#B3261E', fontHeader: 'Cinzel, Georgia, serif', fontBody: 'Inter, Arial, sans-serif'
  },
  {
    file: 'builtin-emerald-grove.json', name: 'Emerald Grove', builtIn: true, description: 'Deep forest greens.',
    primary: '#0F1F17', secondary: '#173326', accent: '#6FCF8F', accentText: '#0B1A12', highlight: '#9BE7FF', text: '#E3F2E6',
    cardBg: '#E2EFE4', cardText: '#10241A', dmWarning: '#E0703A', fontHeader: 'Georgia, serif', fontBody: 'Inter, Arial, sans-serif'
  },
  {
    file: 'builtin-frost-arcane.json', name: 'Frost Arcane', builtIn: true, description: 'Midnight blue and spell-light.',
    primary: '#0D1424', secondary: '#18233D', accent: '#7AA2FF', accentText: '#0A1020', highlight: '#C79BFF', text: '#E6ECFF',
    cardBg: '#E8EEFF', cardText: '#0D1424', dmWarning: '#FF5C8A', fontHeader: 'Cinzel, Georgia, serif', fontBody: 'Inter, Arial, sans-serif'
  },
  {
    file: 'builtin-crimson-keep.json', name: 'Crimson Keep', builtIn: true, description: 'Blood red and iron.',
    primary: '#1A1012', secondary: '#2E1A1E', accent: '#D9534F', accentText: '#FFF1F0', highlight: '#F0B35A', text: '#F3E6E4',
    cardBg: '#F3E3DC', cardText: '#2A1214', dmWarning: '#FF7A45', fontHeader: 'Cinzel, Georgia, serif', fontBody: 'Inter, Arial, sans-serif'
  },
  {
    file: 'builtin-shadowfell.json', name: 'Shadowfell', builtIn: true, description: 'Violet dusk and pale bone.',
    primary: '#15121C', secondary: '#241E30', accent: '#B48CFF', accentText: '#150F22', highlight: '#7FE0D0', text: '#ECE6F5',
    cardBg: '#ECE6F2', cardText: '#1C1626', dmWarning: '#FF6B6B', fontHeader: 'Georgia, serif', fontBody: 'Inter, Arial, sans-serif'
  }
];

// Server files win; presets fill in anything the server does not provide.
export function mergeStyles(serverStyles = []) {
  const byFile = new Map();
  STYLE_PRESETS.forEach((s) => byFile.set(s.file, s));
  serverStyles.forEach((s) => { if (s?.file) { const preset = byFile.get(s.file); byFile.set(s.file, { ...(preset || {}), ...s, builtIn: Boolean(preset?.builtIn) }); } });
  return Array.from(byFile.values());
}

// Only theme keys become CSS variables. Keys a style omits fall back to the stylesheet defaults.
export function applyStyleVars(style) {
  const root = document.documentElement;
  STYLE_KEYS.forEach((k) => {
    const v = style?.[k];
    if (v) root.style.setProperty(`--${k}`, v); else root.style.removeProperty(`--${k}`);
  });
}

export function savedStyle() {
  try { return JSON.parse(localStorage.getItem('blackquill-style') || 'null'); } catch { return null; }
}
