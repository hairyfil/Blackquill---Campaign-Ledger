import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';

// v0.85 SRD browser: import screen, category home, filtered lists and entry pages.
// Data comes from /api/srd (server/lib/srd.js), SRD 5.1 via the 5e-bits dataset.

const md = new MarkdownIt({ html: false, linkify: true });
const GROUPS = ['Character', 'Spells & Magic', 'Bestiary', 'Equipment', 'Rules'];
const HIDDEN_KEYS = new Set(['index', 'url', 'image', '_id', 'updated_at', 'name']);

const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
const spellLevelText = (s) => (s.level === 0 ? `${s.school?.name || ''} cantrip` : `${ordinal(s.level)}-level ${String(s.school?.name || '').toLowerCase()}`);
const mod = (score) => { const m = Math.floor((Number(score) - 10) / 2); return `${m >= 0 ? '+' : ''}${m}`; };
const formatCr = (cr) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr));
const prettyKey = (k) => String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const isRef = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.name === 'string' && typeof v.url === 'string';
const textOf = (d) => (Array.isArray(d) ? d.join('\n\n') : String(d ?? ''));

function Markdown({ text, className = '' }) {
  if (!text) return null;
  return <div className={`srd-md ${className}`} dangerouslySetInnerHTML={{ __html: md.render(textOf(text)) }} />;
}

// Turns a 5e-bits reference url (/api/2014/<category>/<index>[/...]) into a link inside the browser.
function RefLink({ r, ctx }) {
  const m = /^\/api\/\d{4}\/([^/]+)\/([^/]+)/.exec(r?.url || '');
  const cat = m && ctx.byKey[m[1]];
  if (!cat) return <span>{r?.name}</span>;
  return <button type="button" className="srd-link" onClick={() => ctx.open(cat.label, m[2])}>{r.name}</button>;
}

function RefList({ refs, ctx }) {
  if (!refs?.length) return <span className="srd-muted">None</span>;
  return <span className="srd-reflist">{refs.map((r, i) => <span key={(r.index || r.name) + i}>{i > 0 && ', '}{isRef(r) ? <RefLink r={r} ctx={ctx} /> : <Value v={r} ctx={ctx} />}</span>)}</span>;
}

// "Choose N from …" option sets used by classes, races and backgrounds.
function optionLabel(o, ctx, key) {
  if (!o) return null;
  switch (o.option_type) {
    case 'reference': return <RefLink key={key} r={o.item} ctx={ctx} />;
    case 'counted_reference': return <span key={key}>{o.count} × <RefLink r={o.of} ctx={ctx} /></span>;
    case 'string': return <span key={key}>{o.string}</span>;
    case 'ideal': return <span key={key}>{o.desc}</span>;
    case 'choice': return <span key={key}><Choice c={o.choice} ctx={ctx} /></span>;
    case 'multiple': return <span key={key}>{(o.items || []).map((x, i) => <span key={i}>{i > 0 && ' and '}{optionLabel(x, ctx)}</span>)}</span>;
    case 'ability_bonus': return <span key={key}>{o.ability_score?.name} +{o.bonus}</span>;
    case 'breath': case 'action': return <span key={key}>{o.name || o.action_name}</span>;
    default: return <span key={key}>{o.item?.name || o.name || o.desc || ''}</span>;
  }
}

function Choice({ c, ctx }) {
  const from = c?.from || {};
  let body;
  if (Array.isArray(from.options)) body = from.options.map((o, i) => <span key={i}>{i > 0 && ', '}{optionLabel(o, ctx)}</span>);
  else if (from.equipment_category) body = <span>any <RefLink r={from.equipment_category} ctx={ctx} /></span>;
  else if (from.resource_list_url) body = <span>{from.resource_list_url.split('/').pop().replace(/-/g, ' ')}</span>;
  return <span className="srd-choice">{c?.desc ? <>{c.desc}<br /></> : null}<em>Choose {c?.choose}:</em> {body}</span>;
}

function isChoice(v) { return v && typeof v === 'object' && 'choose' in v && 'from' in v; }

function Value({ v, ctx }) {
  if (v === null || v === undefined || v === '') return <span className="srd-muted">–</span>;
  if (typeof v === 'boolean') return <span>{v ? 'Yes' : 'No'}</span>;
  if (typeof v === 'number') return <span>{v}</span>;
  if (typeof v === 'string') return v.length > 140 || v.includes('\n') ? <Markdown text={v} /> : <span>{v}</span>;
  if (isRef(v)) return <RefLink r={v} ctx={ctx} />;
  if (isChoice(v)) return <Choice c={v} ctx={ctx} />;
  if (Array.isArray(v)) {
    if (!v.length) return <span className="srd-muted">None</span>;
    if (v.every((x) => typeof x === 'string')) return v.join(' ').length > 140 ? <Markdown text={v} /> : <span>{v.join(', ')}</span>;
    if (v.every(isRef)) return <RefList refs={v} ctx={ctx} />;
    return <div className="srd-stack">{v.map((x, i) => <div key={i} className="srd-sub-block"><Value v={x} ctx={ctx} /></div>)}</div>;
  }
  if (typeof v === 'object') {
    if ('quantity' in v && 'unit' in v) return <span>{v.quantity} {v.unit}</span>;
    if ('damage_dice' in v) return <span>{v.damage_dice} {v.damage_type ? <RefLink r={v.damage_type} ctx={ctx} /> : null}</span>;
    if ('normal' in v && Object.keys(v).every((k) => ['normal', 'long'].includes(k))) return <span>{v.normal}{v.long ? `/${v.long}` : ''} ft.</span>;
    if ('ability_score' in v && 'bonus' in v) return <span><RefLink r={v.ability_score} ctx={ctx} /> +{v.bonus}</span>;
    if (v.name && v.desc && Object.keys(v).length <= 4) return <div><strong>{v.name}.</strong> <Markdown className="inline" text={v.desc} /></div>;
    return <Fields obj={v} ctx={ctx} />;
  }
  return <span>{String(v)}</span>;
}

function Fields({ obj, ctx, skip = [] }) {
  const entries = Object.entries(obj).filter(([k, v]) => !HIDDEN_KEYS.has(k) && !skip.includes(k) && v !== undefined && !(Array.isArray(v) && !v.length));
  if (!entries.length) return null;
  return <dl className="srd-fields">{entries.map(([k, v]) => <div key={k} className="srd-field"><dt>{prettyKey(k)}</dt><dd>{k === 'weight' && typeof v === 'number' ? `${v} lb.` : <Value v={v} ctx={ctx} />}</dd></div>)}</dl>;
}

function Section({ title, children }) {
  return <section className="srd-section"><h3>{title}</h3>{children}</section>;
}

// ------------------------------------------------------------------ entry renderers
function SpellEntry({ s, ctx }) {
  const comps = (s.components || []).join(', ') + (s.material ? ` (${s.material})` : '');
  return <>
    <p className="srd-subtitle">{spellLevelText(s)}{s.ritual ? ' (ritual)' : ''}</p>
    <dl className="srd-statline">
      <div><dt>Casting time</dt><dd>{s.casting_time}</dd></div>
      <div><dt>Range</dt><dd>{s.range}{s.area_of_effect ? ` (${s.area_of_effect.size}-ft. ${s.area_of_effect.type})` : ''}</dd></div>
      <div><dt>Components</dt><dd>{comps}</dd></div>
      <div><dt>Duration</dt><dd>{s.concentration ? 'Concentration, ' : ''}{s.duration}</dd></div>
    </dl>
    <Markdown text={s.desc} />
    {s.higher_level?.length > 0 && <Markdown text={`***At Higher Levels.*** ${textOf(s.higher_level)}`} />}
    <dl className="srd-fields">
      <div className="srd-field"><dt>Classes</dt><dd><RefList refs={s.classes} ctx={ctx} /></dd></div>
      {s.subclasses?.length > 0 && <div className="srd-field"><dt>Subclasses</dt><dd><RefList refs={s.subclasses} ctx={ctx} /></dd></div>}
    </dl>
  </>;
}

function actionTitle(a) {
  const bits = [];
  if (a.usage?.type === 'per day') bits.push(`${a.usage.times}/Day`);
  if (a.usage?.type === 'recharge on roll') bits.push(`Recharge ${a.usage.min_value}${a.usage.min_value < 6 ? '–6' : ''}`);
  if (a.usage?.type === 'recharge after rest') bits.push(`Recharges after a ${(a.usage.rest_types || []).join(' or ')} rest`);
  return bits.length ? `${a.name} (${bits.join(', ')})` : a.name;
}

function Actions({ title, list, intro }) {
  if (!list?.length) return null;
  return <Section title={title}>{intro && <p>{intro}</p>}{list.map((a, i) => <div key={i} className="srd-action"><Markdown text={`***${actionTitle(a)}.*** ${a.desc || ''}`} /></div>)}</Section>;
}

function MonsterEntry({ m, ctx }) {
  const acNote = (a) => (a.type === 'armor' && a.armor?.length ? a.armor.map((x) => x.name.toLowerCase()).join(', ') : a.type === 'spell' && a.spell ? `with ${a.spell.name.toLowerCase()}` : a.type === 'condition' && a.condition ? `while ${a.condition.name.toLowerCase()}` : a.type && a.type !== 'dex' ? a.type : '');
  const ac = (m.armor_class || []).map((a) => `${a.value}${acNote(a) ? ` (${acNote(a)})` : ''}`).join(', ');
  const speed = Object.entries(m.speed || {}).map(([k, v]) => (k === 'walk' ? v : k === 'hover' ? 'hover' : `${k} ${v}`)).join(', ');
  const saves = (m.proficiencies || []).filter((p) => p.proficiency.index.startsWith('saving-throw')).map((p) => `${p.proficiency.name.replace('Saving Throw: ', '')} +${p.value}`).join(', ');
  const skills = (m.proficiencies || []).filter((p) => p.proficiency.index.startsWith('skill')).map((p) => `${p.proficiency.name.replace('Skill: ', '')} +${p.value}`).join(', ');
  const senses = Object.entries(m.senses || {}).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ');
  const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const line = (label, value) => (value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null);
  return <>
    <p className="srd-subtitle">{m.size} {m.type}{m.subtype ? ` (${m.subtype})` : ''}, {m.alignment}</p>
    <div className="srd-statblock">
      <dl className="srd-statline">
        {line('Armor Class', ac)}
        {line('Hit Points', `${m.hit_points} (${m.hit_points_roll || m.hit_dice})`)}
        {line('Speed', speed)}
      </dl>
      <table className="srd-abilities"><thead><tr>{abilities.map((a) => <th key={a}>{a.slice(0, 3).toUpperCase()}</th>)}</tr></thead>
        <tbody><tr>{abilities.map((a) => <td key={a}>{m[a]} ({mod(m[a])})</td>)}</tr></tbody></table>
      <dl className="srd-statline">
        {line('Saving Throws', saves)}
        {line('Skills', skills)}
        {line('Damage Vulnerabilities', (m.damage_vulnerabilities || []).join(', '))}
        {line('Damage Resistances', (m.damage_resistances || []).join(', '))}
        {line('Damage Immunities', (m.damage_immunities || []).join(', '))}
        {m.condition_immunities?.length > 0 && <div><dt>Condition Immunities</dt><dd><RefList refs={m.condition_immunities} ctx={ctx} /></dd></div>}
        {line('Senses', senses)}
        {line('Languages', m.languages || '—')}
        {line('Challenge', `${formatCr(m.challenge_rating)} (${Number(m.xp || 0).toLocaleString()} XP)`)}
        {line('Proficiency Bonus', m.proficiency_bonus ? `+${m.proficiency_bonus}` : '')}
      </dl>
    </div>
    {m.special_abilities?.length > 0 && <div className="srd-section">{m.special_abilities.map((a, i) => <div key={i} className="srd-action"><Markdown text={`***${actionTitle(a)}.*** ${a.desc || ''}`} /></div>)}</div>}
    <Actions title="Actions" list={m.actions} />
    <Actions title="Bonus Actions" list={m.bonus_actions} />
    <Actions title="Reactions" list={m.reactions} />
    <Actions title="Legendary Actions" list={m.legendary_actions} intro={m.legendary_actions?.length ? `The ${m.name.toLowerCase()} can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${m.name.toLowerCase()} regains spent legendary actions at the start of its turn.` : ''} />
    {m.desc && <Section title="Description"><Markdown text={m.desc} /></Section>}
  </>;
}

function LevelTable({ levels, ctx }) {
  if (!levels?.length) return null;
  const specificKeys = [...new Set(levels.flatMap((l) => Object.entries(l.class_specific || {}).filter(([, v]) => typeof v !== 'object').map(([k]) => k)))];
  const slotKeys = [...new Set(levels.flatMap((l) => Object.keys(l.spellcasting || {})))].filter((k) => (levels.some((l) => Number(l.spellcasting?.[k]) > 0)));
  const head = (k) => prettyKey(k.replace('spell_slots_level_', 'slot ').replace(/_/g, ' '));
  return <div className="srd-table-wrap"><table className="srd-table">
    <thead><tr><th>Level</th>{levels[0].prof_bonus != null && <th>Prof.</th>}<th>Features</th>{specificKeys.map((k) => <th key={k}>{head(k)}</th>)}{slotKeys.map((k) => <th key={k}>{head(k)}</th>)}</tr></thead>
    <tbody>{levels.map((l) => <tr key={l.index}>
      <td>{ordinal(l.level)}</td>{levels[0].prof_bonus != null && <td>+{l.prof_bonus}</td>}
      <td className="srd-features-cell">{l.features?.length ? <RefList refs={l.features} ctx={ctx} /> : '—'}</td>
      {specificKeys.map((k) => <td key={k}>{String(l.class_specific?.[k] ?? '—')}</td>)}
      {slotKeys.map((k) => <td key={k}>{l.spellcasting?.[k] || '—'}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

function SpellsByLevel({ spells, ctx }) {
  if (!spells?.length) return null;
  const levels = [...new Set(spells.map((s) => s.level))];
  return <div className="srd-spell-levels">{levels.map((lv) => <div key={lv}><h4>{lv === 0 ? 'Cantrips' : `${ordinal(lv)} level`}</h4>
    <RefList refs={spells.filter((s) => s.level === lv).map((s) => ({ ...s, url: `/api/2014/spells/${s.index}` }))} ctx={ctx} /></div>)}</div>;
}

function ClassEntry({ c, extra, ctx }) {
  return <>
    <dl className="srd-fields">
      <div className="srd-field"><dt>Hit die</dt><dd>d{c.hit_die}</dd></div>
      <div className="srd-field"><dt>Saving throws</dt><dd><RefList refs={c.saving_throws} ctx={ctx} /></dd></div>
      <div className="srd-field"><dt>Proficiencies</dt><dd><RefList refs={c.proficiencies} ctx={ctx} /></dd></div>
      {(c.proficiency_choices || []).map((p, i) => <div key={i} className="srd-field"><dt>Choice</dt><dd><Choice c={p} ctx={ctx} /></dd></div>)}
      {c.starting_equipment?.length > 0 && <div className="srd-field"><dt>Starting equipment</dt><dd>{c.starting_equipment.map((e, i) => <span key={i}>{i > 0 && ', '}{e.quantity > 1 ? `${e.quantity} × ` : ''}<RefLink r={e.equipment} ctx={ctx} /></span>)}</dd></div>}
      {(c.starting_equipment_options || []).map((p, i) => <div key={`o${i}`} className="srd-field"><dt>Equipment choice</dt><dd><Choice c={p} ctx={ctx} /></dd></div>)}
      <div className="srd-field"><dt>Subclasses</dt><dd><RefList refs={c.subclasses} ctx={ctx} /></dd></div>
    </dl>
    <Section title="Class table"><LevelTable levels={extra.levels} ctx={ctx} /></Section>
    {c.spellcasting && <Section title="Spellcasting">{(c.spellcasting.info || []).map((i, n) => <div key={n}><h4>{i.name}</h4><Markdown text={i.desc} /></div>)}</Section>}
    {extra.spells?.length > 0 && <Section title={`${c.name} spells`}><SpellsByLevel spells={extra.spells} ctx={ctx} /></Section>}
    {c.multi_classing && <Section title="Multiclassing"><Fields obj={c.multi_classing} ctx={ctx} /></Section>}
  </>;
}

function SubclassEntry({ s, extra, ctx }) {
  return <>
    <p className="srd-subtitle">{s.subclass_flavor} · <RefLink r={s.class} ctx={ctx} /></p>
    <Markdown text={s.desc} />
    {s.spells?.length > 0 && <Section title="Subclass spells"><ul className="srd-plain-list">{s.spells.map((x, i) => <li key={i}>{(x.prerequisites || []).map((p) => p.name).join(', ')}: <RefLink r={x.spell} ctx={ctx} /></li>)}</ul></Section>}
    <Section title="Features by level"><LevelTable levels={extra.levels} ctx={ctx} /></Section>
  </>;
}

function RaceEntry({ r, extra, ctx }) {
  return <>
    <dl className="srd-fields">
      <div className="srd-field"><dt>Ability score increase</dt><dd>{(r.ability_bonuses || []).map((b, i) => <span key={i}>{i > 0 && ', '}<RefLink r={b.ability_score} ctx={ctx} /> +{b.bonus}</span>)}{r.ability_bonus_options && <><br /><Choice c={r.ability_bonus_options} ctx={ctx} /></>}</dd></div>
      <div className="srd-field"><dt>Speed</dt><dd>{r.speed} ft.</dd></div>
      <div className="srd-field"><dt>Size</dt><dd>{r.size}. {r.size_description}</dd></div>
      <div className="srd-field"><dt>Age</dt><dd>{r.age}</dd></div>
      <div className="srd-field"><dt>Alignment</dt><dd>{r.alignment}</dd></div>
      <div className="srd-field"><dt>Languages</dt><dd>{r.language_desc}</dd></div>
      {r.starting_proficiencies?.length > 0 && <div className="srd-field"><dt>Proficiencies</dt><dd><RefList refs={r.starting_proficiencies} ctx={ctx} /></dd></div>}
      {r.starting_proficiency_options && <div className="srd-field"><dt>Proficiency choice</dt><dd><Choice c={r.starting_proficiency_options} ctx={ctx} /></dd></div>}
      <div className="srd-field"><dt>Traits</dt><dd><RefList refs={r.traits} ctx={ctx} /></dd></div>
      {extra.subraces?.length > 0 && <div className="srd-field"><dt>Subraces</dt><dd><RefList refs={extra.subraces.map((s) => ({ ...s, url: `/api/2014/subraces/${s.index}` }))} ctx={ctx} /></dd></div>}
    </dl>
  </>;
}

function RulesEntry({ r, extra, ctx }) {
  const intro = textOf(r.desc).replace(/^#\s.*$/m, '').trim();
  return <>
    {intro && <Markdown text={intro} />}
    {extra.sections?.length > 0 && <nav className="srd-toc" aria-label="Sections">{extra.sections.map((x) => <a key={x.index} href={`#srd-${x.index}`} onClick={(e) => { e.preventDefault(); document.getElementById(`srd-${x.index}`)?.scrollIntoView({ behavior: 'smooth' }); }}>{x.name}</a>)}</nav>}
    {(extra.sections || []).map((x) => <div key={x.index} id={`srd-${x.index}`} className="srd-rule-section"><Markdown text={x.desc} /></div>)}
  </>;
}

function GenericEntry({ item, extra, ctx }) {
  return <>
    {item.desc && <Markdown text={item.desc} />}
    <Fields obj={item} ctx={ctx} skip={['desc']} />
    {extra?.spells?.length > 0 && <Section title="Spells"><SpellsByLevel spells={extra.spells} ctx={ctx} /></Section>}
  </>;
}

function EntryBody({ catKey, item, extra, ctx }) {
  if (catKey === 'spells') return <SpellEntry s={item} ctx={ctx} />;
  if (catKey === 'monsters') return <MonsterEntry m={item} ctx={ctx} />;
  if (catKey === 'classes') return <ClassEntry c={item} extra={extra} ctx={ctx} />;
  if (catKey === 'subclasses') return <SubclassEntry s={item} extra={extra} ctx={ctx} />;
  if (catKey === 'rules') return <RulesEntry r={item} extra={extra} ctx={ctx} />;
  if (catKey === 'races') return <RaceEntry r={item} extra={extra} ctx={ctx} />;
  return <GenericEntry item={item} extra={extra} ctx={ctx} />;
}

// ------------------------------------------------------------------ screens
function Attribution({ status }) {
  const a = status?.attribution;
  if (!a) return null;
  return <footer className="srd-attribution">
    <p>This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at <a href={a.srdUrl} target="_blank" rel="noreferrer">dnd.wizards.com/resources/systems-reference-document</a>. The SRD 5.1 is licensed under the <a href={a.licenseUrl} target="_blank" rel="noreferrer">Creative Commons Attribution 4.0 International License</a>.</p>
    <p>JSON data from <a href={a.datasetUrl} target="_blank" rel="noreferrer">{a.dataset}</a>. BlackQuill is not affiliated with or endorsed by Wizards of the Coast.</p>
  </footer>;
}

function ImportScreen({ status, canManage, onImported }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  async function run(source) {
    setBusy(source); setError('');
    const res = await fetch('/api/srd/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setError(data.error || 'Import failed'); return; }
    onImported(data);
  }
  // v1.0.8: no SRD ships with BlackQuill. Upload the 5e-bits JSON files from this computer.
  async function uploadFiles(list) {
    const files = [...(list || [])];
    if (!files.length) return;
    setBusy('upload'); setError('');
    const body = new FormData();
    files.forEach((f) => body.append('files', f, f.name));
    const res = await fetch('/api/srd/import-files', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setError(data.error || 'Import failed'); return; }
    onImported(data);
  }
  return <div className="srd-page">
    <header className="page-header"><div><p className="page-eyebrow">Reference</p><h1 className="page-title">System Reference Document</h1><p className="page-sub">D&amp;D 5e SRD 5.1, shared by every campaign on this BlackQuill.</p></div></header>
    <div className="empty-state srd-import">
      <div className="empty-glyph" aria-hidden="true">📖</div>
      <h2>The SRD is not in BlackQuill yet</h2>
      {canManage ? <>
        <p>Import the System Reference Document to browse races, classes, spells, monsters, equipment, magic items, conditions and the core rules from the sidebar. It is stored once in system/srd and every campaign can use it.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <p>BlackQuill does not include the SRD. Choose how to bring it in:</p>
        <div className="srd-import-actions">
          <button className="btn primary" disabled={!!busy} onClick={() => run('download')}>{busy === 'download' ? 'Downloading…' : 'Download SRD 5.1 from GitHub'}</button>
          <button type="button" className="btn srd-upload-btn" disabled={!!busy} onClick={() => fileInput.current?.click()}>{busy === 'upload' ? 'Importing…' : 'Upload JSON files…'}</button>
          <input ref={fileInput} className="srd-upload-input" type="file" accept=".json,application/json" multiple hidden onChange={(e) => { uploadFiles(e.target.files); e.target.value = ''; }} />
          {status.localAvailable && <button className="btn" disabled={!!busy} onClick={() => run('folder')}>{busy === 'folder' ? 'Importing…' : 'Import from folder'}</button>}
        </div>
        <ul className="hint srd-import-help">
          <li><strong>Download</strong> fetches the files from the 5e-bits/5e-database project on GitHub (about 4 MB, needs internet).</li>
          <li><strong>Upload</strong> takes the JSON files you already have (from <a href="https://github.com/5e-bits/5e-database/tree/main/src/2014/en" target="_blank" rel="noreferrer">5e-database, src/2014/en</a>). Select all {status.requiredFiles?.length || 24} of them at once; names like 5e-SRD-Spells.json or Spells.json both work.</li>
          <li><strong>Import from folder</strong> appears when those files are in <code>{status.importFolder || 'system/srd/import'}</code>, for servers you can't upload to.</li>
        </ul>
      </> : <p>Ask your DM to open SRD in the sidebar and import it. Once imported, everyone in every campaign can browse it.</p>}
    </div>
    <Attribution status={status} />
  </div>;
}

function SearchResults({ q, ctx }) {
  const [results, setResults] = useState(null);
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => { fetch(`/api/srd/search?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : [])).then(setResults).catch(() => setResults([])); }, 180);
    return () => clearTimeout(t);
  }, [q]);
  if (!results) return null;
  return <section className="dash-panel"><h2>Search results</h2>{results.length ? <ul className="srd-rows">{results.map((r) => <li key={r.category + r.index}><button className="srd-row" onClick={() => ctx.open(r.categoryLabel, r.index)}><span className="srd-row-name">{r.name}</span><span className="srd-row-meta">{r.categoryLabel}</span></button></li>)}</ul> : <p className="srd-muted">Nothing in the SRD matches “{q}”.</p>}</section>;
}

function Home({ status, canManage, ctx, onStatusChange }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const manifest = status.manifest || {};
  async function redownload() {
    setBusy('download'); setError('');
    const res = await fetch('/api/srd/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'download' }) });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (!res.ok) { setError(data.error || 'Download failed'); return; }
    onStatusChange(data);
  }
  async function remove() {
    if (!window.confirm('Remove the SRD from BlackQuill? Campaign notes are not affected, and you can import it again at any time.')) return;
    setBusy('remove');
    const res = await fetch('/api/srd', { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusy('');
    if (res.ok) onStatusChange(data);
  }
  return <div className="srd-page">
    <header className="page-header"><div><p className="page-eyebrow">Reference</p><h1 className="page-title">System Reference Document 5.1</h1><p className="page-sub">Choose a category, or search every entry by name.</p></div></header>
    <label className="search-wrap srd-search"><span className="sr-only">Search the SRD</span><span className="search-icon" aria-hidden="true">⌕</span><input className="search" type="search" placeholder="Search the SRD… (e.g. fireball, owlbear)" value={q} onChange={(e) => setQ(e.target.value)} /></label>
    <div className="dashboard">
      <SearchResults q={q} ctx={ctx} />
      {GROUPS.map((g) => {
        const cats = status.categories.filter((c) => c.group === g);
        if (!cats.length) return null;
        return <section key={g} className="dash-panel"><h2 className="srd-group-h">{g}</h2><div className="dash-cat-grid">
          {cats.map((c) => <button key={c.key} className={`dash-cat ${c.primary ? 'srd-primary' : ''}`} onClick={() => ctx.open(c.label)}><span className="dash-cat-count">{c.count}</span><span className="dash-cat-label">{c.label}</span></button>)}
        </div></section>;
      })}
      {canManage && <section className="dash-panel srd-manage"><h2>SRD data</h2>
        <p className="srd-muted">{manifest.source || 'Imported'}{manifest.importedAt ? ` · ${new Date(manifest.importedAt).toLocaleString()}` : ''}{manifest.importedBy ? ` · by ${manifest.importedBy}` : ''}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="srd-import-actions"><button className="btn" disabled={!!busy} onClick={redownload}>{busy === 'download' ? 'Downloading…' : 'Update from GitHub'}</button><button className="btn ghost" disabled={!!busy} onClick={remove}>Remove SRD</button></div>
      </section>}
    </div>
    <Attribution status={status} />
  </div>;
}

function ListView({ cat, ctx, status }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  useEffect(() => {
    setData(null); setQ(''); setFilters({}); setError('');
    fetch(`/api/srd/${cat.key}`).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not load'); return r.json(); }).then(setData).catch((e) => setError(e.message));
  }, [cat.key]);
  const items = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.items.filter((it) => (!needle || it.name.toLowerCase().includes(needle)) && Object.entries(filters).every(([k, v]) => {
      if (!v) return true;
      const t = it.tags[k];
      return Array.isArray(t) ? t.includes(v) : String(t ?? '') === v;
    }));
  }, [data, q, filters]);
  return <div className="srd-page">
    <header className="page-header"><div><p className="page-eyebrow"><button className="srd-link" onClick={() => ctx.open('')}>SRD</button> · {cat.group}</p><h1 className="page-title">{cat.label}</h1><p className="page-sub">{data ? `${items.length} of ${data.items.length}` : ''}</p></div></header>
    {error && <p className="error" role="alert">{error}</p>}
    {data && <div className="srd-filters">
      <label className="search-wrap"><span className="sr-only">Filter {cat.label}</span><span className="search-icon" aria-hidden="true">⌕</span><input className="search" type="search" placeholder={`Filter ${cat.label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {data.facets.map((f) => <label key={f.key} className="srd-facet"><span>{f.label}</span><select value={filters[f.key] || ''} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}><option value="">All</option>{f.values.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>)}
    </div>}
    {!data && !error && <p className="srd-muted">Loading…</p>}
    {data && (items.length ? <ul className="srd-rows">{items.map((it) => <li key={it.index}><button className="srd-row" onClick={() => ctx.open(cat.label, it.index)}><span className="srd-row-name">{it.name}</span>{it.meta && <span className="srd-row-meta">{it.meta}</span>}</button></li>)}</ul> : <p className="srd-muted">No {cat.label.toLowerCase()} match these filters.</p>)}
    <Attribution status={status} />
  </div>;
}

function EntryView({ cat, index, ctx, status }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null); setError('');
    fetch(`/api/srd/${cat.key}/${encodeURIComponent(index)}`).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Not found'); return r.json(); }).then(setData).catch((e) => setError(e.message));
    document.querySelector('.main-frame')?.scrollTo?.(0, 0);
  }, [cat.key, index]);
  return <div className="srd-page">
    <header className="page-header"><div><p className="page-eyebrow"><button className="srd-link" onClick={() => ctx.open('')}>SRD</button> · <button className="srd-link" onClick={() => ctx.open(cat.label)}>{cat.label}</button></p><h1 className="page-title">{data?.item?.name || (error ? 'Not found' : '…')}</h1></div>
      <button className="btn ghost" onClick={() => ctx.open(cat.label)}>← All {cat.label.toLowerCase()}</button></header>
    {error && <p className="error" role="alert">{error}</p>}
    {data && <article className="srd-entry"><EntryBody catKey={cat.key} item={data.item} extra={data.extra || {}} ctx={ctx} /></article>}
    <Attribution status={status} />
  </div>;
}

export default function SrdBrowser({ user, status, selected, onOpen, onStatusChange }) {
  const role = String(user?.role || '').toLowerCase();
  const canManage = role === 'dm' || role === 'admin';
  const ctx = useMemo(() => {
    const byKey = Object.fromEntries((status?.categories || []).map((c) => [c.key, c]));
    return { byKey, open: onOpen };
  }, [status, onOpen]);
  if (!status) return <div className="srd-page"><p className="srd-muted">Loading the SRD…</p></div>;
  if (!status.imported) return <ImportScreen status={status} canManage={canManage} onImported={onStatusChange} />;
  const cat = status.categories.find((c) => c.label === selected?.subcategory);
  if (!cat) return <Home status={status} canManage={canManage} ctx={ctx} onStatusChange={onStatusChange} />;
  if (selected?.srdItem) return <EntryView cat={cat} index={selected.srdItem} ctx={ctx} status={status} />;
  return <ListView cat={cat} ctx={ctx} status={status} />;
}
