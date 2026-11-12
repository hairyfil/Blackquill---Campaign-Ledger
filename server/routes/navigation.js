import express from "express";
import path from "path";
import { readNavigation, writeNavigation, enabledMenusForUser, slugFolder } from "../lib/navigation.js";
import { getCampaignNotesFolder, listCampaignFolders } from "../lib/filesystem/campaigns.js";
import { ensureDir } from "../lib/fsdb.js";
import { requireRole } from "../lib/auth.js";

const router = express.Router();
const requireDM = requireRole(["dm", "admin"], "Only DM can edit navigation");

// Every campaign gets a folder for each enabled menu and subcategory.
function createFolders(nav) {
  for (const campaignSlug of listCampaignFolders()) {
    for (const menu of nav.menus.filter((m) => m.enabled !== false)) {
      const menuFolder = path.join(getCampaignNotesFolder(campaignSlug), menu.folder);
      ensureDir(menuFolder);
      for (const sub of menu.subcategories.filter((s) => s.enabled !== false)) ensureDir(path.join(menuFolder, sub.folder));
    }
  }
}

function save(res, nav) {
  const saved = writeNavigation(nav);
  createFolders(saved);
  res.json(saved);
}

// The menus this user sees (enabled only; DM Eyes Only only for the DM).
router.get("/", (req, res) => res.json(enabledMenusForUser(req.session?.user)));

// The full configuration, including disabled menus, for Settings > Navigation.
router.get("/admin", requireDM, (req, res) => res.json(readNavigation()));

router.post("/", requireDM, (req, res) => save(res, Array.isArray(req.body.menus) ? req.body : readNavigation()));

router.post("/subcategory", requireDM, (req, res) => {
  const nav = readNavigation();
  const category = String(req.body.category || "").trim();
  const label = String(req.body.label || "").trim();
  if (!category || !label) return res.status(400).json({ error: "Category and label are required" });

  const menu = nav.menus.find((m) => m.label === category || m.key === slugFolder(category));
  if (!menu) return res.status(404).json({ error: "Category not found" });
  if (menu.subcategories.some((s) => s.key === slugFolder(label) || s.label.toLowerCase() === label.toLowerCase())) {
    return res.status(409).json({ error: "Subcategory already exists" });
  }
  menu.enabled = true;
  menu.subcategories.push({ label, key: slugFolder(label), folder: req.body.folder ? slugFolder(req.body.folder) : `${slugFolder(label)}s`, enabled: true });
  save(res, nav);
});

export default router;
