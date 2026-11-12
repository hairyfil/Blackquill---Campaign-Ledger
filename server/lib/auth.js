import fs from "fs";
import { PATHS } from "./filesystem/paths.js";

// Shared route guards and the audit log.

export function roleOf(req) {
  return String(req.session?.user?.role || "").toLowerCase();
}

export const isDm = (req) => roleOf(req) === "dm";

export function requireLogin(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Not logged in" });
  next();
}

// requireRole(["dm", "admin"], "Only DM/admin can edit settings")
export function requireRole(roles, error) {
  return (req, res, next) => {
    if (!roles.includes(roleOf(req))) return res.status(403).json({ error });
    next();
  };
}

// v0.86.4: the demo account may look at everything its role can see but change nothing.
// Every /api request that is not a read (GET/HEAD/OPTIONS) is refused, except logging in and out.
// The client shows DEMO_BLOCKED_MESSAGE in a popup when it gets { demo: true } back.
export const DEMO_BLOCKED_MESSAGE = "This is blocked in demo mode. The demo account can look around but cannot add, change or delete anything.";
const DEMO_ALLOWED_WRITES = new Set(["/auth/login", "/auth/logout"]);

export function blockDemoWrites(req, res, next) {
  if (!req.session?.user?.demo) return next();
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || DEMO_ALLOWED_WRITES.has(req.path)) return next();
  audit(req, "demo-blocked", { method: req.method, path: req.originalUrl });
  res.status(403).json({ error: DEMO_BLOCKED_MESSAGE, demo: true });
}

// One JSON object per line in system/audit.log.
export function audit(req, action, details = {}) {
  try {
    const u = req.session?.user || {};
    const line = { timestamp: new Date().toISOString(), user: u.username || u.email || u.id || "", role: u.role || "", action, ...details };
    fs.appendFileSync(PATHS.auditLog, JSON.stringify(line) + "\n");
  } catch {}
}
