// დემო რეჟიმი (VITE_DEMO=1): ინტერფეისი მუშაობს ბრაუზერის მეხსიერებაში, სერვერის გარეშე.
// SMS რეალურად არ იგზავნება; გვერდის განახლებისას მონაცემები საწყისზე ბრუნდება.
// უკავშირდება მხოლოდ api.js-ს; ბექენდის გამოქვეყნების შემდეგ VITE_DEMO ამოვიღოთ.
import { smsInfo, MAX_FRAGMENTS } from './gsm.js';

const VAR = /\{\{\s*([^{}\s]+)\s*\}\}/g;
const now = () => new Date().toISOString();
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

const normalizePhone = (raw) => {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('5')) d = '995' + d;
  return /^995\d{9}$/.test(d) ? d : null;
};

const db = {
  cabinets: [
    { id: 'kea', name: 'Kea academy', sender: 'KEA Academy', balance_gel: 25, price_per_sms: 0.06 },
    { id: 'mindup', name: 'Mind up', sender: 'Mind up', balance_gel: 12.4, price_per_sms: 0.06 },
    { id: 'movesummit', name: 'Move Summit', sender: 'Move Summit', balance_gel: 8.5, price_per_sms: 0.06 },
    { id: 'trainup', name: 'Trainup.ge', sender: 'Trainup.ge', balance_gel: 0, price_per_sms: 0 },
  ],
  folders: [{ cabinet: 'kea', name: 'დასტურის სმს' }],
  templates: [
    ['kea', '', 'გაკვეთილის შეხსენება', 'გამარჯობა {{name}}, შეგახსენებთ, რომ გაკვეთილი იწყება {{date}} {{time}} საათზე. KEA Academy'],
    ['kea', 'დასტურის სმს', 'რეგისტრაცია გაიხსნა', 'გამარჯობა {{name}}, KEA Academy-ში გაიხსნა რეგისტრაცია კურსზე: {{course}}.'],
    ['kea', '', 'გადახდის შეხსენება', 'გამარჯობა {{name}}, გახსენებთ {{amount}} ლარის გადახდას {{date}}-მდე. KEA Academy'],
    ['mindup', '', 'ახალი ჯგუფი', 'გამარჯობა {{name}}, Mind up-ში იწყება ახალი ჯგუფი {{date}}-ს.'],
    ['mindup', '', 'სესიის დადასტურება', '{{name}}, თქვენი სესია Mind up-ში დადასტურებულია: {{date}}, {{time}} საათი.'],
  ].map(([cabinet, folder, name, body], i) => ({ id: i + 1, cabinet, folder, name, body, created_at: now() })),
  blocked: [{ phone: '995555000999', note: 'მოითხოვა გამოწერის გაუქმება', created_at: ago(2000) }],
  campaigns: [],
  messages: [],
  seq: { template: 100, campaign: 0, message: 0 },
};

function addCampaign({ cabinet, name, body, scheduled_at, recipients, statusFor }) {
  const cab = db.cabinets.find((c) => c.id === cabinet);
  const campaign = { id: ++db.seq.campaign, name, sender: cab.sender, body, scheduled_at, status: 'ACTIVE', created_at: now(), cabinet };
  db.campaigns.unshift(campaign);
  recipients.forEach((r, i) => {
    const st = statusFor ? statusFor(i) : 'DELIVERED';
    db.messages.unshift({
      id: `m${++db.seq.message}`, campaign_id: campaign.id, campaign_name: name, to_number: r.phone, text: r.text,
      status: st, attempts: st === 'PENDING' ? 0 : 1, fragments: smsInfo(r.text).fragments, delivery_status: st === 'DELIVERED' ? 'DELIVERED' : null,
      error_code: st === 'FAILED_PERMANENT' ? 'INVALID_DESTINATION' : null, error_kind: st === 'FAILED_PERMANENT' ? 'PERMANENT' : null, error_message: null,
      created_at: scheduled_at, completed_at: st === 'DELIVERED' || st === 'FAILED_PERMANENT' ? scheduled_at : null,
    });
  });
  return campaign;
}

// საწყისი მაგალითები
addCampaign({
  cabinet: 'kea', name: 'ოქტომბრის შეხსენება', body: 'გამარჯობა, გაკვეთილი ხვალ 18:00 საათზე. KEA Academy', scheduled_at: ago(180),
  recipients: ['995555111001', '995555111002', '995555111003', '995555111004'].map((phone) => ({ phone, text: 'გამარჯობა, გაკვეთილი ხვალ 18:00 საათზე. KEA Academy' })),
  statusFor: (i) => (i === 3 ? 'FAILED_PERMANENT' : 'DELIVERED'),
});
addCampaign({
  cabinet: 'mindup', name: 'ახალი ჯგუფი', body: 'Mind up: იწყება ახალი ჯგუფი.', scheduled_at: ago(50),
  recipients: ['995599222001', '995599222002'].map((phone) => ({ phone, text: 'Mind up: იწყება ახალი ჯგუფი.' })),
});

const cabView = (c) => ({ ...c, sms_left: c.price_per_sms > 0 ? Math.floor(c.balance_gel / c.price_per_sms) : null });

function counts(campaignId) {
  const ms = db.messages.filter((m) => m.campaign_id === campaignId);
  const n = (...s) => ms.filter((m) => s.includes(m.status)).length;
  return {
    total: ms.length, pending: n('PENDING', 'SENDING'), submitted: n('SUBMITTED'), delivered: n('DELIVERED'),
    failed: n('FAILED_PERMANENT', 'FAILED_FINAL'), needs_review: n('NEEDS_REVIEW'), cancelled: n('CANCELLED'),
  };
}

function prepare(b) {
  const cab = db.cabinets.find((c) => c.id === b.cabinet);
  if (!b.body?.trim()) return { error: 'ტექსტი სავალდებულოა' };
  if (!cab) return { error: 'აირჩიეთ კაბინეტი' };
  if (!b.recipients?.length) return { error: 'მიმღებები არ არის მითითებული' };
  const blocked = new Set(db.blocked.map((x) => x.phone));
  const seen = new Set();
  const ok = [];
  const skipped = [];
  b.recipients.forEach((r, i) => {
    const phone = normalizePhone(r.phone);
    const skip = (reason) => skipped.push({ row: i + 1, phone: r.phone, reason });
    if (!phone) return skip('ნომერი არასწორია');
    if (seen.has(phone)) return skip('დუბლირებული ნომერი');
    if (blocked.has(phone)) return skip('ნომერი შავ სიაშია');
    const missing = [...b.body.matchAll(VAR)].map((m) => m[1]).filter((k) => !String(r.vars?.[k] ?? '').trim());
    if (missing.length) return skip(`ცვლადი ცარიელია: ${[...new Set(missing)].join(', ')}`);
    const text = b.body.replace(VAR, (_, k) => String(r.vars[k]).trim());
    const info = smsInfo(text);
    if (info.fragments > MAX_FRAGMENTS) return skip(`ტექსტი ძალიან გრძელია (${info.fragments} fragment)`);
    seen.add(phone);
    ok.push({ phone, text, fragments: info.fragments });
  });
  if (!ok.length) return { error: 'გასაგზავნი მესიჯი არ დარჩა', skipped };
  const sms = ok.reduce((a, r) => a + r.fragments, 0);
  const cost = Math.round(sms * cab.price_per_sms * 10000) / 10000;
  return {
    cab, ok, skipped,
    when: b.scheduledAt && new Date(b.scheduledAt) > new Date() ? new Date(b.scheduledAt).toISOString() : now(),
    estimate: {
      messages: ok.length, sms, cost_gel: cost, balance_gel: cab.balance_gel,
      balance_after: Math.round((cab.balance_gel - cost) * 10000) / 10000, price_known: cab.price_per_sms > 0,
    },
  };
}

const fail = (error, data = {}) => { throw Object.assign(new Error(error), { data: { error, ...data } }); };
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 80));

export async function demoRequest(path, options = {}) {
  const url = new URL(path, 'http://demo');
  const p = url.pathname;
  const q = (k) => url.searchParams.get(k) || '';
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  const seg = p.split('/').filter(Boolean);

  if (p === '/config') return delay({ mock: true, demo: true, defaultSender: 'BEEPHUB', hasApiKey: false });

  if (seg[0] === 'cabinets') {
    if (method === 'PUT') {
      const c = db.cabinets.find((x) => x.id === seg[1]);
      if (!c) fail('კაბინეტი ვერ მოიძებნა');
      c.balance_gel = Number(body.balance_gel);
      c.price_per_sms = Number(body.price_per_sms);
      return delay(cabView(c));
    }
    return delay(db.cabinets.map(cabView));
  }

  if (seg[0] === 'template-folders') {
    if (method === 'POST') {
      const name = String(body.name ?? '').trim();
      if (!name) fail('საქაღალდის სახელი სავალდებულოა');
      if (!db.folders.some((f) => f.cabinet === body.cabinet && f.name === name)) db.folders.push({ cabinet: body.cabinet, name });
      return delay({ name });
    }
    if (method === 'DELETE') {
      db.templates.filter((t) => t.cabinet === q('cabinet') && t.folder === q('name')).forEach((t) => { t.folder = ''; });
      db.folders = db.folders.filter((f) => !(f.cabinet === q('cabinet') && f.name === q('name')));
      return delay(null);
    }
    return delay(db.folders.filter((f) => f.cabinet === q('cabinet')).map((f) => f.name));
  }

  if (seg[0] === 'templates') {
    if (seg[2] === 'folder') {
      const t = db.templates.find((x) => String(x.id) === seg[1]);
      if (!t) fail('ვერ მოიძებნა');
      t.folder = String(body.folder ?? '').trim();
      return delay(t);
    }
    if (method === 'GET') return delay(db.templates.filter((t) => !q('cabinet') || t.cabinet === q('cabinet')).sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name)));
    if (method === 'DELETE') { db.templates = db.templates.filter((t) => String(t.id) !== seg[1]); return delay(null); }
    const folder = String(body.folder ?? '').trim();
    if (!body.name?.trim() || !body.body?.trim()) fail('სახელი და ტექსტი სავალდებულოა');
    if (method === 'POST') {
      const t = { id: ++db.seq.template, cabinet: body.cabinet, folder, name: body.name.trim(), body: body.body, created_at: now() };
      db.templates.push(t);
      return delay(t);
    }
    const t = db.templates.find((x) => String(x.id) === seg[1]);
    if (!t) fail('ვერ მოიძებნა');
    Object.assign(t, { name: body.name.trim(), body: body.body, folder });
    return delay(t);
  }

  if (seg[0] === 'parse') fail('დემო რეჟიმში CSV/Excel ფაილის ატვირთვა მიუწვდომელია. ნომრები ხელით ჩაწერეთ.');

  if (seg[0] === 'blocked') {
    if (method === 'DELETE') { db.blocked = db.blocked.filter((b) => b.phone !== seg[1]); return delay(null); }
    if (method === 'POST') {
      const phones = (Array.isArray(body.phones) ? body.phones : [body.phone]).map(normalizePhone);
      const valid = [...new Set(phones.filter(Boolean))];
      if (!valid.length) fail('ნომერი არასწორია');
      valid.filter((ph) => !db.blocked.some((b) => b.phone === ph)).forEach((phone) => db.blocked.unshift({ phone, note: String(body.note ?? '').trim(), created_at: now() }));
      return delay({ added: valid.length, invalid: phones.length - valid.length });
    }
    return delay(db.blocked);
  }

  if (seg[0] === 'stats') {
    const ms = db.messages.filter((m) => db.campaigns.find((c) => c.id === m.campaign_id)?.cabinet === q('cabinet'));
    const n = (...s) => ms.filter((m) => s.includes(m.status)).length;
    const lastC = db.campaigns.find((c) => c.cabinet === q('cabinet') && db.messages.some((m) => m.campaign_id === c.id && m.status.startsWith('FAILED')));
    return delay({
      today: { total: ms.length, delivered: n('DELIVERED'), failed: n('FAILED_PERMANENT', 'FAILED_FINAL', 'NEEDS_REVIEW'), waiting: n('PENDING', 'SENDING', 'SUBMITTED') },
      lastFailed: lastC ? { campaign_id: lastC.id, name: lastC.name, numbers: db.messages.filter((m) => m.campaign_id === lastC.id && m.status.startsWith('FAILED')).map((m) => m.to_number) } : null,
    });
  }

  if (seg[0] === 'campaigns') {
    if (seg[1] === 'preview') {
      const r = prepare(body);
      if (r.error) fail(r.error, { skipped: r.skipped });
      return delay({ sender: r.cab.sender, cabinet: r.cab.name, scheduled_at: r.when, estimate: r.estimate, skipped: r.skipped, sample: r.ok[0].text });
    }
    if (method === 'POST' && !seg[1]) {
      const r = prepare(body);
      if (r.error) fail(r.error, { skipped: r.skipped });
      const future = new Date(r.when) > new Date(Date.now() + 60000);
      const campaign = addCampaign({
        cabinet: r.cab.id, name: body.name?.trim() || `გაგზავნა ${new Date().toLocaleString('ka-GE', { hour12: false })}`,
        body: body.body, scheduled_at: r.when, recipients: r.ok, statusFor: () => (future ? 'PENDING' : 'DELIVERED'),
      });
      if (!future) r.cab.balance_gel = Math.round((r.cab.balance_gel - r.estimate.cost_gel) * 10000) / 10000;
      return delay({ campaign, created: r.ok.length, skipped: r.skipped, estimate: r.estimate });
    }
    if (seg[2] === 'cancel') {
      const c = db.campaigns.find((x) => String(x.id) === seg[1]);
      if (c) c.status = 'CANCELLED';
      let k = 0;
      db.messages.filter((m) => String(m.campaign_id) === seg[1] && m.status === 'PENDING').forEach((m) => { m.status = 'CANCELLED'; k++; });
      return delay({ cancelled: k });
    }
    if (seg[2] === 'retry-failed') return delay({ retried: 0 });
    if (seg[1]) {
      const c = db.campaigns.find((x) => String(x.id) === seg[1]);
      if (!c) fail('ვერ მოიძებნა');
      return delay({ ...c, ...counts(c.id) });
    }
    return delay(db.campaigns.filter((c) => !q('cabinet') || c.cabinet === q('cabinet')).map((c) => ({ ...c, ...counts(c.id) })));
  }

  if (seg[0] === 'messages') {
    const text = q('q').toLowerCase();
    let rows = db.messages.filter((m) => {
      const c = db.campaigns.find((x) => x.id === m.campaign_id);
      return (!q('cabinet') || c?.cabinet === q('cabinet')) && (!q('status') || m.status === q('status'))
        && (!q('campaignId') || String(m.campaign_id) === q('campaignId'))
        && (!text || m.to_number.includes(text) || m.text.toLowerCase().includes(text));
    });
    const total = rows.length;
    const offset = Number(q('offset')) || 0;
    rows = rows.slice(offset, offset + (Number(q('limit')) || 50));
    return delay({ total, rows });
  }

  fail(`დემო რეჟიმში ეს მოთხოვნა მხარდაჭერილი არ არის: ${p}`);
}
