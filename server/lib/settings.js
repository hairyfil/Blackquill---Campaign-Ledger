import path from "path";
import { PATHS } from "./filesystem/paths.js";
import { readJson, writeJson } from "./fsdb.js";

// One set of branding/settings for the whole instance, in system/settings.json.
// Admin Console > Settings and the DM Settings pages edit the same file.

export const DEFAULT_SETTINGS = {
  debug: false,
  activeBanner: "default-banner.svg",
  bannerWidth: 60,
  activeStyle: "default-style.json",
  activeIconPack: "default"
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(PATHS.settingsFile, {}) };
}

export function saveSettings(updates = {}) {
  const next = { ...getSettings(), ...updates, updatedAt: new Date().toISOString() };
  writeJson(PATHS.settingsFile, next);
  return next;
}

export function clampBannerWidth(value, fallback = DEFAULT_SETTINGS.bannerWidth) {
  const w = Number(value);
  return Number.isFinite(w) ? Math.max(30, Math.min(100, w)) : fallback;
}

export const BANNER_EXTS = [".svg", ".png", ".jpg", ".jpeg", ".webp"];

// A file name without folders, with only safe characters; null if it is not a banner image.
export function safeBannerName(name = "") {
  const base = path.basename(String(name || "")).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return BANNER_EXTS.includes(path.extname(base).toLowerCase()) ? base : null;
}
