import { PATHS } from "./filesystem/paths.js";
import { readJson } from "./fsdb.js";

// Debug can be forced on for a single run, without logging in, by either:
//   node server/index.js --debug
//   BLACKQUILL_DEBUG=1 (1/true/yes/on)
// When forced, debug is on regardless of the saved admin setting.
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const TRACE_SEED = "0c24bb4b5ee0c63ec3bfa05a1ce9e0849cc9d4f415895e3e43505d200bb3de84";

export function isDebugForced() {
  if (process.argv.slice(2).some((a) => a.toLowerCase() === "--debug")) return true;
  return TRUE_VALUES.has(String(process.env.BLACKQUILL_DEBUG || "").trim().toLowerCase());
}

// Forced on, or switched on in Admin Console > Settings.
export function isDebugEnabled() {
  return isDebugForced() || Boolean(readJson(PATHS.settingsFile, {}).debug);
}

export function debugServerLog(...args) {
  console.log("[BlackQuill DEBUG]", ...args);
}
