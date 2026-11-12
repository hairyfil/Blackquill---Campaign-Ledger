import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHS } from "./filesystem/paths.js";
import { ensureDir, readJson, writeJson } from "./fsdb.js";

// v0.85 SRD browser.
//
// Data: the D&D 5e System Reference Document 5.1 (SRD 5.1) as JSON, from the
// 5e-bits/5e-database project (src/2014/en). v1.0.8: no copy ships with the app.
// The DM imports it from the SRD page: download from GitHub, upload the JSON files,
// or import from a folder (system/srd/import/, or srd-data/5.1/ next to the app).
// Imported data lives in
//   blackquill-common-data/system/srd/
//     srd.json      manifest: edition, source, importedAt, counts
//     5.1/          one JSON file per category (5e-bits file names)
// and is shared by every campaign.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SRD_EDITION = "5.1";
export const BUNDLED_DIR = path.resolve(__dirname, "../../srd-data", SRD_EDITION);
export const IMPORT_DIR = path.join(PATHS.srd, "import");
const DOWNLOAD_BASE = "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en";
const DATA_DIR = path.join(PATHS.srd, SRD_EDITION);
const MANIFEST = path.join(PATHS.srd, "srd.json");

export const ATTRIBUTION = {
  text:
    'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.',
  srdUrl: "https://dnd.wizards.com/resources/systems-reference-document",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/legalcode",
  dataset: "5e-bits/5e-database (MIT License)",
  datasetUrl: "https://github.com/5e-bits/5e-database"
};

const names = (refs) => (Array.isArray(refs) ? refs.map((r) => r?.name).filter(Boolean) : []);
const ordinal = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
export function formatCr(cr) {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr ?? "");
}
const crSort = (v) => (v === "1/8" ? 0.125 : v === "1/4" ? 0.25 : v === "1/2" ? 0.5 : Number(v));
const spellLevel = (l) => (l === 0 ? "Cantrip" : `${ordinal(l)} level`);
const spellLevelSort = (v) => (v === "Cantrip" ? 0 : parseInt(v, 10));
const RARITY = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Varies"];
const raritySort = (v) => { const i = RARITY.indexOf(v); return i < 0 ? 99 : i; };
const cost = (c) => (c?.quantity != null ? `${c.quantity} ${c.unit}` : "");

// key = the URL segment 5e-bits uses in its references ("/api/2014/<key>/<index>"),
// so cross-links inside an entry resolve to the right category.
// primary = shown in the sidebar under SRD.
export const CATEGORIES = [
  { key: "races", label: "Races", file: "Races", group: "Character", primary: true,
    summary: (r) => ({ meta: `${r.size} · speed ${r.speed} ft.`, tags: {} }) },
  { key: "subraces", label: "Subraces", file: "Subraces", group: "Character",
    summary: (r) => ({ meta: r.race?.name || "", tags: {} }) },
  { key: "classes", label: "Classes", file: "Classes", group: "Character", primary: true,
    summary: (c) => ({ meta: `Hit die d${c.hit_die}${c.spellcasting ? " · spellcaster" : ""}`, tags: {} }) },
  { key: "subclasses", label: "Subclasses", file: "Subclasses", group: "Character",
    summary: (s) => ({ meta: s.class?.name || "", tags: { class: s.class?.name } }),
    facets: [{ key: "class", label: "Class" }] },
  { key: "backgrounds", label: "Backgrounds", file: "Backgrounds", group: "Character", primary: true,
    summary: () => ({ meta: "", tags: {} }) },
  { key: "feats", label: "Feats", file: "Feats", group: "Character", primary: true,
    summary: (f) => ({ meta: (f.prerequisites || []).map((p) => `${p.ability_score?.name || ""} ${p.minimum_score || ""}`.trim()).join(", "), tags: {} }) },
  { key: "features", label: "Class Features", file: "Features", group: "Character",
    summary: (f) => ({ meta: [f.class?.name, f.subclass?.name, f.level ? `level ${f.level}` : ""].filter(Boolean).join(" · "), tags: { class: f.class?.name, level: f.level ? String(f.level) : "" } }),
    facets: [{ key: "class", label: "Class" }, { key: "level", label: "Level", sort: Number }] },
  { key: "traits", label: "Racial Traits", file: "Traits", group: "Character",
    summary: (t) => ({ meta: names(t.races).concat(names(t.subraces)).join(", "), tags: { race: names(t.races) } }),
    facets: [{ key: "race", label: "Race" }] },
  { key: "proficiencies", label: "Proficiencies", file: "Proficiencies", group: "Character",
    summary: (p) => ({ meta: p.type || "", tags: { type: p.type } }),
    facets: [{ key: "type", label: "Type" }] },
  { key: "skills", label: "Skills", file: "Skills", group: "Character",
    summary: (s) => ({ meta: s.ability_score?.name || "", tags: {} }) },
  { key: "languages", label: "Languages", file: "Languages", group: "Character",
    summary: (l) => ({ meta: [l.type, l.script].filter(Boolean).join(" · "), tags: { type: l.type } }),
    facets: [{ key: "type", label: "Type" }] },
  { key: "ability-scores", label: "Ability Scores", file: "Ability-Scores", group: "Character",
    summary: (a) => ({ meta: a.full_name || "", tags: {} }) },
  { key: "alignments", label: "Alignments", file: "Alignments", group: "Character",
    summary: (a) => ({ meta: a.abbreviation || "", tags: {} }) },

  { key: "spells", label: "Spells", file: "Spells", group: "Spells & Magic", primary: true,
    summary: (s) => ({
      meta: `${spellLevel(s.level)} ${s.school?.name || ""}${s.ritual ? " (ritual)" : ""}${s.concentration ? " · concentration" : ""}`,
      tags: { level: spellLevel(s.level), school: s.school?.name, class: names(s.classes) }
    }),
    facets: [{ key: "level", label: "Level", sort: spellLevelSort }, { key: "class", label: "Class" }, { key: "school", label: "School" }] },
  { key: "magic-items", label: "Magic Items", file: "Magic-Items", group: "Spells & Magic", primary: true,
    summary: (m) => ({ meta: [m.equipment_category?.name, m.rarity?.name].filter(Boolean).join(" · "), tags: { rarity: m.rarity?.name, type: m.equipment_category?.name } }),
    facets: [{ key: "rarity", label: "Rarity", sort: raritySort }, { key: "type", label: "Type" }] },
  { key: "magic-schools", label: "Schools of Magic", file: "Magic-Schools", group: "Spells & Magic",
    summary: () => ({ meta: "", tags: {} }) },

  { key: "monsters", label: "Monsters", file: "Monsters", group: "Bestiary", primary: true,
    summary: (m) => ({
      meta: `CR ${formatCr(m.challenge_rating)} · ${m.size} ${m.type}`,
      tags: { cr: formatCr(m.challenge_rating), type: m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "", size: m.size }
    }),
    facets: [{ key: "cr", label: "Challenge", sort: crSort }, { key: "type", label: "Type" }, { key: "size", label: "Size", sort: (v) => ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].indexOf(v) }] },

  { key: "equipment", label: "Equipment", file: "Equipment", group: "Equipment", primary: true,
    summary: (e) => ({ meta: [e.equipment_category?.name, cost(e.cost), e.weight != null ? `${e.weight} lb.` : ""].filter(Boolean).join(" · "), tags: { category: e.equipment_category?.name } }),
    facets: [{ key: "category", label: "Category" }] },
  { key: "equipment-categories", label: "Equipment Categories", file: "Equipment-Categories", group: "Equipment",
    summary: (c) => ({ meta: `${(c.equipment || []).length} items`, tags: {} }) },
  { key: "weapon-properties", label: "Weapon Properties", file: "Weapon-Properties", group: "Equipment",
    summary: () => ({ meta: "", tags: {} }) },

  { key: "rules", label: "Rules", file: "Rules", group: "Rules", primary: true,
    summary: (r) => ({ meta: `${(r.subsections || []).length} sections`, tags: {} }) },
  { key: "rule-sections", label: "Rule Sections", file: "Rule-Sections", group: "Rules",
    summary: () => ({ meta: "", tags: {} }) },
  { key: "conditions", label: "Conditions", file: "Conditions", group: "Rules", primary: true,
    summary: () => ({ meta: "", tags: {} }) },
  { key: "damage-types", label: "Damage Types", file: "Damage-Types", group: "Rules",
    summary: () => ({ meta: "", tags: {} }) }
];

// Levels.json is not a browsable category; it feeds the class and subclass tables.
const EXTRA_FILES = ["Levels"];
const ALL_FILES = [...CATEGORIES.map((c) => c.file), ...EXTRA_FILES];
const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));
export const getCategory = (key) => byKey.get(String(key || ""));

// ---------------------------------------------------------------- cache
const cache = new Map();
function clearCache() { cache.clear(); }
function load(file) {
  if (!cache.has(file)) {
    const data = readJson(path.join(DATA_DIR, `${file}.json`), []);
    cache.set(file, Array.isArray(data) ? data : []);
  }
  return cache.get(file);
}

// ---------------------------------------------------------------- status
export const REQUIRED_FILES = ALL_FILES;

// A file may be named "Spells.json" or, as 5e-bits names it, "5e-SRD-Spells.json".
const baseName = (name) => String(name || "").replace(/^.*[\\/]/, "").replace(/\.json$/i, "").replace(/^5e-SRD-/i, "").toLowerCase();
function findInDir(dir, file) {
  for (const n of [`${file}.json`, `5e-SRD-${file}.json`]) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
// The first folder that holds every SRD file, or null.
export function localDir() {
  return [IMPORT_DIR, BUNDLED_DIR].find((d) => ALL_FILES.every((f) => findInDir(d, f))) || null;
}
export function bundledAvailable() { return Boolean(localDir()); }

export function getStatus() {
  const manifest = readJson(MANIFEST, null);
  const imported = Boolean(manifest) && fs.existsSync(DATA_DIR);
  return {
    imported,
    edition: SRD_EDITION,
    manifest: imported ? manifest : null,
    bundledAvailable: bundledAvailable(),
    localAvailable: bundledAvailable(),
    importFolder: IMPORT_DIR,
    requiredFiles: ALL_FILES.map((f) => `${f}.json`),
    attribution: ATTRIBUTION,
    categories: imported
      ? CATEGORIES.map((c) => ({ key: c.key, label: c.label, group: c.group, primary: Boolean(c.primary), count: load(c.file).length }))
      : []
  };
}

// ---------------------------------------------------------------- import
async function download(file) {
  const res = await fetch(`${DOWNLOAD_BASE}/5e-SRD-${file}.json`, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${file}`);
  return res.text();
}

// source: "download" (GitHub), "folder" (localDir()), or "upload" (files: [{ name, text }]).
// "bundled" is the pre-v1.0.8 name for "folder".
export async function importSrd({ source = "folder", user = "", files = [] } = {}) {
  if (source === "bundled") source = "folder";
  if (!["download", "folder", "upload"].includes(source)) throw new Error("Unknown source");
  const dir = source === "folder" ? localDir() : null;
  if (source === "folder" && !dir) throw new Error(`No SRD files found. Put the JSON files in ${IMPORT_DIR}, or use Download or Upload instead.`);
  const uploaded = new Map();
  if (source === "upload") {
    for (const f of files) uploaded.set(baseName(f.name), f.text);
    const missing = ALL_FILES.filter((f) => !uploaded.has(f.toLowerCase()));
    if (missing.length) throw new Error(`These SRD files are missing: ${missing.map((m) => `${m}.json`).join(", ")}`);
  }

  const incoming = path.join(PATHS.srd, ".incoming");
  fs.rmSync(incoming, { recursive: true, force: true });
  ensureDir(incoming);
  const counts = {};
  try {
    for (const file of ALL_FILES) {
      const text = source === "download"
        ? await download(file)
        : source === "upload"
          ? uploaded.get(file.toLowerCase())
          : fs.readFileSync(findInDir(dir, file), "utf8");
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`${file} is not valid JSON`); }
      if (!Array.isArray(data) || !data.length) throw new Error(`${file} has no entries`);
      counts[file] = data.length;
      fs.writeFileSync(path.join(incoming, `${file}.json`), text);
    }
  } catch (err) {
    fs.rmSync(incoming, { recursive: true, force: true });
    throw err;
  }
  // Swap in the new copy only once every file arrived and parsed.
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.renameSync(incoming, DATA_DIR);
  if (source === "folder") {
    const lic = path.join(dir, "LICENSE-5e-database.md");
    if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(DATA_DIR, "LICENSE-5e-database.md"));
  }
  fs.writeFileSync(path.join(DATA_DIR, "ATTRIBUTION.txt"), `${ATTRIBUTION.text}\n\nJSON data: ${ATTRIBUTION.dataset}, ${ATTRIBUTION.datasetUrl}\n`);
  const manifest = {
    edition: SRD_EDITION,
    source: source === "download" ? `Downloaded from ${DOWNLOAD_BASE}` : source === "upload" ? "Uploaded JSON files" : `Imported from ${dir}`,
    dataset: ATTRIBUTION.dataset,
    importedAt: new Date().toISOString(),
    importedBy: user,
    counts
  };
  writeJson(MANIFEST, manifest);
  clearCache();
  return getStatus();
}

export function removeSrd() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(MANIFEST, { force: true });
  clearCache();
  return getStatus();
}

// ---------------------------------------------------------------- browse
export function listCategory(key) {
  const cat = getCategory(key);
  if (!cat) return null;
  const items = load(cat.file)
    .map((it) => {
      const s = cat.summary(it);
      return { index: it.index, name: it.name, meta: s.meta || "", tags: s.tags || {} };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const facets = (cat.facets || []).map((f) => {
    const values = new Set();
    for (const it of items) {
      const v = it.tags[f.key];
      (Array.isArray(v) ? v : [v]).forEach((x) => { if (x !== undefined && x !== null && x !== "") values.add(String(x)); });
    }
    const sorted = [...values].sort((a, b) => (f.sort ? f.sort(a) - f.sort(b) : 0) || a.localeCompare(b));
    return { key: f.key, label: f.label, values: sorted };
  });
  return { key: cat.key, label: cat.label, group: cat.group, items, facets };
}

const ref = (x) => ({ index: x.index, name: x.name });

export function getEntry(key, index) {
  const cat = getCategory(key);
  if (!cat) return null;
  const item = load(cat.file).find((it) => it.index === String(index || ""));
  if (!item) return null;
  const extra = {};
  if (cat.key === "classes") {
    extra.levels = load("Levels").filter((l) => l.class?.index === item.index && !l.subclass).sort((a, b) => a.level - b.level);
    extra.spells = load("Spells").filter((s) => (s.classes || []).some((c) => c.index === item.index))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map((s) => ({ ...ref(s), level: s.level }));
  }
  if (cat.key === "subclasses") {
    extra.levels = load("Levels").filter((l) => l.subclass?.index === item.index).sort((a, b) => a.level - b.level);
  }
  if (cat.key === "magic-schools") {
    extra.spells = load("Spells").filter((s) => s.school?.index === item.index)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map((s) => ({ ...ref(s), level: s.level }));
  }
  if (cat.key === "rules") {
    const sections = load("Rule-Sections");
    extra.sections = (item.subsections || []).map((r) => sections.find((x) => x.index === r.index)).filter(Boolean);
  }
  if (cat.key === "races") {
    extra.subraces = load("Subraces").filter((s) => s.race?.index === item.index).map(ref);
  }
  return { category: { key: cat.key, label: cat.label }, item, extra };
}

export function searchAll(q, limit = 60) {
  const needle = String(q || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const out = [];
  for (const cat of CATEGORIES) {
    for (const it of load(cat.file)) {
      const name = String(it.name || "").toLowerCase();
      if (!name.includes(needle)) continue;
      out.push({ category: cat.key, categoryLabel: cat.label, index: it.index, name: it.name, starts: name.startsWith(needle) });
    }
  }
  out.sort((a, b) => (b.starts - a.starts) || a.name.localeCompare(b.name));
  return out.slice(0, limit).map(({ starts, ...r }) => r);
}
