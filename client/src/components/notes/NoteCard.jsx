import { useState } from 'react';
import { getIconForCategory } from '../../utils/icons.js';
import { currentIconPack } from '../../utils/appearance.js';

// Plain-text preview of a note's Markdown (links and images reduced to their text).
export function excerpt(content = '', length = 140){
 return String(content)
  .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, l) => l || t)
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/^#+\s.*$/gm, '')
  .replace(/[*_`>#|-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, length);
}

// v0.87: a note without a picture is a compact text card. The old placeholder seal ("BQ")
// made every card look the same. Custom icon packs still show a small icon by the title.
function iconPackActive(){
 return currentIconPack() !== 'default';
}

function CardIcon({ note }){
 const sources = [note.subcategory, note.category].filter(Boolean).map((c) => getIconForCategory(c));
 const [index, setIndex] = useState(0);
 if (index >= sources.length) return null;
 return <img className="note-card-icon" src={sources[index]} alt="" loading="lazy" onError={() => setIndex((i) => i + 1)} />;
}

export default function NoteCard({ note, open, onClick }){
 const img = note.images?.[0]?.url || note.thumbnail || '';
 const text = excerpt(note.content);
 const dm = note.category === 'DM Eyes Only';
 return <button type="button" className={`note-card ${open?'open':''} ${img ? 'has-image' : 'text-card'} ${dm ? 'dm' : ''}`} onClick={onClick} aria-label={`Open ${note.title}`}>
  {img && <span className="note-card-media"><img className="note-card-image" src={img} alt="" loading="lazy" onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} /></span>}
  <span className="note-card-body">
   <span className="note-card-head">
    {!img && iconPackActive() && <CardIcon note={note} />}
    <span className="note-card-title" title={note.title}>{note.title}</span>
   </span>
   <span className="note-card-category">{note.subcategory || note.category}</span>
   {text && <span className="note-card-excerpt">{text}</span>}
  </span>
 </button>
}
