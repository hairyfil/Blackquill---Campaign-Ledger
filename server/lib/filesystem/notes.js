import path from "path";
import { getCampaignNotesFolder } from "./campaigns.js";
import { folderForCategory, folderForSubcategory, readNavigation } from "../navigation.js";

// Note folders are canonical: notes/<category>/<subcategory>/<note-slug>/<note-slug>.md
// Atlas notes use their location level (World, City, Site...) as the subcategory folder.

function defaultSubcategory(category) {
  if (category === "Atlas") return "City";
  if (category === "Adventure Groups") return "Groups";
  return "General";
}

export function getNoteDirectory(campaignSlug, note) {
  const nav = readNavigation();
  const category = note.category || "Atlas";
  const sub = category === "Atlas"
    ? note.locationLevel || note.subcategory || "Site"
    : note.subcategory || defaultSubcategory(category);
  return path.join(getCampaignNotesFolder(campaignSlug), folderForCategory(category, nav), folderForSubcategory(category, sub, nav), note.slug);
}

export function getNoteMarkdownPath(campaignSlug, note) {
  return path.join(getNoteDirectory(campaignSlug, note), `${note.slug}.md`);
}

// A file that sits in the note's own folder (images, dm-secrets.md). Folder parts of the name are
// dropped; returns null for a name that is not a file name ("", ".", "..").
export function getNoteFilePath(campaignSlug, note, filename) {
  const name = path.basename(String(filename || ""));
  if (!name || name === "." || name === "..") return null;
  return path.join(getNoteDirectory(campaignSlug, note), name);
}

export function normalizeNoteData(data = {}) {
  const category = data.category || "Atlas";
  const subcategory = data.subcategory || data.locationLevel || defaultSubcategory(category);
  const locationLevel = category === "Atlas" ? data.locationLevel || subcategory : "";
  return { ...data, category, subcategory, locationLevel };
}
