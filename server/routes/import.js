import express from "express";
import { lookup, importArticle, titleFromUrl } from "../lib/fandom.js";
import { requireLogin } from "../lib/auth.js";

// Forgotten Realms Wiki lookup and import. Any logged-in user (players can create notes too).
const router = express.Router();
router.use(requireLogin);

function sendError(res, err) {
  const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
  res.status(err.status || (timedOut ? 504 : 502)).json({ error: timedOut ? "The Forgotten Realms Wiki did not answer in time." : (err.message || "Import failed") });
}

// GET /api/import/forgotten-realms/lookup?name=Waterdeep
// -> { query, exact: {title,url,disambiguation} | null, suggestions: [{title,url,snippet}] }
router.get("/forgotten-realms/lookup", async (req, res) => {
  try {
    res.json(await lookup(String(req.query.name || "")));
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/import/forgotten-realms?name=Waterdeep  or  ?url=https://forgottenrealms.fandom.com/wiki/Waterdeep
// -> { title, url, content, facts, images: [{sourceUrl, previewUrl, file, caption, filePage}], wikiSource }
// Nothing is written here. Images are downloaded into the note's folder when the note is saved
// (POST /api/notes/:campaign/:slug/wiki-images).
router.get("/forgotten-realms", async (req, res) => {
  const url = req.query.url ? String(req.query.url) : "";
  if (url && !titleFromUrl(url)) {
    return res.status(400).json({ error: "Use a Forgotten Realms Wiki article URL, e.g. https://forgottenrealms.fandom.com/wiki/Waterdeep" });
  }
  try {
    res.json(await importArticle({ name: String(req.query.name || ""), url }));
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
