// Card icon for a category or subcategory, from the active icon pack (v1.0.3: the table's pack,
// or this browser's own choice).
import { currentIconPack } from './appearance.js';
const ICON_FILE = { pcs: 'npc', personae: 'npc' };

export function getIconForCategory(category) {
  const set = currentIconPack();
  const name = String(category || '').toLowerCase().replace(/\s+/g, '-');
  return `/icons/${set}/${ICON_FILE[name] || name || 'default'}.svg`;
}
