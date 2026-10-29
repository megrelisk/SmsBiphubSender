import React, { useState } from 'react';
import { api } from './api.js';
import { usePolling } from './common.jsx';
import MessagesTable from './MessagesTable.jsx';

const PAGE = 50;

export default function History({ cabinet }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ total: 0, rows: [] });

  const load = () => api.messages({ q, status, cabinet: cabinet.id, limit: PAGE, offset: page * PAGE }).then(setData).catch(() => {});
  usePolling(load, 5000);
  // ფილტრის ან კაბინეტის შეცვლისას დაუყოვნებლივ გადატვირთვა
  React.useEffect(() => { load(); }, [q, status, page, cabinet.id]);

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  return (
    <>
      <div className="pbar">
        <input placeholder="ძებნა ნომრით ან ტექსტით" aria-label="ძებნა" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <div className="row">
          <select value={status} aria-label="სტატუსი" onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
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
      </div>
      <div className="scroll" style={{ flex: 1 }}><MessagesTable rows={data.rows} showCampaign /></div>
      <div className="pager">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="წინა">←</button>
        <span>{page + 1} / {pages}</span>
        <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="შემდეგი">→</button>
      </div>
    </>
  );
}
