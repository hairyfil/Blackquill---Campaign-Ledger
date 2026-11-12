import NoteCard, { excerpt } from './NoteCard.jsx';
import { entryMenus } from '../../utils/category.js';

// v0.84.4 campaign overview. All Entries remains the full card list.

const CLOSED_QUESTS = ['completed', 'failed'];

function noteTime(n) {
  return Date.parse(n.updatedAt || n.createdAt || '') || 0;
}

function formatDate(n) {
  const t = noteTime(n);
  return t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

function isSessionLog(n) {
  const sub = String(n.subcategory || '').toLowerCase();
  return (n.category === 'Chronicle' && sub === 'session logs') || n.category === 'Session Archive';
}

export default function Dashboard({ notes, navigation, layout, onOpen, onNavigate, onNewEntry }) {
  const recent = [...notes].sort((a, b) => noteTime(b) - noteTime(a)).slice(0, 8);
  const latestSession = notes.filter(isSessionLog).sort((a, b) => noteTime(b) - noteTime(a))[0] || null;
  const openQuests = notes
    .filter((n) => n.category === 'Quests' && !CLOSED_QUESTS.includes(String(n.subcategory || '').toLowerCase()))
    .sort((a, b) => noteTime(b) - noteTime(a));

  const categories = entryMenus(navigation).map((m) => ({ label: m.label, dm: Boolean(m.dmOnly), count: notes.filter((n) => n.category === m.label).length }));

  if (!notes.length) {
    return (
      <div className="blank-frame empty-state">
        <div className="empty-glyph" aria-hidden="true">✒</div>
        <h2>Your ledger is empty</h2>
        <p>Once entries are added, this page shows what changed recently, how many entries each section holds, the latest session log and the quests still open.</p>
        {onNewEntry && <button className="btn primary" onClick={onNewEntry}>Create the first entry</button>}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="dash-panel dash-categories" aria-labelledby="dash-cat-h">
        <h2 id="dash-cat-h">Sections</h2>
        <div className="dash-cat-grid">
          {categories.map((c) => (
            <button key={c.label} type="button" className={`dash-cat ${c.dm ? 'dm' : ''} ${c.count ? '' : 'empty'}`} onClick={() => onNavigate?.(c.label, '')}>
              <span className="dash-cat-count">{c.count}</span>
              <span className="dash-cat-label">{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="dash-columns">
        <section className="dash-panel" aria-labelledby="dash-session-h">
          <div className="dash-panel-head">
            <h2 id="dash-session-h">Latest session log</h2>
            <button type="button" className="link-btn" onClick={() => onNavigate?.('Chronicle', 'Session Logs')}>All session logs</button>
          </div>
          {latestSession ? (
            <button type="button" className="dash-session" onClick={() => onOpen(latestSession)}>
              <span className="dash-session-title">{latestSession.title}</span>
              <span className="dash-meta">{formatDate(latestSession)}</span>
              {excerpt(latestSession.content, 280) && <span className="dash-session-text">{excerpt(latestSession.content, 280)}</span>}
            </button>
          ) : (
            <p className="hint">No session logs yet. Add one under Chronicle › Session Logs.</p>
          )}
        </section>

        <section className="dash-panel" aria-labelledby="dash-quests-h">
          <div className="dash-panel-head">
            <h2 id="dash-quests-h">Open quests <span className="dash-count">{openQuests.length}</span></h2>
            <button type="button" className="link-btn" onClick={() => onNavigate?.('Quests', '')}>All quests</button>
          </div>
          {openQuests.length ? (
            <ul className="dash-list">
              {openQuests.slice(0, 8).map((q) => (
                <li key={q.slug}>
                  <button type="button" className="dash-list-item" onClick={() => onOpen(q)}>
                    <span className="dash-list-title">{q.title}</span>
                    <span className="dash-tag">{q.subcategory || 'Quest'}</span>
                  </button>
                </li>
              ))}
              {openQuests.length > 8 && <li className="hint">and {openQuests.length - 8} more</li>}
            </ul>
          ) : (
            <p className="hint">No open quests. Quests marked Completed or Failed are not shown here.</p>
          )}
        </section>
      </div>

      <section className="dash-panel dash-recent" aria-labelledby="dash-recent-h">
        <div className="dash-panel-head">
          <h2 id="dash-recent-h">Recently updated</h2>
          <button type="button" className="link-btn" onClick={() => onNavigate?.('All Entries', '')}>All entries</button>
        </div>
        <div className={`notes-grid ${layout}`}>
          {recent.map((n) => (
            <div key={n.slug} className={`note-wrap ${layout}`}>
              <NoteCard note={n} onClick={() => onOpen(n)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
