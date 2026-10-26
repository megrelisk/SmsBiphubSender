import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import { pool, query } from './db.js';
import { config } from './config.js';
import { normalizePhone } from './phone.js';
import { render } from './template.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const MAX_RECIPIENTS = 50_000;
const CHUNK = 500;

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const bad = (res, error, extra = {}) => res.status(400).json({ error, ...extra });

export const api = Router();

api.get('/config', (_req, res) => {
  res.json({ mock: config.mock, defaultSender: config.defaultSender, hasApiKey: !!config.apiKey });
});

// ---------- შაბლონები ----------
api.get('/templates', wrap(async (_req, res) => {
  res.json((await query('SELECT * FROM templates ORDER BY name')).rows);
}));

api.post('/templates', wrap(async (req, res) => {
  const { name, body } = req.body ?? {};
  if (!name?.trim() || !body?.trim()) return bad(res, 'სახელი და ტექსტი სავალდებულოა');
  try {
    const { rows } = await query('INSERT INTO templates (name, body) VALUES ($1,$2) RETURNING *', [name.trim(), body]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return bad(res, 'ასეთი სახელის შაბლონი უკვე არსებობს');
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
// body: { name, sender, body, scheduledAt?, recipients: [{ phone, vars }] }
api.post('/campaigns', wrap(async (req, res) => {
  const { name, sender, body, scheduledAt, recipients } = req.body ?? {};
  if (!body?.trim()) return bad(res, 'ტექსტი სავალდებულოა');
  const from = (sender || config.defaultSender).trim();
  if (from.length < 1 || from.length > 11) return bad(res, 'Sender ID უნდა იყოს 1-11 სიმბოლო');
  if (!Array.isArray(recipients) || !recipients.length) return bad(res, 'მიმღებები არ არის მითითებული');
  if (recipients.length > MAX_RECIPIENTS) return bad(res, `მაქსიმუმ ${MAX_RECIPIENTS} მიმღებია დაშვებული`);

  let when = new Date();
  if (scheduledAt) {
    when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return bad(res, 'თარიღი არასწორია');
    if (when < new Date()) when = new Date();
  }

  const seen = new Set();
  const numbers = [];
  const texts = [];
  const skipped = [];
  for (const [i, r] of recipients.entries()) {
    const phone = normalizePhone(r.phone);
    if (!phone) { skipped.push({ row: i + 1, phone: r.phone, reason: 'ნომერი არასწორია' }); continue; }
    if (seen.has(phone)) { skipped.push({ row: i + 1, phone: r.phone, reason: 'დუბლირებული ნომერი' }); continue; }
    const out = render(body, r.vars);
    if (out.missing) { skipped.push({ row: i + 1, phone: r.phone, reason: `ცვლადი ცარიელია: ${out.missing.join(', ')}` }); continue; }
    seen.add(phone);
    numbers.push(phone);
    texts.push(out.text);
  }
  if (!numbers.length) return bad(res, 'გასაგზავნი მესიჯი არ დარჩა', { skipped });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO campaigns (name, sender, body, scheduled_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [name?.trim() || `გაგზავნა ${new Date().toLocaleString('ka-GE')}`, from, body, when],
    );
    const campaign = rows[0];
    for (let i = 0; i < numbers.length; i += CHUNK) {
      await client.query(
        `INSERT INTO messages (campaign_id, to_number, text, next_action_at)
         SELECT $1, n, t, $4 FROM unnest($2::text[], $3::text[]) AS u(n, t)`,
        [campaign.id, numbers.slice(i, i + CHUNK), texts.slice(i, i + CHUNK), when],
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ campaign, created: numbers.length, skipped });
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

api.get('/campaigns', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT c.*, ${COUNTS} FROM campaigns c LEFT JOIN messages m ON m.campaign_id=c.id
     GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`,
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
  const { status, q, campaignId } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`m.status=$${params.length}`); }
  if (campaignId) { params.push(campaignId); where.push(`m.campaign_id=$${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(m.to_number ILIKE $${params.length} OR m.text ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query(`SELECT count(*)::int AS n FROM messages m ${w}`, params)).rows[0].n;
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
