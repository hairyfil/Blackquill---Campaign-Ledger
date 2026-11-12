import express from "express";
import { hasAdminAccount, createAdminAccount, readUsers, findUserByLogin, publicUser, MIN_ADMIN_PASSWORD } from "../lib/users.js";

// First-run setup: only works while no admin account exists.
const router = express.Router();

router.get("/status", (req, res) => res.json({ needsSetup: !hasAdminAccount(), minPasswordLength: MIN_ADMIN_PASSWORD }));

router.post("/", (req, res) => {
  if (hasAdminAccount()) return res.status(409).json({ error: "Setup is already complete. Log in instead." });
  const username = String(req.body.username || "admin").trim() || "admin";
  const password = String(req.body.password || "");
  const confirm = String(req.body.confirm ?? password);
  if (!/^[A-Za-z0-9._@-]{2,64}$/.test(username)) return res.status(400).json({ error: "Username can use letters, numbers and . _ @ - (2 to 64 characters)." });
  if (password.length < MIN_ADMIN_PASSWORD) return res.status(400).json({ error: `Password must be at least ${MIN_ADMIN_PASSWORD} characters.` });
  if (password !== confirm) return res.status(400).json({ error: "The two passwords do not match." });
  if (findUserByLogin(readUsers(), username)) return res.status(409).json({ error: "That username is already used by another account. Choose a different one." });
  const admin = createAdminAccount(username, password);
  console.log(`✔ Admin account "${admin.username}" created from the setup page`);
  req.session.user = publicUser(admin);
  res.json(req.session.user);
});

export default router;
