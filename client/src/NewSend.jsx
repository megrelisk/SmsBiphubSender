import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { smsInfo, MAX_FRAGMENTS } from './gsm.js';
import DateTimePicker, { nowRounded } from './DateTimePicker.jsx';
import { gel } from './BalanceBar.jsx';

const VAR = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const PHONE_GUESS = /phone|tel|mobile|number|ნომ|ტელ/i;

function renderPreview(body, vars) {
  return body.replace(VAR, (_, k) => (vars?.[k] ? String(vars[k]) : `{{${k}}}`));
}

export default function NewSend({ cabinet, onCreated, onSent }) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [source, setSource] = useState('manual');
  const [numbers, setNumbers] = useState('');
  const [file, setFile] = useState(null); // { name, columns, rows }
  const [phoneCol, setPhoneCol] = useState('');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState('now');
  const [scheduledAt, setScheduledAt] = useState(nowRounded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // კაბინეტის შეცვლისას შაბლონები იცვლება, ტექსტი კი გასუფთავდეს, რომ სხვა კაბინეტის ტექსტი არ გაიგზავნოს
  useEffect(() => {
    api.templates(cabinet.id).then(setTemplates).catch(() => {});
    setBody('');
    setResult(null);
    setError('');
  }, [cabinet.id]);

  const recipients = useMemo(() => {
    if (source === 'manual') {
      return numbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).map((phone) => ({ phone, vars: {} }));
    }
    if (!file || !phoneCol) return [];
    return file.rows.map((r) => ({ phone: r[phoneCol], vars: r }));
  }, [source, numbers, file, phoneCol]);

  const columns = source === 'file' && file ? file.columns.filter((c) => c !== phoneCol) : [];

  // ხარჯის შეფასება: ყოველი მიმღების რენდერილი ტექსტის fragment-ები
  const est = useMemo(() => {
    if (!body.trim() || !recipients.length) return null;
    let sms = 0;
    for (const r of recipients) sms += smsInfo(renderPreview(body, r.vars)).fragments;
    const cost = sms * cabinet.price_per_sms;
    return { sms, cost, after: cabinet.balance_gel - cost };
  }, [body, recipients, cabinet.price_per_sms, cabinet.balance_gel]);
  const info = smsInfo(body);
  const priceKnown = cabinet.price_per_sms > 0;
  const notEnough = est && priceKnown && est.after < 0;

  async function onFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setError('');
    try {
      const parsed = await api.parseFile(f);
      setFile({ name: f.name, ...parsed });
      setPhoneCol(parsed.columns.find((c) => PHONE_GUESS.test(c)) || parsed.columns[0] || '');
    } catch (err) {
      setFile(null);
      setError(err.message);
    }
  }

  async function submit() {
    setError('');
    setResult(null);
    const what = when === 'later' ? `დაიგეგმოს ${scheduledAt.toLocaleString('ka-GE', { hour12: false })}-ზე` : 'გაიგზავნოს ახლავე';
    if (!window.confirm(`${recipients.length} მიმღები, გამგზავნი: ${cabinet.sender}\n${what}?`)) return;
    setBusy(true);
    try {
      const out = await api.createCampaign({
        cabinet: cabinet.id,
        name,
        body,
        scheduledAt: when === 'later' ? scheduledAt.toISOString() : null,
        recipients,
      });
      setResult(out);
      onSent();
      if (!out.skipped.length) onCreated(out.campaign.id);
    } catch (err) {
      setError(err.message);
      if (err.data?.skipped) setResult({ created: 0, skipped: err.data.skipped });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && body.trim() && recipients.length > 0 && info.fragments <= MAX_FRAGMENTS;

  return (
    <div className="card">
      <label>სახელი (არასავალდებულო)
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="მაგ. ოქტომბრის შეხსენება" />
      </label>

      <h3>მიმღებები</h3>
      <div className="seg">
        <button className={source === 'manual' ? 'active' : ''} onClick={() => setSource('manual')}>ნომრები ხელით</button>
        <button className={source === 'file' ? 'active' : ''} onClick={() => setSource('file')}>CSV / Excel ფაილი</button>
      </div>

      {source === 'manual' ? (
        <label>ნომრები (თითო ხაზზე ერთი ან მძიმით გამოყოფილი)
          <textarea rows={5} value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder={'555123456\n599000111'} />
        </label>
      ) : (
        <>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} />
          {file && (
            <div className="row">
              <label>ტელეფონის სვეტი
                <select value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)}>
                  {file.columns.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <span className="muted">{file.name}: {file.rows.length} სტრიქონი</span>
            </div>
          )}
        </>
      )}
      <p className="muted">მიმღები: {recipients.length}</p>

      <h3>ტექსტი</h3>
      <div className="row">
        <label>{cabinet.name}-ის შაბლონები
          <select value="" onChange={(e) => { const t = templates.find((x) => String(x.id) === e.target.value); if (t) setBody(t.body); }}>
            <option value="">{templates.length ? 'აირჩიეთ შაბლონი...' : 'ამ კაბინეტს შაბლონები ჯერ არ აქვს'}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      {columns.length > 0 && (
        <div className="chips">
          ცვლადები (დააჭირეთ ჩასასმელად):
          {columns.map((c) => <button key={c} className="chip" onClick={() => setBody((b) => `${b}{{${c}}}`)}>{`{{${c}}}`}</button>)}
        </div>
      )}
      <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="მაგ. გამარჯობა {{name}}, ..." />
      <p className="muted">
        {info.length} სიმბოლო · {info.fragments} SMS ერთ მიმღებზე ({info.encoding}
        {info.encoding === 'UCS-2' ? ': ქართული 70 სიმბოლო თითო SMS-ზე' : ''})
        {info.fragments > MAX_FRAGMENTS && <b className="neg"> · ზედმეტად გრძელია (მაქს. {MAX_FRAGMENTS})</b>}
      </p>
      {body && recipients[0] && (
        <div className="preview"><b>გადახედვა (პირველი მიმღები):</b> {renderPreview(body, recipients[0].vars)}</div>
      )}

      <h3>გაგზავნის დრო</h3>
      <div className="seg">
        <button className={when === 'now' ? 'active' : ''} onClick={() => setWhen('now')}>ახლავე</button>
        <button className={when === 'later' ? 'active' : ''} onClick={() => { setWhen('later'); setScheduledAt(nowRounded()); }}>დაგეგმვა</button>
      </div>
      {when === 'later' && <DateTimePicker value={scheduledAt} onChange={setScheduledAt} />}

      {est && (
        <div className={`cost ${notEnough ? 'bad' : ''}`}>
          <span>ჯამში <b>{est.sms} SMS</b> ({recipients.length} მიმღები)</span>
          {priceKnown ? (
            <>
              <span>ღირებულება <b>{gel(est.cost)}</b></span>
              <span>ბალანსი გაგზავნის შემდეგ <b>{gel(est.after)}</b></span>
              {notEnough && <b className="neg">ბალანსი არ ჰყოფნის!</b>}
            </>
          ) : (
            <span className="muted">ღირებულების სანახავად მიუთითეთ ფასი 1 SMS-ზე („ბალანსის შეცვლა“)</span>
          )}
        </div>
      )}

      {error && <div className="alert err">{error}</div>}
      {result && (
        <div className="alert ok">
          დაემატა {result.created} მესიჯი.
          {result.skipped?.length > 0 && (
            <>
              {' '}გამოტოვებულია {result.skipped.length}:
              <ul>{result.skipped.slice(0, 50).map((s, i) => <li key={i}>სტრიქონი {s.row} ({String(s.phone)}): {s.reason}</li>)}</ul>
              {result.campaign && <button onClick={() => onCreated(result.campaign.id)}>გაგზავნის ნახვა</button>}
            </>
          )}
        </div>
      )}

      <button className="primary send" disabled={!canSubmit} onClick={submit}>
        {busy ? 'იგზავნება...' : `${when === 'later' ? 'დაგეგმვა' : 'გაგზავნა'} სახელით: ${cabinet.sender}`}
      </button>
    </div>
  );
}
