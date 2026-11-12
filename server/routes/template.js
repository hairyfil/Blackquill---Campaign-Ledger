import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { PATHS } from "../lib/filesystem/paths.js";
import { ensureDir } from "../lib/fsdb.js";
import { getSettings, saveSettings, safeBannerName, clampBannerWidth, BANNER_EXTS } from "../lib/settings.js";
import { requireRole, audit } from "../lib/auth.js";

// Instance-wide branding: login banner, banner width and the login intro text.
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const requireDM = requireRole(["dm", "admin"], "Only DM/admin can edit settings");
const introFile = path.join(PATHS.defaultTemplate, "intro.txt");
const bannerPath = (file) => path.join(PATHS.banners, file);

function listBannerFiles() {
  ensureDir(PATHS.banners);
  return fs.readdirSync(PATHS.banners).filter((f) => BANNER_EXTS.includes(path.extname(f).toLowerCase())).sort((a, b) => a.localeCompare(b));
}

function bannerInfo() {
  const { activeBanner, bannerWidth } = getSettings();
  return { activeBanner, bannerWidth: Number(bannerWidth) || 60 };
}

router.get("/intro", (req, res) => res.type("text").send(fs.existsSync(introFile) ? fs.readFileSync(introFile, "utf8") : ""));
router.post("/intro", requireDM, (req, res) => {
  ensureDir(PATHS.defaultTemplate);
  fs.writeFileSync(introFile, String(req.body.text || ""));
  res.json({ ok: true });
});

router.get("/banner-settings", (req, res) => res.json(bannerInfo()));
router.post("/banner-settings", requireDM, (req, res) => res.json(saveSettings({ bannerWidth: clampBannerWidth(req.body.bannerWidth) })));

router.get("/banners", (req, res) => {
  res.json({ ...bannerInfo(), files: listBannerFiles().map((file) => ({ file, url: `/api/template/banners/${encodeURIComponent(file)}` })) });
});

router.get("/banners/:file", (req, res) => {
  const file = safeBannerName(req.params.file);
  if (!file) return res.status(400).json({ error: "Invalid banner file" });
  if (!fs.existsSync(bannerPath(file))) return res.status(404).json({ error: "Banner not found" });
  res.sendFile(bannerPath(file));
});

// The active banner for the login page (falls back to the default banner).
router.get("/assets/:file", (req, res) => {
  if (!/^banner\.(png|svg)$/.test(req.params.file)) return res.status(404).json({ error: "Not found" });
  const active = safeBannerName(getSettings().activeBanner);
  res.sendFile(active && fs.existsSync(bannerPath(active)) ? bannerPath(active) : bannerPath("default-banner.svg"));
});

// Upload a banner (DM Settings > Banner or Admin Console > Settings) and make it the active one.
router.post("/banner", requireDM, upload.single("banner"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No banner file uploaded" });
  const ext = path.extname(req.file.originalname || "").toLowerCase();
  if (!BANNER_EXTS.includes(ext)) return res.status(400).json({ error: "Unsupported banner format" });
  ensureDir(PATHS.banners);
  const base = path.basename(safeBannerName(req.file.originalname), ext).replace(/^-+|-+$/g, "") || "banner";
  const finalExt = ext === ".jpeg" ? ".jpg" : ext;
  let filename = `${base}${finalExt}`;
  for (let i = 1; fs.existsSync(bannerPath(filename)); i++) filename = `${base}-${i}${finalExt}`;
  fs.writeFileSync(bannerPath(filename), req.file.buffer);
  const settings = saveSettings({ activeBanner: filename });
  audit(req, "upload-banner", { file: filename });
  res.json({ ok: true, file: filename, url: `/api/template/banners/${encodeURIComponent(filename)}?t=${Date.now()}`, activeBanner: settings.activeBanner, bannerWidth: settings.bannerWidth });
});

router.post("/banner/select", requireDM, (req, res) => {
  const file = safeBannerName(req.body.file);
  if (!file) return res.status(400).json({ error: "Invalid banner file" });
  if (!fs.existsSync(bannerPath(file))) return res.status(404).json({ error: "Banner not found" });
  res.json(saveSettings({ activeBanner: file }));
});

router.delete("/banner/:file", requireDM, (req, res) => {
  const file = safeBannerName(req.params.file);
  if (!file) return res.status(400).json({ error: "Invalid banner file" });
  if (file === getSettings().activeBanner) return res.status(400).json({ error: "Cannot delete the active banner. Select another banner first." });
  fs.rmSync(bannerPath(file), { force: true });
  res.json({ ok: true, files: listBannerFiles() });
});

// Style files in system/styles/, listed in Settings > Styles next to the built-in presets.
router.get("/styles", (req, res) => {
  const files = fs.existsSync(PATHS.styles) ? fs.readdirSync(PATHS.styles).filter((f) => f.endsWith(".json")) : [];
  res.json(files.map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(PATHS.styles, f), "utf8")) })));
});

// v1.0.3: the instance-wide look. Everyone (also the login page and the Admin Console) uses
// activeStyle and activeIconPack from system/settings.json unless they chose their own in
// this browser. Built-in styles live in the client; a style file in system/styles/ is sent along.
const STYLE_FILE_RE = /^[a-zA-Z0-9._-]+\.json$/;
const isBuiltInStyle = (file) => file === "default-style.json" || /^builtin-[a-z0-9-]+\.json$/.test(file);
const iconPackExists = (pack) => /^[a-zA-Z0-9_-]+$/.test(pack) && fs.existsSync(path.join(PATHS.icons, pack));

function readStyleFile(file) {
  if (!STYLE_FILE_RE.test(file)) return null;
  const full = path.join(PATHS.styles, file);
  try { return fs.existsSync(full) ? { file, ...JSON.parse(fs.readFileSync(full, "utf8")) } : null; } catch { return null; }
}

function appearance() {
  const { activeStyle, activeIconPack } = getSettings();
  return { activeStyle, activeIconPack, style: readStyleFile(activeStyle) };
}

router.get("/appearance", (req, res) => res.json(appearance()));

router.post("/appearance", requireDM, (req, res) => {
  const updates = {};
  if (req.body.activeStyle !== undefined) {
    const file = path.basename(String(req.body.activeStyle || ""));
    if (!STYLE_FILE_RE.test(file) || !(isBuiltInStyle(file) || readStyleFile(file))) return res.status(400).json({ error: "Unknown style" });
    updates.activeStyle = file;
  }
  if (req.body.activeIconPack !== undefined) {
    const pack = String(req.body.activeIconPack || "");
    if (!iconPackExists(pack)) return res.status(400).json({ error: "Unknown icon pack" });
    updates.activeIconPack = pack;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Nothing to change" });
  saveSettings(updates);
  audit(req, "update-appearance", updates);
  res.json(appearance());
});

export default router;
