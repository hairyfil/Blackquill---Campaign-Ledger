import fs from "fs";
import path from "path";
import { PATHS, VERSION } from "./filesystem/paths.js";
import { listCampaigns } from "./filesystem/campaigns.js";
import { ensureDir, ensureFile } from "./fsdb.js";
import { isDebugEnabled } from "./debug.js";
import { hasAdminAccount, createAdminAccount, ensureDemoAccount, DEMO_USERNAME, MIN_ADMIN_PASSWORD } from "./users.js";
import { DEFAULT_SETTINGS } from "./settings.js";

const DEFAULT_STYLE = {
  name: "Default",
  primary: "#1C1C1E",
  secondary: "#2A2D34",
  accent: "#C2A96A",
  highlight: "#4DA3FF",
  text: "#EAE6D6",
  cardBg: "#F0E4C6",
  cardText: "#1f1a14",
  dmWarning: "#C94A4A",
  fontHeader: "Cinzel, Georgia, serif",
  fontBody: "Inter, Arial, sans-serif"
};

function defaultSvg(label, fill = "#C2A96A") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#1C1C1E" stroke="${fill}" stroke-width="3"/><text x="32" y="38" text-anchor="middle" font-size="18" font-family="serif" fill="${fill}">${label}</text></svg>`;
}

// v0.87: the old default banner, kept only to recognise an untouched copy and replace it.
function oldDefaultBannerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="450" viewBox="0 0 1600 450">
  <rect width="1600" height="450" fill="#1C1C1E"/>
  <rect x="24" y="24" width="1552" height="402" rx="28" fill="#2A2D34" stroke="#C2A96A" stroke-width="6"/>
  <text x="800" y="220" text-anchor="middle" fill="#C2A96A" font-size="86" font-family="serif">BlackQuill</text>
  <text x="800" y="285" text-anchor="middle" fill="#EAE6D6" font-size="32" font-family="sans-serif">Campaign Ledger</text>
</svg>`;
}

// v0.87–v1.0.4 default banner, kept only to recognise an untouched copy and replace it.
function v087DefaultBannerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="420" viewBox="0 0 1600 420">
  <defs>
    <radialGradient id="glow" cx="50%" cy="0%" r="75%">
      <stop offset="0" stop-color="#C2A96A" stop-opacity=".22"/>
      <stop offset="1" stop-color="#C2A96A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26282E"/>
      <stop offset="1" stop-color="#17171A"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="420" fill="url(#bg)"/>
  <rect width="1600" height="420" fill="url(#glow)"/>
  <g transform="translate(800 120)" fill="none" stroke="#C2A96A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-34 44 C-10 10 18 -18 46 -40 C30 -6 4 22 -24 40 Z" fill="#C2A96A" fill-opacity=".18"/>
    <path d="M-34 44 L22 -22"/>
    <path d="M-34 44 L-44 58"/>
  </g>
  <text x="800" y="262" text-anchor="middle" fill="#C2A96A" font-size="96" letter-spacing="6" font-family="Cinzel, 'Trajan Pro', Georgia, 'Times New Roman', serif">BlackQuill</text>
  <g stroke="#C2A96A" stroke-opacity=".6" stroke-width="2">
    <line x1="460" y1="316" x2="580" y2="316"/>
    <line x1="1020" y1="316" x2="1140" y2="316"/>
  </g>
  <text x="800" y="325" text-anchor="middle" fill="#EAE6D6" fill-opacity=".85" font-size="26" letter-spacing="8" font-family="Georgia, 'Times New Roman', serif">CAMPAIGN LEDGER</text>
</svg>`;
}

// v1.0.5: the title fills the banner (large gold "BlackQuill"), with a ruled "CAMPAIGN LEDGER"
// line under it, a small quill at its left end and a diamond at its right.
function defaultBannerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="420" viewBox="0 0 1600 420">
  <defs>
    <radialGradient id="glow" cx="50%" cy="10%" r="80%">
      <stop offset="0" stop-color="#C2A96A" stop-opacity=".24"/>
      <stop offset="1" stop-color="#C2A96A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26282E"/>
      <stop offset="1" stop-color="#17171A"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E2CD94"/>
      <stop offset=".55" stop-color="#C2A96A"/>
      <stop offset="1" stop-color="#9C8248"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="420" fill="url(#bg)"/>
  <rect width="1600" height="420" fill="url(#glow)"/>
  <text x="800" y="266" text-anchor="middle" fill="url(#gold)" font-size="224" letter-spacing="4" font-family="Cinzel, 'Trajan Pro', Georgia, 'Times New Roman', serif">BlackQuill</text>
  <g stroke="#C2A96A" stroke-opacity=".65" stroke-width="2.5">
    <line x1="330" y1="336" x2="530" y2="336"/>
    <line x1="1070" y1="336" x2="1270" y2="336"/>
  </g>
  <g transform="translate(320 336)" fill="none" stroke="#C2A96A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-22 22 C-6 6 10 -10 30 -24 C20 -4 4 12 -14 20 Z" fill="#C2A96A" fill-opacity=".25"/>
    <path d="M-22 22 L14 -10"/>
  </g>
  <path d="M1280 336 L1290 326 L1300 336 L1290 346 Z" fill="#C2A96A" fill-opacity=".8"/>
  <text x="800" y="348" text-anchor="middle" fill="#EAE6D6" fill-opacity=".88" font-size="34" letter-spacing="12" font-family="Georgia, 'Times New Roman', serif">CAMPAIGN LEDGER</text>
</svg>`;
}

const DEFAULT_ICONS = {
  default: "BQ", city: "CT", town: "TN", village: "VG", region: "RG", continent: "CO", world: "WD",
  site: "ST", npc: "NP", personae: "NP", organisations: "OR", armory: "AR", codex: "CX", quests: "Q",
  chronicle: "CH", adventure: "AG", pc: "PC"
};

// Replaces a file only if it still holds exactly the old built-in default.
function replaceIfUntouched(file, oldContent, newContent) {
  try {
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8").trim() === oldContent.trim()) fs.writeFileSync(file, newContent);
  } catch {}
}

// Safe initialization: create only missing folders/files. Never overwrite user data
// (untouched copies of older default banners and the old login text are updated).
function ensureDefaults() {
  for (const dir of [PATHS.campaigns, PATHS.defaultTemplate, PATHS.styles, PATHS.defaultIcons, PATHS.banners, PATHS.backups, PATHS.datasets]) ensureDir(dir);
  ensureFile(PATHS.campaignsFile, "[]");
  ensureFile(PATHS.settingsFile, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  // v0.87: no default login text (the banner already names the app). An untouched
  // v0.86-or-earlier default is cleared; text a DM wrote is never changed.
  const introFile = path.join(PATHS.defaultTemplate, "intro.txt");
  ensureFile(introFile, "");
  replaceIfUntouched(introFile, "Welcome to BlackQuill Campaign Ledger", "");
  ensureFile(path.join(PATHS.styles, "default-style.json"), JSON.stringify(DEFAULT_STYLE, null, 2));
  const bannerFile = path.join(PATHS.banners, "default-banner.svg");
  ensureFile(bannerFile, defaultBannerSvg());
  // Untouched copies of earlier default banners (v0.86 and v0.87–v1.0.4) become the current one.
  for (const old of [oldDefaultBannerSvg(), v087DefaultBannerSvg()]) replaceIfUntouched(bannerFile, old, defaultBannerSvg());
  for (const [name, label] of Object.entries(DEFAULT_ICONS)) ensureFile(path.join(PATHS.defaultIcons, `${name}.svg`), defaultSvg(label));
}

// No built-in admin password. If there is no admin, the first browser visit shows a
// setup screen (routes/setup.js). For headless installs (Docker), BLACKQUILL_ADMIN_PASSWORD
// creates the admin at startup.
function ensureAdminOrSetup() {
  if (hasAdminAccount()) {
    console.log("✔ Admin account exists");
    return;
  }
  const envPassword = String(process.env.BLACKQUILL_ADMIN_PASSWORD || "");
  if (envPassword.length >= MIN_ADMIN_PASSWORD) {
    createAdminAccount(process.env.BLACKQUILL_ADMIN_USERNAME || "admin", envPassword);
    console.log("✔ Created admin account from BLACKQUILL_ADMIN_PASSWORD");
    return;
  }
  if (envPassword) console.log(`✖ BLACKQUILL_ADMIN_PASSWORD is shorter than ${MIN_ADMIN_PASSWORD} characters; ignored. Use the setup page instead.`);
  console.log("! No admin account yet. Open BlackQuill in your browser to choose the admin password.");
}

// v0.86.4: the read-only demo account always exists (it cannot be deleted from the Admin Console).
function ensureDemo() {
  const result = ensureDemoAccount();
  if (result === "created") console.log(`✔ Created read-only demo account (login "${DEMO_USERNAME}", password "demo")`);
  else if (result === "login-taken") console.log(`! Another account already uses the login "${DEMO_USERNAME}", so the demo account was not created.`);
}

function debugLog() {
  console.log(`BlackQuill ${VERSION}, data folder: ${PATHS.root}`);
  if (!isDebugEnabled()) return;
  console.log("\n========== BlackQuill Data Init ==========");
  for (const [key, value] of Object.entries(PATHS)) console.log(`[${key}] ${fs.existsSync(value) ? "✔" : "✖"} ${value}`);
  const campaigns = listCampaigns();
  console.log("\n[Campaigns]");
  if (!campaigns.length) console.log("⚠ none yet");
  campaigns.forEach((c) => console.log("✔", c.slug, c.name || ""));
  console.log("\n[Styles]");
  fs.readdirSync(PATHS.styles).forEach((s) => console.log("-", s));
  console.log("\n[Icon sets]");
  fs.readdirSync(PATHS.icons).forEach((s) => console.log("-", s));
  console.log("=========================================\n");
}

export function initData() {
  ensureDefaults();
  ensureAdminOrSetup();
  ensureDemo();
  debugLog();
}
