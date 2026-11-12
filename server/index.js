import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { initData } from "./lib/initData.js";
import { PATHS, VERSION } from "./lib/filesystem/paths.js";
import { hasAdminAccount } from "./lib/users.js";
import { blockDemoWrites } from "./lib/auth.js";
import { isDebugForced, isDebugEnabled } from "./lib/debug.js";
import authRoutes from "./routes/auth.js";
import setupRoutes from "./routes/setup.js";
import campaignRoutes from "./routes/campaigns.js";
import noteRoutes from "./routes/notes.js";
import templateRoutes from "./routes/template.js";
import importRoutes from "./routes/import.js";
import iconRoutes from "./routes/icons.js";
import navigationRoutes from "./routes/navigation.js";
import adminRoutes from "./routes/admin.js";
import srdRoutes from "./routes/srd.js";

initData();
const app = express();
const PORT = process.env.PORT || 3001;
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");

app.use(express.json({ limit: "10mb" }));
// Routes read req.body.x directly; Express 5 leaves req.body undefined when there is no JSON body.
app.use((req, res, next) => { req.body ??= {}; next(); });
app.use(session({ secret: process.env.SESSION_SECRET || "blackquill-dev-secret", resave: false, saveUninitialized: false }));
app.use("/api", blockDemoWrites);
app.use("/icons", express.static(PATHS.icons));

// Public: the running version (top bar) and whether debug logging is on (forced or saved).
app.get("/api/version", (req, res) => res.json({ version: VERSION }));
app.get("/api/debug-status", (req, res) => res.json({ forced: isDebugForced(), enabled: isDebugEnabled() }));
app.use("/api/setup", setupRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/template", templateRoutes);
app.use("/api/import", importRoutes);
app.use("/api/icons", iconRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/srd", srdRoutes);

app.use(express.static(clientDist));
app.get("/{*path}", (req, res) => res.sendFile(path.join(clientDist, "index.html")));

app.listen(PORT, () => {
  console.log(`BlackQuill running at http://localhost:${PORT}`);
  if (!hasAdminAccount()) console.log(`FIRST START: open http://localhost:${PORT} in your browser and choose the admin password.`);
  if (isDebugForced()) console.log("DEBUG MODE FORCED ON from the command line (overrides the saved admin setting).");
});
