import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import NewSend from './NewSend.jsx';
import Campaigns from './Campaigns.jsx';
import History from './History.jsx';
import Templates from './Templates.jsx';

const TABS = [
  ['new', 'ახალი გაგზავნა'],
  ['campaigns', 'გაგზავნები'],
  ['history', 'ისტორია'],
  ['templates', 'შაბლონები'],
];

export default function App() {
  const [tab, setTab] = useState('new');
  const [cfg, setCfg] = useState(null);
  const [openCampaign, setOpenCampaign] = useState(null);

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);

  const showCampaign = useCallback((id) => { setOpenCampaign(id); setTab('campaigns'); }, []);

  return (
    <div className="app">
      <header>
        <h1>SMS გაგზავნა</h1>
        {cfg?.mock && <span className="badge warn">ტესტ რეჟიმი: SMS რეალურად არ იგზავნება</span>}
        {cfg && !cfg.mock && !cfg.hasApiKey && <span className="badge err">BEEPHUB_API_KEY არ არის მითითებული</span>}
      </header>
      <nav>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setOpenCampaign(null); }}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === 'new' && <NewSend cfg={cfg} onCreated={showCampaign} />}
        {tab === 'campaigns' && <Campaigns openId={openCampaign} setOpenId={setOpenCampaign} />}
        {tab === 'history' && <History />}
        {tab === 'templates' && <Templates />}
      </main>
    </div>
  );
}
