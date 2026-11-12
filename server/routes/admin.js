import express from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PATHS } from "../lib/filesystem/paths.js";
import { isDebugEnabled } from "../lib/debug.js";
import { ensureDir, readJson, listFilesRecursive, listFolders, copyTree, slugifyName } from "../lib/fsdb.js";
import { readUsers, writeUsers, isAdmin, isDemo, MIN_ADMIN_PASSWORD } from "../lib/users.js";
import { listCampaigns, getCampaignFolder, CAMPAIGN_SUBFOLDERS } from "../lib/filesystem/campaigns.js";
import { getSettings, saveSettings, clampBannerWidth } from "../lib/settings.js";
import { requireRole, audit } from "../lib/auth.js";

const router = express.Router();
router.use(requireRole(["admin"], "Only admin can access admin console"));

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: String(user.role || "player").toLowerCase(),
    locked: Boolean(user.locked),
    formerDomain: user.formerDomain || null,
    createdAt: user.createdAt || null,
    lastLogin: user.lastLogin || null,
    protected: isAdmin(user),
    demo: isDemo(user)
  };
}

const listFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort((a, b) => a.localeCompare(b)) : []);
const findCampaign = (slug) => listCampaigns().find((c) => c.slug === slug);
const debugLog = (debug, ...lines) => { if (debug) lines.forEach((l) => console.log(`[BlackQuill DEBUG] ${l}`)); };

// v1.0.7: the first-DM hint. Shown to an admin until they close it, and only while no DM
// account exists yet, so installs that already have a DM never see it.
function showFirstDmHint(req, users) {
  const me = users.find((u) => u.id === req.session.user?.id);
  if (!me || me.firstDmHintDismissed) return false;
  return !users.some((u) => String(u.role || "").toLowerCase() === "dm");
}

router.get("/dashboard", (req, res) => {
  const users = readUsers();
  res.json({ users: users.map(safeUser), campaigns: listCampaigns(), firstDmHint: showFirstDmHint(req, users) });
});

router.post("/hints/first-dm/dismiss", (req, res) => {
  const users = readUsers();
  const me = users.find((u) => u.id === req.session.user?.id);
  if (me && !me.firstDmHintDismissed) {
    me.firstDmHintDismissed = true;
    writeUsers(users);
  }
  res.json({ ok: true });
});

router.get("/campaigns", (req, res) => res.json(listCampaigns().map((c) => ({ ...c, path: getCampaignFolder(c.slug) }))));

router.get("/settings", (req, res) => {
  res.json({
    settings: getSettings(),
    styles: listFiles(PATHS.styles).filter((f) => f.endsWith(".json")),
    iconPacks: listFolders(PATHS.icons),
    banners: listFiles(PATHS.banners)
  });
});

router.post("/settings", (req, res) => {
  const updates = {};
  if (req.body.debug !== undefined) updates.debug = Boolean(req.body.debug);
  if (req.body.activeStyle !== undefined) updates.activeStyle = String(req.body.activeStyle || "default-style.json");
  if (req.body.activeIconPack !== undefined) updates.activeIconPack = String(req.body.activeIconPack || "default");
  if (req.body.activeBanner !== undefined) updates.activeBanner = String(req.body.activeBanner || "default-banner.svg");
  if (req.body.bannerWidth !== undefined) updates.bannerWidth = clampBannerWidth(req.body.bannerWidth);
  audit(req, "update-admin-settings", updates);
  res.json(saveSettings(updates));
});

router.post("/users", (req, res) => {
  const name = String(req.body.name || "").trim();
  const username = String(req.body.username || req.body.email || "").trim();
  const email = String(req.body.email || username || "").trim();
  const role = String(req.body.role || "").toLowerCase() === "dm" ? "dm" : "player";
  const password = String(req.body.password || "");
  if (!username) return res.status(400).json({ error: "Username/email is required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const users = readUsers();
  const taken = (v) => users.some((u) => [u.username, u.email].some((x) => x && String(x).toLowerCase() === v.toLowerCase()));
  if (taken(username) || taken(email)) return res.status(409).json({ error: "A user with that username or email already exists" });
  users.push({ id: `user-${role}-${slugifyName(username)}`, name: name || username, username, email, role, locked: false, passwordHash: bcrypt.hashSync(password, 10), createdAt: new Date().toISOString() });
  writeUsers(users);
  audit(req, "create-user", { username, role });
  res.json({ ok: true });
});

router.put("/users/:userId", (req, res) => {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === req.params.userId);
  if (idx < 0) return res.status(404).json({ error: "User not found" });
  if (isAdmin(users[idx])) return res.status(403).json({ error: "Admin account cannot be edited, locked, or password-reset from User Management." });
  const updates = {};
  for (const key of ["name", "username", "email"]) if (req.body[key] !== undefined) updates[key] = String(req.body[key]).trim();
  if (["dm", "player"].includes(String(req.body.role).toLowerCase())) updates.role = String(req.body.role).toLowerCase();
  if (req.body.locked !== undefined) updates.locked = Boolean(req.body.locked);
  if (req.body.password) updates.passwordHash = bcrypt.hashSync(String(req.body.password), 10);
  users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
  writeUsers(users);
  audit(req, "edit-user", { userId: req.params.userId });
  res.json(safeUser(users[idx]));
});

// v1.0.2: the signed-in admin changes their own password. Needs the current password.
router.post("/password", (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
  const confirm = String(req.body.confirm ?? next);
  const users = readUsers();
  const me = users.find((u) => u.id === req.session.user.id && isAdmin(u));
  if (!me) return res.status(404).json({ error: "Admin account not found. Log out and in again." });
  if (!bcrypt.compareSync(current, me.passwordHash || "")) return res.status(400).json({ error: "The current password is wrong." });
  if (next.length < MIN_ADMIN_PASSWORD) return res.status(400).json({ error: `The new password must be at least ${MIN_ADMIN_PASSWORD} characters.` });
  if (next !== confirm) return res.status(400).json({ error: "The two new passwords do not match." });
  me.passwordHash = bcrypt.hashSync(next, 10);
  me.updatedAt = new Date().toISOString();
  writeUsers(users);
  audit(req, "change-admin-password");
  res.json({ ok: true });
});

router.delete("/users/:userId", (req, res) => {
  const users = readUsers();
  const target = users.find((u) => u.id === req.params.userId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (isAdmin(target)) return res.status(403).json({ error: "Admin account cannot be deleted." });
  if (isDemo(target)) return res.status(403).json({ error: "The demo account cannot be deleted. You can change its password or lock it instead." });
  writeUsers(users.filter((u) => u !== target));
  audit(req, "delete-user", { userId: req.params.userId });
  res.json({ ok: true });
});

const REQUIRED_PATHS = [
  ["Data root", PATHS.root], ["System", PATHS.system], ["Users", PATHS.usersFile], ["Settings", PATHS.settingsFile],
  ["Templates", PATHS.defaultTemplate], ["Styles", PATHS.styles], ["Icons", PATHS.icons], ["Banners", PATHS.banners],
  ["Datasets", PATHS.datasets], ["Backups", PATHS.backups], ["Campaigns", PATHS.campaigns], ["Campaign index", PATHS.campaignsFile]
];

router.get("/file-checker", (req, res) => {
  const results = [];
  const checkPath = (label, p) => {
    const ok = fs.existsSync(p);
    results.push({ level: ok ? "OK" : "Error", label, path: p, message: ok ? "exists" : "missing" });
  };
  for (const [label, p] of REQUIRED_PATHS) checkPath(label, p);
  for (const campaign of listCampaigns()) {
    const root = getCampaignFolder(campaign.slug);
    checkPath(`Campaign ${campaign.slug}`, root);
    checkPath(`Campaign ${campaign.slug} notes`, path.join(root, "notes"));
    for (const file of listFilesRecursive(path.join(root, "notes"), (f) => f.endsWith(".md"))) {
      const base = path.basename(file, ".md");
      if (base !== path.basename(path.dirname(file)) && base !== "dm-secrets") results.push({ level: "Warning", label: "Non-canonical note markdown", path: file, message: "Expected <slug>/<slug>.md" });
    }
  }
  res.json(results);
});

// Safe repair only creates missing folders; it never deletes anything.
router.post("/file-checker/repair", (req, res) => {
  for (const dir of [PATHS.defaultTemplate, PATHS.styles, PATHS.defaultIcons, PATHS.banners, PATHS.datasets, PATHS.backups, PATHS.campaigns]) ensureDir(dir);
  for (const campaign of listCampaigns()) {
    for (const sub of CAMPAIGN_SUBFOLDERS) ensureDir(path.join(getCampaignFolder(campaign.slug), sub));
  }
  audit(req, "repair-safe-file-issues");
  res.json({ ok: true });
});

router.post("/backups", (req, res) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const scope = req.body.scope || "all";
  let dest;
  if (scope === "campaign" && req.body.campaignSlug) {
    const campaign = findCampaign(req.body.campaignSlug);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    dest = path.join(PATHS.backups, `backup-${stamp}-campaign-${campaign.slug}`);
    copyTree(getCampaignFolder(campaign.slug), path.join(dest, "campaigns", campaign.slug));
  } else {
    // Everything except the backups folder itself.
    dest = path.join(PATHS.backups, `backup-${stamp}-all`);
    const backups = path.resolve(PATHS.backups);
    copyTree(PATHS.root, dest, { skip: (p) => path.resolve(p) === backups });
  }
  audit(req, "backup", { scope, target: dest });
  res.json({ ok: true, backupFolder: dest });
});

router.get("/datasets", (req, res) => {
  const sets = listFolders(PATHS.datasets).map((slug) => {
    const folder = path.join(PATHS.datasets, slug);
    const meta = readJson(path.join(folder, "dataset.json"), {});
    return { slug, name: meta.name || slug, description: meta.description || "", path: folder };
  });
  res.json(sets.sort((a, b) => a.name.localeCompare(b.name)));
});

// Copy every file and folder inside the selected dataset directory into the campaign folder.
router.post("/datasets/copy", (req, res) => {
  const dataset = slugifyName(req.body.dataset || "");
  const campaignSlug = slugifyName(req.body.campaignSlug || "");
  if (!dataset || !campaignSlug) return res.status(400).json({ error: "Dataset and campaign are required" });

  const src = path.join(PATHS.datasets, dataset);
  const targetCampaignFolder = getCampaignFolder(campaignSlug);
  const debug = isDebugEnabled();
  debugLog(debug, "Dataset copy requested", `dataset: ${dataset}`, `campaign: ${campaignSlug}`, `source dataset path: ${src}`, `target campaign path: ${targetCampaignFolder}`);

  if (!fs.existsSync(src)) return res.status(404).json({ error: "Dataset not found", sourcePath: src });
  if (!findCampaign(campaignSlug)) return res.status(404).json({ error: "Campaign not found", targetCampaignFolder });

  const copied = copyTree(src, targetCampaignFolder, { debug });
  audit(req, "copy-dataset", { dataset, campaign: campaignSlug, sourcePath: src, targetCampaignFolder, fileCount: copied.length });
  res.json({ ok: true, copiedFrom: src, copiedTo: targetCampaignFolder, filesCopied: copied.length });
});

// Copy one campaign's notes into another campaign. Existing files in the target are never overwritten.
router.post("/campaigns/copy", (req, res) => {
  const sourceSlug = slugifyName(req.body.sourceCampaignSlug || "");
  const targetSlug = slugifyName(req.body.campaignSlug || "");
  if (!sourceSlug || !targetSlug) return res.status(400).json({ error: "Source and target campaigns are required" });
  if (sourceSlug === targetSlug) return res.status(400).json({ error: "Source and target must be different campaigns" });
  if (!findCampaign(sourceSlug)) return res.status(404).json({ error: "Source campaign not found" });
  if (!findCampaign(targetSlug)) return res.status(404).json({ error: "Target campaign not found" });

  const src = path.join(getCampaignFolder(sourceSlug), "notes");
  const dest = path.join(getCampaignFolder(targetSlug), "notes");
  const debug = isDebugEnabled();
  debugLog(debug, "Campaign notes copy requested", `source campaign path: ${src}`, `target campaign path: ${dest}`);
  if (!fs.existsSync(src)) return res.status(404).json({ error: "Source campaign has no notes folder", sourcePath: src });

  const total = listFilesRecursive(src).length;
  const copied = copyTree(src, dest, { overwrite: false, debug });
  const skipped = total - copied.length;
  audit(req, "copy-campaign-notes", { sourceCampaign: sourceSlug, targetCampaign: targetSlug, fileCount: copied.length, skipped });
  res.json({ ok: true, copiedFrom: src, copiedTo: dest, filesCopied: copied.length, filesSkipped: skipped });
});

export default router;
