import express from "express";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import slugify from "slugify";
import multer from "multer";
import { ensureDir, listFilesRecursive } from "../lib/fsdb.js";
import { getCampaignNotesFolder, findCampaign } from "../lib/filesystem/campaigns.js";
import { getNoteMarkdownPath, getNoteDirectory, getNoteFilePath, normalizeNoteData } from "../lib/filesystem/notes.js";
import { removeUndefined } from "../lib/sanitize.js";
import { dmOnlyCategories, isDmWriteOnlyCategory, readNavigation } from "../lib/navigation.js";
import { downloadImage, isAllowedImageUrl, isWikiUrl } from "../lib/fandom.js";
import { requireLogin, requireRole, isDm } from "../lib/auth.js";

// Notes live in campaigns/<campaign-slug>/notes/. Any logged-in DM or player can read them,
// except notes in DM-only sections (DM Eyes Only), which only the DM ever receives.
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const requireDM = requireRole(["dm"], "Only the DM can do this");

router.use(requireLogin);

// A deleted campaign cannot be written to, so someone still viewing it cannot recreate its folder.
router.use("/:campaignSlug", (req, res, next) => {
  if (req.method !== "GET" && !findCampaign(req.params.campaignSlug)) return res.status(404).json({ error: "This campaign no longer exists" });
  next();
});

// DM-only sections, and sections flagged dmWriteOnly (House Rules and Rulings): only the DM may write.
function refuseIfDmWriteOnly(req, res, ...categories) {
  if (isDm(req)) return false;
  const nav = readNavigation();
  const dmOnly = dmOnlyCategories(nav);
  if (categories.some((c) => dmOnly.has(c) || isDmWriteOnlyCategory(c, nav))) {
    res.status(403).json({ error: "Only the DM can add or change notes in this section" });
    return true;
  }
  return false;
}

function visibleNotes(req, notes) {
  if (isDm(req)) return notes;
  const hidden = dmOnlyCategories();
  return notes.filter((n) => !hidden.has(n.category));
}

const assetUrl = (campaignSlug, noteSlug, filename) => `/api/notes/${campaignSlug}/${noteSlug}/asset/${encodeURIComponent(filename)}`;
const isExternalUrl = (value = "") => /^https?:\/\//i.test(String(value));
const imageRef = (image) => (typeof image === "string" ? image : image?.file || image?.filename || image?.path || image?.url || "");

// Images in front matter are { file, caption?, source? }. Local files always live in the note's own folder.
function storedImage(image) {
  const raw = imageRef(image);
  if (!raw) return null;
  const caption = typeof image === "string" ? undefined : image.caption || "";
  if (isExternalUrl(raw)) return { file: image.file || raw, url: raw, caption };
  // Keep the wiki file page of imported images (image attribution).
  const source = isWikiUrl(image.source) ? String(image.source).slice(0, 500) : undefined;
  return { file: path.basename(raw), caption, source };
}

function withImageUrls(images, campaignSlug, noteSlug) {
  return (Array.isArray(images) ? images : []).map((image) => {
    const raw = imageRef(image);
    const base = typeof image === "string" ? {} : image;
    if (isExternalUrl(raw)) return { ...base, file: base.file || raw, url: raw };
    const file = path.basename(raw);
    return { ...base, file, url: assetUrl(campaignSlug, noteSlug, file) };
  }).filter((image) => image.file);
}

function cleanWikiSource(src) {
  if (!src || typeof src !== "object" || !/^https:\/\/forgottenrealms\.fandom\.com\/wiki\//i.test(String(src.url || ""))) return undefined;
  const pick = (v, n) => String(v || "").slice(0, n);
  return {
    site: "Forgotten Realms Wiki",
    title: pick(src.title, 200),
    url: pick(src.url, 500),
    license: pick(src.license || "CC BY-SA 3.0", 60),
    licenseUrl: pick(src.licenseUrl || "https://creativecommons.org/licenses/by-sa/3.0/", 200),
    importedAt: pick(src.importedAt, 40) || new Date().toISOString()
  };
}

function readNoteFile(file, campaignSlug) {
  const parsed = matter(fs.readFileSync(file, "utf8"));
  const data = normalizeNoteData(parsed.data || {});
  const slug = data.slug || path.basename(file, ".md");
  return { ...data, content: parsed.content, file, slug, title: data.title || slug, images: withImageUrls(data.images, campaignSlug, slug) };
}

function writeNoteFile(file, content, data) {
  const clean = removeUndefined(data);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, matter.stringify(content || "", clean));
  return clean;
}

// Rewrites a note's front matter with change(data) applied, keeping its text.
function updateFrontMatter(campaignSlug, note, change) {
  const mdPath = getNoteMarkdownPath(campaignSlug, note);
  if (!fs.existsSync(mdPath)) return null;
  const parsed = matter(fs.readFileSync(mdPath, "utf8"));
  const data = normalizeNoteData(parsed.data || {});
  change(data);
  writeNoteFile(mdPath, parsed.content, data);
  return mdPath;
}

// Canonical notes only: <slug>/<slug>.md. If a slug appears twice, the newest file wins.
function allNotes(campaignSlug) {
  const files = listFilesRecursive(getCampaignNotesFolder(campaignSlug), (f) => f.endsWith(".md") && path.basename(path.dirname(f)) === path.basename(f, ".md"));
  const unique = new Map();
  for (const file of files) {
    const note = readNoteFile(file, campaignSlug);
    const existing = unique.get(note.slug);
    if (!existing || fs.statSync(file).mtimeMs > fs.statSync(existing.file).mtimeMs) unique.set(note.slug, note);
  }
  return [...unique.values()];
}

// The note named by :slug, or a 404. Pass visibleOnly to hide DM-only notes from players.
function findNote(req, res, visibleOnly = false) {
  const notes = allNotes(req.params.campaignSlug);
  const note = (visibleOnly ? visibleNotes(req, notes) : notes).find((n) => n.slug === req.params.slug);
  if (!note) res.status(404).json({ error: visibleOnly ? "Not found" : "Note not found" });
  return note;
}

function isInside(target, folder) {
  return path.resolve(target).startsWith(path.resolve(folder));
}

router.get("/:campaignSlug", (req, res) => {
  const { category, subcategory } = req.query;
  let notes = visibleNotes(req, allNotes(req.params.campaignSlug)).sort((a, b) => a.title.localeCompare(b.title));
  if (category && category !== "All Entries" && category !== "Dashboard") {
    notes = notes.filter((n) => (category === "Atlas" ? n.category === "Atlas" : [n.category, n.subcategory, n.locationLevel].includes(category)));
  }
  if (subcategory) notes = notes.filter((n) => n.subcategory === subcategory || n.locationLevel === subcategory);
  res.json(notes);
});

router.get("/:campaignSlug/:slug", (req, res) => {
  const note = findNote(req, res, true);
  if (note) res.json(note);
});

// Create or update a note. Moving it to another category/subcategory moves its whole folder.
router.post("/:campaignSlug", (req, res) => {
  const { campaignSlug } = req.params;
  const body = req.body;
  const now = new Date().toISOString();
  const slug = slugify(body.originalSlug || body.slug || body.title || "untitled", { lower: true, strict: true });
  const data = normalizeNoteData({
    id: body.id || `note-${slug}`,
    title: body.title || "Untitled",
    slug,
    category: body.category || "Atlas",
    subcategory: body.subcategory || body.locationLevel || (body.category === "Adventure Groups" ? "Groups" : "City"),
    tags: body.tags || [],
    visibility: body.visibility || "dm",
    createdBy: req.session.user.id,
    createdAt: body.createdAt || now,
    updatedAt: now,
    locationLevel: body.locationLevel || body.subcategory || "",
    parentSlug: body.parentSlug || "",
    linkedNotes: body.linkedNotes || [],
    backlinks: body.backlinks || [],
    // Where an imported note came from (Forgotten Realms Wiki), kept for CC-BY-SA attribution.
    wikiSource: cleanWikiSource(body.wikiSource),
    images: (body.images || []).map(storedImage).filter(Boolean)
  });

  const existing = allNotes(campaignSlug).find((n) => n.slug === slug);
  if (refuseIfDmWriteOnly(req, res, data.category, existing?.category)) return;

  const notesRoot = getCampaignNotesFolder(campaignSlug);
  const file = getNoteMarkdownPath(campaignSlug, data);
  const newDir = path.resolve(path.dirname(file));
  const originalFile = body.originalFile || body.file || "";
  if (originalFile) {
    const oldFile = path.resolve(originalFile);
    const oldDir = path.dirname(oldFile);
    if (!isInside(oldFile, notesRoot) || !isInside(newDir, notesRoot)) return res.status(400).json({ error: "Invalid note path" });

    if (oldDir !== newDir && fs.existsSync(oldDir)) {
      if (fs.existsSync(newDir)) {
        return res.status(409).json({ error: "A note folder already exists at the destination. Rename the note or choose a different category/subcategory." });
      }
      ensureDir(path.dirname(newDir));
      fs.renameSync(oldDir, newDir);
      const movedOldMarkdown = path.join(newDir, path.basename(oldFile));
      if (movedOldMarkdown !== path.resolve(file)) fs.rmSync(movedOldMarkdown, { force: true });
    } else if (oldFile !== path.resolve(file)) {
      fs.rmSync(oldFile, { force: true });
    }
  }

  const saved = writeNoteFile(file, body.content, data);
  res.json({ ...saved, content: body.content || "", file });
});

router.delete("/:campaignSlug/:slug", requireDM, (req, res) => {
  const note = findNote(req, res);
  if (!note) return;
  const noteDir = getNoteDirectory(req.params.campaignSlug, note);
  if (!isInside(noteDir, getCampaignNotesFolder(req.params.campaignSlug))) return res.status(400).json({ error: "Invalid note path" });
  fs.rmSync(noteDir, { recursive: true, force: true });
  res.json({ success: true });
});

// DM Secrets: a dm-secrets.md file in the note's folder, never sent to players.
router.get("/:campaignSlug/:slug/secrets", requireDM, (req, res) => {
  const note = findNote(req, res);
  if (!note) return;
  const secretsPath = getNoteFilePath(req.params.campaignSlug, note, "dm-secrets.md");
  res.type("text").send(fs.existsSync(secretsPath) ? fs.readFileSync(secretsPath, "utf8") : "");
});

router.post("/:campaignSlug/:slug/secrets", requireDM, (req, res) => {
  const note = findNote(req, res);
  if (!note) return;
  const secretsPath = getNoteFilePath(req.params.campaignSlug, note, "dm-secrets.md");
  ensureDir(path.dirname(secretsPath));
  fs.writeFileSync(secretsPath, String(req.body.content || ""));
  res.json({ success: true });
});

router.post("/:campaignSlug/:slug/image", upload.single("image"), (req, res) => {
  const note = findNote(req, res);
  if (!note || refuseIfDmWriteOnly(req, res, note.category)) return;
  const file = req.file && getNoteFilePath(req.params.campaignSlug, note, req.file.originalname);
  if (!file) return res.status(400).json({ error: "No image uploaded" });
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, req.file.buffer);
  const name = path.basename(file);
  res.json({ file: name, url: assetUrl(req.params.campaignSlug, req.params.slug, name) });
});

router.delete("/:campaignSlug/:slug/image/:file", (req, res) => {
  const note = findNote(req, res);
  if (!note || refuseIfDmWriteOnly(req, res, note.category)) return;
  const target = getNoteFilePath(req.params.campaignSlug, note, req.params.file);
  if (!target) return res.status(400).json({ error: "Invalid image path" });
  fs.rmSync(target, { force: true });
  const targetFile = path.basename(target);
  updateFrontMatter(req.params.campaignSlug, note, (data) => {
    data.images = (Array.isArray(data.images) ? data.images : []).filter((image) => path.basename(imageRef(image)) !== targetFile);
  });
  res.json({ success: true });
});

// Downloads the images picked during a Forgotten Realms Wiki import into the note's own folder
// and adds them to the note's images. Body: { images: [{ sourceUrl, file, caption, filePage }] }.
// Only the wiki's image server is allowed.
router.post("/:campaignSlug/:slug/wiki-images", async (req, res) => {
  const note = findNote(req, res);
  if (!note || refuseIfDmWriteOnly(req, res, note.category)) return;

  const requested = (Array.isArray(req.body.images) ? req.body.images : []).slice(0, 12).filter((i) => i && isAllowedImageUrl(i.sourceUrl));
  const noteDir = getNoteDirectory(req.params.campaignSlug, note);
  const added = [];
  const failed = [];

  for (const image of requested) {
    try {
      const { buffer, ext } = await downloadImage(String(image.sourceUrl));
      const base = path.basename(String(image.file || "wiki-image")).replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-]+/gi, "-").slice(0, 70) || "wiki-image";
      let file = `${base}.${ext}`;
      for (let n = 2; fs.existsSync(path.join(noteDir, file)); n++) file = `${base}-${n}.${ext}`;
      ensureDir(noteDir);
      fs.writeFileSync(path.join(noteDir, file), buffer);
      added.push(removeUndefined({
        file,
        caption: String(image.caption || "").slice(0, 200),
        source: isWikiUrl(image.filePage) ? String(image.filePage).slice(0, 500) : undefined
      }));
    } catch (err) {
      failed.push({ sourceUrl: image.sourceUrl, error: err.name === "TimeoutError" || err.name === "AbortError" ? "Timed out" : (err.message || "Download failed") });
    }
  }

  const mdPath = updateFrontMatter(req.params.campaignSlug, note, (data) => {
    data.images = [...(Array.isArray(data.images) ? data.images : []), ...added];
    data.updatedAt = new Date().toISOString();
  });
  res.json({ note: readNoteFile(mdPath, req.params.campaignSlug), added: added.length, failed });
});

router.get("/:campaignSlug/:slug/asset/:file", (req, res) => {
  const note = visibleNotes(req, allNotes(req.params.campaignSlug)).find((n) => n.slug === req.params.slug);
  const file = note && getNoteFilePath(req.params.campaignSlug, note, req.params.file);
  // Only pictures: the note's Markdown and dm-secrets.md live in the same folder.
  if (!file || file.toLowerCase().endsWith(".md")) return res.status(404).end();
  res.sendFile(file);
});

export default router;
