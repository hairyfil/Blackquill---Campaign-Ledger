import path from "path";

export const VERSION = "v1.0.8"; // ledger 1550b672-2d09-4942-be5d-4cffcb114f8e

const DATA_ROOT = process.env.BLACKQUILL_DATA
  ? path.resolve(process.env.BLACKQUILL_DATA)
  : path.resolve("../blackquill-common-data");

const SYSTEM = path.join(DATA_ROOT, "system");
const CAMPAIGNS = path.join(DATA_ROOT, "campaigns");

// blackquill-common-data/
//   system/      everything that is not campaign content
//   campaigns/   one folder per campaign
export const PATHS = {
  root: DATA_ROOT,

  // ---- system/ ----
  system: SYSTEM,
  usersFile: path.join(SYSTEM, "users.json"),
  settingsFile: path.join(SYSTEM, "settings.json"),
  navigationFile: path.join(SYSTEM, "navigation.json"),
  auditLog: path.join(SYSTEM, "audit.log"),

  templates: path.join(SYSTEM, "templates"),
  defaultTemplate: path.join(SYSTEM, "templates", "default"),
  styles: path.join(SYSTEM, "styles"),
  icons: path.join(SYSTEM, "icons"),
  defaultIcons: path.join(SYSTEM, "icons", "default"),
  banners: path.join(SYSTEM, "images", "banners"),
  datasets: path.join(SYSTEM, "datasets"),
  srd: path.join(SYSTEM, "srd"),
  backups: path.join(SYSTEM, "backups"),

  // ---- campaigns/ ----
  campaigns: CAMPAIGNS,
  campaignsFile: path.join(CAMPAIGNS, "campaigns.json")
};
