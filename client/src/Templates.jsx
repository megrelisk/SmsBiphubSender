import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const EMPTY = { name: '', body: '' };

export default function Templates() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(EMPTY);
  const [error, setError] = useState('');

  const load = () => api.templates().then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save() {
    setError('');
    try {
      await api.saveTemplate(edit);
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
    <div className="card">
      <h3>{edit.id ? 'შაბლონის რედაქტირება' : 'ახალი შაბლონი'}</h3>
      <label>სახელი<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
      <label>ტექსტი (ცვლადები: {'{{name}}'}, {'{{amount}}'}...)
        <textarea rows={4} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
      </label>
      {error && <div className="alert err">{error}</div>}
      <div className="row">
        <button className="primary" onClick={save}>შენახვა</button>
        {edit.id && <button onClick={() => setEdit(EMPTY)}>გაუქმება</button>}
      </div>

      <h3>შაბლონები</h3>
      {!list.length && <p className="muted">შაბლონები ჯერ არ არის</p>}
      <table>
        <tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <td><b>{t.name}</b></td>
              <td className="text">{t.body}</td>
              <td className="nowrap">
                <button onClick={() => setEdit(t)}>რედაქტირება</button>{' '}
                <button onClick={() => remove(t)}>წაშლა</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
