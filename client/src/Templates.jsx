import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import FolderList, { folderNames } from './FolderList.jsx';

const EMPTY = { name: '', body: '', folder: '' };

export const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
export const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);

export default function Templates({ cabinet, currentBody, onUse }) {
  const [list, setList] = useState([]);
  const [savedFolders, setSavedFolders] = useState([]);
  const [edit, setEdit] = useState(EMPTY);
  const [error, setError] = useState('');
  const [newFolder, setNewFolder] = useState(null); // null = დახურულია, სტრიქონი = ველი ღიაა
  const editorRef = useRef(null);
  const nameRef = useRef(null);

  const load = () => Promise.all([api.templates(cabinet.id), api.templateFolders(cabinet.id)])
    .then(([t, f]) => { setList(t); setSavedFolders(f); })
    .catch((e) => setError(e.message));
  useEffect(() => { setEdit(EMPTY); setError(''); setNewFolder(null); load(); }, [cabinet.id]);

  const allFolders = [...new Set([...savedFolders, ...folderNames(list)])].sort((a, b) => a.localeCompare(b, 'ka'));

  async function createFolder() {
    const name = (newFolder ?? '').trim();
    if (!name) return setNewFolder(null);
    setError('');
    try {
      await api.addTemplateFolder(cabinet.id, name);
      setNewFolder(null);
      load();
    } catch (e) { setError(e.message); }
  }

  async function removeFolder(f) {
    const n = list.filter((t) => t.folder === f).length;
    if (!window.confirm(`წაიშალოს საქაღალდე „${f}“?${n ? ` ${n} შაბლონი არ წაიშლება, გადავა საქაღალდის გარეშე.` : ''}`)) return;
    setError('');
    try { await api.deleteTemplateFolder(cabinet.id, f); load(); } catch (e) { setError(e.message); }
  }

  async function move(id, folder) {
    const t = list.find((x) => String(x.id) === String(id));
    if (!t || (t.folder ?? '') === folder) return;
    setError('');
    try { await api.moveTemplate(id, folder); load(); } catch (e) { setError(e.message); }
  }

  // "+" საქაღალდის გვერდით: ახალი შაბლონის ფორმა ამ საქაღალდით წინასწარ არჩეული
  function addIn(folder) {
    setEdit({ ...EMPTY, folder });
    setTimeout(() => { editorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); nameRef.current?.focus(); }, 0);
  }

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

  const row = (t) => (
    <div
      className="tpl-row"
      key={t.id}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; }}
    >
      <button className="item" onClick={() => onUse(t.body)} title="გასაგზავნში ჩასმა">
        <span className="t">{t.name}</span>
        <span className="clamp">{t.body}</span>
      </button>
      <button className="icon" onClick={() => setEdit({ id: t.id, name: t.name, body: t.body, folder: t.folder ?? '' })} aria-label={`რედაქტირება: ${t.name}`} style={{ marginTop: 6 }}><PencilIcon /></button>
      <button className="icon" onClick={() => remove(t)} aria-label={`წაშლა: ${t.name}`} style={{ marginTop: 6 }}><TrashIcon /></button>
    </div>
  );

  return (
    <>
      <div className="list scroll">
        <div className="folder-toolbar">
          {newFolder === null ? (
            <button className="link" onClick={() => setNewFolder('')}>+ საქაღალდის შექმნა</button>
          ) : (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                autoFocus
                value={newFolder}
                maxLength={60}
                onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolder(null); }}
                placeholder="საქაღალდის სახელი"
                aria-label="საქაღალდის სახელი"
              />
              <button className="primary" onClick={createFolder}>შექმნა</button>
              <button onClick={() => setNewFolder(null)}>გაუქმება</button>
            </div>
          )}
        </div>
        <FolderList
          items={list}
          extraFolders={savedFolders}
          renderItem={row}
          empty={`${cabinet.name}-ს შაბლონები ჯერ არ აქვს`}
          onMove={move}
          folderAction={(f) => (
            <>
              <button className="icon" onClick={() => addIn(f)} aria-label={`ახალი შაბლონი საქაღალდეში: ${f}`} title="ახალი შაბლონი ამ საქაღალდეში"><PlusIcon /></button>
              <button className="icon" onClick={() => removeFolder(f)} aria-label={`საქაღალდის წაშლა: ${f}`} title="საქაღალდის წაშლა"><TrashIcon /></button>
            </>
          )}
        />
      </div>
      <div className="pfoot" ref={editorRef}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="lbl">{edit.id ? 'შაბლონის რედაქტირება' : 'ახალი შაბლონი'}</span>
          <button className="link" onClick={() => setEdit({ ...edit, body: currentBody })} disabled={!currentBody}>მიმდინარე ტექსტის ჩასმა</button>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input ref={nameRef} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="სახელი" aria-label="შაბლონის სახელი" />
          <select value={edit.folder} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} aria-label="საქაღალდე">
            <option value="">საქაღალდის გარეშე</option>
            {allFolders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
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
