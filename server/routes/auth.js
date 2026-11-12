import express from "express";
import bcrypt from "bcryptjs";
import { PATHS } from "../lib/filesystem/paths.js";
import { readUsers, writeUsers, findUserByLogin, publicUser } from "../lib/users.js";
import { isDebugEnabled, debugServerLog } from "../lib/debug.js";

const router = express.Router();

// One login for everyone. All accounts live in system/users.json.
router.post("/login", (req, res) => {
  const login = String(req.body.email || req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const debug = isDebugEnabled();
  const trace = (...args) => { if (debug) debugServerLog("Login:", ...args); };
  trace(`attempt for "${login}"`);

  const users = readUsers();
  trace(`users file: ${PATHS.usersFile} (${users.length} account(s))`);
  const user = findUserByLogin(users, login);
  if (!user) {
    trace("failed: no account with that username or email");
    return res.status(401).json({ error: "Invalid login" });
  }
  const ok = bcrypt.compareSync(password, user.passwordHash || "");
  trace(`matched "${user.username || user.email}" (${user.role || "player"}); password ${ok ? "OK" : "does not match"}`);
  if (!ok) return res.status(401).json({ error: "Invalid login" });
  if (user.locked) {
    trace("rejected: account is locked");
    return res.status(403).json({ error: "User account is locked" });
  }

  user.lastLogin = new Date().toISOString();
  try { writeUsers(users); } catch {}

  trace("success");
  req.session.user = publicUser(user);
  res.json(req.session.user);
});

router.post("/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));
router.get("/me", (req, res) => res.json(req.session.user || null));

export default router;
