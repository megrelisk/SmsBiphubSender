import React, { useState } from 'react';
import { api } from './api.js';
import { usePolling } from './common.jsx';
import MessagesTable from './MessagesTable.jsx';

const PAGE = 50;

export default function History() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ total: 0, rows: [] });

  usePolling(
    () => api.messages({ q, status, limit: PAGE, offset: page * PAGE }).then(setData).catch(() => {}),
    5000,
  );
  // ფილტრის შეცვლისას დაუყოვნებლივ გადატვირთვა
  React.useEffect(() => {
    api.messages({ q, status, limit: PAGE, offset: page * PAGE }).then(setData).catch(() => {});
  }, [q, status, page]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  return (
    <div className="card">
      <div className="row">
        <input placeholder="ძებნა ნომრით ან ტექსტით" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">ყველა სტატუსი</option>
          <option value="PENDING">ელოდება</option>
          <option value="SUBMITTED">ველოდებით სტატუსს</option>
          <option value="DELIVERED">მიწოდებული</option>
          <option value="FAILED_PERMANENT">მუდმივი შეცდომა</option>
          <option value="FAILED_FINAL">დროებითი, ცდები ამოიწურა</option>
          <option value="NEEDS_REVIEW">საჭიროებს შემოწმებას</option>
        </select>
        <span className="muted">სულ: {data.total}</span>
      </div>
      <MessagesTable rows={data.rows} showCampaign />
      <div className="row">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>←</button>
        <span>{page + 1} / {pages}</span>
        <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>→</button>
      </div>
    </div>
  );
}
