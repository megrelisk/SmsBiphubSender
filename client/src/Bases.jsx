import React, { useEffect, useState } from 'react';
import FolderList, { folderNames } from './FolderList.jsx';
import { PencilIcon, TrashIcon } from './Templates.jsx';

// ნომრების ბაზები ინახება ამ ბრაუზერში (localStorage), კაბინეტის მიხედვით.
// სერვერზე ცალკე ცხრილი ჯერ არ არის.
const key = (cabinet) => `bases:${cabinet}`;
const read = (cabinet) => { try { return JSON.parse(localStorage.getItem(key(cabinet))) || []; } catch { return []; } };
const write = (cabinet, list) => { try { localStorage.setItem(key(cabinet), JSON.stringify(list)); } catch { /* არაუშავს */ } };
const parse = (text) => text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
const EMPTY = { name: '', folder: '', numbers: '' };

export default function Bases({ cabinet, currentNumbers, onUse }) {
  const [list, setList] = useState(() => read(cabinet.id));
  const [edit, setEdit] = useState(EMPTY);
  useEffect(() => { setList(read(cabinet.id)); setEdit(EMPTY); }, [cabinet.id]);

  const commit = (next) => { setList(next); write(cabinet.id, next); };
  const nums = parse(edit.numbers);

  const save = () => {
    if (!nums.length) return;
    const item = { id: edit.id ?? String(Date.now()), name: edit.name.trim() || `ბაზა ${list.length + 1}`, folder: edit.folder.trim(), nums };
    commit(edit.id ? list.map((b) => (b.id === edit.id ? item : b)) : list.concat([item]));
    setEdit(EMPTY);
  };

  const remove = (b) => {
    if (!window.confirm(`წაიშალოს „${b.name}“?`)) return;
    commit(list.filter((x) => x.id !== b.id));
    if (edit.id === b.id) setEdit(EMPTY);
  };

  const row = (b) => (
    <div className="tpl-row" key={b.id} style={{ alignItems: 'center' }}>
      <button className="item" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onClick={() => onUse(b.nums)} title="ნომრებში დამატება">
        <span className="base-count">{b.nums.length}</span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span className="t">{b.name}</span>
          <span className="d">დააჭირე ნომრებში დასამატებლად</span>
        </span>
      </button>
      <button className="icon" onClick={() => setEdit({ id: b.id, name: b.name, folder: b.folder ?? '', numbers: b.nums.join('\n') })} aria-label={`რედაქტირება: ${b.name}`}><PencilIcon /></button>
      <button className="icon" onClick={() => remove(b)} aria-label={`წაშლა: ${b.name}`}><TrashIcon /></button>
    </div>
  );

  return (
    <>
      <div className="list scroll">
        <FolderList items={list} renderItem={row} empty="ბაზები ჯერ არ არის" />
      </div>
      <div className="pfoot">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="lbl">{edit.id ? 'ბაზის რედაქტირება' : 'ახალი ბაზა'} · {nums.length} ნომერი</span>
          <button className="link" onClick={() => setEdit({ ...edit, numbers: currentNumbers })} disabled={!currentNumbers}>მიმდინარე ნომრების ჩასმა</button>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="სახელი" aria-label="ბაზის სახელი" />
          <input value={edit.folder} list="base-folders" onChange={(e) => setEdit({ ...edit, folder: e.target.value })} placeholder="საქაღალდე" aria-label="საქაღალდე" />
          <datalist id="base-folders">{folderNames(list).map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        <textarea rows={3} value={edit.numbers} onChange={(e) => setEdit({ ...edit, numbers: e.target.value })} placeholder="ნომრები (თითო ხაზზე ერთი)" aria-label="ბაზის ნომრები" />
        <div className="row">
          <button className="primary" onClick={save} disabled={!nums.length}>შენახვა</button>
          {edit.id && <button onClick={() => setEdit(EMPTY)}>გაუქმება</button>}
        </div>
      </div>
    </>
  );
}
