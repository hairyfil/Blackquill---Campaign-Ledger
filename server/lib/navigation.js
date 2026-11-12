import { PATHS } from "./filesystem/paths.js";
import { ensureFile, readJson, writeJson, slugifyName } from "./fsdb.js";

// Navigation file version. 2 = v0.84.3 (adds House Rules and Rulings).
const NAVIGATION_VERSION = 2;

// DM-only writes, readable by everyone.
const HOUSE_RULES_MENU = { label: "House Rules and Rulings", key: "house-rules-and-rulings", folder: "house-rules-and-rulings", enabled: true, dmWriteOnly: true, subcategories: [
  { label: "House Rules", key: "house-rules", folder: "house-rules", enabled: true },
  { label: "Rulings", key: "rulings", folder: "rulings", enabled: true }
] };

const DEFAULT_NAVIGATION = {
  version: NAVIGATION_VERSION,
  menus: [
    { label: "Dashboard", key: "dashboard", folder: "dashboard", enabled: true, system: true, subcategories: [] },
    { label: "All Entries", key: "all-entries", folder: "all-entries", enabled: true, system: true, subcategories: [] },
    { ...HOUSE_RULES_MENU },
    { label: "Adventure Groups", key: "adventure-groups", folder: "adventure-groups", enabled: true, subcategories: [ { label: "Groups", key: "groups", folder: "groups", enabled: true }, { label: "PCs", key: "pcs", folder: "pcs", enabled: true } ] },
    { label: "Chronicle", key: "chronicle", folder: "chronicle", enabled: true, subcategories: [
      { label: "Session Logs", key: "session-logs", folder: "session-logs", enabled: true },
      { label: "Party Journal", key: "party-journal", folder: "party-journal", enabled: true },
      { label: "Discoveries", key: "discoveries", folder: "discoveries", enabled: true },
      { label: "Rumours", key: "rumours", folder: "rumours", enabled: true },
      { label: "Plans & Schemes", key: "plans-and-schemes", folder: "plans-and-schemes", enabled: true },
      { label: "Loot History", key: "loot-history", folder: "loot-history", enabled: true },
      { label: "Shared Notes", key: "shared-notes", folder: "shared-notes", enabled: true }
    ]},
    { label: "Atlas", key: "atlas", folder: "atlas", enabled: true, subcategories: [
      { label: "World", key: "world", folder: "worlds", enabled: true },
      { label: "Continent", key: "continent", folder: "continents", enabled: true },
      { label: "Region", key: "region", folder: "regions", enabled: true },
      { label: "City", key: "city", folder: "cities", enabled: true },
      { label: "Town", key: "town", folder: "towns", enabled: true },
      { label: "Village", key: "village", folder: "villages", enabled: true },
      { label: "Hamlet", key: "hamlet", folder: "hamlets", enabled: true },
      { label: "Dwelling", key: "dwelling", folder: "dwellings", enabled: true },
      { label: "Site", key: "site", folder: "sites", enabled: true }
    ]},
    { label: "Personae", key: "personae", folder: "personae", enabled: true, subcategories: [
      { label: "Allies", key: "allies", folder: "allies", enabled: true },
      { label: "Enemies", key: "enemies", folder: "enemies", enabled: true },
      { label: "Merchants", key: "merchants", folder: "merchants", enabled: true },
      { label: "Nobility", key: "nobility", folder: "nobility", enabled: true },
      { label: "Religious Figures", key: "religious-figures", folder: "religious-figures", enabled: true },
      { label: "Mercenaries", key: "mercenaries", folder: "mercenaries", enabled: true },
      { label: "Missing / Dead", key: "missing-dead", folder: "missing-dead", enabled: true },
      { label: "Party Contacts", key: "party-contacts", folder: "party-contacts", enabled: true }
    ]},
    { label: "Organisations", key: "organisations", folder: "organisations", enabled: true, subcategories: [
      { label: "Guilds", key: "guilds", folder: "guilds", enabled: true },
      { label: "Noble Houses", key: "noble-houses", folder: "noble-houses", enabled: true },
      { label: "Churches", key: "churches", folder: "churches", enabled: true },
      { label: "Military Forces", key: "military-forces", folder: "military-forces", enabled: true },
      { label: "Criminal Syndicates", key: "criminal-syndicates", folder: "criminal-syndicates", enabled: true },
      { label: "Secret Societies", key: "secret-societies", folder: "secret-societies", enabled: true },
      { label: "Enemy Factions", key: "enemy-factions", folder: "enemy-factions", enabled: true }
    ]},
    { label: "Armory", key: "armory", folder: "armory", enabled: true, subcategories: [
      { label: "Weapons", key: "weapons", folder: "weapons", enabled: true },
      { label: "Armor", key: "armor", folder: "armor", enabled: true },
      { label: "Magic Items", key: "magic-items", folder: "magic-items", enabled: true },
      { label: "Consumables", key: "consumables", folder: "consumables", enabled: true },
      { label: "Quest Items", key: "quest-items", folder: "quest-items", enabled: true },
      { label: "Treasure Hoards", key: "treasure-hoards", folder: "treasure-hoards", enabled: true },
      { label: "Crafting Materials", key: "crafting-materials", folder: "crafting-materials", enabled: true },
      { label: "Party Inventory", key: "party-inventory", folder: "party-inventory", enabled: true }
    ]},
    { label: "Codex", key: "codex", folder: "codex", enabled: true, subcategories: [
      { label: "Rules Reference", key: "rules-reference", folder: "rules-reference", enabled: true },
      { label: "Classes", key: "classes", folder: "classes", enabled: true },
      { label: "Spells", key: "spells", folder: "spells", enabled: true },
      { label: "Conditions", key: "conditions", folder: "conditions", enabled: true },
      { label: "Combat", key: "combat", folder: "combat", enabled: true },
      { label: "Exploration", key: "exploration", folder: "exploration", enabled: true },
      { label: "Downtime", key: "downtime", folder: "downtime", enabled: true },
      { label: "RAW", key: "raw", folder: "raw", enabled: true },
      { label: "RAP", key: "rap", folder: "rap", enabled: true },
      { label: "HBR", key: "hbr", folder: "hbr", enabled: true },
      { label: "Homebrew Rules", key: "homebrew-rules", folder: "homebrew-rules", enabled: true },
      { label: "House Rulings", key: "house-rulings", folder: "house-rulings", enabled: true }
    ]},
    { label: "Quests", key: "quests", folder: "quests", enabled: true, subcategories: [
      { label: "Main Story", key: "main-story", folder: "main-story", enabled: true },
      { label: "Side Quests", key: "side-quests", folder: "side-quests", enabled: true },
      { label: "Completed", key: "completed", folder: "completed", enabled: true },
      { label: "Failed", key: "failed", folder: "failed", enabled: true },
      { label: "Rumoured Hooks", key: "rumoured-hooks", folder: "rumoured-hooks", enabled: true },
      { label: "Timed Events", key: "timed-events", folder: "timed-events", enabled: true }
    ]},
    { label: "Session Archive", key: "session-archive", folder: "session-archive", enabled: true, subcategories: [] },
    { label: "DM Eyes Only", key: "dm-eyes-only", folder: "dm-eyes-only", enabled: true, dmOnly: true, subcategories: [
      { label: "Story Arc", key: "story-arc", folder: "story-arc", enabled: true },
      { label: "Important Story Points", key: "important-story-points", folder: "important-story-points", enabled: true },
      { label: "To-Do List", key: "to-do-list", folder: "to-do-list", enabled: true }
    ]}
  ]
};

export function slugFolder(value = "") {
  return slugifyName(value || "misc") || "misc";
}

const DM_EYES_ONLY = DEFAULT_NAVIGATION.menus.find((m) => m.key === "dm-eyes-only");

// v0.84.3: navigation files older than version 2 get House Rules and Rulings,
// placed directly above Adventure Groups. Added once, so a DM can later move it.
function addHouseRules(nav) {
  const menus = Array.isArray(nav?.menus) ? nav.menus : [];
  if (Number(nav?.version || 1) >= 2 || menus.some((m) => m.key === HOUSE_RULES_MENU.key)) return menus;
  const idx = menus.findIndex((m) => m.key === "adventure-groups");
  const at = idx >= 0 ? idx : menus.findIndex((m) => !m.system && m.key !== "dm-eyes-only");
  const out = [...menus];
  out.splice(at >= 0 ? at : out.length, 0, { ...HOUSE_RULES_MENU });
  return out;
}

function cleanSubcategory(sub = {}) {
  const label = String(sub.label || "").trim();
  return {
    ...sub,
    label,
    key: sub.key || slugFolder(label),
    folder: sub.folder ? slugFolder(sub.folder) : `${slugFolder(label)}s`,
    enabled: sub.enabled !== false
  };
}

function cleanMenu(menu = {}) {
  const label = String(menu.label || "").trim();
  const subs = (Array.isArray(menu.subcategories) ? menu.subcategories : []).map(cleanSubcategory).filter((s) => s.label);

  // DM Eyes Only is always on, DM-only, and keeps its default subcategories.
  if (menu.key === "dm-eyes-only" || label === "DM Eyes Only") {
    const merged = new Map(subs.map((s) => [s.key, s]));
    for (const sub of DM_EYES_ONLY.subcategories) if (!merged.has(sub.key)) merged.set(sub.key, cleanSubcategory(sub));
    return { ...menu, label: "DM Eyes Only", key: "dm-eyes-only", folder: "dm-eyes-only", dmOnly: true, enabled: true,
      subcategories: [...merged.values()].map((s) => ({ ...s, enabled: true })) };
  }

  const key = menu.key || slugFolder(label);
  const enabled = menu.enabled !== false;
  return {
    ...menu,
    label,
    key,
    folder: slugFolder(menu.folder || label),
    enabled,
    ...(key === HOUSE_RULES_MENU.key ? { dmWriteOnly: true } : {}),
    // A disabled menu disables all of its subcategories.
    subcategories: enabled ? subs : subs.map((s) => ({ ...s, enabled: false }))
  };
}

function normalizeNavigationState(nav) {
  return { version: NAVIGATION_VERSION, menus: addHouseRules(nav || DEFAULT_NAVIGATION).map(cleanMenu).filter((m) => m.label) };
}

export function readNavigation() {
  ensureFile(PATHS.navigationFile, JSON.stringify(DEFAULT_NAVIGATION, null, 2));
  const nav = readJson(PATHS.navigationFile, null);
  if (!Array.isArray(nav?.menus)) return normalizeNavigationState(DEFAULT_NAVIGATION);
  const clean = normalizeNavigationState(nav);
  // Persist one-time navigation upgrades (House Rules and Rulings in v0.84.3).
  if (Number(nav.version || 1) < NAVIGATION_VERSION) writeJson(PATHS.navigationFile, clean);
  return clean;
}

export function writeNavigation(nav) {
  const clean = normalizeNavigationState(nav);
  writeJson(PATHS.navigationFile, clean);
  return clean;
}

// The menus a user sees: enabled ones only, and DM-only menus only for the DM.
export function enabledMenusForUser(user) {
  const isDm = String(user?.role || "").toLowerCase() === "dm";
  const nav = readNavigation();
  return {
    ...nav,
    menus: nav.menus
      .filter((m) => m.enabled !== false && (!m.dmOnly || isDm))
      .map((m) => ({ ...m, subcategories: m.subcategories.filter((s) => s.enabled !== false) }))
  };
}

function findMenu(menus, label) {
  return menus.find((m) => m.label === label || m.key === slugFolder(label));
}

// Labels of menus flagged dmOnly (DM Eyes Only): players never see their notes.
export function dmOnlyCategories(nav = readNavigation()) {
  return new Set(nav.menus.filter((m) => m.dmOnly).map((m) => m.label));
}

// True when only the DM may create, edit or delete notes in this category (readable by everyone).
export function isDmWriteOnlyCategory(category, nav = readNavigation()) {
  return Boolean(category && findMenu(nav.menus, category)?.dmWriteOnly);
}

export function folderForCategory(category, nav = readNavigation()) {
  return findMenu(nav.menus, category)?.folder || slugFolder(category);
}

export function folderForSubcategory(category, subcategory, nav = readNavigation()) {
  const subs = findMenu(nav.menus, category)?.subcategories || [];
  return subs.find((s) => s.label === subcategory || s.key === slugFolder(subcategory))?.folder || slugFolder(subcategory);
}
