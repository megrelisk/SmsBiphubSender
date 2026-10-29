import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { TrashIcon } from './Templates.jsx';

const fmtPhone = (p) => (p.length === 12 ? `+${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)} ${p.slice(10)}` : p);

// შავი სია: ამ ნომრებზე სერვერი არასდროს გააგზავნის (ყველა პროფილზე)
export default function Blocklist({ onClose, onChanged }) {
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = () => api.blocked().then((l) => { setList(l); onChanged(l.length); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  async function add() {
    setError('');
    try {
      const out = await api.addBlocked(text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean), note);
      if (out.invalid) setError(`${out.invalid} ნომერი არასწორია და გამოტოვებულია`);
      setText(''); setNote('');
      load();
    } catch (e) { setError(e.message); }
  }

  async function remove(p) {
    await api.removeBlocked(p);
    load();
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="შავი სია" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>შავი სია</h2>
          <button onClick={onClose}>დახურვა</button>
        </div>
        <p className="muted">ამ ნომრებზე SMS არასდროს გაიგზავნება, არც ერთი პროფილიდან. გაგზავნისას ისინი ავტომატურად გამოიტოვება.</p>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="ნომრები (თითო ხაზზე ერთი)" aria-label="ბლოკირებადი ნომრები" />
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="შენიშვნა (არასავალდებულო)" aria-label="შენიშვნა" />
          <button className="primary" onClick={add} disabled={!text.trim()}>დამატება</button>
        </div>
        {error && <div className="alert err">{error}</div>}
        <div className="scroll modal-list">
          {!list.length && <p className="muted">შავი სია ცარიელია</p>}
          {list.map((b) => (
            <div className="tpl-row" key={b.phone} style={{ alignItems: 'center' }}>
              <div className="item" style={{ cursor: 'default' }}>
                <span className="t">{fmtPhone(b.phone)}</span>
                {b.note && <span className="d">{b.note}</span>}
              </div>
              <button className="icon" onClick={() => remove(b.phone)} aria-label={`წაშლა: ${b.phone}`}><TrashIcon /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
