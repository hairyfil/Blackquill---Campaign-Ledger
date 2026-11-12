import fs from "fs";
import path from "path";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Writes the file only when it does not exist yet.
export function ensureFile(file, content) {
  if (fs.existsSync(file)) return;
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

export function listFilesRecursive(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, predicate));
    else if (predicate(full)) out.push(full);
  }
  return out;
}

export function listFolders(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

// Copies the contents of src into dest. Returns the list of files copied.
//   overwrite: replace files that already exist in dest (default true)
//   skip(p):   return true to leave out a file or folder
//   debug:     log each folder and file
export function copyTree(src, dest, { overwrite = true, skip = () => false, debug = false } = {}) {
  const copied = [];
  const walk = (from, to) => {
    if (skip(from)) return;
    if (fs.statSync(from).isDirectory()) {
      ensureDir(to);
      if (debug) console.log(`[BlackQuill DEBUG] ensure folder: ${to}`);
      for (const entry of fs.readdirSync(from)) walk(path.join(from, entry), path.join(to, entry));
    } else if (overwrite || !fs.existsSync(to)) {
      fs.copyFileSync(from, to);
      copied.push(to);
      if (debug) console.log(`[BlackQuill DEBUG] copied file: ${from} -> ${to}`);
    } else if (debug) {
      console.log(`[BlackQuill DEBUG] skipped existing file: ${to}`);
    }
  };
  if (fs.existsSync(src)) walk(src, dest);
  return copied;
}

// "Lost Mine of Phandelver" -> "lost-mine-of-phandelver"
export function slugifyName(name = "") {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
