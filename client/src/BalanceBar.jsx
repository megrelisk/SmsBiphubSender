import React, { useState } from 'react';
import { api } from './api.js';

export const gel = (n) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;

// Beephub-ის API ბალანსს არ გვაძლევს: ბალანსს ხელით ვწერთ (შევსებისას), ფასს ასევე,
// ხოლო ყოველი გაგზავნილი SMS-ის ღირებულება ავტომატურად აკლდება.
export default function BalanceBar({ cabinet, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [balance, setBalance] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  const open = () => {
    setBalance(String(cabinet.balance_gel));
    setPrice(String(cabinet.price_per_sms));
    setError('');
    setEdit(true);
  };

  async function save() {
    try {
      await api.saveCabinet(cabinet.id, {
        balance_gel: Number(balance.replace(',', '.')),
        price_per_sms: Number(price.replace(',', '.')),
      });
      setEdit(false);
      onSaved();
    } catch (e) { setError(e.message); }
  }

  const known = cabinet.price_per_sms > 0;
  if (edit) {
    return (
      <div className="panel balance">
        <div className="balance-edit">
          <label>ბალანსი (₾)<input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} /></label>
          <label>ფასი 1 SMS-ზე (₾)<input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <div className="row">
            <button className="primary" onClick={save}>შენახვა</button>
            <button onClick={() => setEdit(false)}>გაუქმება</button>
          </div>
          {error && <div className="alert err">{error}</div>}
          <p className="muted">ბალანსს Beephub API არ აბრუნებს, ამიტომ შეიყვანეთ ამჟამინდელი მნიშვნელობა. გაგზავნილი SMS-ების ღირებულება მას ავტომატურად გამოაკლდება.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="panel balance">
      <div className="lbl">დარჩენილი SMS</div>
      <div className="big"><b>{known ? Math.max(cabinet.sms_left ?? 0, 0) : '—'}</b><span>SMS</span></div>
      <div className="stats">
        <div><span>ბალანსი</span><b className={cabinet.balance_gel < 0 ? 'neg' : ''}>{gel(cabinet.balance_gel)}</b></div>
        <div><span>ფასი 1 SMS-ზე</span><b>{known ? gel(cabinet.price_per_sms) : 'არ არის მითითებული'}</b></div>
        <div><button className="link" onClick={open}>ბალანსის შეცვლა</button></div>
      </div>
    </div>
  );
}
