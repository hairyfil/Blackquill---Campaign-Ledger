import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// v0.86.2: the delete-campaign confirmation. The DM must type the full campaign name exactly.
// v0.86.5: its own component, used by Settings › Campaign and by the Choose a campaign page.
export function DeleteCampaignDialog({ campaign, onClose, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const name = String(campaign?.name || campaign?.slug || '');
  const matches = typed === name && name !== '';

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function remove(e) {
    e.preventDefault();
    if (!matches || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaign.slug)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName: typed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || `Could not delete the campaign (server answered ${res.status}).`); setBusy(false); return; }
      setBusy(false);
      onDeleted?.(data.deleted || { slug: campaign.slug, name });
    } catch {
      setError('Could not reach the server. Nothing was deleted.');
      setBusy(false);
    }
  }

  return createPortal(<div className="modal-backdrop" onClick={() => !busy && onClose?.()}>
    <form className="confirm-modal delete-campaign-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-campaign-title" aria-describedby="delete-campaign-warning" onClick={(e) => e.stopPropagation()} onSubmit={remove}>
      <h3 id="delete-campaign-title">Delete “{name}”?</h3>
      <p id="delete-campaign-warning" className="delete-warning"><strong>Warning: this cannot be undone.</strong> The campaign and everything in it (all notes, pictures, DM secrets and session files) will be permanently deleted for every DM and player.</p>
      <label className="field">
        <span>Type the full campaign name to confirm: <strong className="confirm-name">{name}</strong></span>
        <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} placeholder={name} aria-invalid={typed !== '' && !matches} />
      </label>
      {typed !== '' && !matches && <p className="hint">The name must match exactly, including capitals and spaces.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="note-action-btn" onClick={() => onClose?.()} disabled={busy}>Cancel</button>
        <button type="submit" className="note-action-btn danger solid" disabled={!matches || busy}>{busy ? 'Deleting…' : 'Delete Campaign Forever'}</button>
      </div>
    </form>
  </div>, document.body);
}

// Settings › Campaign (DM only): shows the open campaign and lets the DM delete it.
export default function CampaignSettings({ campaign, onDeleted }) {
  const [open, setOpen] = useState(false);
  const name = String(campaign?.name || campaign?.slug || '');

  if (!campaign) return <section className="settings"><h2>Campaign</h2><p>No campaign is open.</p></section>;

  return (
    <section className="settings">
      <h2>Campaign</h2>
      <p>You are managing <strong>{name}</strong>.</p>

      <div className="danger-zone">
        <h3>Delete this campaign</h3>
        <p>Permanently deletes <strong>{name}</strong> for everyone: every note, picture, DM secret and session file in it. <strong>This cannot be undone.</strong></p>
        <div className="settings-actions"><button type="button" className="note-action-btn danger" onClick={() => setOpen(true)}>Delete Campaign…</button></div>
      </div>

      {open && <DeleteCampaignDialog campaign={campaign} onClose={() => setOpen(false)} onDeleted={(d) => { setOpen(false); onDeleted?.(d); }} />}
    </section>
  );
}
