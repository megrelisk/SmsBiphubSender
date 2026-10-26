import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { segments } from './common.jsx';

const VAR = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const PHONE_GUESS = /phone|tel|mobile|number|ნომ|ტელ/i;

function renderPreview(body, vars) {
  return body.replace(VAR, (_, k) => (vars?.[k] ? String(vars[k]) : `{{${k}}}`));
}

export default function NewSend({ cfg, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState('');
  const [sender, setSender] = useState('');
  const [source, setSource] = useState('manual');
  const [numbers, setNumbers] = useState('');
  const [file, setFile] = useState(null); // { name, columns, rows }
  const [phoneCol, setPhoneCol] = useState('');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => { api.templates().then(setTemplates).catch(() => {}); }, []);

  const recipients = useMemo(() => {
    if (source === 'manual') {
      return numbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).map((phone) => ({ phone, vars: {} }));
    }
    if (!file || !phoneCol) return [];
    return file.rows.map((r) => ({ phone: r[phoneCol], vars: r }));
  }, [source, numbers, file, phoneCol]);

  const columns = source === 'file' && file ? file.columns.filter((c) => c !== phoneCol) : [];
  const seg = segments(body);

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
    if (when === 'later' && !scheduledAt) return setError('აირჩიეთ გაგზავნის თარიღი და დრო');
    const confirmText = when === 'later' ? `დაიგეგმოს ${recipients.length} მესიჯი?` : `გაიგზავნოს ${recipients.length} მესიჯი ახლავე?`;
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const out = await api.createCampaign({
        name,
        sender: sender || cfg?.defaultSender,
        body,
        scheduledAt: when === 'later' ? new Date(scheduledAt).toISOString() : null,
        recipients,
      });
      setResult(out);
      if (!out.skipped.length) onCreated(out.campaign.id);
    } catch (err) {
      setError(err.message);
      if (err.data?.skipped) setResult({ created: 0, skipped: err.data.skipped });
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && body.trim() && recipients.length > 0;

  return (
    <div className="card">
      <div className="row">
        <label>სახელი (არასავალდებულო)
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="მაგ. ოქტომბრის შეხსენება" />
        </label>
        <label>Sender ID
          <input value={sender} maxLength={11} onChange={(e) => setSender(e.target.value)} placeholder={cfg?.defaultSender} />
        </label>
      </div>

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
        <label>შაბლონი
          <select value="" onChange={(e) => { const t = templates.find((x) => String(x.id) === e.target.value); if (t) setBody(t.body); }}>
            <option value="">აირჩიეთ შაბლონი...</option>
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
      <p className="muted">{body.length} სიმბოლო, დაახლ. {seg.n} SMS{seg.ucs2 ? ' (ქართული/უნიკოდი: 70 სიმბოლო თითო SMS-ზე)' : ''}</p>
      {body && recipients[0] && (
        <div className="preview"><b>გადახედვა (პირველი მიმღები):</b> {renderPreview(body, recipients[0].vars)}</div>
      )}

      <h3>გაგზავნის დრო</h3>
      <div className="row">
        <label className="inline"><input type="radio" checked={when === 'now'} onChange={() => setWhen('now')} /> ახლავე</label>
        <label className="inline"><input type="radio" checked={when === 'later'} onChange={() => setWhen('later')} /> დაგეგმე</label>
        {when === 'later' && <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />}
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

      <button className="primary" disabled={!canSubmit} onClick={submit}>
        {busy ? 'იგზავნება...' : when === 'later' ? 'დაგეგმვა' : 'გაგზავნა'}
      </button>
    </div>
  );
}
