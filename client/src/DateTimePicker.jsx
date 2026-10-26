import React, { useEffect, useRef } from 'react';

const ITEM = 36; // ერთი ელემენტის სიმაღლე px
const pad = (n) => String(n).padStart(2, '0');

const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const nowRounded = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
};

// ვერტიკალური "ბორბალი": სქროლით იცვლება მნიშვნელობა, დაჭერით პირდაპირ ირჩევა
function Wheel({ count, value, onChange, label }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const programmatic = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.scrollTop = value * ITEM;
      return;
    }
    if (Math.round(el.scrollTop / ITEM) !== value) {
      programmatic.current = true;
      el.scrollTo({ top: value * ITEM, behavior: 'smooth' });
      setTimeout(() => { programmatic.current = false; }, 450);
    }
  }, [value]);

  const onScroll = () => {
    if (programmatic.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const i = Math.min(count - 1, Math.max(0, Math.round(ref.current.scrollTop / ITEM)));
      if (i !== value) onChange(i);
    }, 80);
  };

  return (
    <div className="wheel" aria-label={label}>
      <div className="wheel-band" />
      <div className="wheel-list" ref={ref} onScroll={onScroll}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={`wheel-item ${i === value ? 'sel' : ''}`} onClick={() => onChange(i)}>
            {pad(i)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DateTimePicker({ value, onChange }) {
  const set = (fn) => { const d = new Date(value); fn(d); d.setSeconds(0, 0); onChange(d); };
  const addMinutes = (m) => onChange(new Date(Math.max(Date.now(), value.getTime()) + m * 60000));
  const inPast = value.getTime() < Date.now() - 60000;

  return (
    <div className="dtp">
      <div className="dtp-date">
        <button onClick={() => set((d) => d.setDate(d.getDate() - 1))} aria-label="წინა დღე">‹</button>
        <input
          type="date"
          value={toDateInput(value)}
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, day] = e.target.value.split('-').map(Number);
            set((d) => d.setFullYear(y, m - 1, day));
          }}
        />
        <button onClick={() => set((d) => d.setDate(d.getDate() + 1))} aria-label="შემდეგი დღე">›</button>
        <button onClick={() => onChange(nowRounded())}>ახლა</button>
      </div>

      <div className="dtp-wheels">
        <Wheel label="საათი" count={24} value={value.getHours()} onChange={(h) => set((d) => d.setHours(h))} />
        <span className="colon">:</span>
        <Wheel label="წუთი" count={60} value={value.getMinutes()} onChange={(m) => set((d) => d.setMinutes(m))} />
        <div className="dtp-side">
          <div className="minute-grid">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <button key={m} className={value.getMinutes() === m ? 'on' : ''} onClick={() => set((d) => d.setMinutes(m))}>
                :{pad(m)}
              </button>
            ))}
          </div>
          <div className="quick">
            {[[15, '+15 წთ'], [30, '+30 წთ'], [60, '+1 სთ'], [180, '+3 სთ']].map(([m, l]) => (
              <button key={m} onClick={() => addMinutes(m)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={`dtp-summary ${inPast ? 'past' : ''}`}>
        {value.toLocaleString('ka-GE', { dateStyle: 'full', timeStyle: 'short', hour12: false })}
        {inPast && ' (წარსულშია, გაიგზავნება ახლავე)'}
      </div>
    </div>
  );
}
