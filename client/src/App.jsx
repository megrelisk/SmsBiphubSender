import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import NewSend from './NewSend.jsx';
import Campaigns from './Campaigns.jsx';
import History from './History.jsx';
import Templates from './Templates.jsx';
import Bases from './Bases.jsx';
import BalanceBar from './BalanceBar.jsx';

const TABS = [
  ['campaigns', 'გაგზავნები'],
  ['history', 'ისტორია'],
  ['templates', 'ტექსტები'],
  ['bases', 'ბაზები'],
];

function loadCabinet() {
  try { return localStorage.getItem('cabinet') || ''; } catch { return ''; }
}

export default function App() {
  const [tab, setTab] = useState('campaigns');
  const [cfg, setCfg] = useState(null);
  const [cabinets, setCabinets] = useState([]);
  const [cabinetId, setCabinetId] = useState(loadCabinet);
  const [openCampaign, setOpenCampaign] = useState(null);
  const [body, setBody] = useState('');
  const [numbers, setNumbers] = useState('');

  const refreshCabinets = useCallback(() => api.cabinets().then(setCabinets).catch(() => {}), []);
  useEffect(() => { api.config().then(setCfg).catch(() => {}); refreshCabinets(); }, [refreshCabinets]);
  useEffect(() => { const t = setInterval(refreshCabinets, 10000); return () => clearInterval(t); }, [refreshCabinets]);

  const cabinet = cabinets.find((c) => c.id === cabinetId) ?? cabinets[0];

  const pick = (id) => {
    setCabinetId(id);
    setOpenCampaign(null);
    try { localStorage.setItem('cabinet', id); } catch { /* არაუშავს */ }
  };

  const showCampaign = useCallback((id) => { setOpenCampaign(id); setTab('campaigns'); }, []);
  const appendNumbers = (nums) => setNumbers((cur) => {
    const have = new Set(cur.split(/[\n,;]+/).map((s) => s.replace(/\D/g, '').slice(-9)));
    const add = nums.filter((n) => !have.has(String(n).replace(/\D/g, '').slice(-9)));
    const base = cur.replace(/\s+$/, '');
    return (base ? base + '\n' : '') + add.join('\n');
  });

  return (
    <div className="app" data-cabinet={cabinet?.id}>
      <header>
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 11h7M8.5 14h4" /></svg>
          </div>
          <h1>SMS გაგზავნა</h1>
        </div>
        {cfg?.mock && <span className="badge warn">ტესტ რეჟიმი: SMS რეალურად არ იგზავნება</span>}
        {cfg && !cfg.mock && !cfg.hasApiKey && <span className="badge err">BEEPHUB_API_KEY არ არის მითითებული</span>}
      </header>

      <div className="shell">
        <aside className="col">
          <div className="panel cabs" role="group" aria-label="გამგზავნი კაბინეტი">
            <div className="lbl">გამგზავნი კაბინეტი</div>
            {cabinets.map((c) => {
              const on = c.id === cabinet?.id;
              return (
                <div key={c.id} data-cabinet={c.id} className={`cab ${on ? 'on' : ''}`}>
                  <div className="cab-mark" aria-hidden="true">{c.name.slice(0, 1)}</div>
                  <div className="cab-name"><b>{c.name}</b><small>{c.sender}</small></div>
                  <button className="sw" role="switch" aria-checked={on} aria-label={c.name} onClick={() => !on && pick(c.id)}><i /></button>
                </div>
              );
            })}
          </div>
          {cabinet && <BalanceBar cabinet={cabinet} onSaved={refreshCabinets} />}
        </aside>

        {cabinet ? (
          <NewSend
            cabinet={cabinet}
            body={body} setBody={setBody}
            numbers={numbers} setNumbers={setNumbers}
            onCreated={showCampaign} onSent={refreshCabinets}
          />
        ) : <section className="panel compose"><p className="muted">იტვირთება...</p></section>}

        <section className="panel side-right">
          <div className="tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setOpenCampaign(null); }}>{label}</button>
            ))}
          </div>
          <div className="tabbody">
            {cabinet && tab === 'campaigns' && <Campaigns cabinet={cabinet} openId={openCampaign} setOpenId={setOpenCampaign} />}
            {cabinet && tab === 'history' && <History cabinet={cabinet} />}
            {cabinet && tab === 'templates' && <Templates cabinet={cabinet} currentBody={body} onUse={setBody} />}
            {cabinet && tab === 'bases' && <Bases cabinet={cabinet} currentNumbers={numbers} onUse={appendNumbers} />}
          </div>
        </section>
      </div>
    </div>
  );
}
