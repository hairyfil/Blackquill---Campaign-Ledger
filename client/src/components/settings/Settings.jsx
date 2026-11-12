import { useEffect, useMemo, useRef, useState } from 'react';
import CampaignSettings from './CampaignSettings.jsx';
import { mergeStyles, applyStyleVars } from '../../utils/stylePresets.js';
import { applyCurrentStyle, currentStyleFile, currentIconPack, tableStyleFile, tableIconPack, myStyle, myIconPack, saveTableAppearance, setMyStyle, setMyIconPack } from '../../utils/appearance.js';

function StyleMock({ style }) {
  const v = (k, d) => style?.[k] || d;
  return (
    <div className="style-mock" aria-hidden="true" style={{ background: v('primary', '#1C1C1E'), color: v('text', '#EAE6D6'), fontFamily: v('fontBody', 'Inter, Arial, sans-serif') }}>
      <div className="style-mock-top" style={{ background: v('secondary', '#2A2D34') }}><span style={{ fontFamily: v('fontHeader', 'Georgia, serif'), color: v('accent', '#C2A96A') }}>BlackQuill</span></div>
      <div className="style-mock-body">
        <div className="style-mock-side" style={{ background: v('secondary', '#2A2D34') }}>
          <span className="style-mock-btn" style={{ background: v('accent', '#C2A96A'), color: v('accentText', '#1c1a16') }}>New</span>
          <span className="style-mock-line" style={{ background: v('dmWarning', '#C94A4A') }} />
          <span className="style-mock-line" style={{ background: v('text', '#EAE6D6') }} />
          <span className="style-mock-line" style={{ background: v('text', '#EAE6D6') }} />
        </div>
        <div className="style-mock-cards">
          {[0, 1].map((i) => <div key={i} className="style-mock-card" style={{ background: v('cardBg', '#F0E4C6'), color: v('cardText', '#1f1a14'), borderColor: v('accent', '#C2A96A') }}><b style={{ fontFamily: v('fontHeader', 'Georgia, serif') }}>{i ? 'Oakhurst' : 'Belak'}</b><span>Entry</span></div>)}
        </div>
      </div>
    </div>
  );
}

function slugFolder(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc';
}

function getKey(item) {
  return item?.key || item?.label || '';
}

function reorderArray(items, fromIndex, toIndex) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function Settings({ subsection, user, onNavigationChange, campaign, onCampaignDeleted }) {
  const [styles, setStyles] = useState([]);
  const [icons, setIcons] = useState([]);
  const [iconFiles, setIconFiles] = useState([]);
  const [intro, setIntro] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [banners, setBanners] = useState([]);
  const [bannerSettings, setBannerSettings] = useState({ activeBanner: 'default-banner.svg', bannerWidth: 60 });
  const [bannerWidthChoice, setBannerWidthChoice] = useState('60');
  const [customBannerWidth, setCustomBannerWidth] = useState(60);
  const [message, setMessage] = useState('');
  const [layout, setLayout] = useState(localStorage.getItem('blackquill-layout') || 'portrait-standard');
  const [selectedStyleFile, setSelectedStyleFile] = useState(currentStyleFile());
  const [selectedIconSet, setSelectedIconSet] = useState(currentIconPack());
  const [appliedStyleFile, setAppliedStyleFile] = useState(currentStyleFile());
  const [busy, setBusy] = useState(false);
  const [navDraft, setNavDraft] = useState({ menus: [] });
  const [newSub, setNewSub] = useState({ category: 'Atlas', label: '', folder: '' });
  const [dragMenuKey, setDragMenuKey] = useState(null);
  const [dragSub, setDragSub] = useState(null);

  const dm = String(user?.role).toLowerCase() === 'dm';
  // v1.0.3: the DM changes the table's look for everyone; a player changes only this browser.
  const setsTableLook = dm || String(user?.role).toLowerCase() === 'admin';

  // The editor needs every menu, including disabled ones, so it loads the full configuration.
  useEffect(() => {
    if (!dm) return;
    fetch('/api/navigation/admin').then(r => r.ok ? r.json() : { menus: [] }).then(setNavDraft).catch(() => {});
  }, [dm]);

  useEffect(() => {
    fetch('/api/template/styles').then(r => r.json()).then(data => {
      const list = mergeStyles(Array.isArray(data) ? data : []);
      setStyles(list);
      if (!selectedStyleFile && list.length) setSelectedStyleFile(list[0].file);
    }).catch(() => setStyles(mergeStyles([])));
    fetch('/api/icons').then(r => r.json()).then(data => setIcons(Array.isArray(data) ? data : []));
    fetch('/api/template/intro').then(r => r.text()).then(setIntro);
    refreshBanners();
  }, [dm]);

  useEffect(() => {
    if (!selectedIconSet) return;
    fetch(`/api/icons/${encodeURIComponent(selectedIconSet)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setIconFiles(Array.isArray(data) ? data : []))
      .catch(() => setIconFiles([]));
  }, [selectedIconSet]);

  async function saveIntro() {
    setMessage('');
    const res = await fetch('/api/template/intro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: intro })
    });
    setMessage(res.ok ? 'Banner text saved' : 'Could not save banner text');
  }

  async function refreshBanners() {
    const res = await fetch('/api/template/banners');
    if (!res.ok) return;
    const data = await res.json();
    setBanners(data.files || []);
    const settings = { activeBanner: data.activeBanner || 'default-banner.svg', bannerWidth: Number(data.bannerWidth || 60) };
    setBannerSettings(settings);
    const widthText = String(settings.bannerWidth);
    if (['50','60','70','80'].includes(widthText)) setBannerWidthChoice(widthText);
    else { setBannerWidthChoice('custom'); setCustomBannerWidth(settings.bannerWidth); }
  }

  async function uploadBanner() {
    if (!bannerFile) return;
    setMessage('');
    const fd = new FormData();
    fd.append('banner', bannerFile);
    const res = await fetch('/api/template/banner', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setBannerFile(null);
      setMessage('Banner uploaded and selected');
      await refreshBanners();
    } else {
      setMessage('Banner upload failed: ' + (data.error || ''));
    }
  }

  async function selectBanner(file) {
    setMessage('');
    const res = await fetch('/api/template/banner/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || 'Could not select banner'); return; }
    setMessage(`Selected banner: ${file}`);
    await refreshBanners();
  }

  async function deleteBanner(file) {
    if (!confirm(`Delete banner ${file}?`)) return;
    setMessage('');
    const res = await fetch(`/api/template/banner/${encodeURIComponent(file)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || 'Could not delete banner'); return; }
    setMessage(`Deleted banner: ${file}`);
    await refreshBanners();
  }

  async function saveBannerWidth() {
    const width = bannerWidthChoice === 'custom' ? Number(customBannerWidth) : Number(bannerWidthChoice);
    const safeWidth = Math.max(30, Math.min(100, Number.isFinite(width) ? width : 60));
    const res = await fetch('/api/template/banner-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bannerWidth: safeWidth })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || 'Could not save banner width'); return; }
    setBannerSettings({ ...bannerSettings, bannerWidth: data.bannerWidth || safeWidth });
    setMessage(`Banner width saved: ${data.bannerWidth || safeWidth}%`);
  }

  function changeLayout(value) {
    localStorage.setItem('blackquill-layout', value);
    setLayout(value);
    window.dispatchEvent(new Event('blackquill-layout-changed'));
  }

  const selectedStyle = useMemo(
    () => styles.find(s => s.file === selectedStyleFile) || styles[0] || null,
    [styles, selectedStyleFile]
  );

  const [previewing, setPreviewing] = useState(false);
  const styleName = (file) => styles.find(s => s.file === file)?.name || file;

  // Live preview: selecting a style recolours the whole app straight away.
  function previewStyle(style) {
    setSelectedStyleFile(style.file);
    applyStyleVars(style);
    setPreviewing(style.file !== appliedStyleFile);
    setMessage('');
  }

  function revertPreview() {
    applyCurrentStyle();
    setSelectedStyleFile(appliedStyleFile);
    setPreviewing(false);
  }

  // Leaving Styles without applying puts the current style back.
  useEffect(() => () => { applyCurrentStyle(); }, [subsection]);

  async function confirmStyle() {
    if (!selectedStyle) return;
    setMessage('');
    try {
      setBusy(true);
      if (setsTableLook) await saveTableAppearance({ activeStyle: selectedStyle.file });
      else setMyStyle(selectedStyle);
      setAppliedStyleFile(selectedStyle.file);
      setPreviewing(false);
      setMessage(setsTableLook ? `Style applied for everyone: ${selectedStyle.name || selectedStyle.file}` : `Style applied in this browser: ${selectedStyle.name || selectedStyle.file}`);
    } catch (err) {
      applyCurrentStyle();
      setMessage(err.message || 'Could not apply the style');
    } finally { setBusy(false); }
  }

  function useTableStyle() {
    setMyStyle(null);
    setAppliedStyleFile(tableStyleFile());
    setSelectedStyleFile(tableStyleFile());
    setPreviewing(false);
    setMessage(`Back to the table's style: ${styleName(tableStyleFile())}`);
  }

  async function confirmIconSet() {
    setMessage('');
    try {
      if (setsTableLook) await saveTableAppearance({ activeIconPack: selectedIconSet || 'default' });
      else setMyIconPack(selectedIconSet === tableIconPack() ? null : selectedIconSet);
      setMessage(setsTableLook ? `Icon pack applied for everyone: ${selectedIconSet || 'default'}` : `Icon pack applied in this browser: ${selectedIconSet || 'default'}`);
    } catch (err) {
      setMessage(err.message || 'Could not apply the icon pack');
    }
  }

  function updateMenuByKey(menuKey, enabled) {
    setNavDraft(prev => ({
      ...prev,
      menus: (prev.menus || []).map(m => {
        if (getKey(m) !== menuKey) return m;
        return {
          ...m,
          enabled,
          subcategories: enabled === false
            ? (m.subcategories || []).map(s => ({ ...s, enabled: false }))
            : (m.subcategories || [])
        };
      })
    }));
  }

  function updateSubByKey(menuKey, subKey, enabled) {
    setNavDraft(prev => ({
      ...prev,
      menus: (prev.menus || []).map(m => {
        if (getKey(m) !== menuKey) return m;
        return {
          ...m,
          enabled: enabled === true ? true : m.enabled,
          subcategories: (m.subcategories || []).map(s => getKey(s) === subKey ? { ...s, enabled } : s)
        };
      })
    }));
  }

  function moveMenu(fromKey, toKey) {
    setNavDraft(prev => {
      const menus = [...(prev.menus || [])];
      const visible = menus.filter(m => !m.system);
      const fromVisible = visible.findIndex(m => getKey(m) === fromKey);
      const toVisible = visible.findIndex(m => getKey(m) === toKey);
      if (fromVisible < 0 || toVisible < 0 || fromVisible === toVisible) return prev;
      const reorderedVisible = reorderArray(visible, fromVisible, toVisible);
      let i = 0;
      return { ...prev, menus: menus.map(m => m.system ? m : reorderedVisible[i++]) };
    });
  }

  function moveMenuByButton(menuKey, direction) {
    const visible = (navDraft.menus || []).filter(m => !m.system);
    const idx = visible.findIndex(m => getKey(m) === menuKey);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= visible.length) return;
    moveMenu(menuKey, getKey(visible[target]));
  }

  function moveSub(menuKey, fromSubKey, toSubKey) {
    setNavDraft(prev => ({
      ...prev,
      menus: (prev.menus || []).map(m => {
        if (getKey(m) !== menuKey) return m;
        const subs = [...(m.subcategories || [])];
        const from = subs.findIndex(s => getKey(s) === fromSubKey);
        const to = subs.findIndex(s => getKey(s) === toSubKey);
        if (from < 0 || to < 0 || from === to) return m;
        return { ...m, subcategories: reorderArray(subs, from, to) };
      })
    }));
  }

  function moveSubByButton(menuKey, subKey, direction) {
    const menu = (navDraft.menus || []).find(m => getKey(m) === menuKey);
    const subs = menu?.subcategories || [];
    const idx = subs.findIndex(s => getKey(s) === subKey);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= subs.length) return;
    moveSub(menuKey, subKey, getKey(subs[target]));
  }

  async function saveNavigation() {
    setMessage('');
    const res = await fetch('/api/navigation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(navDraft)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || 'Could not save navigation'); return; }
    setNavDraft(data);
    onNavigationChange?.();
    setMessage('Navigation saved. Sidebar, New Entry, and Edit dropdowns now use this order and enabled state. New folders are created automatically where needed.');
  }

  async function addSubcategory() {
    setMessage('');
    const res = await fetch('/api/navigation/subcategory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSub)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || 'Could not add subcategory'); return; }
    setNavDraft(data);
    onNavigationChange?.();
    setNewSub({ category: newSub.category, label: '', folder: '' });
    setMessage('Subcategory added and folders created where needed.');
  }

  if (subsection === 'Campaign' && dm) return <CampaignSettings campaign={campaign} onDeleted={onCampaignDeleted} />;

  if (subsection === 'Layout') return (
    <section className="settings">
      <h2>Layout</h2>
      <p>Choose how note cards are displayed in category views.</p>
      <select value={layout} onChange={e => changeLayout(e.target.value)}>
        <option value="portrait-standard">Portrait - Standard</option>
        <option value="portrait-condensed">Portrait - Condensed</option>
      </select>
      <p className="hint">Portrait - Standard is the default. Portrait - Condensed is the smaller card layout.</p>
    </section>
  );

  if (subsection === 'Icons') return (
    <section className="settings">
      <h2>Icon Set</h2>
      <p>{setsTableLook ? 'Select an icon pack, preview its icons, then confirm it. The icon pack is used by everyone at your table.' : 'Select an icon pack, preview its icons, then confirm it. Your choice is used in this browser only.'}</p>
      <select value={selectedIconSet} onChange={e => setSelectedIconSet(e.target.value)}>
        {icons.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
      <div className="icon-preview-grid">
        {iconFiles.map(f => <div className="icon-preview" key={f}><img src={`/icons/${selectedIconSet}/${f}`} /><span>{f}</span></div>)}
      </div>
      <div className="settings-actions"><button className="note-action-btn primary" onClick={confirmIconSet}>Confirm Icon Pack</button>{!setsTableLook && myIconPack() && <button className="note-action-btn" onClick={() => { setMyIconPack(null); setSelectedIconSet(tableIconPack()); setMessage(`Back to the table's icon pack: ${tableIconPack()}`); }}>Use the table's icon pack</button>}</div>
      {message && <p className="hint">{message}</p>}
    </section>
  );

  if (subsection === 'Banner') return (
    <section className="settings">
      <h2>Banner Manager</h2>
      {!dm && <p>Only the DM can edit banner settings.</p>}
      {dm && <>
        <label>Banner Text<textarea value={intro} onChange={e => setIntro(e.target.value)} rows="6" /></label>
        <div className="settings-actions"><button className="note-action-btn primary" onClick={saveIntro}>Save Banner Text</button></div>

        <div className="image-upload-panel banner-upload-panel">
          <strong>Upload New Banner</strong>
          <p className="hint">Banners are stored in blackquill-common-data/system/images/banners and shown below as selectable thumbnails.</p>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setBannerFile(e.target.files?.[0] || null)} />
          <div className="settings-actions"><button className="note-action-btn primary" onClick={uploadBanner} disabled={!bannerFile}>Upload Banner</button></div>
        </div>

        <h3>Banner Display Width</h3>
        <div className="banner-width-controls">
          <select value={bannerWidthChoice} onChange={e => setBannerWidthChoice(e.target.value)}>
            <option value="50">50%</option>
            <option value="60">60%</option>
            <option value="70">70%</option>
            <option value="80">80%</option>
            <option value="custom">Custom %</option>
          </select>
          {bannerWidthChoice === 'custom' && <input type="number" min="30" max="100" value={customBannerWidth} onChange={e => setCustomBannerWidth(e.target.value)} />}
          <button className="note-action-btn" onClick={saveBannerWidth}>Save Width</button>
        </div>

        <h3>Available Banners</h3>
        <div className="banner-gallery">
          {banners.map(b => (
            <div key={b.file} className={`banner-thumb-card ${bannerSettings.activeBanner === b.file ? 'selected' : ''}`}>
              <img src={`${b.url}?t=${Date.now()}`} alt={b.file} />
              <span>{b.file}</span>
              <div className="banner-thumb-actions">
                <button className="note-action-btn" onClick={() => selectBanner(b.file)} disabled={bannerSettings.activeBanner === b.file}>{bannerSettings.activeBanner === b.file ? 'Active' : 'Select'}</button>
                <button className="note-action-btn danger" onClick={() => deleteBanner(b.file)} disabled={bannerSettings.activeBanner === b.file}>Delete</button>
              </div>
            </div>
          ))}
        </div>
        {message && <p className="hint">{message}</p>}
      </>}
    </section>
  );

  if (subsection === 'Navigation') return (
    <section className="settings">
      <h2>Navigation</h2>
      {!dm && <p>Only the DM can configure navigation.</p>}
      {dm && <>
        <p className="hint">Enable/disable menus and subcategories, add new subcategories, and drag items to change their display order. If a category is disabled, all subcategories under it are disabled. If a subcategory is enabled, its parent category is automatically enabled. Sidebar, New Entry, and Edit dropdowns only show enabled items.</p>
        <div className="navigation-editor">
          {(navDraft.menus || []).filter(m => !m.system).map((m, menuIndex, menus) => {
            const menuKey = getKey(m);
            return (
              <div
                className="nav-menu-editor"
                key={menuKey}
                draggable
                onDragStart={() => setDragMenuKey(menuKey)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragMenuKey) moveMenu(dragMenuKey, menuKey); setDragMenuKey(null); }}
              >
                <div className="nav-row nav-menu-row">
                  <span className="drag-handle" title="Drag to reorder">☰</span>
                  <button className="move-btn" type="button" onClick={() => moveMenuByButton(menuKey, -1)} disabled={menuIndex === 0}>↑</button>
                  <button className="move-btn" type="button" onClick={() => moveMenuByButton(menuKey, 1)} disabled={menuIndex === menus.length - 1}>↓</button>
                  <label>
                    <input type="checkbox" checked={m.enabled !== false} onChange={e => updateMenuByKey(menuKey, e.target.checked)} /> <strong>{m.label}</strong> <span className="hint">/{m.folder}</span>
                  </label>
                </div>
                {(m.subcategories || []).length > 0 && <div className="nav-sub-editor">
                  {m.subcategories.map((s, subIndex, subs) => {
                    const subKey = getKey(s);
                    return (
                      <div
                        className={`nav-row nav-sub-row ${m.enabled === false ? 'disabled-option' : ''}`}
                        key={subKey}
                        draggable
                        onDragStart={() => setDragSub({ menuKey, subKey })}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragSub?.menuKey === menuKey) moveSub(menuKey, dragSub.subKey, subKey); setDragSub(null); }}
                      >
                        <span className="drag-handle" title="Drag to reorder">☰</span>
                        <button className="move-btn" type="button" onClick={() => moveSubByButton(menuKey, subKey, -1)} disabled={subIndex === 0}>↑</button>
                        <button className="move-btn" type="button" onClick={() => moveSubByButton(menuKey, subKey, 1)} disabled={subIndex === subs.length - 1}>↓</button>
                        <label>
                          <input type="checkbox" checked={s.enabled !== false && m.enabled !== false} onChange={e => updateSubByKey(menuKey, subKey, e.target.checked)} /> {s.label} <span className="hint">/{m.folder}/{s.folder}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>}
              </div>
            );
          })}
        </div>
        <h3>Add Subcategory</h3>
        <div className="add-subcategory">
          <select value={newSub.category} onChange={e => setNewSub({ ...newSub, category: e.target.value })}>
            {(navDraft.menus || []).filter(m => !m.system).map(m => <option key={getKey(m)} value={m.label}>{m.label}</option>)}
          </select>
          <input value={newSub.label} onChange={e => setNewSub({ ...newSub, label: e.target.value })} placeholder="Subcategory label, e.g. Settlement" />
          <input value={newSub.folder} onChange={e => setNewSub({ ...newSub, folder: slugFolder(e.target.value) })} placeholder="Folder, default auto-generated" />
          <button className="note-action-btn" onClick={addSubcategory} disabled={!newSub.label.trim()}>Add</button>
        </div>
        <div className="settings-actions"><button className="note-action-btn primary" onClick={saveNavigation}>Save Navigation</button></div>
        {message && <p className="hint">{message}</p>}
      </>}
    </section>
  );

  return (
    <section className="settings">
      <h2>Styles</h2>
      <p>{setsTableLook ? 'Click a style to preview it, then choose Apply Style. The style is used by everyone at your table, on the login page and in the Admin Console.' : "Click a style to preview it, then choose Apply Style. Your choice is used in this browser only; everyone else keeps the table's style."}</p>
      <div className="style-gallery" role="radiogroup" aria-label="Styles">
        {styles.map(s => {
          const isSelected = (selectedStyle?.file || '') === s.file;
          const isApplied = appliedStyleFile === s.file;
          return <button key={s.file} type="button" role="radio" aria-checked={isSelected} className={`style-option ${isSelected ? 'selected' : ''}`} onClick={() => previewStyle(s)}>
            <StyleMock style={s} />
            <span className="style-option-meta">
              <strong>{s.name || s.file}</strong>
              {isApplied && <span className="style-badge">Current</span>}
              {!s.builtIn && <span className="style-badge subtle">Custom</span>}
            </span>
            {s.description && <span className="style-option-desc">{s.description}</span>}
            <span className="style-swatches">{['primary','secondary','accent','text','cardBg','dmWarning'].map(k => s[k] ? <i key={k} title={`${k}: ${s[k]}`} style={{ background: s[k] }} /> : null)}</span>
          </button>;
        })}
      </div>
      <div className="settings-actions sticky-actions">
        <button className="note-action-btn primary" onClick={confirmStyle} disabled={!selectedStyle || !previewing || busy}>{setsTableLook ? 'Apply Style for everyone' : 'Apply Style'}</button>
        <button className="note-action-btn" onClick={revertPreview} disabled={!previewing}>Revert</button>
        {!setsTableLook && myStyle() && !previewing && <button className="note-action-btn" onClick={useTableStyle}>Use the table's style</button>}
        {previewing && <span className="hint">Previewing {selectedStyle?.name || selectedStyle?.file}. Not saved yet.</span>}
      </div>
      <p className="hint">Add your own styles by placing .json style files in the styles folder; they appear here marked Custom.</p>
      {message && <p className="hint">{message}</p>}
    </section>
  );
}
