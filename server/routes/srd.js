import express from "express";
import multer from "multer";
import { getStatus, importSrd, removeSrd, listCategory, getEntry, searchAll } from "../lib/srd.js";
import { requireLogin, requireRole, audit } from "../lib/auth.js";

// SRD browser API. Reading needs any login; importing or removing the SRD needs a DM
// (or the admin), because it changes system-wide data.
const router = express.Router();
router.use(requireLogin);
const requireManager = requireRole(["dm", "admin"], "Only a DM can import or remove the SRD");

function requireImported(req, res, next) {
  if (!getStatus().imported) return res.status(404).json({ error: "The SRD has not been imported yet" });
  next();
}

let importing = false;
// v1.0.8: the DM can upload the SRD JSON files from the browser.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 60 } });

router.get("/status", (req, res) => res.json(getStatus()));

router.post("/import", requireManager, async (req, res) => {
  if (importing) return res.status(409).json({ error: "An SRD import is already running" });
  importing = true;
  const source = req.body.source === "download" ? "download" : "folder";
  try {
    const u = req.session.user;
    const status = await importSrd({ source, user: u.username || u.email || u.id || "" });
    audit(req, "srd-import", { source });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err?.message || "Import failed" });
  } finally {
    importing = false;
  }
});

router.post("/import-files", requireManager, upload.array("files", 60), async (req, res) => {
  if (importing) return res.status(409).json({ error: "An SRD import is already running" });
  importing = true;
  try {
    const u = req.session.user;
    const files = (req.files || []).map((f) => ({ name: f.originalname, text: f.buffer.toString("utf8") }));
    const status = await importSrd({ source: "upload", files, user: u.username || u.email || u.id || "" });
    audit(req, "srd-import", { source: "upload", files: files.length });
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err?.message || "Import failed" });
  } finally {
    importing = false;
  }
});

router.delete("/", requireManager, (req, res) => {
  const status = removeSrd();
  audit(req, "srd-remove");
  res.json(status);
});

router.get("/search", requireImported, (req, res) => res.json(searchAll(req.query.q)));

router.get("/:category", requireImported, (req, res) => {
  const list = listCategory(req.params.category);
  if (!list) return res.status(404).json({ error: "Unknown SRD category" });
  res.json(list);
});

router.get("/:category/:index", requireImported, (req, res) => {
  const entry = getEntry(req.params.category, req.params.index);
  if (!entry) return res.status(404).json({ error: "SRD entry not found" });
  res.json(entry);
});

export default router;
