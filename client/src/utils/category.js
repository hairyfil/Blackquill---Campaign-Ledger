// Navigation comes from GET /api/navigation, already limited to what this user may see:
// enabled menus and subcategories only, and DM Eyes Only only for the DM.

const SYSTEM_MENUS = ['dashboard', 'all-entries', 'settings'];

export function findMenu(nav, category) {
  return (nav?.menus || []).find((m) => m.label === category || m.key === category);
}

// Menus that hold entries (not Dashboard, All Entries or Settings).
export function entryMenus(nav) {
  return (nav?.menus || []).filter((m) => !SYSTEM_MENUS.includes(m.key));
}

export function subcategoryOptions(nav, category) {
  return (findMenu(nav, category)?.subcategories || []).map((s) => s.label);
}
