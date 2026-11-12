import { useEffect, useMemo, useState } from 'react';
import LinkTextarea from './LinkTextarea.jsx';
import { subcategoryOptions, entryMenus } from '../../utils/category.js';

const defaultForm = {
  title: '',
  category: '',
  subcategory: '',
  locationLevel: '',
  parentSlug: '',
  content: '',
  tags: [],
  visibility: 'dm',
  images: []
};

function formSnapshot(form) {
  return JSON.stringify({
    title: form.title || '',
    category: form.category || '',
    subcategory: form.subcategory || '',
    locationLevel: form.locationLevel || '',
    parentSlug: form.parentSlug || '',
    content: form.content || '',
    tags: Array.isArray(form.tags) ? form.tags : [],
    visibility: form.visibility || 'dm',
    images: Array.isArray(form.images) ? form.images : []
  });
}


function templateFor(category, subcategory) {
  if (category === 'Adventure Groups') {
    return '## Character Details\n\n**Player Name:** \n\n**Character Name:** \n\n**Pet/Familiar Details:** \n\n**Race:** \n\n**Background:** \n\n**Traits:** \n\n**Hates/Wishes:** \n\n**Character Sheet URL:** \n';
  }
  if (category === 'Personae') return '## Description\n\n## Motives\n\n## Relationships\n';
  if (category === 'Quests') return '## Objective\n\n## NPC Contacts\n\n## Rewards\n\n## Deadline\n\n## Related Locations\n';
  if (category === 'Atlas') return `## Summary\n\n## Geography\n\n## Notable Locations\n\n## Linked Notes\n`;
  if (category === 'DM Eyes Only') return `## ${subcategory || 'DM Notes'}\n\n`;
  return '## Notes\n\n';
}

const WIKI_URL_RE = /^(https?:\/\/)?forgottenrealms\.fandom\.com\/(wiki\/|index\.php\?)/i;
const emptyLookup = { status: 'idle', query: '', exact: null, suggestions: [], error: '' };

// True when the note text is empty or still the untouched category template.
function isTemplateOrEmpty(content, category, subcategory) {
  const text = String(content || '').trim();
  return !text || text === templateFor(category, subcategory).trim();
}

// Categories a user may put entries in: dmWriteOnly sections (House Rules and Rulings) are DM-only.
function writableMenus(navigation, user) {
  const isDm = !user || String(user.role || '').toLowerCase() === 'dm';
  return entryMenus(navigation).filter((m) => !m.dmWriteOnly || isDm);
}

function firstSubcategory(navigation, category) {
  return subcategoryOptions(navigation, category)[0] || (category === 'Adventure Groups' ? 'Groups' : '');
}

// The form for an existing note, or for a new entry. A new entry starts in the section
// the user was viewing (category, and subcategory if one was open).
function initialForm(note, defaults, navigation, user) {
  if (note) {
    return {
      ...defaultForm,
      ...note,
      images: Array.isArray(note.images) ? note.images : [],
      category: note.category || '',
      subcategory: note.subcategory || firstSubcategory(navigation, note.category),
      locationLevel: note.locationLevel || note.subcategory || ''
    };
  }
  const category = defaults?.category || '';
  if (!category || !writableMenus(navigation, user).some((m) => m.label === category)) return { ...defaultForm };
  const options = subcategoryOptions(navigation, category);
  const subcategory = options.includes(defaults.subcategory) ? defaults.subcategory : firstSubcategory(navigation, category);
  return {
    ...defaultForm,
    category,
    subcategory,
    locationLevel: category === 'Atlas' ? subcategory : '',
    content: templateFor(category, subcategory)
  };
}

export default function NoteEditor({ campaign, note = null, onSaved, onCancel, embedded = false, navigation = null, user = null, defaults = null }) {
  const [form, setForm] = useState(defaultForm);
  const [initialSnapshot, setInitialSnapshot] = useState(formSnapshot(defaultForm));
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  // v0.86: Forgotten Realms Wiki lookup while typing a new note's title.
  const [wikiLookup, setWikiLookup] = useState(emptyLookup);
  const [wikiUrl, setWikiUrl] = useState('');
  const [wikiImport, setWikiImport] = useState(null); // { title, url, images: [...] } after an import
  const [pickedImages, setPickedImages] = useState([]); // files of wiki images to download on save
  const [saveStatus, setSaveStatus] = useState('');
  // v0.87: pictures chosen before a new entry's first save; uploaded right after it is saved.
  const [pendingImages, setPendingImages] = useState([]); // [{ file, url }]
  const [showWikiUrl, setShowWikiUrl] = useState(false);
  // v0.87: Atlas entries pick their parent location by title ("Located in") instead of typing a slug.
  const [atlasNotes, setAtlasNotes] = useState([]);

  useEffect(() => {
    const next = initialForm(note, defaults, navigation, user);
    setForm(next);
    setInitialSnapshot(formSnapshot(next));
    setShowCloseConfirm(false);
    setUploadError('');
    setSaveError('');
    setImportError('');
    setWikiLookup(emptyLookup);
    setWikiUrl('');
    setWikiImport(null);
    setPickedImages([]);
    setPendingImages((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.url)); return []; });
    setShowWikiUrl(false);
  }, [note]);

  useEffect(() => {
    if (form.category !== 'Atlas' || !campaign?.slug) return;
    let alive = true;
    fetch(`/api/notes/${campaign.slug}?category=Atlas`).then((r) => (r.ok ? r.json() : [])).then((list) => { if (alive) setAtlasNotes(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { alive = false; };
  }, [form.category, campaign?.slug]);

  // Check the wiki shortly after the title stops changing (new entries only).
  useEffect(() => {
    if (note) return undefined;
    const name = String(form.title || '').trim();
    if (name.length < 3) { setWikiLookup(emptyLookup); return undefined; }
    const controller = new AbortController();
    setWikiLookup((prev) => (prev.query === name && prev.status === 'done' ? prev : { ...emptyLookup, status: 'checking', query: name }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/import/forgotten-realms/lookup?name=${encodeURIComponent(name)}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Wiki lookup failed');
        setWikiLookup({ status: 'done', query: name, exact: data.exact || null, suggestions: data.suggestions || [], error: '' });
      } catch (err) {
        if (err.name === 'AbortError') return;
        setWikiLookup({ ...emptyLookup, status: 'error', query: name, error: err.message || 'Wiki lookup failed' });
      }
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.title, note]);

  const dirty = useMemo(() => formSnapshot(form) !== initialSnapshot || pendingImages.length > 0, [form, initialSnapshot, pendingImages]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') requestClose();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [dirty]);

  const options = subcategoryOptions(navigation, form.category);
  const availableCategories = writableMenus(navigation, user).map((m) => m.label);
  const existingNoteSlug = note?.slug || form.slug;

  function updateForm(patch) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateCategory(category) {
    const subcategory = firstSubcategory(navigation, category);
    setForm((prev) => {
      const next = {
        ...prev,
        category,
        subcategory,
        locationLevel: category === 'Atlas' ? subcategory : ''
      };
      if (!note && !String(prev.content || '').trim()) {
        next.content = templateFor(category, subcategory);
      }
      return next;
    });
  }

  function updateSubcategory(subcategory) {
    setForm((prev) => {
      const next = {
        ...prev,
        subcategory,
        locationLevel: prev.category === 'Atlas' ? subcategory : prev.locationLevel
      };
      if (!note && !String(prev.content || '').trim()) {
        next.content = templateFor(prev.category, subcategory);
      }
      return next;
    });
  }

  async function importFromWiki(url) {
    const target = String(url || '').trim();
    if (!target) return;
    if (!WIKI_URL_RE.test(target)) {
      setImportError('Use a Forgotten Realms Wiki article URL, e.g. https://forgottenrealms.fandom.com/wiki/Waterdeep');
      return;
    }
    if (!isTemplateOrEmpty(form.content, form.category, form.subcategory)
      && !window.confirm('Replace the text you have written with the wiki article?')) return;

    setImporting(true);
    setImportError('');
    try {
      const res = await fetch(`/api/import/forgotten-realms?url=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 404 ? 'That wiki page does not exist. Check the URL or pick a suggestion.' : (data.error || 'Import failed'));

      setForm((prev) => ({
        ...prev,
        title: String(prev.title || '').trim() ? prev.title : (data.title || ''),
        content: data.content || prev.content || '',
        tags: Array.from(new Set([...(prev.tags || []), 'Forgotten Realms', 'Imported'])),
        wikiSource: data.wikiSource
      }));
      setWikiImport({ title: data.title, url: data.url, images: data.images || [] });
      setPickedImages((data.images || []).map((i) => i.file));
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function undoWikiImport() {
    setForm((prev) => ({
      ...prev,
      content: prev.category ? templateFor(prev.category, prev.subcategory) : '',
      tags: (prev.tags || []).filter((t) => t !== 'Forgotten Realms' && t !== 'Imported'),
      wikiSource: undefined
    }));
    setWikiImport(null);
    setPickedImages([]);
  }

  function togglePickedImage(file) {
    setPickedImages((prev) => (prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]));
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!campaign?.slug || !existingNoteSlug) {
      setUploadError('');
      setPendingImages((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
      event.target.value = '';
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const data = new FormData();
      data.append('image', file);

      const res = await fetch(`/api/notes/${campaign.slug}/${existingNoteSlug}/image`, {
        method: 'POST',
        body: data
      });

      const uploaded = await res.json();
      if (!res.ok) throw new Error(uploaded.error || 'Image upload failed');

      setForm((prev) => ({
        ...prev,
        images: [...(prev.images || []), uploaded].filter(Boolean)
      }));
    } catch (err) {
      setUploadError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function deleteImage(image, index) {
    const confirmed = window.confirm('Delete this image from the note folder?');
    if (!confirmed) return;

    const file = image?.file || image?.filename || image?.path || '';

    try {
      if (campaign?.slug && existingNoteSlug && file && !/^https?:\/\//i.test(file)) {
        await fetch(`/api/notes/${campaign.slug}/${existingNoteSlug}/image/${encodeURIComponent(file)}`, {
          method: 'DELETE'
        });
      }
    } catch (err) {
      setUploadError(err.message || 'Image delete failed');
      return;
    }

    setForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  }

  async function save() {
    if (!campaign?.slug) return false;
    if (!form.category || !form.subcategory) { setSaveError('Choose a category and subcategory before saving.'); return false; }
    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch(`/api/notes/${campaign.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      let saved = await res.json();
      if (!res.ok) throw new Error(saved.error || 'Save failed');

      // v0.86: download the wiki images picked during import into the new note's folder.
      const images = !note && wikiImport ? wikiImport.images.filter((i) => pickedImages.includes(i.file)) : [];
      if (images.length) {
        setSaveStatus(`Downloading ${images.length} wiki image${images.length === 1 ? '' : 's'}...`);
        try {
          const imgRes = await fetch(`/api/notes/${campaign.slug}/${saved.slug}/wiki-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images })
          });
          const result = await imgRes.json();
          if (!imgRes.ok) throw new Error(result.error || 'Image download failed');
          if (result.note) saved = { ...saved, ...result.note };
          if (result.failed?.length) window.alert(`The note was saved, but ${result.failed.length} of ${images.length} wiki images could not be downloaded:\n\n${result.failed.map((f) => f.error).join('\n')}`);
        } catch (err) {
          window.alert(`The note was saved, but the wiki images could not be downloaded: ${err.message}`);
        }
      }

      // v0.87: upload pictures chosen before the first save, then record them on the note.
      if (!note && pendingImages.length) {
        setSaveStatus(`Uploading ${pendingImages.length} picture${pendingImages.length === 1 ? '' : 's'}...`);
        const added = [];
        const failed = [];
        for (const p of pendingImages) {
          try {
            const data = new FormData();
            data.append('image', p.file);
            const upRes = await fetch(`/api/notes/${campaign.slug}/${saved.slug}/image`, { method: 'POST', body: data });
            const uploaded = await upRes.json();
            if (!upRes.ok) throw new Error(uploaded.error || 'Upload failed');
            added.push(uploaded);
          } catch (err) {
            failed.push(`${p.file.name}: ${err.message}`);
          }
        }
        if (added.length) {
          const reRes = await fetch(`/api/notes/${campaign.slug}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...saved, images: [...(saved.images || []), ...added] })
          });
          if (reRes.ok) saved = await reRes.json();
        }
        if (failed.length) window.alert(`The note was saved, but ${failed.length} picture${failed.length === 1 ? '' : 's'} could not be uploaded:\n\n${failed.join('\n')}`);
        pendingImages.forEach((p) => URL.revokeObjectURL(p.url));
        setPendingImages([]);
      }

      setInitialSnapshot(formSnapshot(saved));
      onSaved?.(saved);
      return true;
    } catch (err) {
      setSaveError(err.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
      setSaveStatus('');
    }
  }

  function requestClose() {
    if (dirty) {
      setShowCloseConfirm(true);
      return;
    }
    onCancel?.();
  }

  async function saveAndClose() {
    const ok = await save();
    if (ok) {
      setShowCloseConfirm(false);
      onCancel?.();
    }
  }

  function closeWithoutSaving() {
    setShowCloseConfirm(false);
    onCancel?.();
  }

  const editorContent = (
      <div className={embedded ? 'editor-popout embedded-editor-popout' : 'editor-popout'} onClick={(e) => e.stopPropagation()}>
        <div className="note-view-header editor-header">
          <div>
            <div className="note-meta">{form.category || 'No category yet'}{form.subcategory ? ` › ${form.subcategory}` : ''}{dirty ? <span className="dirty-dot"> · Unsaved changes</span> : null}</div>
            <h2>{note ? 'Edit Entry' : 'New Entry'}</h2>
          </div>

          <div className="note-actions">
            <button className="note-action-btn primary" type="button" onClick={save} disabled={saving}>{saving ? (saveStatus || 'Saving...') : 'Save'}</button>
            <button className="note-action-btn" type="button" onClick={requestClose}>Close</button>
          </div>
        </div>

        {saveError && <p className="error" role="alert">{saveError}</p>}

        {note && form.wikiSource?.url && (
          <p className="wiki-import-banner compact">Imported from the Forgotten Realms Wiki: <a href={form.wikiSource.url} target="_blank" rel="noreferrer">{form.wikiSource.url}</a></p>
        )}

        <label>
          Title
          <input value={form.title} onChange={(e) => updateForm({ title: e.target.value })} />
        </label>

        {!note && (
          <section className="import-panel wiki-panel" aria-live="polite">
            <div className="wiki-panel-head">
              <strong>Forgotten Realms Wiki</strong>
              {wikiLookup.status === 'checking' && <span className="hint">Checking the wiki...</span>}
              {wikiLookup.status === 'idle' && !wikiImport && <span className="hint">Type a title and BlackQuill looks it up.</span>}
              {!wikiImport && <button type="button" className="link-btn wiki-url-toggle" aria-expanded={showWikiUrl ? 'true' : 'false'} onClick={() => setShowWikiUrl((v) => !v)}>{showWikiUrl ? 'Hide URL box' : 'Paste a URL'}</button>}
            </div>

            {wikiImport ? (
              <div className="wiki-imported">
                <p>Imported <a href={wikiImport.url} target="_blank" rel="noreferrer">{wikiImport.title}</a>. Review the text below before you save.</p>
                {wikiImport.images.length > 0 ? (
                  <>
                    <p className="hint">Ticked images are saved into this entry's folder when you press Save.</p>
                    <div className="wiki-image-picker">
                      {wikiImport.images.map((img) => (
                        <label key={img.file} className={pickedImages.includes(img.file) ? 'wiki-image picked' : 'wiki-image'} title={img.caption}>
                          <input type="checkbox" checked={pickedImages.includes(img.file)} onChange={() => togglePickedImage(img.file)} />
                          <img src={img.previewUrl || img.sourceUrl} alt={img.caption || img.file} loading="lazy" referrerPolicy="no-referrer" />
                          <span>{img.caption}</span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : <p className="hint">The article has no images to import.</p>}
                <button type="button" className="note-action-btn" onClick={undoWikiImport}>Undo import</button>
              </div>
            ) : (
              <>
                {wikiLookup.status === 'error' && <p className="hint">Could not reach the wiki ({wikiLookup.error}). Use Paste a URL, or write the entry yourself.</p>}
                {wikiLookup.status !== 'idle' && wikiLookup.status !== 'error' && wikiLookup.query && (
                  wikiLookup.exact ? (
                    <div className="wiki-match">
                      <span>Found <a href={wikiLookup.exact.url} target="_blank" rel="noreferrer">{wikiLookup.exact.title}</a>{wikiLookup.exact.disambiguation ? ' (a page listing several meanings, so a suggestion below may fit better)' : ''}</span>
                      <button type="button" className="primary" onClick={() => importFromWiki(wikiLookup.exact.url)} disabled={importing}>{importing ? 'Importing...' : 'Import'}</button>
                    </div>
                  ) : wikiLookup.status === 'done' && (
                    wikiLookup.suggestions[0] ? (
                      <div className="wiki-match">
                        <span>No page called "{wikiLookup.query}". Closest match: <a href={wikiLookup.suggestions[0].url} target="_blank" rel="noreferrer">{wikiLookup.suggestions[0].title}</a></span>
                        <button type="button" className="primary" onClick={() => importFromWiki(wikiLookup.suggestions[0].url)} disabled={importing}>{importing ? 'Importing...' : 'Import this'}</button>
                      </div>
                    ) : <p className="hint">No wiki page matches "{wikiLookup.query}". Use Paste a URL, or write the entry yourself.</p>
                  )
                )}
                {wikiLookup.status === 'done' && wikiLookup.suggestions.length > (wikiLookup.exact ? 0 : 1) && (
                  <div className="wiki-suggestions">
                    <span className="hint">{wikiLookup.exact ? 'Other pages:' : 'Other close matches:'}</span>
                    {wikiLookup.suggestions.slice(wikiLookup.exact ? 0 : 1).map((sug) => (
                      <button key={sug.url} type="button" className="wiki-chip" title={sug.snippet || sug.url} onClick={() => { setWikiUrl(sug.url); setShowWikiUrl(true); }}>{sug.title}</button>
                    ))}
                  </div>
                )}
                {showWikiUrl && <div className="alternative-url-row">
                  <input value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); importFromWiki(wikiUrl); } }} placeholder="Or paste a wiki URL, e.g. https://forgottenrealms.fandom.com/wiki/Waterdeep" aria-label="Forgotten Realms Wiki URL" />
                  <button type="button" onClick={() => importFromWiki(wikiUrl)} disabled={importing || !wikiUrl.trim()}>{importing ? 'Importing...' : 'Import URL'}</button>
                </div>}
              </>
            )}
            {importError && <p className="error">{importError}</p>}
          </section>
        )}

        <div className="field-row">
        <label>
          Category
          <select value={form.category} onChange={(e) => updateCategory(e.target.value)}>
            <option value="">Select category</option>{availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label>
          Subcategory
          <select value={form.subcategory || ''} onChange={(e) => updateSubcategory(e.target.value)}>
            <option value="">Select subcategory</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        </div>

        {form.category === 'Atlas' && (
          <label>
            Located in
            <span className="hint label-hint">The larger place this one belongs to, e.g. a city's region.</span>
            <select value={form.parentSlug || ''} onChange={(e) => updateForm({ parentSlug: e.target.value })}>
              <option value="">Not inside another place</option>
              {form.parentSlug && !atlasNotes.some((n) => n.slug === form.parentSlug) && <option value={form.parentSlug}>{form.parentSlug} (entry not found)</option>}
              {atlasNotes.filter((n) => n.slug !== (note?.slug || '')).map((n) => <option key={n.slug} value={n.slug}>{n.title}{n.subcategory ? ` (${n.subcategory})` : ''}</option>)}
            </select>
          </label>
        )}

        <label>
          Content
          <span className="hint label-hint">Markdown supported. Type [[ to link another entry or an SRD entry (spells, monsters, items…).</span>
          <LinkTextarea className="content-input" rows={16} value={form.content || ''} campaign={campaign} onChange={(content) => updateForm({ content })} />
        </label>

        <section className="image-upload-panel">
          <label>
            Pictures
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
          </label>
          <p className="hint">{note ? "Pictures are stored in this entry's own folder beside its Markdown file." : 'Pictures you add now are uploaded into the entry\'s folder when you press Save.'}</p>
          {uploading && <p className="hint">Uploading...</p>}
          {uploadError && <p className="error">{uploadError}</p>}
          {(form.images?.length > 0 || pendingImages.length > 0) && (
            <div className="thumbs image-manager">
              {form.images.map((img, idx) => (
                <div className="image-manager-item" key={`${img.file || img.url || idx}-${idx}`}>
                  <a href={img.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    <img src={img.url} alt={img.caption || img.file || form.title || 'note image'} />
                  </a>
                  <button className="note-action-btn danger" type="button" onClick={() => deleteImage(img, idx)}>Delete</button>
                </div>
              ))}
              {pendingImages.map((p, idx) => (
                <div className="image-manager-item pending" key={p.url}>
                  <img src={p.url} alt={p.file.name} />
                  <button className="note-action-btn" type="button" onClick={() => { URL.revokeObjectURL(p.url); setPendingImages((prev) => prev.filter((_, i) => i !== idx)); }}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {showCloseConfirm && (
          <div className="modal-backdrop" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal">
              <h3>Unsaved Changes</h3>
              <p>You have unsaved edits. Closing now will lose those changes.</p>
              <div className="modal-actions">
                <button className="note-action-btn" type="button" onClick={() => setShowCloseConfirm(false)}>Cancel</button>
                <button className="note-action-btn primary" type="button" onClick={saveAndClose}>Save</button>
                <button className="note-action-btn danger" type="button" onClick={closeWithoutSaving}>Close Without Saving</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return editorContent;
  }

  return (
    <div className="editor-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      {editorContent}
    </div>
  );
}

