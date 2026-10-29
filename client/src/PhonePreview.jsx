import React, { useEffect, useState } from 'react';

// iPhone 16 Pro Max: 430 × 932 pt. ეკრანზე ეტევა scale-ით.
const W = 430;
const H = 932;
const initials = (s) => s.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const gel = (n) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;

export default function PhonePreview({ name, sender, text, time, later, whenLabel, estimate, skipped, busy, onConfirm, onBack }) {
  const [scale, setScale] = useState(() => Math.min(1, (window.innerHeight - 72) / H));
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 72) / H));
    const esc = (e) => e.key === 'Escape' && !busy && onBack();
    window.addEventListener('resize', fit);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('keydown', esc); };
  }, [onBack, busy]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="გაგზავნის დადასტურება">
      <div className="phone-wrap" style={{ width: W * scale, height: H * scale }}>
        <div className="phone" style={{ transform: `scale(${scale})` }}>
          <div className="screen">
            <div className="island" aria-hidden="true" />
            <div className="sbar" aria-hidden="true">
              <span className="sb-time">{time}</span>
              <span className="sb-icons">
                <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="22" height="11" rx="3.5" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="19" height="8" rx="2.2" fill="currentColor" /><rect x="24" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45" /></svg>
              </span>
            </div>

            <div className="mhead">
              <button className="mback" onClick={onBack} disabled={busy} aria-label="უკან">
                <svg width="12" height="20" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2 2 10l8 8" /></svg>
              </button>
              <div className="mcontact">
                <div className="avatar" aria-hidden="true">{initials(name)}</div>
                <div className="mname">{name}<svg width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 4 4-4 4" /></svg></div>
              </div>
              <span style={{ width: 44 }} />
            </div>

            <div className="thread">
              <div className="stamp"><b>ტექსტური შეტყობინება</b><br />დღეს {time}</div>
              <div className="bubble">{text}</div>
            </div>

            <div className="composer" aria-hidden="true">
              <div className="plus">+</div>
              <div className="field">ტექსტური შეტყობინება · SMS</div>
            </div>
            <div className="home" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="confirm">
        <h2>{later ? 'დაგეგმვის დადასტურება' : 'გაგზავნის დადასტურება'}</h2>
        <p className="muted">ასე გამოჩნდება SMS ადრესატთან. გადაამოწმე და დაადასტურე.</p>
        <dl>
          <div><dt>პროფილი</dt><dd>{name}</dd></div>
          <div><dt>Sender ID</dt><dd>{sender}</dd></div>
          <div><dt>მიმღები</dt><dd>{estimate.messages}</dd></div>
          <div><dt>SMS სულ</dt><dd>{estimate.sms}</dd></div>
          {estimate.price_known && <div><dt>ღირებულება</dt><dd>{gel(estimate.cost_gel)}</dd></div>}
          {estimate.price_known && <div><dt>ბალანსი შემდეგ</dt><dd className={estimate.balance_after < 0 ? 'neg' : ''}>{gel(estimate.balance_after)}</dd></div>}
          <div><dt>{later ? 'გაიგზავნება' : 'დრო'}</dt><dd>{later ? whenLabel : 'ახლავე'}</dd></div>
        </dl>
        {estimate.price_known && estimate.balance_after < 0 && <div className="alert err">ბალანსი არ ჰყოფნის!</div>}
        {skipped?.length > 0 && (
          <div className="alert warn">
            გამოტოვდება {skipped.length}:
            <ul>{skipped.slice(0, 4).map((x, i) => <li key={i}>{String(x.phone)}: {x.reason}</li>)}{skipped.length > 4 && <li>... და კიდევ {skipped.length - 4}</li>}</ul>
          </div>
        )}
        <div className="confirm-actions">
          <button className="primary send" onClick={onConfirm} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
            {busy ? 'იგზავნება...' : later ? 'დადასტურება და დაგეგმვა' : 'დადასტურება და გაგზავნა'}
          </button>
          <button onClick={onBack} disabled={busy} style={{ height: 44 }}>← უკან, გადავაკეთებ</button>
        </div>
      </div>
    </div>
  );
}
