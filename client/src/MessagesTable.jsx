import React from 'react';
import { StatusBadge, KIND, fmt } from './common.jsx';

export default function MessagesTable({ rows, showCampaign }) {
  if (!rows.length) return <p className="muted">მესიჯები არ მოიძებნა</p>;
  return (
    <table>
      <thead>
        <tr>
          <th>ნომერი</th>
          {showCampaign && <th>გაგზავნა</th>}
          <th>ტექსტი</th>
          <th>სტატუსი</th>
          <th>ცდა</th>
          <th>შეცდომა</th>
          <th>დრო</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td>{m.to_number}</td>
            {showCampaign && <td>{m.campaign_name}</td>}
            <td className="text">{m.text}</td>
            <td><StatusBadge status={m.status} /></td>
            <td>{m.attempts}</td>
            <td>
              {m.error_code && <>{m.error_kind && <b>{KIND[m.error_kind]}: </b>}{m.error_code}{m.error_message ? ` (${m.error_message})` : ''}</>}
            </td>
            <td>{fmt(m.completed_at || m.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
