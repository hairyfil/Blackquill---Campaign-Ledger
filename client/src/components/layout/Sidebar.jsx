import { useState } from 'react';

function readOpen(){ try { return localStorage.getItem('blackquill-dm-open') !== 'false'; } catch { return true; } }

export default function Sidebar({ user, selected, onSelect, search, setSearch, navigation, srd = null, open = false }){
 const dm = String(user?.role).toLowerCase()==='dm';
 const allMenus = navigation?.menus || [];
 const menus = allMenus.filter(m => !['settings','dm-eyes-only'].includes(m.key));
 const dmSubs = allMenus.find(m => m.key === 'dm-eyes-only')?.subcategories || [];
 const [dmOpen, setDmOpen] = useState(readOpen);

 function toggleDm(){ const next = !dmOpen; setDmOpen(next); try { localStorage.setItem('blackquill-dm-open', String(next)); } catch {} }

 function selectMenu(menu){
   if (menu.key === 'adventure-groups') {
     onSelect('Adventure Groups','Groups');
     return;
   }
   onSelect(menu.label,'');
 }

 const srdSubs = srd?.imported ? (srd.categories||[]).filter(c=>c.primary) : [];
 const isActive = (cat, sub) => selected.category===cat && (sub === undefined || (selected.subcategory||'')===sub);

 return <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Campaign navigation">
  <div className="sidebar-scroll">
    <div className="sidebar-actions">
      <button className="new-entry btn" onClick={()=>onSelect('New Entry','')}><span aria-hidden="true">＋</span> New Entry</button>
      <label className="search-wrap"><span className="sr-only">Search notes</span><span className="search-icon" aria-hidden="true">⌕</span><input className="search" type="search" placeholder="Search notes…" value={search} onChange={e=>setSearch(e.target.value)} /></label>
    </div>

    {dm && <div className={`dm-block ${dmOpen ? 'expanded' : ''}`}>
      <div className="nav-section-row">
        <button className={`dm-menu nav-item ${isActive('DM Eyes Only','') ? 'active' : ''}`} onClick={()=>onSelect('DM Eyes Only','')}><span className="dm-eye" aria-hidden="true">◉</span>DM Eyes Only</button>
        <button className="icon-btn collapse-btn dm-collapse" aria-label={dmOpen ? 'Collapse DM Eyes Only' : 'Expand DM Eyes Only'} aria-expanded={dmOpen ? 'true' : 'false'} onClick={toggleDm}><span aria-hidden="true">{dmOpen ? '▾' : '▸'}</span></button>
      </div>
      {dmOpen && <div className="submenu">{dmSubs.map(s=><button key={s.key} className={`dm-sub nav-item ${isActive('DM Eyes Only', s.label) ? 'active' : ''}`} onClick={()=>onSelect('DM Eyes Only',s.label)}>{s.label}</button>)}</div>}
    </div>}

    <div className="nav-group-label">Ledger</div>
    <nav className="nav-list">
    {menus.map(m=>{
      const subs = m.subcategories || [];
      const expanded = subs.length>0 && selected.category===m.label;
      return <div key={m.key || m.label} className={`nav-group ${expanded ? 'expanded' : ''}`}>
        <button className={`nav-item ${selected.category===m.label && !selected.subcategory ? 'active' : ''} ${selected.category===m.label ? 'in-section' : ''}`} aria-expanded={subs.length ? (expanded ? 'true' : 'false') : undefined} onClick={()=>selectMenu(m)}>
          <span className="nav-label">{m.label}</span>{subs.length>0 && <span className="nav-caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span>}
        </button>
        {expanded && <div className="submenu">{subs.map(s=><button key={s.key || s.label} onClick={()=>onSelect(m.label,s.label)} className={`nav-item sub ${selected.subcategory===s.label?'active':''}`}>{s.label}</button>)}</div>}
      </div>;
    })}
    </nav>

    {/* v0.85: SRD reference browser, shared by every campaign */}
    <div className="nav-group-label">Reference</div>
    <nav className="nav-list">
      <div className={`nav-group ${selected.category==='SRD' && srdSubs.length ? 'expanded' : ''}`}>
        <button className={`nav-item srd-nav ${selected.category==='SRD' && !selected.subcategory ? 'active' : ''} ${selected.category==='SRD' ? 'in-section' : ''}`} aria-expanded={srdSubs.length ? (selected.category==='SRD' ? 'true' : 'false') : undefined} onClick={()=>onSelect('SRD','')}>
          <span className="nav-label"><span aria-hidden="true">📖</span> SRD</span>{srdSubs.length>0 ? <span className="nav-caret" aria-hidden="true">{selected.category==='SRD' ? '▾' : '▸'}</span> : (srd && !srd.imported ? <span className="nav-badge">Set up</span> : null)}
        </button>
        {selected.category==='SRD' && srdSubs.length>0 && <div className="submenu">{srdSubs.map(c=><button key={c.key} onClick={()=>onSelect('SRD',c.label)} className={`nav-item sub ${selected.subcategory===c.label?'active':''}`}>{c.label}</button>)}</div>}
      </div>
    </nav>
  </div>
  <div className="sidebar-bottom"><button className={`nav-item ${selected.category==='Settings' ?'active':''}`} onClick={()=>onSelect('Settings','')}><span className="nav-label"><span aria-hidden="true">⚙</span> Settings</span></button></div>
 </aside>
}
