import { useEffect, useState } from 'react';
import { useAppVersion } from '../../utils/version.js';
import { COPYRIGHT_NOTICE } from '../../utils/copyright.js';
import { mergeStyles } from '../../utils/stylePresets.js';
import { loadAppearance } from '../../utils/appearance.js';

// v0.87: readable dates in the user list, and no email column echo of the login name.
function formatWhen(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? String(iso) : new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const showEmail = (u) => Boolean(u.email) && String(u.email).toLowerCase() !== String(u.username || '').toLowerCase();

function FormRow({ label, children }) {
  return (
    <label className="form-row">
      <span className="form-label">{label}</span>
      <span className="form-control">{children}</span>
    </label>
  );
}

export default function AdminConsole({ onLogout }) {
  const [section, setSection] = useState('users');
  const version = useAppVersion();
  const [users, setUsers] = useState([]);
  const [fileResults, setFileResults] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ settings: {}, styles: [], iconPacks: [], banners: [] });
  const [adminBannerFile, setAdminBannerFile] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [userForm, setUserForm] = useState({ name:'', username:'', email:'', role:'player', password:'' });
  const [showUserForm, setShowUserForm] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [firstDmHint, setFirstDmHint] = useState(false);
  const [datasetForm, setDatasetForm] = useState({ source:'', campaignSlug:'' });

  // Changes clear the previous message; reads (e.g. the reload after a change) keep it on screen.
  async function api(path, options = {}) {
    if (options.method) { setError(''); setMessage(''); }
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function load() {
    try {
      const dash = await api('/api/admin/dashboard');
      setUsers(dash.users || []);
      setCampaigns(dash.campaigns || []);
      setFirstDmHint(Boolean(dash.firstDmHint));
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    try { await api('/api/admin/users', { method:'POST', body: JSON.stringify(userForm) }); const login = userForm.username || userForm.email; setMessage(userForm.role === 'dm' ? `DM account created. Log out, then sign in as “${login}” to create, edit and run campaigns.` : 'User created.'); setUserForm((f)=>({ ...f, name:'', username:'', email:'', password:'' })); setShowUserForm(false); await load(); }
    catch(e){ setError(e.message); }
  }
  // v1.0.7: closing the first-DM hint (either button) stops it showing again for this admin.
  function dismissFirstDmHint(createDm) {
    setFirstDmHint(false);
    fetch('/api/admin/hints/first-dm/dismiss', { method:'POST' }).catch(()=>{});
    if (createDm) { setError(''); setMessage(''); setSection('users'); setUserForm((f)=>({ ...f, role:'dm' })); setShowUserForm(true); }
  }
  async function toggleUser(user) {
    if (user.protected || user.role === 'admin') { setError('Admin account cannot be locked or suspended.'); return; }
    try { await api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method:'PUT', body: JSON.stringify({ locked: !user.locked }) }); await load(); }
    catch(e){ setError(e.message); }
  }
  async function resetPassword(user) {
    if (user.protected || user.role === 'admin') { setError('Admin account cannot be reset from User Management.'); return; }
    const password = prompt(`New password for ${user.username || user.email}`);
    if (!password) return;
    try { await api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method:'PUT', body: JSON.stringify({ password }) }); setMessage('Password reset.'); await load(); }
    catch(e){ setError(e.message); }
  }
  // v1.0.2: the admin's own password (the admin row's Change Password button).
  async function changeAdminPassword(form) {
    await api('/api/admin/password', { method:'POST', body: JSON.stringify(form) });
    setPwOpen(false);
    setMessage('Admin password changed. Use the new password next time you log in.');
  }
  async function deleteUser(user) {
    if (user.protected || user.role === 'admin') { setError('Admin account cannot be deleted.'); return; }
    if (user.demo) { setError('The demo account cannot be deleted. You can change its password or lock it instead.'); return; }
    if (!confirm(`Delete user ${user.username || user.email}?`)) return;
    try { await api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method:'DELETE' }); await load(); }
    catch(e){ setError(e.message); }
  }
  async function runFileCheck() {
    try { setFileResults(await api('/api/admin/file-checker')); setSection('file-checker'); }
    catch(e){ setError(e.message); }
  }
  async function repairFiles() {
    try { await api('/api/admin/file-checker/repair', { method:'POST', body:'{}' }); setMessage('Safe repair completed.'); await runFileCheck(); }
    catch(e){ setError(e.message); }
  }
  async function backup(scope='all', campaignSlug='') {
    try { const data = await api('/api/admin/backups', { method:'POST', body: JSON.stringify({ scope, campaignSlug }) }); setMessage(`Backup created: ${data.backupFolder}`); }
    catch(e){ setError(e.message); }
  }
  async function loadDatasets() {
    try {
      const data = await api('/api/admin/datasets');
      setDatasets(data);
      setSection('datasets');
      const list = await api('/api/admin/campaigns');
      setCampaigns(list || []);
      setDatasetForm((f) => ({ ...f, campaignSlug: f.campaignSlug || list?.[0]?.slug || '' }));
    }
    catch(e){ setError(e.message); }
  }
  async function copyDataset() {
    const [kind, slug] = String(datasetForm.source).split(':');
    try {
      if (kind === 'campaign') {
        const data = await api('/api/admin/campaigns/copy', { method:'POST', body: JSON.stringify({ sourceCampaignSlug: slug, campaignSlug: datasetForm.campaignSlug }) });
        setMessage(`Copied ${data.filesCopied} file(s) from ${data.copiedFrom} to ${data.copiedTo}` + (data.filesSkipped ? `. Skipped ${data.filesSkipped} file(s) that already existed in the target.` : '.'));
      } else {
        const data = await api('/api/admin/datasets/copy', { method:'POST', body: JSON.stringify({ dataset: slug, campaignSlug: datasetForm.campaignSlug }) });
        setMessage(`Dataset copied to ${data.copiedTo}`);
      }
    }
    catch(e){ setError(e.message); }
  }
  async function loadAdminSettings() {
    try { setAdminSettings(await api('/api/admin/settings')); setSection('settings'); }
    catch(e){ setError(e.message); }
  }
  async function saveAdminSettings(next) {
    try {
      const settings = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(next) });
      setAdminSettings((s) => ({ ...s, settings }));
      // v1.0.3: style and icon pack take effect straight away (and for everyone on their next page load).
      if (next.activeStyle !== undefined || next.activeIconPack !== undefined) await loadAppearance();
      setMessage(next.activeStyle !== undefined ? 'Style saved. Everyone sees it the next time they open or reload BlackQuill.' : next.activeIconPack !== undefined ? 'Icon pack saved. Everyone sees it the next time they open or reload BlackQuill.' : 'Admin settings saved.');
    } catch(e) { setError(e.message); }
  }
  async function uploadAdminBanner() {
    if (!adminBannerFile) return;
    setError(''); setMessage('');
    const fd = new FormData();
    fd.append('banner', adminBannerFile);
    const res = await fetch('/api/template/banner', { method:'POST', body: fd });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) { setError(data.error || 'Banner upload failed'); return; }
    setAdminBannerFile(null);
    setMessage('Admin banner uploaded and selected.');
    await loadAdminSettings();
  }

  const nav = [
    ['users','User Management'], ['file-checker','File Checker'], ['datasets','Data Sets'], ['backup','Backup / Restore'], ['settings','Settings']
  ];

  function handleNav(k) {
    setError(''); setMessage('');
    if(k==='file-checker') runFileCheck();
    else if(k==='datasets') loadDatasets();
    else if(k==='settings') loadAdminSettings();
    else setSection(k);
  }

  return <div className="admin-shell">
    <aside className="admin-menu"><div className="admin-brand"><span className="brand">Black<span>Quill</span></span><small>Admin Console{version ? <span className="app-version"> · {version}</span> : null}</small></div><nav className="admin-nav" aria-label="Admin sections">{nav.map(([k,l])=><button key={k} className={`nav-item ${section===k?'active':''}`} aria-current={section===k ? 'page' : undefined} onClick={()=>handleNav(k)}>{l}</button>)}</nav><button className="btn ghost admin-logout" onClick={onLogout}>Logout</button><p className="admin-copyright">{COPYRIGHT_NOTICE}</p></aside>
    <main className="admin-main"><h1>{nav.find(([k])=>k===section)?.[1] || 'Admin Dashboard'}</h1>{error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
      {section==='users'&&<><div className="admin-section-head"><h2>Users</h2>{!showUserForm&&<button className="btn primary" onClick={()=>setShowUserForm(true)}><span aria-hidden="true">＋</span> Add user</button>}</div>{showUserForm&&<section className="admin-panel"><div className="admin-section-head"><h2>Add user</h2><button className="btn" onClick={()=>setShowUserForm(false)}>Cancel</button></div><div className="admin-form stacked-form"><FormRow label="Name"><input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})}/></FormRow><FormRow label="Username"><input value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})}/></FormRow><FormRow label="Email"><input value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></FormRow><FormRow label="Role"><select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}><option value="player">Player</option><option value="dm">DM</option></select></FormRow><FormRow label="Password"><input type="password" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></FormRow><div className="form-row form-actions-row"><span className="form-label"></span><span className="form-control"><button className="btn primary" onClick={createUser}>Create User</button></span></div></div></section>}<UserTable users={users} onToggle={toggleUser} onReset={resetPassword} onChangeAdminPassword={()=>setPwOpen(true)} onDelete={deleteUser}/>{pwOpen&&<AdminPasswordDialog onSubmit={changeAdminPassword} onClose={()=>setPwOpen(false)}/>}</>}
      {section==='file-checker'&&<><div className="toolbar"><button className="btn primary" onClick={runFileCheck}>Run Check</button><button onClick={repairFiles}>Repair Safe Issues</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Level</th><th>Check</th><th>Message</th><th>Path</th></tr></thead><tbody>{fileResults.map((r,i)=><tr key={i} className={String(r.level).toLowerCase()}><td>{r.level}</td><td>{r.label}</td><td>{r.message}</td><td><code>{r.path}</code></td></tr>)}</tbody></table></div></>}
      {section==='datasets'&&<><section className="admin-panel"><h2>Copy Into a Campaign</h2><p className="hint">A data set copies everything in its folder into the campaign. A campaign copies its notes into the other campaign and never overwrites notes that already exist there.</p><div className="admin-form stacked-form"><FormRow label="Source"><select value={datasetForm.source} onChange={e=>{ const source=e.target.value; setDatasetForm(f=>({ ...f, source, campaignSlug: source === `campaign:${f.campaignSlug}` ? '' : f.campaignSlug })); }}><option value="">Select data set or campaign</option><optgroup label="Data sets">{datasets.map(d=><option key={`dataset:${d.slug}`} value={`dataset:${d.slug}`}>{d.name || d.slug}</option>)}</optgroup><optgroup label="Campaigns (copies notes)">{campaigns.map(c=><option key={`campaign:${c.slug}`} value={`campaign:${c.slug}`}>{c.name || c.slug}</option>)}</optgroup></select></FormRow><FormRow label="Target Campaign"><select value={datasetForm.campaignSlug} onChange={e=>setDatasetForm({...datasetForm,campaignSlug:e.target.value})}><option value="">{campaigns.length ? 'Select campaign' : 'No campaigns available'}</option>{campaigns.filter(c=>datasetForm.source !== `campaign:${c.slug}`).map(c=><option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}</select></FormRow><div className="form-row form-actions-row"><span className="form-label"></span><span className="form-control"><button disabled={!datasetForm.source || !datasetForm.campaignSlug} onClick={copyDataset} className="btn primary">Copy to Campaign</button></span></div></div></section><ul>{datasets.map(d=><li key={d.slug}><code>{d.slug}</code>{d.name && d.name !== d.slug ? ` — ${d.name}` : ''} — {d.path}</li>)}</ul></>}
      {section==='backup'&&<><section className="admin-panel"><h2>Full Backup</h2><p className="hint">Copies everything in system/ and campaigns/ into a timestamped folder under system/backups/.</p><button className="btn primary" onClick={()=>backup('all')}>Backup All Data</button></section><section className="admin-panel"><h2>Campaign Backups</h2><div className="button-grid">{campaigns.map(c=><button key={c.slug} onClick={()=>backup('campaign', c.slug)}>Backup {c.name || c.slug}</button>)}</div>{campaigns.length===0 && <p className="hint">No campaigns yet.</p>}</section></>}
      {section==='settings'&&<AdminSettingsPanel adminSettings={adminSettings} onSave={saveAdminSettings} bannerFile={adminBannerFile} setBannerFile={setAdminBannerFile} uploadBanner={uploadAdminBanner}/>} 
    </main>
    {firstDmHint&&<FirstDmHint onCreate={()=>dismissFirstDmHint(true)} onClose={()=>dismissFirstDmHint(false)}/>}
  </div>
}

function AdminSettingsPanel({ adminSettings, onSave, bannerFile, setBannerFile, uploadBanner }) {
  const settings = adminSettings.settings || {};
  // v1.0.3: the six built-in styles plus any style files in system/styles/, by name.
  const [styleList, setStyleList] = useState(mergeStyles([]));
  useEffect(() => { fetch('/api/template/styles').then(r => r.ok ? r.json() : []).then(d => setStyleList(mergeStyles(Array.isArray(d) ? d : []))).catch(() => {}); }, []);
  return <section className="admin-panel"><h2>Admin Settings</h2><p>These settings control branding, style, icons and debug mode for the whole BlackQuill instance. They are stored in system/settings.json.</p><div className="admin-form stacked-form"><FormRow label="Style"><select value={settings.activeStyle || 'default-style.json'} onChange={e=>onSave({ activeStyle: e.target.value })}>{styleList.map(s=><option key={s.file} value={s.file}>{s.name || s.file}{s.builtIn ? '' : ' (custom)'}</option>)}</select></FormRow><FormRow label="Icon Pack"><select value={settings.activeIconPack || 'default'} onChange={e=>onSave({ activeIconPack: e.target.value })}>{(adminSettings.iconPacks || []).map(p=><option key={p} value={p}>{p}</option>)}</select></FormRow><FormRow label="Banner"><select value={settings.activeBanner || 'default-banner.svg'} onChange={e=>onSave({ activeBanner: e.target.value })}>{(adminSettings.banners || []).map(b=><option key={b} value={b}>{b}</option>)}</select></FormRow><FormRow label="Banner Preview"><img className="admin-banner-preview" src={`/api/template/assets/banner.png?t=${Date.now()}`} alt="Admin banner preview"/></FormRow><FormRow label="Upload Banner"><span className="inline-controls"><input type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={e=>setBannerFile(e.target.files?.[0] || null)}/><button disabled={!bannerFile} onClick={uploadBanner}>Upload</button></span></FormRow><FormRow label="Banner Width %"><input type="number" min="30" max="100" value={settings.bannerWidth || 60} onChange={e=>onSave({ bannerWidth: Number(e.target.value) })}/></FormRow><label className="checkbox-row"><input type="checkbox" checked={Boolean(settings.debug)} onChange={e=>onSave({ debug: e.target.checked })}/><span>Debug Mode</span></label></div></section>
}

function FirstDmHint({ onCreate, onClose }) {
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose(); }}><div className="confirm-modal first-dm-hint" role="dialog" aria-modal="true" aria-labelledby="first-dm-title" aria-describedby="first-dm-text"><p className="first-dm-kicker">Getting started</p><h3 id="first-dm-title">Create your first DM account</h3><div id="first-dm-text"><p>The admin account looks after users, settings and backups. It does not run games.</p><ol className="first-dm-steps"><li>Add a user here with the role <strong>DM</strong>.</li><li>Log out, then sign in with that DM account.</li><li>As the DM you can create, edit and run campaigns, and add your players.</li></ol></div><div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Later</button><button type="button" className="btn primary" onClick={onCreate} autoFocus>Create DM account</button></div></div></div>;
}

function AdminPasswordDialog({ onSubmit, onClose }) {
  const [form, setForm] = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError('');
    if (form.newPassword.length < 8) { setError('The new password must be at least 8 characters.'); return; }
    if (form.newPassword !== form.confirm) { setError('The two new passwords do not match.'); return; }
    setBusy(true);
    try { await onSubmit(form); } catch (err) { setError(err.message); setBusy(false); }
  }
  const field = (key, label, auto, autoFocus) => <label className="field"><span>{label}</span><input type="password" value={form[key]} onChange={e=>setForm({ ...form, [key]: e.target.value })} autoComplete={auto} autoFocus={autoFocus}/></label>;
  return <div className="modal-backdrop" onMouseDown={(e)=>{ if(e.target===e.currentTarget && !busy) onClose(); }}><form className="confirm-modal admin-password-modal" role="dialog" aria-modal="true" aria-labelledby="admin-pw-title" onSubmit={submit}><h3 id="admin-pw-title">Change admin password</h3>{error&&<p className="error" role="alert">{error}</p>}{field('currentPassword','Current password','current-password',true)}{field('newPassword','New password (at least 8 characters)','new-password')}{field('confirm','Confirm new password','new-password')}<div className="modal-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Change Password'}</button></div></form></div>;
}

function UserTable({ users, onToggle, onReset, onChangeAdminPassword, onDelete }) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Login Name</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead><tbody>{users.map(u=>{ const protectedUser = u.protected || u.role === 'admin'; return <tr key={u.id}><td>{u.username || u.email}</td><td>{u.name}</td><td className={showEmail(u) ? '' : 'muted-cell'}>{showEmail(u) ? u.email : '—'}</td><td>{u.role}{u.demo ? ' (demo, read-only)' : ''}</td><td>{protectedUser ? 'Protected' : (u.locked?'Locked':'Active')}</td><td className={u.lastLogin ? '' : 'muted-cell'}>{u.lastLogin ? formatWhen(u.lastLogin) : 'Never'}</td><td>{protectedUser ? <button onClick={onChangeAdminPassword}>Change Password</button> : <button onClick={()=>onReset(u)}>Reset Password</button>}<button disabled={protectedUser} onClick={()=>onToggle(u)}>{u.locked?'Unlock':'Lock'}</button><button disabled={protectedUser || u.demo} title={u.demo ? 'The demo account cannot be deleted' : undefined} className="danger" onClick={()=>onDelete(u)}>Delete</button></td></tr>})}</tbody></table></div>
}
