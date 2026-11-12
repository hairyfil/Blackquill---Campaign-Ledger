import express from "express";
import { slugifyName } from "../lib/fsdb.js";
import { listCampaigns, addCampaign, findCampaign, deleteCampaign } from "../lib/filesystem/campaigns.js";
import { requireLogin, requireRole, roleOf, audit } from "../lib/auth.js";

const router = express.Router();

// Campaigns are for DMs and players; the admin works in the Admin Console.
function notAdmin(req, res, next) {
  if (roleOf(req) === "admin") return res.status(403).json({ error: "Admin manages the system from the admin console; log in as a DM to manage campaigns" });
  next();
}
const requireDM = requireRole(["dm"], "Only DM can do this");

router.use(requireLogin, notAdmin);

router.get("/", (req, res) => res.json(listCampaigns()));

router.post("/", requireDM, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Campaign name is required" });
  const slug = slugifyName(name);
  if (!slug) return res.status(400).json({ error: "Campaign name needs at least one letter or number" });
  if (listCampaigns().some((c) => c.slug === slug || String(c.name).toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "A campaign with that name already exists" });
  }
  res.json(addCampaign({ id: slug, slug, name, folder: slug, createdBy: req.session.user.id, createdAt: new Date().toISOString() }));
});

// DM-only, permanent. The body must repeat the campaign's full name exactly
// (case and spaces included) as confirmation: { confirmName: "<campaign name>" }.
router.delete("/:campaignSlug", requireDM, (req, res) => {
  const campaign = findCampaign(req.params.campaignSlug);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const name = String(campaign.name || campaign.slug);
  if (String(req.body.confirmName ?? "") !== name) {
    return res.status(400).json({ error: "The name you typed does not match the campaign name exactly. Nothing was deleted." });
  }
  try {
    deleteCampaign(campaign);
  } catch (err) {
    return res.status(500).json({ error: `Could not delete the campaign: ${err.message}` });
  }
  audit(req, "campaign-delete", { campaign: campaign.slug, name });
  res.json({ ok: true, deleted: { slug: campaign.slug, name } });
});

export default router;
