import { useEffect, useMemo, useState } from 'react';
import NoteCard from './NoteCard.jsx';
import NoteView from './NoteView.jsx';
import NoteEditor from './NoteEditor.jsx';
import Dashboard from './Dashboard.jsx';
import { subcategoryOptions, findMenu } from '../../utils/category.js';

function slugifyTitle(value = '') {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function NotesGrid({ campaign, selected, search, setSearch, user, setSelected, navigation = null, onNewEntry, onNavigate, onOpenSrd }) {
  const [sectionNotes, setSectionNotes] = useState([]);
  const [openSlug, setOpenSlug] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [secretsNote, setSecretsNote] = useState(null);
  const [secretsContent, setSecretsContent] = useState('');
  const [secretsError, setSecretsError] = useState('');
  const [layout, setLayout] = useState(localStorage.getItem('blackquill-layout') || 'portrait-standard');
  const canEdit = String(user?.role || '').toLowerCase() === 'dm';
  // Sections flagged dmWriteOnly (House Rules and Rulings) are readable by players but only the DM can add entries.
  const dmWriteOnly = Boolean(findMenu(navigation, selected.category)?.dmWriteOnly);
  const canCreate = canEdit || !dmWriteOnly;

  async function loadNotes() {
    if (!campaign) return;
    // v0.87: the whole section is loaded once and narrowed to the subcategory here, so the
    // subcategory chips can show how many entries each one holds.
    const q = new URLSearchParams();
    if (selected.category && selected.category !== 'Dashboard') q.set('category', selected.category);
    const data = await fetch(`/api/notes/${campaign.slug}?${q}`).then((r) => r.json());
    setSectionNotes(Array.isArray(data) ? data : []);
    setOpenSlug(selected.openSlug || null);
    setIsEditing(false);
    setSecretsNote(null);
  }

  useEffect(() => { loadNotes(); }, [campaign, selected.category, selected.subcategory, selected.openSlug]);

  useEffect(() => {
    function refreshLayout(){ setLayout(localStorage.getItem('blackquill-layout') || 'portrait-standard'); }
    window.addEventListener('blackquill-layout-changed', refreshLayout);
    window.addEventListener('storage', refreshLayout);
    return () => {
      window.removeEventListener('blackquill-layout-changed', refreshLayout);
      window.removeEventListener('storage', refreshLayout);
    };
  }, []);

  const effectiveSubcategory = selected.category === 'Adventure Groups' && !selected.subcategory ? 'Groups' : selected.subcategory;
  const inSub = (n, sub) => n.subcategory === sub || n.locationLevel === sub;
  const notes = useMemo(() => (effectiveSubcategory ? sectionNotes.filter((n) => inSub(n, effectiveSubcategory)) : sectionNotes), [sectionNotes, effectiveSubcategory]);

  const filtered = useMemo(() => {
    return notes
      .filter((n) => !search || `${n.title} ${n.content} ${(n.tags || []).join(' ')}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  }, [notes, search]);

  const openNote = useMemo(() => {
    if (!openSlug) return null;
    return notes.find((n) => n.slug === openSlug) || null;
  }, [notes, openSlug]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape' && openSlug && !isEditing) closeOpenNote();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [openSlug, isEditing, selected.category, selected.subcategory]);

  function closeOpenNote() {
    setOpenSlug(null);
    setIsEditing(false);
    setSelected({ category: selected.category, subcategory: selected.subcategory || '', openSlug: null });
  }

  function openCard(note) {
    if (openSlug === note.slug) {
      closeOpenNote();
      return;
    }
    setOpenSlug(note.slug);
    setIsEditing(false);
    setSelected({ category: selected.category, subcategory: selected.subcategory || '', openSlug: note.slug });
  }

  async function openWikiLink(target) {
    if (!target || !campaign) return;
    const allNotes = await fetch(`/api/notes/${campaign.slug}`).then((r) => r.json());
    const targetSlug = slugifyTitle(target);
    let found = allNotes.find((n) => n.slug === targetSlug || String(n.title || '').toLowerCase() === String(target).toLowerCase());

    // v0.85.1: [[Name]] with no matching note opens an SRD entry with exactly that name, if there is one.
    if (!found && onOpenSrd) {
      const hits = await fetch(`/api/srd/search?q=${encodeURIComponent(target)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const exact = (Array.isArray(hits) ? hits : []).find((h) => String(h.name).toLowerCase() === String(target).trim().toLowerCase());
      if (exact) { onOpenSrd(exact.category, exact.index); return; }
    }

    if (!found && canEdit) {
      const res = await fetch(`/api/notes/${campaign.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: target,
          category: selected.category === 'Dashboard' ? 'Atlas' : selected.category,
          subcategory: selected.category === 'Adventure Groups' ? 'Groups' : (selected.subcategory || 'City'),
          content: ''
        })
      });
      found = await res.json();
    }

    if (found) {
      setSelected({ category: found.category || 'All Entries', subcategory: found.subcategory || '', openSlug: found.slug });
      setOpenSlug(found.slug);
      setIsEditing(false);
    }
  }

  async function deleteOpenNote(note) {
    if (!canEdit || !campaign || !note) return;
    const confirmed = window.confirm(`Delete "${note.title}" and its entire note folder? This cannot be undone.`);
    if (!confirmed) return;
    const res = await fetch(`/api/notes/${campaign.slug}/${note.slug}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Delete failed');
      return;
    }
    closeOpenNote();
    loadNotes();
  }

  async function openSecrets(note) {
    if (!canEdit || !campaign || !note) return;
    setSecretsError('');
    setSecretsNote(note);
    const res = await fetch(`/api/notes/${campaign.slug}/${note.slug}/secrets`);
    if (!res.ok) {
      setSecretsContent('');
      setSecretsError('Could not load DM secrets');
      return;
    }
    setSecretsContent(await res.text());
  }

  async function saveSecrets() {
    if (!canEdit || !campaign || !secretsNote) return;
    setSecretsError('');
    const res = await fetch(`/api/notes/${campaign.slug}/${secretsNote.slug}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: secretsContent })
    });
    if (!res.ok) {
      setSecretsError('Could not save DM secrets');
      return;
    }
    setSecretsNote(null);
    setSecretsContent('');
  }

  if (!campaign) return null;

  const pageTitle = selected.subcategory || selected.category || 'Dashboard';
  const parentTitle = selected.subcategory ? selected.category : '';
  const chipOptions = ['Dashboard', 'All Entries', 'Settings', 'New Entry'].includes(selected.category) ? [] : subcategoryOptions(navigation, selected.category);
  const isDmSection = selected.category === 'DM Eyes Only';
  const isGroups = selected.category === 'Adventure Groups';
  const activeChip = isGroups ? selected.subcategory || 'Groups' : selected.subcategory;
  // Dashboard is an overview; while searching it falls back to the card list of matches.
  const showDashboard = selected.category === 'Dashboard' && !search;

  return (
    <>
      <header className={`page-header ${isDmSection ? 'dm' : ''}`}>
        <div className="page-header-text">
          {parentTitle && <p className="page-eyebrow">{parentTitle}</p>}
          <h1 className="page-title">{pageTitle}</h1>
          <p className="page-sub">{showDashboard ? `${campaign.name} at a glance · ` : ''}{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}{search ? <> matching “{search}” <button className="link-btn" onClick={() => setSearch('')}>Clear search</button></> : ''}{isDmSection ? ' · hidden from players' : ''}{dmWriteOnly ? (canEdit ? ' · players can read, only you can edit' : ' · only the DM can add entries') : ''}</p>
        </div>
        {onNewEntry && canCreate && <button className="btn primary" onClick={onNewEntry}><span aria-hidden="true">＋</span> New Entry</button>}
      </header>

      {chipOptions.length > 0 && (
        <div className="chip-row" role="tablist" aria-label={`${selected.category} subcategories`}>
          {/* Adventure Groups always shows one subcategory (Groups by default), so it has no "All" chip. */}
          {!isGroups && <button role="tab" aria-selected={!activeChip} className={`chip ${!activeChip ? 'active' : ''}`} onClick={() => onNavigate(selected.category, '')}>All <span className="chip-count">{sectionNotes.length}</span></button>}
          {chipOptions.map((c) => { const count = sectionNotes.filter((n) => inSub(n, c)).length; return <button key={c} role="tab" aria-selected={activeChip === c} aria-label={`${c}, ${count} ${count === 1 ? 'entry' : 'entries'}`} className={`chip ${activeChip === c ? 'active' : ''} ${count ? '' : 'empty'}`} onClick={() => onNavigate(selected.category, c)}>{c} <span className="chip-count">{count}</span></button>; })}
        </div>
      )}

      {showDashboard ? (
        <Dashboard notes={notes} navigation={navigation} layout={layout} onOpen={openCard} onNavigate={onNavigate} onNewEntry={onNewEntry} />
      ) : filtered.length === 0 ? (
        <div className="blank-frame empty-state">
          <div className="empty-glyph" aria-hidden="true">✒</div>
          <h2>{search ? 'No matching entries' : 'Nothing recorded here yet'}</h2>
          <p>{search ? `No entries in ${pageTitle} match “${search}”.` : `Entries you add to ${pageTitle} will appear here as cards.`}</p>
          {search ? <button className="btn" onClick={() => setSearch('')}>Clear search</button> : (onNewEntry && canCreate && <button className="btn primary" onClick={onNewEntry}>Create the first entry</button>)}
        </div>
      ) : (
        <div className={`notes-grid ${layout}`}>
          {filtered.map((n) => (
            <div key={n.slug} className={`note-wrap ${layout}`}>
              <NoteCard note={n} open={openSlug === n.slug} onClick={() => openCard(n)} />
            </div>
          ))}
        </div>
      )}

      {openNote && (
        <div className="note-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !isEditing) closeOpenNote(); }}>
          <div className="note-modal-shell" onMouseDown={(e) => e.stopPropagation()}>
            {!isEditing ? (
              <NoteView
                note={openNote}
                canEdit={canEdit}
                onEdit={() => setIsEditing(true)}
                onDelete={() => deleteOpenNote(openNote)}
                onSecrets={() => openSecrets(openNote)}
                onWikiLink={openWikiLink}
                onSrdLink={(category, index) => onOpenSrd?.(category, index)}
                onClose={closeOpenNote}
              />
            ) : (
              <NoteEditor
                campaign={campaign}
                note={openNote}
                navigation={navigation}
                embedded
                onSaved={(saved) => {
                  setIsEditing(false);
                  setSelected({ category: saved.category, subcategory: saved.subcategory || '', openSlug: saved.slug });
                  loadNotes();
                }}
                onCancel={() => setIsEditing(false)}
              />
            )}
          </div>
        </div>
      )}

      {secretsNote && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSecretsNote(null); }}>
          <div className="confirm-modal dm-secrets-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3>DM Secrets: {secretsNote.title}</h3>
            <p className="hint">Stored as dm-secrets.md in this note folder. Players never receive this content.</p>
            {secretsError && <p className="error">{secretsError}</p>}
            <textarea rows="14" value={secretsContent} onChange={(e) => setSecretsContent(e.target.value)} />
            <div className="modal-actions">
              <button className="note-action-btn" onClick={() => setSecretsNote(null)}>Cancel</button>
              <button className="note-action-btn primary" onClick={saveSecrets}>Save Secrets</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
