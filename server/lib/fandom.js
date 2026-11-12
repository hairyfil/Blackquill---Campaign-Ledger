// v0.86: Forgotten Realms Wiki (forgottenrealms.fandom.com) lookup and import.
//
// Everything goes through the wiki's MediaWiki API (api.php), not page scraping:
//   lookup  -> action=query (exact title, follows redirects, case-insensitive retry)
//              then action=opensearch + list=search for the closest matches
//   import  -> action=parse (article HTML, image list, categories)
//              then prop=imageinfo for real image URLs and sizes
//
// Wiki text is CC-BY-SA 3.0. Every import keeps the source URL, the page title
// and an attribution line in the note (see buildAttribution).

const WIKI_HOST = "forgottenrealms.fandom.com";
const WIKI_BASE = `https://${WIKI_HOST}`;
const WIKI_API = `${WIKI_BASE}/api.php`;
const WIKI_LICENSE = "CC BY-SA 3.0";
const WIKI_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/";
// Fandom serves every uploaded file from this CDN. Image downloads are limited to it.
const IMAGE_HOSTS = ["static.wikia.nocookie.net"];

const USER_AGENT = "BlackQuill-Campaign-Ledger/0.86.4 (self-hosted D&D notes app)";
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_SIDE = 150;
const TIMEOUT_MS = 15000;

// Sections that are lists of sources or wiki housekeeping, not lore.
const SKIP_SECTIONS = /^(appearances|gallery|further reading|references|notes|external links|connections|see also|footnotes|sources|bibliography|trivia and notes)$/i;

function timedFetch(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": USER_AGENT } });
}

// Any page on the wiki (articles and File: pages), used to accept attribution links.
export function isWikiUrl(value) {
  return /^https:\/\/forgottenrealms\.fandom\.com\//i.test(String(value || ""));
}

async function api(params) {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await timedFetch(`${WIKI_API}?${qs.toString()}`);
  if (!res.ok) {
    const err = new Error(`Forgotten Realms Wiki answered ${res.status}`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

function titleToUrl(title = "") {
  const page = String(title || "").trim().replace(/\s+/g, "_");
  return `${WIKI_BASE}/wiki/${encodeURIComponent(page).replace(/%2F/gi, "/").replace(/%3A/gi, ":").replace(/%5F/g, "_")}`;
}

// Accepts https://forgottenrealms.fandom.com/wiki/Some_Page (with or without https://,
// #section or ?query) and returns "Some Page". Anything else returns "".
export function titleFromUrl(raw = "") {
  let value = String(raw || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let url;
  try { url = new URL(value); } catch { return ""; }
  if (url.hostname.toLowerCase() !== WIKI_HOST) return "";
  let title = "";
  const match = url.pathname.match(/^\/wiki\/(.+)$/);
  if (match) title = match[1];
  else if (url.pathname === "/index.php" && url.searchParams.get("title")) title = url.searchParams.get("title");
  if (!title) return "";
  try { title = decodeURIComponent(title); } catch { /* keep raw */ }
  title = title.replace(/_/g, " ").trim();
  // Only articles: no File:, Category:, Special: and so on.
  if (/^(file|image|category|special|template|user|user talk|talk|forgotten realms wiki|help|mediawiki|module|message wall|thread|board):/i.test(title)) return "";
  return title;
}

function titleCase(s) {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

async function queryTitles(titles) {
  const data = await api({ action: "query", titles: titles.join("|"), redirects: "1", prop: "pageprops|info", ppprop: "disambiguation" });
  return data?.query?.pages || [];
}

function isDisambiguation(page) {
  return Boolean(page?.pageprops && Object.prototype.hasOwnProperty.call(page.pageprops, "disambiguation"));
}

// Returns { query, exact: {title,url,disambiguation} | null, suggestions: [{title,url,snippet}] }
export async function lookup(name = "") {
  const query = String(name || "").trim().slice(0, 200);
  if (!query) return { query, exact: null, suggestions: [] };

  // 1. Exact title (MediaWiki only normalises the first letter, so also try Title Case).
  const variants = Array.from(new Set([query, titleCase(query.toLowerCase())]));
  let exact = null;
  const pages = await queryTitles(variants);
  const hit = pages.find((p) => !p.missing && !p.invalid && p.ns === 0);
  if (hit) exact = { title: hit.title, url: titleToUrl(hit.title), disambiguation: isDisambiguation(hit) };

  // 2. Closest matches: opensearch (title prefix, follows redirects) first, then full-text search.
  const seen = new Set(exact ? [exact.title.toLowerCase()] : []);
  const suggestions = [];
  const push = (title, snippet = "") => {
    if (!title || seen.has(title.toLowerCase()) || suggestions.length >= 6) return;
    seen.add(title.toLowerCase());
    suggestions.push({ title, url: titleToUrl(title), snippet: cleanSnippet(snippet) });
  };

  const [open, search] = await Promise.all([
    api({ action: "opensearch", search: query, limit: "5", namespace: "0", redirects: "resolve" }).catch(() => null),
    api({ action: "query", list: "search", srsearch: query, srlimit: "6", srnamespace: "0", srwhat: "text" }).catch(() => null)
  ]);
  // A spelling fix offered by search ("Did you mean") goes first.
  const fixed = search?.query?.searchinfo?.suggestion;
  if (fixed && !exact) {
    const fixedPages = await queryTitles([fixed]).catch(() => []);
    const fixedHit = fixedPages.find((p) => !p.missing && p.ns === 0);
    if (fixedHit) push(fixedHit.title);
  }
  if (Array.isArray(open?.[1])) open[1].forEach((t) => push(t));
  (search?.query?.search || []).forEach((r) => push(r.title, r.snippet));

  return { query, exact, suggestions };
}

function cleanSnippet(html = "") {
  return decodeEntities(String(html).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim().slice(0, 200);
}

function decodeEntities(s = "") {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Text that ends up in Markdown. The reader renders Markdown with HTML enabled,
// so angle brackets are escaped again after decoding.
function toText(html = "") {
  return decodeEntities(String(html).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\s+/g, " ")
    .trim();
}

// Inline HTML -> Markdown text, keeping wiki links as plain text and bold/italic.
function inlineToMarkdown(html = "") {
  let s = String(html);
  s = s.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => { const t = toText(inner); return t ? `**${t}**` : ""; });
  s = s.replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, inner) => { const t = toText(inner); return t ? `*${t}*` : ""; });
  return toText(s).replace(/\*\*\s*\*\*/g, "").replace(/\s+([,.;:!?])/g, "$1");
}

function removeBlocks(html, tag, classPattern) {
  // Removes <tag class="...pattern...">...</tag>, handling nesting of the same tag.
  const open = new RegExp(`<${tag}\\b[^>]*class="[^"]*(?:${classPattern})[^"]*"[^>]*>`, "i");
  let out = html;
  for (let guard = 0; guard < 200; guard++) {
    const m = open.exec(out);
    if (!m) break;
    const start = m.index;
    const re = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}>`, "gi");
    re.lastIndex = start + m[0].length;
    let depth = 1; let end = out.length; let t;
    while ((t = re.exec(out))) {
      if (t[0][1] === "/") { depth--; if (depth === 0) { end = t.index + t[0].length; break; } }
      else depth++;
    }
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

function extractInfobox(html) {
  const asideMatch = html.match(/<aside\b[^>]*portable-infobox[\s\S]*?<\/aside>/i);
  if (!asideMatch) return { facts: [], html };
  const aside = asideMatch[0];
  const facts = [];
  const re = /<h3[^>]*class="[^"]*pi-data-label[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<div[^>]*class="[^"]*pi-data-value[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(aside)) && facts.length < 14) {
    const label = toText(m[1]);
    // List items and line breaks inside a value become ", " (marked first so numbers like 1,347,840 stay intact).
    const value = toText(m[2].replace(/<sup[\s\S]*?<\/sup>/gi, "").replace(/<li[^>]*>|<br\s*\/?>/gi, " \u0001 "))
      .split("\u0001").map((part) => part.trim()).filter(Boolean).join(", ");
    if (label && value && value.length < 200) facts.push({ label, value });
  }
  return { facts, html: html.replace(aside, "") };
}

// Article HTML (from action=parse) -> Markdown sections.
function htmlToMarkdown(rawHtml = "") {
  let html = String(rawHtml);
  html = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<sup[\s\S]*?<\/sup>/gi, "")
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>\s*<\/span>|<span[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>/gi, "");

  const { facts, html: withoutInfobox } = extractInfobox(html);
  html = withoutInfobox;
  html = removeBlocks(html, "table", "navbox|metadata|ambox|wikitable|toccolours|infobox");
  html = removeBlocks(html, "div", "toc|navbox|reflist|references|thumb|gallery|noprint|notice|quote-box|dablink|hatnote|mw-references-wrap|wikia-gallery");
  html = removeBlocks(html, "figure", "thumb|image|tright|tleft|mw-");
  html = html.replace(/<figure[\s\S]*?<\/figure>/gi, "").replace(/<table[\s\S]*?<\/table>/gi, "");

  const lines = [];
  let skipping = false;
  const blockRe = /<(h[2-4])\b[^>]*>([\s\S]*?)<\/\1>|<p\b[^>]*>([\s\S]*?)<\/p>|<(ul|ol)\b[^>]*>([\s\S]*?)<\/\4>|<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi;
  let m;
  while ((m = blockRe.exec(html))) {
    if (m[1]) {
      const heading = toText(m[2]);
      const level = Number(m[1][1]);
      if (level === 2) skipping = SKIP_SECTIONS.test(heading);
      if (!skipping && heading) lines.push(`${"#".repeat(level)} ${heading}`);
      continue;
    }
    if (skipping) continue;
    if (m[3] !== undefined) {
      const text = inlineToMarkdown(m[3]);
      if (text && !/^This article is (a stub|about)/i.test(text)) lines.push(text);
    } else if (m[5] !== undefined) {
      const ordered = m[4].toLowerCase() === "ol";
      const items = [];
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let li; let n = 1;
      while ((li = liRe.exec(m[5]))) {
        const text = inlineToMarkdown(li[1].replace(/<(ul|ol)[\s\S]*$/i, ""));
        if (text) items.push(`${ordered ? `${n++}.` : "-"} ${text}`);
      }
      if (items.length) lines.push(items.join("\n"));
    } else if (m[6] !== undefined) {
      const text = inlineToMarkdown(m[6]);
      if (text) lines.push(`> ${text}`);
    }
  }

  // Drop headings with nothing under them.
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const isHeading = /^#{2,4} /.test(lines[i]);
    if (isHeading) {
      const level = lines[i].match(/^#+/)[0].length;
      let j = i + 1; let hasBody = false;
      while (j < lines.length) {
        const next = lines[j].match(/^(#{2,4}) /);
        if (next && next[1].length <= level) break;
        if (!next) { hasBody = true; break; }
        j++;
      }
      if (!hasBody) continue;
    }
    cleaned.push(lines[i]);
  }
  return { facts, markdown: cleaned.join("\n\n") };
}

function buildAttribution(title, url, importedAt = new Date().toISOString()) {
  const date = importedAt.slice(0, 10);
  return `Text from the Forgotten Realms Wiki article "[${title}](${url})", imported ${date}. `
    + `Licensed under [${WIKI_LICENSE}](${WIKI_LICENSE_URL}); see the article history for its authors. `
    + `Images keep their own licences, listed on each file page. BlackQuill is not affiliated with Fandom or Wizards of the Coast.`;
}

function safeImageFilename(name, used) {
  const dot = name.lastIndexOf(".");
  const ext = (dot > 0 ? name.slice(dot + 1) : "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
  let file = `wiki-${base}.${ext}`;
  let n = 2;
  while (used.has(file)) file = `wiki-${base}-${n++}.${ext}`;
  used.add(file);
  return file;
}

function captionFromFilename(name) {
  return name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

// Captions written on the article (figure captions / thumbcaptions), keyed by file name.
function captionsFromHtml(html = "") {
  const map = new Map();
  const re = /(?:data-image-name|data-image-key)="([^"]+)"(?:(?!data-image-name|data-image-key)[\s\S]){0,4000}?<(?:figcaption|div class="thumbcaption")[^>]*>([\s\S]*?)<\/(?:figcaption|div)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const key = decodeEntities(m[1]).replace(/_/g, " ").toLowerCase();
    const caption = toText(m[2].replace(/<sup[\s\S]*?<\/sup>/gi, "")).replace(/&lt;|&gt;/g, "");
    if (caption && !map.has(key)) map.set(key, caption.slice(0, 200));
  }
  return map;
}

async function imageInfo(fileNames) {
  if (!fileNames.length) return [];
  const data = await api({
    action: "query",
    titles: fileNames.map((f) => `File:${f}`).join("|"),
    prop: "imageinfo",
    iiprop: "url|size|mime",
    iiurlwidth: "1200"
  });
  return data?.query?.pages || [];
}

// Returns { title, url, content, facts, images:[{sourceUrl, previewUrl, file, caption, filePage}], wikiSource }
export async function importArticle({ name = "", url = "" } = {}) {
  const title = url ? titleFromUrl(url) : String(name || "").trim();
  if (!title) {
    const err = new Error(url ? "Use a Forgotten Realms Wiki article URL, e.g. https://forgottenrealms.fandom.com/wiki/Waterdeep" : "Enter a note name or a wiki URL.");
    err.status = 400;
    throw err;
  }

  const data = await api({ action: "parse", page: title, prop: "text|images|displaytitle", redirects: "1", disableeditsection: "1", disabletoc: "1" });
  if (data?.error) {
    const err = new Error(data.error.code === "missingtitle" ? "not found" : (data.error.info || "Import failed"));
    err.status = data.error.code === "missingtitle" ? 404 : 502;
    throw err;
  }
  const parse = data?.parse || {};
  const pageTitle = parse.title || title;
  const pageUrl = titleToUrl(pageTitle);
  const html = typeof parse.text === "string" ? parse.text : (parse.text?.["*"] || "");
  const { facts, markdown } = htmlToMarkdown(html);
  const importedAt = new Date().toISOString();

  // Images: files used on the page, skipping icons, logos and tiny pictures.
  const candidates = (parse.images || [])
    .map((f) => String(f).replace(/_/g, " "))
    .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
    .filter((f) => !/(icon|logo|symbol of|stub|wiki-wordmark|placeholder|no image|^portal|flag of|button|arrow|disambig)/i.test(f))
    .slice(0, 20);
  const captions = captionsFromHtml(html);
  const infos = await imageInfo(candidates).catch(() => []);
  const order = new Map(candidates.map((f, i) => [f.toLowerCase(), i]));
  const used = new Set();
  const images = infos
    .map((p) => ({ name: String(p.title || "").replace(/^File:/i, ""), info: p.imageinfo?.[0] }))
    .filter((x) => x.info?.url && /^image\//.test(x.info.mime || "image/") && (x.info.width || 999) >= MIN_IMAGE_SIDE && (x.info.height || 999) >= MIN_IMAGE_SIDE)
    .filter((x) => isAllowedImageUrl(x.info.url))
    .sort((a, b) => (order.get(a.name.toLowerCase()) ?? 99) - (order.get(b.name.toLowerCase()) ?? 99))
    .slice(0, MAX_IMAGES)
    .map((x) => ({
      sourceUrl: x.info.thumburl && isAllowedImageUrl(x.info.thumburl) ? x.info.thumburl : x.info.url,
      previewUrl: x.info.thumburl || x.info.url,
      file: safeImageFilename(x.name, used),
      caption: captions.get(x.name.toLowerCase()) || captionFromFilename(x.name),
      filePage: x.info.descriptionurl || titleToUrl(`File:${x.name}`)
    }));

  const factsMd = facts.length ? `## Quick Facts\n\n${facts.map((f) => `- **${f.label}:** ${f.value}`).join("\n")}\n\n` : "";
  const body = markdown || "The wiki page was found, but no article text could be extracted. Add your own notes below.";
  // v0.86.1: the "Imported from" notice is shown by the reader from wikiSource, at the top of the note.
  const content = `${factsMd}${body}\n\n## DM Notes\n\n\n## Source\n\n${buildAttribution(pageTitle, pageUrl, importedAt)}\n`;

  return {
    title: pageTitle,
    url: pageUrl,
    content,
    facts,
    images,
    wikiSource: { site: "Forgotten Realms Wiki", title: pageTitle, url: pageUrl, license: WIKI_LICENSE, licenseUrl: WIKI_LICENSE_URL, importedAt }
  };
}

export function isAllowedImageUrl(raw = "") {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && IMAGE_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// Downloads one wiki image. Returns { buffer, ext } or throws.
export async function downloadImage(sourceUrl) {
  if (!isAllowedImageUrl(sourceUrl)) throw new Error("Images can only be imported from the wiki's own image server.");
  const res = await timedFetch(sourceUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  if (res.url && !isAllowedImageUrl(res.url)) throw new Error("Image redirected off the wiki's image server.");
  const type = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!MIME_EXT[type]) throw new Error(`Not a supported image (${type || "unknown type"})`);
  const length = Number(res.headers.get("content-length") || 0);
  if (length > MAX_IMAGE_BYTES) throw new Error("Image is larger than 10 MB");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image is larger than 10 MB");
  return { buffer, ext: MIME_EXT[type] };
}
