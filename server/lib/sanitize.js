// js-yaml cannot write undefined values, so null/undefined values and empty objects
// are removed before a note's front matter is saved.
const keep = (v) => v !== undefined && v !== null && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

export function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined).filter(keep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, removeUndefined(v)]).filter(([, v]) => keep(v)));
  }
  return value;
}
