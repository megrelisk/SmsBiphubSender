import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const EMPTY = { name: '', body: '' };

const Trash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
);

export default function Templates({ cabinet, currentBody, onUse }) {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = () => api.templates(cabinet.id).then(setList).catch((e) => setError(e.message));
  useEffect(() => { setEdit(EMPTY); setError(''); load(); }, [cabinet.id]);

  async function save() {
    setError('');
    try {
      await api.saveTemplate({ ...edit, cabinet: cabinet.id });
      setEdit(EMPTY);
      load();
    } catch (e) { setError(e.message); }
  }

  async function remove(t) {
    if (!window.confirm(`წაიშალოს „${t.name}“?`)) return;
    await api.deleteTemplate(t.id);
    if (edit.id === t.id) setEdit(EMPTY);
    load();
  }

  return (
    <>
      <div className="list scroll">
        {!list.length && <p className="muted" style={{ padding: 8 }}>{cabinet.name}-ს შაბლონები ჯერ არ აქვს</p>}
        {list.map((t) => (
          <div className="tpl-row" key={t.id}>
            <button className="item" onClick={() => onUse(t.body)} title="ტექსტში ჩასმა">
              <span className="t">{t.name}</span>
              <span className="clamp">{t.body}</span>
            </button>
            <button className="icon" onClick={() => setEdit(t)} aria-label={`რედაქტირება: ${t.name}`} style={{ marginTop: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
            <button className="icon" onClick={() => remove(t)} aria-label={`წაშლა: ${t.name}`} style={{ marginTop: 6 }}><Trash /></button>
          </div>
        ))}
      </div>
      <div className="pfoot">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="lbl">{edit.id ? 'შაბლონის რედაქტირება' : 'ახალი შაბლონი'}</span>
          <button className="link" onClick={() => setEdit({ ...edit, body: currentBody })} disabled={!currentBody}>მიმდინარე ტექსტის ჩასმა</button>
        </div>
        <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="შაბლონის სახელი" aria-label="შაბლონის სახელი" />
        <textarea rows={3} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="ტექსტი (ცვლადები: {{name}}, {{amount}}...)" aria-label="შაბლონის ტექსტი" />
        {error && <div className="alert err">{error}</div>}
        <div className="row">
          <button className="primary" onClick={save}>შენახვა</button>
          {edit.id && <button onClick={() => setEdit(EMPTY)}>გაუქმება</button>}
        </div>
      </div>
    </>
  );
}
