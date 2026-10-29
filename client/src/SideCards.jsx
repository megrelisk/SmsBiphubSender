import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { usePolling } from './common.jsx';
import Blocklist from './Blocklist.jsx';

const when = (d) => new Date(d).toLocaleString('ka-GE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

// მარცხენა სვეტი: დღევანდელი შედეგი, დაგეგმილები, შეცდომიანი ნომრები, შავი სია
export default function SideCards({ cabinet, onOpenCampaign, onRetry }) {
  const [stats, setStats] = useState(null);
  const [sched, setSched] = useState([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [blockOpen, setBlockOpen] = useState(false);

  const load = () => {
    api.stats(cabinet.id).then(setStats).catch(() => {});
    api.campaigns(cabinet.id).then((l) => setSched(
      l.filter((c) => c.status === 'ACTIVE' && Number(c.pending) > 0 && new Date(c.scheduled_at) > new Date())
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
    )).catch(() => {});
    api.blocked().then((b) => setBlockedCount(b.length)).catch(() => {});
  };
  usePolling(load, 10000);
  useEffect(() => { setStats(null); setSched([]); load(); }, [cabinet.id]);

  async function cancel(c) {
    if (!window.confirm(`გაუქმდეს დაგეგმილი გაგზავნა „${c.name}“ (${when(c.scheduled_at)})?`)) return;
    await api.cancelCampaign(c.id);
    load();
  }

  const t = stats?.today;
  const rate = t && t.total - t.waiting > 0 ? Math.round((t.delivered / (t.total - t.waiting)) * 100) : null;
  const failed = stats?.lastFailed;

  return (
    <>
      <div className="panel today">
        <div className="lbl">დღეს</div>
        <div className="today-grid">
          <div><b>{t?.total ?? '—'}</b><span>გაგზავნილი</span></div>
          <div><b className="ok">{rate == null ? '—' : `${rate}%`}</b><span>მიწოდება</span></div>
          <div><b className={t?.failed ? 'neg' : ''}>{t?.failed ?? '—'}</b><span>შეცდომა</span></div>
        </div>
      </div>

      <div className="panel sched">
        <div className="lbl" style={{ padding: '14px 16px 6px' }}>დაგეგმილი · {sched.length}</div>
        <div className="scroll sched-list">
          {!sched.length && <p className="muted" style={{ padding: '4px 8px 12px' }}>დაგეგმილი გაგზავნა არ არის</p>}
          {sched.map((c) => (
            <div className="tpl-row" key={c.id} style={{ alignItems: 'center' }}>
              <button className="item" onClick={() => onOpenCampaign(c.id)} style={{ gap: 2, padding: '6px 10px' }}>
                <span className="t">{when(c.scheduled_at)}</span>
                <span className="d">{c.name} · {c.pending} მიმღები</span>
              </button>
              <button className="icon" onClick={() => cancel(c)} aria-label={`გაუქმება: ${c.name}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="side-actions">
        <button
          disabled={!failed}
          onClick={() => onRetry(failed.numbers)}
          title={failed ? `ბოლო შეცდომიანი გაგზავნა: ${failed.name}` : 'შეცდომიანი ნომრები არ არის'}
        >
          ხელახლა · {failed ? failed.numbers.length : 0}
        </button>
        <button onClick={() => setBlockOpen(true)}>შავი სია · {blockedCount}</button>
      </div>
      {blockOpen && <Blocklist onClose={() => setBlockOpen(false)} onChanged={setBlockedCount} />}
    </>
  );
}
