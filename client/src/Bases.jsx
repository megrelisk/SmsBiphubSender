import React, { useEffect, useState } from 'react';

// ნომრების ბაზები ინახება ამ ბრაუზერში (localStorage), კაბინეტის მიხედვით.
// სერვერზე ცალკე ცხრილი ჯერ არ არის.
const key = (cabinet) => `bases:${cabinet}`;
const read = (cabinet) => { try { return JSON.parse(localStorage.getItem(key(cabinet))) || []; } catch { return []; } };
const write = (cabinet, list) => { try { localStorage.setItem(key(cabinet), JSON.stringify(list)); } catch { /* არაუშავს */ } };

export default function Bases({ cabinet, currentNumbers, onUse }) {
  const [list, setList] = useState(() => read(cabinet.id));
  const [name, setName] = useState('');
  useEffect(() => { setList(read(cabinet.id)); setName(''); }, [cabinet.id]);

  const current = currentNumbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const commit = (next) => { setList(next); write(cabinet.id, next); };

  const save = () => {
    if (!current.length) return;
    commit(list.concat([{ id: String(Date.now()), name: name.trim() || `ბაზა ${list.length + 1}`, nums: current }]));
    setName('');
  };

  return (
    <>
      <div className="list scroll">
        {!list.length && <p className="muted" style={{ padding: 8 }}>ბაზები ჯერ არ არის</p>}
        {list.map((b) => (
          <div className="tpl-row" key={b.id} style={{ alignItems: 'center' }}>
            <button className="item" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onClick={() => onUse(b.nums)}>
              <span className="base-count">{b.nums.length}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="t">{b.name}</span>
                <span className="d">დააჭირე ნომრებში დასამატებლად</span>
              </span>
            </button>
            <button className="icon" aria-label={`წაშლა: ${b.name}`} onClick={() => window.confirm(`წაიშალოს „${b.name}“?`) && commit(list.filter((x) => x.id !== b.id))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="pfoot">
        <span className="lbl">ახლანდელი ნომრების შენახვა ბაზად ({current.length})</span>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ბაზის სახელი" aria-label="ბაზის სახელი" />
          <button className="primary" onClick={save} disabled={!current.length}>შენახვა</button>
        </div>
      </div>
    </>
  );
}
