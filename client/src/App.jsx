import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import NewSend from './NewSend.jsx';
import Campaigns from './Campaigns.jsx';
import History from './History.jsx';
import Templates from './Templates.jsx';
import BalanceBar from './BalanceBar.jsx';

const TABS = [
  ['new', 'ახალი გაგზავნა'],
  ['campaigns', 'გაგზავნები'],
  ['history', 'ისტორია'],
  ['templates', 'შაბლონები'],
];

function loadCabinet() {
  try { return localStorage.getItem('cabinet') || ''; } catch { return ''; }
}

export default function App() {
  const [tab, setTab] = useState('new');
  const [cfg, setCfg] = useState(null);
  const [cabinets, setCabinets] = useState([]);
  const [cabinetId, setCabinetId] = useState(loadCabinet);
  const [openCampaign, setOpenCampaign] = useState(null);

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

  return (
    <div className="app" data-cabinet={cabinet?.id}>
      <header>
        <h1>SMS გაგზავნა</h1>
        {cfg?.mock && <span className="badge warn">ტესტ რეჟიმი: SMS რეალურად არ იგზავნება</span>}
        {cfg && !cfg.mock && !cfg.hasApiKey && <span className="badge err">BEEPHUB_API_KEY არ არის მითითებული</span>}
        <div className="cabinet-switch" role="group" aria-label="კაბინეტი">
          {cabinets.map((c) => (
            <button key={c.id} data-cabinet={c.id} className={c.id === cabinet?.id ? 'on' : ''} onClick={() => pick(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      </header>

      {cabinet && (
        <div className="sender-strip">
          გაგზავნის სახელი: <b>{cabinet.sender}</b>
        </div>
      )}
      {cabinet && <BalanceBar cabinet={cabinet} onSaved={refreshCabinets} />}

      <nav>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setOpenCampaign(null); }}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {cabinet && tab === 'new' && <NewSend cabinet={cabinet} onCreated={showCampaign} onSent={refreshCabinets} />}
        {cabinet && tab === 'campaigns' && <Campaigns cabinet={cabinet} openId={openCampaign} setOpenId={setOpenCampaign} />}
        {cabinet && tab === 'history' && <History cabinet={cabinet} />}
        {cabinet && tab === 'templates' && <Templates cabinet={cabinet} />}
        {!cabinet && <p className="muted">იტვირთება...</p>}
      </main>
    </div>
  );
}
