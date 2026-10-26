import React, { useState } from 'react';
import { api } from './api.js';
import { fmt, usePolling } from './common.jsx';
import MessagesTable from './MessagesTable.jsx';

function Detail({ id, onBack }) {
  const [c, setC] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setC(await api.campaign(id));
      setRows((await api.messages({ campaignId: id, status, limit: 100 })).rows);
    } catch (e) { setError(e.message); }
  };
  usePolling(load, 5000);

  if (!c) return <p>{error || 'იტვირთება...'}</p>;
  const act = async (fn, msg) => { if (window.confirm(msg)) { await fn(id); load(); } };

  return (
    <div className="card">
      <button onClick={onBack}>← უკან</button>
      <h2>{c.name} {c.status === 'CANCELLED' && <span className="pill gray">გაუქმებულია</span>}</h2>
      <p className="muted">Sender: {c.sender} · დაგეგმილი: {fmt(c.scheduled_at)}</p>
      <p className="preview">{c.body}</p>
      <Counts c={c} />
      <div className="row">
        {c.status === 'ACTIVE' && Number(c.pending) > 0 && (
          <button onClick={() => act(api.cancelCampaign, 'გაუქმდეს ჯერ გაუგზავნელი მესიჯები?')}>გაუქმება</button>
        )}
        {Number(c.failed) > 0 && (
          <button onClick={() => act(api.retryFailed, 'ხელახლა სცადოს დროებითი შეცდომით დასრულებულ მესიჯებზე?')}>
            ხელახლა ცდა (დროებითი შეცდომები)
          </button>
        )}
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ყველა სტატუსი</option>
          <option value="PENDING">ელოდება</option>
          <option value="SUBMITTED">ველოდებით სტატუსს</option>
          <option value="DELIVERED">მიწოდებული</option>
          <option value="FAILED_PERMANENT">მუდმივი შეცდომა</option>
          <option value="FAILED_FINAL">დროებითი, ცდები ამოიწურა</option>
          <option value="NEEDS_REVIEW">საჭიროებს შემოწმებას</option>
        </select>
      </div>
      <MessagesTable rows={rows} />
    </div>
  );
}

const Counts = ({ c }) => (
  <div className="counts">
    <span>სულ: <b>{c.total}</b></span>
    <span>ელოდება: <b>{c.pending}</b></span>
    <span>ველოდებით სტატუსს: <b>{c.submitted}</b></span>
    <span className="g">მიწოდებული: <b>{c.delivered}</b></span>
    <span className="r">შეცდომა: <b>{c.failed}</b></span>
    {Number(c.needs_review) > 0 && <span className="o">შესამოწმებელი: <b>{c.needs_review}</b></span>}
  </div>
);

export default function Campaigns({ openId, setOpenId }) {
  const [list, setList] = useState([]);
  usePolling(() => { if (!openId) api.campaigns().then(setList).catch(() => {}); }, 5000);

  if (openId) return <Detail id={openId} onBack={() => setOpenId(null)} />;
  if (!list.length) return <p className="muted">გაგზავნები ჯერ არ არის</p>;
  return (
    <div className="card">
      <table>
        <thead><tr><th>სახელი</th><th>დაგეგმილი დრო</th><th>შედეგი</th></tr></thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className="click" onClick={() => setOpenId(c.id)}>
              <td>{c.name} {c.status === 'CANCELLED' && <span className="pill gray">გაუქმებულია</span>}</td>
              <td>{fmt(c.scheduled_at)}</td>
              <td><Counts c={c} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
