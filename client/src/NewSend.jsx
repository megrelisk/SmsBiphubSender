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

export default function NewSend({ cabinet, body, setBody, numbers, setNumbers, onCreated, onSent }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('manual');
  const [file, setFile] = useState(null); // { name, columns, rows }
  const [phoneCol, setPhoneCol] = useState('');
  const [when, setWhen] = useState('now');
  const [scheduledAt, setScheduledAt] = useState(nowRounded);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // კაბინეტის შეცვლისას ტექსტი გასუფთავდეს, რომ სხვა კაბინეტის ტექსტი არ გაიგზავნოს
  useEffect(() => {
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
  const later = when === 'later';
  const whenText = scheduledAt.toLocaleString('ka-GE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <section className="panel compose">
      <div className="compose-mid">
        <div className="numcol">
          <div className="fhead">
            <label className="lbl" htmlFor="nums" style={{ margin: 0 }}>ნომრები</label>
            <div className="seg mini" role="group" aria-label="მიმღებების წყარო">
              <button aria-pressed={source === 'manual'} onClick={() => setSource('manual')}>ხელით</button>
              <button aria-pressed={source === 'file'} onClick={() => setSource('file')}>ფაილი</button>
            </div>
          </div>
          {source === 'manual' ? (
            <textarea id="nums" value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder="+995 5XX XX XX XX" />
          ) : (
            <div className="filebox">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} aria-label="CSV / Excel ფაილი" />
              {file && (
                <>
                  <label>ტელეფონის სვეტი
                    <select value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)}>
                      {file.columns.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <span className="muted">{file.name}: {file.rows.length} სტრიქონი</span>
                </>
              )}
            </div>
          )}
          <div className="fhead">
            <span className="muted"><b>{recipients.length}</b> მიმღები</span>
            {source === 'manual' && numbers && <button className="link" onClick={() => setNumbers('')}>გასუფთავება</button>}
          </div>
        </div>

        <div className="textcol">
          <div className="fhead">
            <label className="lbl" htmlFor="msg" style={{ margin: 0 }}>ტექსტი</label>
            <span className="muted">
              <b>{info.length}</b> სიმბოლო · <b>{info.fragments}</b> SMS ({info.encoding === 'UCS-2' ? 'უნიკოდი, 70 / 67' : 'GSM-7, 160 / 153'})
              {info.fragments > MAX_FRAGMENTS && <b className="neg"> · მაქს. {MAX_FRAGMENTS}</b>}
            </span>
          </div>
          {columns.length > 0 && (
            <div className="chips">
              ცვლადები:
              {columns.map((c) => <button key={c} className="chip" onClick={() => setBody((b) => `${b}{{${c}}}`)}>{`{{${c}}}`}</button>)}
            </div>
          )}
          <textarea id="msg" value={body} onChange={(e) => setBody(e.target.value)} placeholder="დაწერე შეტყობინების ტექსტი..." />
          {body && recipients[0] && source === 'file' && <div className="preview"><b>გადახედვა:</b> {renderPreview(body, recipients[0].vars)}</div>}
        </div>
      </div>

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

      <div className="when-row">
        <div className="seg" role="group" aria-label="გაგზავნის დრო">
          <button aria-pressed={!later} onClick={() => { setWhen('now'); setPickerOpen(false); }}>ახლავე</button>
          <button aria-pressed={later} onClick={() => { setWhen('later'); setScheduledAt(nowRounded()); setPickerOpen(true); }}>დაგეგმვა</button>
        </div>
        {later && (
          <button aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)} style={{ height: 38 }}>{whenText}</button>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="გაგზავნის სახელი (არასავალდებულო)"
          aria-label="გაგზავნის სახელი"
          style={{ flex: 1, minWidth: 200, height: 38 }}
        />
        {later && pickerOpen && (
          <div className="dtp-pop">
            <DateTimePicker value={scheduledAt} onChange={setScheduledAt} />
            <div className="pop-foot"><button className="primary" onClick={() => setPickerOpen(false)}>მზადაა</button></div>
          </div>
        )}
      </div>

      <div className="compose-foot">
        <div className={`cost ${notEnough ? 'bad' : ''}`}>
          {est ? (
            <>
              <b className="main">{recipients.length} მიმღები · {est.sms} SMS{priceKnown && ` · ${gel(est.cost)}`}</b>
              <small>
                {!priceKnown ? 'ფასი 1 SMS-ზე არ არის მითითებული'
                  : notEnough ? `ბალანსი არ ჰყოფნის (${gel(est.after)})`
                  : `ბალანსი გაგზავნის შემდეგ ${gel(est.after)}`}
              </small>
            </>
          ) : (
            <small>ჩაწერე ნომრები და ტექსტი</small>
          )}
        </div>
        <button className="primary send" disabled={!canSubmit} onClick={submit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
          {busy ? 'იგზავნება...' : later ? 'დაგეგმვა' : 'გაგზავნა'}
        </button>
      </div>
    </section>
  );
}
