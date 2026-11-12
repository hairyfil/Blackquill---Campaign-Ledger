import { useEffect, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: true, linkify: true });

const escapeHtml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// [[Note Title]], [[Note Title|label]] and (v0.85.1) [[srd:<category>/<index>|label]].
function wikiToLinks(content = '') {
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => {
    const rawTarget = String(target || '').trim();
    const srd = /^srd:([a-z0-9-]+)\/([a-z0-9-]+)$/i.exec(rawTarget);
    if (srd) {
      const text = escapeHtml(String(label || srd[2].replace(/-/g, ' ')).trim());
      return `<a href="#" class="wiki-link srd-ref" data-srd-category="${srd[1]}" data-srd-index="${srd[2]}" title="SRD entry">${text}</a>`;
    }
    const cleanTarget = rawTarget.replace(/"/g, '&quot;');
    const cleanLabel = String(label || target || '').trim();
    return `<a href="#" class="wiki-link" data-wiki="${cleanTarget}">${cleanLabel}</a>`;
  });
}

// v0.87: Delete lives in a "More" menu, away from Edit, so it is not one mis-tap away.
function MoreMenu({ onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [open]);
  return (
    <div className="more-menu" ref={ref}>
      <button className="small-action more-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded={open ? 'true' : 'false'} title="More actions" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}><span aria-hidden="true">⋯</span></button>
      {open && (
        <div className="more-menu-list" role="menu">
          <button role="menuitem" className="more-menu-item danger" onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete?.(); }}>Delete entry…</button>
        </div>
      )}
    </div>
  );
}

export default function NoteView({ note, canEdit = false, onEdit, onDelete, onSecrets, onWikiLink, onSrdLink, onClose }) {
  function handleClick(e) {
    const link = e.target.closest?.('a.wiki-link');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      if (link.dataset.srdCategory) onSrdLink?.(link.dataset.srdCategory, link.dataset.srdIndex);
      else onWikiLink?.(link.dataset.wiki);
      return;
    }

    const external = e.target.closest?.('a[href^="http"]');
    if (external) {
      external.setAttribute('target', '_blank');
      external.setAttribute('rel', 'noreferrer');
      e.stopPropagation();
      return;
    }

    // Clicking the open note itself a second time closes it.
    e.stopPropagation();
    onClose?.();
  }

  const html = md.render(wikiToLinks(note.content || ''));

  return (
    <article className="note-view" onClick={handleClick}>
      <div className="note-view-header" onClick={(e) => e.stopPropagation()}>
        <div className="note-view-heading">
          <div className="note-meta"><span>{note.category}</span>{note.subcategory ? <><span aria-hidden="true"> › </span><span>{note.subcategory}</span></> : null}</div>
          <h2>{note.title}</h2>
        </div>
        <div className="note-view-actions">
          {canEdit && <button className="small-action primary" onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>Edit</button>}
          {canEdit && <button className="small-action dm-secrets-btn" onClick={(e) => { e.stopPropagation(); onSecrets?.(); }}><span aria-hidden="true">◉ </span>DM Secrets</button>}
          {canEdit && <MoreMenu onDelete={onDelete} />}
          <button className="small-action close-btn" aria-label="Close note" title="Close (Esc)" onClick={(e) => { e.stopPropagation(); onClose?.(); }}>✕</button>
        </div>
      </div>

      {note.wikiSource?.url && (
        <aside className="wiki-import-banner" onClick={(e) => e.stopPropagation()}>
          <strong>Imported from the Forgotten Realms Wiki</strong>
          {note.wikiSource.importedAt ? <span className="wiki-import-date"> on {String(note.wikiSource.importedAt).slice(0, 10)}</span> : null}
          <br />
          Original article: <a href={note.wikiSource.url} target="_blank" rel="noreferrer">{note.wikiSource.url}</a>
          <span className="wiki-import-licence"> · Text licensed <a href={note.wikiSource.licenseUrl || 'https://creativecommons.org/licenses/by-sa/3.0/'} target="_blank" rel="noreferrer">{note.wikiSource.license || 'CC BY-SA 3.0'}</a></span>
        </aside>
      )}

      {note.images?.length > 0 && (
        <div className="thumbs" onClick={(e) => e.stopPropagation()}>
          {note.images.map((i, idx) => (
            <a key={idx} href={i.url} target="_blank" rel="noreferrer" title={i.source ? `${i.caption || ''}${i.caption ? ' · ' : ''}Image from the Forgotten Realms Wiki: ${i.source}` : (i.caption || undefined)}>
              <img src={i.url} alt={i.caption || note.title || 'note image'} />
            </a>
          ))}
        </div>
      )}

      <div className="note-content" dangerouslySetInnerHTML={{ __html: html }} />
      <footer className="note-close-hint">Press Esc or click the page to close</footer>
    </article>
  );
}
