import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { pool, query } from './db.js';
import { config } from './config.js';
import { normalizePhone } from './phone.js';
import { render } from './template.js';
import { smsInfo, MAX_FRAGMENTS } from './gsm.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const MAX_RECIPIENTS = 50_000;
const CHUNK = 500;

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const bad = (res, error, extra = {}) => res.status(400).json({ error, ...extra });

export const api = Router();

api.get('/config', (_req, res) => {
  res.json({ mock: config.mock, defaultSender: config.defaultSender, hasApiKey: !!config.apiKey });
});

// ---------- კაბინეტები და ბალანსი ----------
// Beephub-ის API ბალანსს არ აბრუნებს, ამიტომ ბალანსს ხელით ვწერთ და ყოველი მიღებული
// მესიჯისას (fragments * ფასი) ავტომატურად აკლდება (იხ. worker.js)
const CABINET_SELECT = `SELECT id, name, sender, balance_gel::float AS balance_gel, price_per_sms::float AS price_per_sms,
  CASE WHEN price_per_sms > 0 THEN floor(balance_gel / price_per_sms)::int END AS sms_left
  FROM cabinets`;

const getCabinet = async (id) => (await query(`${CABINET_SELECT} WHERE id=$1`, [id])).rows[0];

api.get('/cabinets', wrap(async (_req, res) => {
  res.json((await query(`${CABINET_SELECT} ORDER BY sort_order`)).rows);
}));

api.put('/cabinets/:id', wrap(async (req, res) => {
  const balance = Number(req.body?.balance_gel);
  const price = Number(req.body?.price_per_sms);
  if (!Number.isFinite(balance) || !Number.isFinite(price) || price < 0) return bad(res, 'ბალანსი და ფასი რიცხვები უნდა იყოს');
  const { rowCount } = await query('UPDATE cabinets SET balance_gel=$2, price_per_sms=$3 WHERE id=$1', [req.params.id, balance, price]);
  if (!rowCount) return res.status(404).json({ error: 'კაბინეტი ვერ მოიძებნა' });
  res.json(await getCabinet(req.params.id));
}));

// ---------- შაბლონები ----------
api.get('/templates', wrap(async (req, res) => {
  const { cabinet } = req.query;
  const { rows } = cabinet
    ? await query('SELECT * FROM templates WHERE cabinet=$1 ORDER BY name', [cabinet])
    : await query('SELECT * FROM templates ORDER BY cabinet, name');
  res.json(rows);
}));

api.post('/templates', wrap(async (req, res) => {
  const { name, body, cabinet } = req.body ?? {};
  if (!name?.trim() || !body?.trim()) return bad(res, 'სახელი და ტექსტი სავალდებულოა');
  if (!cabinet || !(await getCabinet(cabinet))) return bad(res, 'კაბინეტი არასწორია');
  try {
    const { rows } = await query('INSERT INTO templates (name, body, cabinet) VALUES ($1,$2,$3) RETURNING *', [name.trim(), body, cabinet]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return bad(res, 'ამ კაბინეტში ასეთი სახელის შაბლონი უკვე არსებობს');
    throw e;
  }
}));

api.put('/templates/:id', wrap(async (req, res) => {
  const { name, body } = req.body ?? {};
  if (!name?.trim() || !body?.trim()) return bad(res, 'სახელი და ტექსტი სავალდებულოა');
  try {
    const { rows } = await query('UPDATE templates SET name=$2, body=$3 WHERE id=$1 RETURNING *', [req.params.id, name.trim(), body]);
    if (!rows[0]) return res.status(404).json({ error: 'ვერ მოიძებნა' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return bad(res, 'ასეთი სახელის შაბლონი უკვე არსებობს');
    throw e;
  }
}));

api.delete('/templates/:id', wrap(async (req, res) => {
  await query('DELETE FROM templates WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

// ---------- CSV/Excel წაკითხვა (გადახედვისთვის) ----------
api.post('/parse', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return bad(res, 'ფაილი არ არის მიმაგრებული');
  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', codepage: 65001 });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
  } catch {
    return bad(res, 'ფაილის წაკითხვა ვერ მოხერხდა (CSV ან XLSX უნდა იყოს)');
  }
  if (rows.length > MAX_RECIPIENTS) return bad(res, `მაქსიმუმ ${MAX_RECIPIENTS} სტრიქონია დაშვებული`);
  res.json({ columns: rows.length ? Object.keys(rows[0]) : [], rows });
}));

// ---------- კამპანიები ----------
// body: { cabinet, name?, body, scheduledAt?, recipients: [{ phone, vars }] }
// Sender ID მოდის არჩეული კაბინეტიდან.
// აბრუნებს მზა მესიჯებს, გამოტოვებულებს და ხარჯის გათვლას (ბაზაში არაფერს წერს)
async function prepare(input) {
  const { cabinet: cabinetId, name, body, scheduledAt, recipients } = input ?? {};
  const fail = (error, extra) => ({ error, ...extra });
  if (!body?.trim()) return fail('ტექსტი სავალდებულოა');
  const cabinet = cabinetId && (await getCabinet(cabinetId));
  if (!cabinet) return fail('აირჩიეთ კაბინეტი');
  if (!Array.isArray(recipients) || !recipients.length) return fail('მიმღებები არ არის მითითებული');
  if (recipients.length > MAX_RECIPIENTS) return fail(`მაქსიმუმ ${MAX_RECIPIENTS} მიმღებია დაშვებული`);

  let when = new Date();
  if (scheduledAt) {
    when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return fail('თარიღი არასწორია');
    if (when < new Date()) when = new Date();
  }

  const seen = new Set();
  const numbers = [];
  const texts = [];
  const frags = [];
  const skipped = [];
  for (const [i, r] of recipients.entries()) {
    const phone = normalizePhone(r.phone);
    if (!phone) { skipped.push({ row: i + 1, phone: r.phone, reason: 'ნომერი არასწორია' }); continue; }
    if (seen.has(phone)) { skipped.push({ row: i + 1, phone: r.phone, reason: 'დუბლირებული ნომერი' }); continue; }
    const out = render(body, r.vars);
    if (out.missing) { skipped.push({ row: i + 1, phone: r.phone, reason: `ცვლადი ცარიელია: ${out.missing.join(', ')}` }); continue; }
    const info = smsInfo(out.text);
    if (info.fragments > MAX_FRAGMENTS) { skipped.push({ row: i + 1, phone: r.phone, reason: `ტექსტი ძალიან გრძელია (${info.fragments} fragment, მაქს. ${MAX_FRAGMENTS})` }); continue; }
    seen.add(phone);
    numbers.push(phone);
    texts.push(out.text);
    frags.push(info.fragments);
  }
  if (!numbers.length) return fail('გასაგზავნი მესიჯი არ დარჩა', { skipped });

  const totalFragments = frags.reduce((a, b) => a + b, 0);
  const cost = Math.round(totalFragments * cabinet.price_per_sms * 10000) / 10000;
  return {
    cabinet, name, body, when, numbers, texts, frags, skipped,
    estimate: {
      messages: numbers.length,
      sms: totalFragments,
      cost_gel: cost,
      balance_gel: cabinet.balance_gel,
      balance_after: Math.round((cabinet.balance_gel - cost) * 10000) / 10000,
      price_known: cabinet.price_per_sms > 0,
    },
  };
}

api.post('/campaigns/preview', wrap(async (req, res) => {
  const p = await prepare(req.body);
  if (p.error) return bad(res, p.error, { skipped: p.skipped });
  res.json({ sender: p.cabinet.sender, cabinet: p.cabinet.name, scheduled_at: p.when, estimate: p.estimate, skipped: p.skipped, sample: p.texts[0] });
}));

api.post('/campaigns', wrap(async (req, res) => {
  const p = await prepare(req.body);
  if (p.error) return bad(res, p.error, { skipped: p.skipped });
  const { cabinet, name, body, when, numbers, texts, frags, skipped } = p;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO campaigns (name, sender, body, scheduled_at, cabinet) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name?.trim() || `გაგზავნა ${new Date().toLocaleString('ka-GE')}`, cabinet.sender, body, when, cabinet.id],
    );
    const campaign = rows[0];
    for (let i = 0; i < numbers.length; i += CHUNK) {
      await client.query(
        `INSERT INTO messages (campaign_id, to_number, text, fragments, next_action_at)
         SELECT $1, n, t, f, $5 FROM unnest($2::text[], $3::text[], $4::int[]) AS u(n, t, f)`,
        [campaign.id, numbers.slice(i, i + CHUNK), texts.slice(i, i + CHUNK), frags.slice(i, i + CHUNK), when],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ campaign, created: numbers.length, skipped, estimate: p.estimate });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

const COUNTS = `
  count(*) AS total,
  count(*) FILTER (WHERE m.status IN ('PENDING','SENDING')) AS pending,
  count(*) FILTER (WHERE m.status='SUBMITTED') AS submitted,
  count(*) FILTER (WHERE m.status='DELIVERED') AS delivered,
  count(*) FILTER (WHERE m.status IN ('FAILED_PERMANENT','FAILED_FINAL')) AS failed,
  count(*) FILTER (WHERE m.status='NEEDS_REVIEW') AS needs_review,
  count(*) FILTER (WHERE m.status='CANCELLED') AS cancelled`;

api.get('/campaigns', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, ${COUNTS} FROM campaigns c LEFT JOIN messages m ON m.campaign_id=c.id
     WHERE ($1::text IS NULL OR c.cabinet=$1)
     GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`,
    [req.query.cabinet || null],
  );
  res.json(rows);
}));

api.get('/campaigns/:id', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, ${COUNTS} FROM campaigns c LEFT JOIN messages m ON m.campaign_id=c.id
     WHERE c.id=$1 GROUP BY c.id`,
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'ვერ მოიძებნა' });
  res.json(rows[0]);
}));

api.post('/campaigns/:id/cancel', wrap(async (req, res) => {
  await query(`UPDATE campaigns SET status='CANCELLED' WHERE id=$1`, [req.params.id]);
  const { rowCount } = await query(
    `UPDATE messages SET status='CANCELLED', updated_at=now() WHERE campaign_id=$1 AND status='PENDING'`,
    [req.params.id],
  );
  res.json({ cancelled: rowCount });
}));

// ხელით ხელახლა ცდა იმ მესიჯებზე, რომლებზეც დროებითი შეცდომის გამო ცდები ამოიწურა
api.post('/campaigns/:id/retry-failed', wrap(async (req, res) => {
  const { rowCount } = await query(
    `UPDATE messages SET status='PENDING', attempts=0, next_action_at=now(), updated_at=now()
     WHERE campaign_id=$1 AND status='FAILED_FINAL'
       AND EXISTS (SELECT 1 FROM campaigns c WHERE c.id=$1 AND c.status='ACTIVE')`,
    [req.params.id],
  );
  res.json({ retried: rowCount });
}));

// ---------- ისტორია ----------
api.get('/messages', wrap(async (req, res) => {
  const { status, q, campaignId, cabinet } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`m.status=$${params.length}`); }
  if (campaignId) { params.push(campaignId); where.push(`m.campaign_id=$${params.length}`); }
  if (cabinet) { params.push(cabinet); where.push(`c.cabinet=$${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(m.to_number ILIKE $${params.length} OR m.text ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT count(*)::int AS n FROM messages m JOIN campaigns c ON c.id=m.campaign_id ${w}`, params)).rows[0].n;
  const { rows } = await query(
    `SELECT m.id, m.campaign_id, c.name AS campaign_name, m.to_number, m.text, m.status, m.attempts,
            m.delivery_status, m.error_code, m.error_kind, m.error_message, m.next_action_at,
            m.created_at, m.completed_at
     FROM messages m JOIN campaigns c ON c.id=m.campaign_id ${w}
     ORDER BY m.created_at DESC, m.id LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  res.json({ total, rows });
}));
