import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Topbar from './components/layout/Topbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import NotesGrid from './components/notes/NotesGrid.jsx';
import NoteEditor from './components/notes/NoteEditor.jsx';
import Settings from './components/settings/Settings.jsx';
import { DeleteCampaignDialog } from './components/settings/CampaignSettings.jsx';
import AdminConsole from './components/settings/AdminConsole.jsx';
import SrdBrowser from './components/srd/SrdBrowser.jsx';
import { loadAppearance, onAppearanceChange } from './utils/appearance.js';
import { useAppVersion } from './utils/version.js';
import { COPYRIGHT_NOTICE } from './utils/copyright.js';
import { useDemoBlocked } from './utils/demo.js';

// v0.86.4: shown whenever the demo account tries to add, change or delete something.
function DemoBlockedPopup({ message, onClose }){
 useEffect(()=>{ if(!message) return; const onKey=(e)=>{ if(e.key==='Escape'||e.key==='Enter') onClose(); }; window.addEventListener('keydown', onKey); return ()=>window.removeEventListener('keydown', onKey); },[message]);
 if(!message) return null;
 return createPortal(<div className="modal-backdrop demo-blocked-backdrop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}><div className="confirm-modal demo-blocked-modal" role="alertdialog" aria-modal="true" aria-labelledby="demo-blocked-title" aria-describedby="demo-blocked-text"><h3 id="demo-blocked-title">Demo mode</h3><p id="demo-blocked-text">{message}</p><div className="modal-actions"><button className="btn primary" onClick={onClose} autoFocus>OK</button></div></div></div>, document.body);
}

function FirstRunSetup({ onDone, minLength = 8 }){
 const [username,setUsername]=useState('admin');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function onSubmit(e){
   e.preventDefault(); setError('');
   if(password.length < minLength){ setError(`Password must be at least ${minLength} characters.`); return; }
   if(password !== confirm){ setError('The two passwords do not match.'); return; }
   setBusy(true);
   const res=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,confirm})});
   const data=await res.json().catch(()=>({}));
   setBusy(false);
   if(!res.ok){ setError(data.error || 'Setup failed'); return; }
   onDone(data);
 }
 return <div className="login-page"><form className="login-box" onSubmit={onSubmit}><div className="login-head"><p className="login-scope">First-time setup</p><h1>Create the admin account</h1><p className="hint">BlackQuill has no admin account yet. Choose the admin login and password. You will use them to sign in to the Admin Console and create DM and player accounts.</p></div>{error&&<p className="error" role="alert">{error}</p>}<label className="field"><span>Admin username</span><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/></label><label className="field"><span>Password (at least {minLength} characters)</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" autoFocus/></label><label className="field"><span>Confirm password</span><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label><button type="submit" className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create admin account'}</button></form><footer className="login-footer"><span className="copyright">{COPYRIGHT_NOTICE}</span></footer></div>
}

// v0.87: Settings has its own tabs; the sidebar only links to the Settings page.
const SETTINGS_TABS = ['Styles','Layout','Icons','Banner','Navigation','Campaign'];
function SettingsTabs({ user, active, onSelect }){
 const dm = String(user?.role).toLowerCase()==='dm';
 const tabs = SETTINGS_TABS.filter(t => dm || !['Navigation','Campaign'].includes(t));
 const current = active || 'Styles';
 return <nav className="settings-tabs chip-row" aria-label="Settings sections">{tabs.map(t=><button key={t} className={`chip ${current===t ? 'active' : ''}`} aria-current={current===t ? 'page' : undefined} onClick={()=>onSelect(t==='Styles' ? '' : t)}>{t}</button>)}</nav>
}

// v1.0.6: the default login banner is real text (HTML/CSS) in the table's style and fonts.
// A banner image uploaded or chosen in Settings › Banner / Admin Console is still shown as an image.
const DEFAULT_BANNER = 'default-banner.svg';
function TextBanner(){
 return <header className="login-banner text-banner">
  <h1 className="text-banner-title">BlackQuill</h1>
  <p className="text-banner-sub">
   <span className="text-banner-rule left" aria-hidden="true"><svg className="text-banner-quill" viewBox="0 0 56 48" focusable="false"><path d="M6 44 C22 28 38 14 54 4 C46 20 32 34 14 42 Z" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="M6 44 L40 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg></span>
   <span className="text-banner-sub-text">Campaign Ledger</span>
   <span className="text-banner-rule right" aria-hidden="true"><i className="text-banner-diamond"/></span>
  </p>
 </header>
}

function Login({ onLogin }){
 const version=useAppVersion();
 const [intro,setIntro]=useState('');
 const [bannerSettings,setBannerSettings]=useState(null);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
   fetch('/api/template/intro').then(r=>r.text()).then(setIntro);
   fetch('/api/template/banner-settings').then(r=>r.ok?r.json():{bannerWidth:60}).then(setBannerSettings).catch(()=>setBannerSettings({bannerWidth:60}));
 },[]);
 async function login(){
   const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const data = await res.json().catch(()=>({}));
   if(!res.ok){setError(data.error || 'Login failed');return;}
   onLogin(data);
 }
 const width = Number(bannerSettings?.bannerWidth || 60);
 const textBanner = bannerSettings && (!bannerSettings.activeBanner || bannerSettings.activeBanner === DEFAULT_BANNER);
 function onSubmit(e){ e.preventDefault(); login(); }
 return <div className="login-page" style={{'--banner-width': `${width}vw`}}>{bannerSettings && <div className="login-banner-wrap">{textBanner ? <TextBanner/> : <img className="login-banner" src={`/api/template/assets/banner.png?t=${Date.now()}`} alt="BlackQuill banner"/>}</div>}<form className="login-box" onSubmit={onSubmit}><div className="login-head"><p className="login-scope">Sign in</p>{intro.trim() && <p className="intro-box">{intro}</p>}</div>{error&&<p className="error" role="alert">{error}</p>}<label className="field"><span>Username or email</span><input value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" autoFocus placeholder="Username or email"/></label><label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Password"/></label><button type="submit" className="btn primary block">Sign in</button></form><footer className="login-footer">BlackQuill Campaign Ledger {version}<br/><span className="copyright">{COPYRIGHT_NOTICE}</span></footer></div>
}

function Campaigns({ user, onSelect, onLogout }){
 const [campaigns,setCampaigns]=useState([]); const [name,setName]=useState(''); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [deleting,setDeleting]=useState(null);
 async function load(){ fetch('/api/campaigns').then(r=>r.json()).then(setCampaigns); }
 useEffect(()=>{ load(); },[]);
 async function create(){ const res=await fetch('/api/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}); if(!res.ok){ const e=await res.json(); setError(e.error); return;} setName(''); setNotice(''); load(); }
 const isDm = String(user?.role).toLowerCase()==='dm' && !user?.demo;
 // v1.0.1: the page has its own Logout (it has no top bar), so nobody is stuck here, e.g. after deleting the last campaign.
 // v0.86.5: DMs can also delete a campaign straight from this page (same confirmation as Settings › Campaign).
 return <div className="campaign-page"><header className="campaign-page-head"><div className="campaign-page-bar"><span className="brand">Black<span>Quill</span></span><div className="campaign-page-account">{user?.demo && <span className="demo-pill" title="Demo account: you can look around, but adding, changing and deleting is blocked.">Demo · read-only</span>}<span className="campaign-page-user">Signed in as <strong>{user?.name || user?.username || 'you'}</strong>{isDm ? ' (Dungeon Master)' : ''}</span><button type="button" className="btn ghost" onClick={onLogout}>Logout</button></div></div><h1>Choose a campaign</h1><p className="hint">{campaigns.length ? 'Pick up where your table left off.' : (isDm ? 'You have no campaigns yet. Create your first one below.' : 'Your DM has not shared a campaign with you yet.')}</p></header>{error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="hint" role="status">{notice}</p>}<div className="campaign-list">{campaigns.map(c=><div key={c.slug} className="campaign-card-wrap"><button className="campaign-card" onClick={()=>onSelect(c)}><span className="campaign-card-initial" aria-hidden="true">{String(c.name||'?').trim().charAt(0).toUpperCase()}</span><span className="campaign-card-name">{c.name}</span><span className="campaign-card-cta">Open ledger →</span></button>{isDm&&<button type="button" className="small-action danger campaign-card-delete" onClick={()=>setDeleting(c)} aria-label={`Delete campaign ${c.name}`} title="Delete this campaign">Delete…</button>}</div>)}</div>{isDm&&<form className="create-campaign" onSubmit={e=>{e.preventDefault(); create();}}><label className="field"><span>New campaign</span><input className="compact-text-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Campaign name"/></label><button type="submit" className="btn primary" disabled={!name.trim()}>Create Campaign</button></form>}{deleting&&<DeleteCampaignDialog campaign={deleting} onClose={()=>setDeleting(null)} onDeleted={(d)=>{ setDeleting(null); setNotice(`Deleted “${d?.name || deleting.name}”.`); load(); }}/>}</div>
}
export default function App(){
 const [demoMessage,closeDemoMessage]=useDemoBlocked();
 const [user,setUser]=useState(null); const [setup,setSetup]=useState(null); const [campaign,setCampaign]=useState(null); const [selected,setSelected]=useState({category:'Dashboard',subcategory:''}); const [search,setSearch]=useState(''); const [debug,setDebug]=useState(false); const [navigation,setNavigation]=useState(null); const [navOpen,setNavOpen]=useState(false); const [srd,setSrd]=useState(null);
 // v1.0.3: re-render when the style or icon pack changes, so cards pick up the new icons.
 const [,setLook]=useState(0);
 useEffect(()=>{ const off=onAppearanceChange(()=>setLook(n=>n+1)); return ()=>{ off(); }; },[]);
 useEffect(()=>{ loadAppearance(); fetch('/api/auth/me').then(r=>r.json()).then(setUser); fetch('/api/setup/status').then(r=>r.ok?r.json():{needsSetup:false}).then(setSetup).catch(()=>setSetup({needsSetup:false})); fetch('/api/debug-status').then(r=>r.json()).then(d=>setDebug(Boolean(d.enabled))).catch(()=>{}); },[]);
 // Navigation depends on the signed-in role (DM-only menus), so load it after login.
 function loadNavigation(){ fetch('/api/navigation').then(r=>r.json()).then(setNavigation).catch(()=>setNavigation(null)); }
 useEffect(()=>{ if(user) loadNavigation(); else setNavigation(null); },[user?.id, user?.role]);
 // v0.85: SRD import status (shared by all campaigns) drives the SRD sidebar entry.
 useEffect(()=>{ if(!user || String(user?.role).toLowerCase()==='admin'){ setSrd(null); return; } fetch('/api/srd/status').then(r=>r.ok?r.json():null).then(setSrd).catch(()=>setSrd(null)); },[user?.id, user?.role]);
 useEffect(()=>{
   if(!debug) return;
   function logError(event){ console.error('[BlackQuill DEBUG] Window error', { message:event.message, source:event.filename, line:event.lineno, column:event.colno, error:event.error }); }
   function logRejection(event){ console.error('[BlackQuill DEBUG] Unhandled promise rejection', event.reason); }
   window.addEventListener('error', logError);
   window.addEventListener('unhandledrejection', logRejection);
   return ()=>{ window.removeEventListener('error', logError); window.removeEventListener('unhandledrejection', logRejection); };
 },[debug]);
 if(!user && setup===null) return null;
 if(!user && setup?.needsSetup) return <FirstRunSetup minLength={setup.minPasswordLength || 8} onDone={(u)=>{ setSetup({needsSetup:false}); setUser(u); }}/>;
 if(!user) return <Login onLogin={setUser}/>;
 if(String(user?.role).toLowerCase()==='admin') return <AdminConsole onLogout={logout}/>;
 if(!campaign) return <><DemoBlockedPopup message={demoMessage} onClose={closeDemoMessage}/><Campaigns user={user} onSelect={setCampaign} onLogout={logout}/></>;
 function onSelect(category,subcategory=''){
   if(debug){
     const folder = `${category || ''}${subcategory ? '/' + subcategory : ''}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
     console.log('[BlackQuill DEBUG] Menu click', { category, subcategory, expectedFolder: folder, campaign: campaign?.slug || null, selectedBefore: selected });
   }
   // v0.86.1: New Entry remembers the section being viewed, so the form starts in it (e.g. Atlas › City).
   if(category==='New Entry'){
     const viewing = selected.category==='New Entry' ? (selected.from||null) : selected;
     const from = viewing && !['Dashboard','All Entries','Settings','SRD','New Entry'].includes(viewing.category) ? { category: viewing.category, subcategory: viewing.subcategory||'' } : null;
     setSelected({category,subcategory,from});
   } else setSelected({category,subcategory});
   setNavOpen(false);
 }
 // v0.85.1: open an SRD entry by category key and index (used by [[srd:…]] links in notes).
 function openSrdRef(key, index){ const cat=(srd?.categories||[]).find(c=>c.key===key); if(cat) openSrd(cat.label, index||null); else openSrd(); }
 function openSrd(label='', item=null){ setSelected({category:'SRD', subcategory:label||'', srdItem:item||null}); setNavOpen(false); }
 async function logout(){ await fetch('/api/auth/logout',{method:'POST'}); setUser(null); setCampaign(null); }
 return <div className={`app ${navOpen ? 'nav-open' : ''}`}><DemoBlockedPopup message={demoMessage} onClose={closeDemoMessage}/><Topbar user={user} campaign={campaign} selected={selected} navOpen={navOpen} onToggleNav={()=>setNavOpen(o=>!o)} onCampaigns={()=>setCampaign(null)} onLogout={logout}/><Sidebar user={user} selected={selected} onSelect={onSelect} search={search} setSearch={setSearch} navigation={navigation} srd={srd} open={navOpen}/>{navOpen && <div className="nav-scrim" onClick={()=>setNavOpen(false)} aria-hidden="true"/>}<main className="main-frame">{selected.category==='SRD'?<SrdBrowser user={user} status={srd} selected={selected} onOpen={openSrd} onStatusChange={setSrd}/>:selected.category==='New Entry'?<NoteEditor key={`new-${selected.from?.category||''}-${selected.from?.subcategory||''}`} campaign={campaign} navigation={navigation} user={user} defaults={selected.from||null} onSaved={(saved)=>setSelected({category:saved?.category || 'All Entries',subcategory:saved?.subcategory || '', openSlug:saved?.slug || null})} onCancel={()=>setSelected({category:'All Entries',subcategory:''})}/>:selected.category==='Settings'?<><SettingsTabs user={user} active={selected.subcategory} onSelect={(s)=>onSelect('Settings',s)}/><Settings subsection={selected.subcategory} user={user} onNavigationChange={loadNavigation} campaign={campaign} onCampaignDeleted={()=>{ setSelected({category:'Dashboard',subcategory:''}); setCampaign(null); }}/></>:<NotesGrid campaign={campaign} selected={selected} search={search} setSearch={setSearch} user={user} setSelected={setSelected} navigation={navigation} onNewEntry={()=>onSelect('New Entry','')} onNavigate={onSelect} onOpenSrd={openSrdRef}/>}</main></div>
}
