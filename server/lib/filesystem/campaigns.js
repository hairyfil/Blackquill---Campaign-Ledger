import fs from "fs";
import path from "path";
import { PATHS } from "./paths.js";
import { readJson, writeJson, ensureDir, listFolders } from "../fsdb.js";

export function safeCampaignSlug(slug = "") {
  return String(slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

// campaigns/<slug>/
export function getCampaignFolder(campaignSlug) {
  return path.join(PATHS.campaigns, safeCampaignSlug(campaignSlug));
}

export function getCampaignNotesFolder(campaignSlug) {
  return path.join(getCampaignFolder(campaignSlug), "notes");
}

export const CAMPAIGN_SUBFOLDERS = ["notes", "sessions", "assets"];

function ensureCampaignFolders(campaignSlug) {
  for (const sub of CAMPAIGN_SUBFOLDERS) ensureDir(path.join(getCampaignFolder(campaignSlug), sub));
}

export function listCampaignFolders() {
  return listFolders(PATHS.campaigns);
}

function titleFromSlug(slug) {
  return String(slug || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Index (campaigns.json) merged with any campaign folders found on disk.
export function listCampaigns() {
  const merged = readJson(PATHS.campaignsFile, []).filter((c) => c && c.slug).map((c) => ({ ...c, folder: c.slug }));
  for (const folder of listCampaignFolders()) {
    if (merged.some((c) => c.slug === folder)) continue;
    const meta = readJson(path.join(PATHS.campaigns, folder, "campaign.json"), {});
    // v0.86.5: a folder-only campaign is always addressed by its folder name, even if its
    // campaign.json carries another slug (otherwise it could be opened but never deleted).
    merged.push({ ...meta, id: folder, slug: folder, folder, name: meta.name || titleFromSlug(folder) });
  }
  return merged.sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug)));
}

// v0.86.5: exact slug first (folders such as "Lost_Mine" from older versions), then the cleaned slug.
export function findCampaign(campaignSlug) {
  const raw = String(campaignSlug || "").trim();
  if (!raw) return null;
  const all = listCampaigns();
  return all.find((c) => c.slug === raw) || all.find((c) => c.slug === safeCampaignSlug(raw)) || null;
}

export function addCampaign(campaign) {
  ensureCampaignFolders(campaign.slug);
  writeJson(PATHS.campaignsFile, [...readJson(PATHS.campaignsFile, []), campaign]);
  writeJson(path.join(getCampaignFolder(campaign.slug), "campaign.json"), campaign);
  return campaign;
}

// Permanently deletes a campaign (as returned by findCampaign): its index entry and its whole
// folder. There is no undo.
// v0.86.5: uses the campaign's real folder name instead of a re-cleaned slug, so campaigns from
// older versions (capitals, underscores, folder-only) are really removed, and reports a folder
// that could not be removed (e.g. a file held open by OneDrive or an editor on Windows).
export function deleteCampaign(campaign) {
  const folderName = String(campaign?.folder || campaign?.slug || "");
  if (!folderName || folderName === "." || folderName === ".." || /[\\/:*?"<>|\0]/.test(folderName)) throw new Error("Invalid campaign folder");
  const folder = path.join(PATHS.campaigns, folderName);
  // Never delete anything that is not a direct child of campaigns/.
  if (path.dirname(path.resolve(folder)) !== path.resolve(PATHS.campaigns)) throw new Error("Invalid campaign folder");
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (fs.existsSync(folder)) throw new Error("the campaign folder could not be removed; close any program using its files and try again");
  const indexed = readJson(PATHS.campaignsFile, []);
  const remaining = indexed.filter((c) => c?.slug !== campaign.slug && c?.slug !== folderName);
  if (remaining.length !== indexed.length) writeJson(PATHS.campaignsFile, remaining);
}
