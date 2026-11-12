import { useAppVersion } from '../../utils/version.js';

export default function Topbar({ user, campaign, selected, onCampaigns, onLogout, onToggleNav, navOpen }){
 const isDm = String(user?.role).toLowerCase()==='dm';
 const version = useAppVersion();
 const crumbs = [selected?.category, selected?.subcategory].filter(Boolean);
 const initials = String(user?.name || 'DM').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 return <header className="topbar">
  <div className="topbar-left">
   <button className="icon-btn nav-toggle" aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen ? 'true' : 'false'} onClick={onToggleNav}><span aria-hidden="true">☰</span></button>
   <span className="brand" aria-label="BlackQuill">Black<span>Quill</span></span>
   <span className="topbar-divider" aria-hidden="true"/>
   <button className="campaign-switch" onClick={onCampaigns} title="Switch campaign">
    <span className="campaign-name">{campaign?.name || 'No Campaign'}</span>
    <span className="campaign-switch-hint" aria-hidden="true">⇄</span>
   </button>
   {crumbs.length > 0 && <nav className="breadcrumb" aria-label="Location">{crumbs.map((c,i)=><span key={i} className={i===crumbs.length-1?'current':''}>{c}</span>)}</nav>}
  </div>
  <div className="topbar-actions">
   {user?.demo && <span className="demo-pill" title="Demo account: you can look around, but adding, changing and deleting is blocked.">Demo · read-only</span>}
   <span className="user-chip" title={`${user?.name || 'Dungeon Master'}${isDm ? ' (DM)' : ''}`}><span className="avatar" aria-hidden="true">{initials}</span><span className="user-chip-name"><strong>{user?.name || 'Dungeon Master'}</strong><small>{isDm ? 'Dungeon Master' : (user?.role || 'Player')}</small></span></span>
   <button className="btn ghost hide-sm" onClick={onCampaigns}>Campaigns</button>
   <button className="btn ghost" onClick={onLogout}>Logout</button>
   {version && <span className="app-version" title={`BlackQuill Campaign Ledger ${version}`}>{version}</span>}
  </div>
 </header>
}
