import { useEffect, useRef, useState } from 'react';

// v0.85.1 note link autocomplete.
// Typing [[ in the note text opens a list of matching campaign notes and SRD entries.
// Picking a note inserts [[Note Title]]; picking an SRD entry inserts [[srd:<category>/<index>|Name]].

const MAX_NOTES = 8;
const MAX_SRD = 8;

// Text between an unclosed [[ and the caret, or null when the caret is not inside a link.
function openQuery(text, caret) {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf('[[');
  if (start < 0) return null;
  const inner = before.slice(start + 2);
  if (inner.includes(']]') || inner.includes('\n') || inner.length > 60) return null;
  return { start, query: inner.split('|')[0] };
}

// Pixel position of the caret inside the textarea (mirror-div technique).
const COPY_STYLES = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordWrap', 'overflowWrap'];
function caretPosition(el, caret) {
  const div = document.createElement('div');
  const cs = window.getComputedStyle(el);
  for (const k of COPY_STYLES) div.style[k] = cs[k];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.overflowWrap = 'break-word';
  div.textContent = el.value.slice(0, caret);
  const span = document.createElement('span');
  span.textContent = '​';
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop - el.scrollTop + parseFloat(cs.lineHeight || '20');
  const left = Math.min(span.offsetLeft - el.scrollLeft, el.clientWidth - 280);
  document.body.removeChild(div);
  return { top: Math.max(0, top), left: Math.max(0, left) };
}

export default function LinkTextarea({ value, onChange, campaign, className = '', rows = 16 }) {
  const ref = useRef(null);
  const [notes, setNotes] = useState(null);
  const [srdOn, setSrdOn] = useState(false);
  const [state, setState] = useState(null); // { start, query, pos }
  const [srdResults, setSrdResults] = useState([]);
  const [active, setActive] = useState(0);

  // Load note titles once per campaign, and whether the SRD is available.
  useEffect(() => {
    if (!campaign?.slug) return;
    fetch(`/api/notes/${campaign.slug}`).then((r) => (r.ok ? r.json() : [])).then((d) => setNotes(Array.isArray(d) ? d : [])).catch(() => setNotes([]));
    fetch('/api/srd/status').then((r) => (r.ok ? r.json() : {})).then((s) => setSrdOn(Boolean(s?.imported))).catch(() => setSrdOn(false));
  }, [campaign?.slug]);

  // SRD search, debounced.
  useEffect(() => {
    if (!state || !srdOn || state.query.trim().length < 2) { setSrdResults([]); return; }
    const q = state.query.trim();
    const t = setTimeout(() => {
      fetch(`/api/srd/search?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : [])).then((d) => setSrdResults(Array.isArray(d) ? d.slice(0, MAX_SRD) : [])).catch(() => setSrdResults([]));
    }, 150);
    return () => clearTimeout(t);
  }, [state?.query, srdOn]);

  const q = (state?.query || '').trim().toLowerCase();
  const noteResults = state ? (notes || [])
    .filter((n) => !q || String(n.title || '').toLowerCase().includes(q))
    .sort((a, b) => (String(b.title).toLowerCase().startsWith(q) - String(a.title).toLowerCase().startsWith(q)) || String(a.title).localeCompare(String(b.title)))
    .slice(0, MAX_NOTES) : [];
  const options = [
    ...noteResults.map((n) => ({ kind: 'note', key: `n:${n.slug}`, label: n.title, meta: n.subcategory || n.category, insert: `[[${n.title}]]` })),
    ...srdResults.map((s) => ({ kind: 'srd', key: `s:${s.category}/${s.index}`, label: s.name, meta: `SRD · ${s.categoryLabel}`, insert: `[[srd:${s.category}/${s.index}|${s.name}]]` }))
  ];

  useEffect(() => { setActive(0); }, [state?.query, srdResults.length, noteResults.length]);

  function refresh(el) {
    const found = openQuery(el.value, el.selectionStart);
    if (!found || el.selectionStart !== el.selectionEnd) { setState(null); return; }
    setState({ ...found, pos: caretPosition(el, el.selectionStart) });
  }

  function choose(opt) {
    const el = ref.current;
    if (!el || !state || !opt) return;
    const caret = el.selectionStart;
    // Also swallow an existing ]] right after the caret (e.g. when editing an old link).
    const after = el.value.slice(caret);
    const closeAt = after.indexOf(']]');
    const swallow = closeAt >= 0 && !after.slice(0, closeAt).includes('\n') && !after.slice(0, closeAt).includes('[[') ? closeAt + 2 : 0;
    const next = el.value.slice(0, state.start) + opt.insert + el.value.slice(caret + swallow);
    const pos = state.start + opt.insert.length;
    onChange(next);
    setState(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
  }

  function onKeyDown(e) {
    if (!state || !options.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(options[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setState(null); }
  }

  const open = state && (options.length > 0 || q.length >= 2);

  return (
    <div className="link-textarea">
      <textarea
        ref={ref}
        className={className}
        rows={rows}
        value={value}
        onChange={(e) => { onChange(e.target.value); refresh(e.target); }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) refresh(e.target); }}
        onClick={(e) => refresh(e.target)}
        onBlur={() => setTimeout(() => setState(null), 150)}
        aria-autocomplete="list"
        aria-expanded={open ? 'true' : 'false'}
      />
      {open && (
        <ul className="link-suggest" role="listbox" style={{ top: state.pos.top, left: state.pos.left }}>
          {options.length === 0 && <li className="link-suggest-empty">No matching notes{srdOn ? ' or SRD entries' : ''}. Finish with ]] to link a new note.</li>}
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === active}>
              <button type="button" className={`link-suggest-item ${i === active ? 'active' : ''} ${o.kind}`} onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}>
                <span className="link-suggest-label">{o.label}</span>
                <span className="link-suggest-meta">{o.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
