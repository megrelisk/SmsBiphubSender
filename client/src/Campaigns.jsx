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

  if (!c) return <p className="muted" style={{ padding: 16 }}>{error || 'იტვირთება...'}</p>;
  const act = async (fn, msg) => { if (window.confirm(msg)) { await fn(id); load(); } };

  return (
    <>
      <div className="pbar">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button onClick={onBack}>← უკან</button>
          {c.status === 'CANCELLED' && <span className="pill gray">გაუქმებულია</span>}
        </div>
        <div>
          <h3>{c.name}</h3>
          <p className="muted">{c.sender} · {fmt(c.scheduled_at)}</p>
        </div>
        <div className="clamp">{c.body}</div>
        <Counts c={c} />
        <div className="row">
          {c.status === 'ACTIVE' && Number(c.pending) > 0 && (
            <button onClick={() => act(api.cancelCampaign, 'გაუქმდეს ჯერ გაუგზავნელი მესიჯები?')}>გაუქმება</button>
          )}
          {Number(c.failed) > 0 && (
            <button onClick={() => act(api.retryFailed, 'ხელახლა სცადოს დროებითი შეცდომით დასრულებულ მესიჯებზე?')}>ხელახლა ცდა</button>
          )}
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="სტატუსის ფილტრი">
            <option value="">ყველა სტატუსი</option>
            <option value="PENDING">ელოდება</option>
            <option value="SUBMITTED">ველოდებით სტატუსს</option>
            <option value="DELIVERED">მიწოდებული</option>
            <option value="FAILED_PERMANENT">მუდმივი შეცდომა</option>
            <option value="FAILED_FINAL">დროებითი, ცდები ამოიწურა</option>
            <option value="NEEDS_REVIEW">საჭიროებს შემოწმებას</option>
          </select>
        </div>
      </div>
      <div className="scroll" style={{ flex: 1 }}><MessagesTable rows={rows} /></div>
    </>
  );
}

const Counts = ({ c }) => (
  <div className="counts">
    <span>სულ: <b>{c.total}</b></span>
    <span>ელოდება: <b>{c.pending}</b></span>
    <span>სტატუსს ველოდებით: <b>{c.submitted}</b></span>
    <span className="g">მიწოდებული: <b>{c.delivered}</b></span>
    <span className="r">შეცდომა: <b>{c.failed}</b></span>
    {Number(c.needs_review) > 0 && <span className="o">შესამოწმებელი: <b>{c.needs_review}</b></span>}
  </div>
);

export default function Campaigns({ cabinet, openId, setOpenId }) {
  const [list, setList] = useState([]);
  usePolling(() => { if (!openId) api.campaigns(cabinet.id).then(setList).catch(() => {}); }, 5000);

  if (openId) return <Detail id={openId} onBack={() => setOpenId(null)} />;
  if (!list.length) return <p className="muted" style={{ padding: 16 }}>გაგზავნები ჯერ არ არის</p>;
  return (
    <div className="list scroll">
      {list.map((c) => (
        <button key={c.id} className="item" onClick={() => setOpenId(c.id)}>
          <span className="d">{fmt(c.scheduled_at)} {c.status === 'CANCELLED' && <span className="pill gray">გაუქმებულია</span>}</span>
          <span className="t">{c.name}</span>
          <Counts c={c} />
        </button>
      ))}
    </div>
  );
}
