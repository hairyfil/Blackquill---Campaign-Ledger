import express from "express";
import fs from "fs";
import path from "path";
import { PATHS } from "../lib/filesystem/paths.js";
import { listFolders } from "../lib/fsdb.js";

const router = express.Router();

// Icon packs are folders under system/icons/; the files are served from /icons/<pack>/.
router.get("/", (req, res) => res.json(listFolders(PATHS.icons)));

router.get("/:set", (req, res) => {
  const dir = path.join(PATHS.icons, String(req.params.set).replace(/[^a-zA-Z0-9_-]/g, ""));
  if (!fs.existsSync(dir)) return res.json([]);
  res.json(fs.readdirSync(dir).filter((f) => /\.(svg|png|jpg|jpeg|webp)$/i.test(f)));
});

export default router;
