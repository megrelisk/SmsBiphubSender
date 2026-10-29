import React from 'react';
import { StatusBadge, KIND, fmt } from './common.jsx';

// კომპაქტური სია მარჯვენა პანელისთვის: ნომერი, სტატუსი, ტექსტი, შეცდომა
export default function MessagesTable({ rows, showCampaign }) {
  if (!rows.length) return <p className="muted" style={{ padding: 16 }}>მესიჯები არ მოიძებნა</p>;
  return (
    <div className="list">
      {rows.map((m) => (
        <div className="msg" key={m.id}>
          <div className="msg-top">
            <b>{m.to_number}</b>
            <StatusBadge status={m.status} />
          </div>
          <div className="msg-text" title={m.text}>{m.text}</div>
          <div className="msg-meta">
            {showCampaign && m.campaign_name ? `${m.campaign_name} · ` : ''}
            {fmt(m.completed_at || m.created_at)}
            {m.attempts > 1 ? ` · ცდა ${m.attempts}` : ''}
            {m.error_code && (
              <span className="e"> · {m.error_kind && `${KIND[m.error_kind]}: `}{m.error_code}{m.error_message ? ` (${m.error_message})` : ''}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
