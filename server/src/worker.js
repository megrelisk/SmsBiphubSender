import { query } from './db.js';
import { config } from './config.js';
import { sendSms, getSmsStatus } from './beephub.js';
import { classifySendRejection, classifyHttpError, classifyDeliveryFailure } from './errors.js';

const TICK_MS = 3000;
const CONCURRENCY = 5;
const BATCH = 50;
const UNKNOWN_RESEND_AFTER_SEC = 120;

async function mapLimit(items, limit, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          await fn(item);
        } catch (e) {
          console.error('worker item error:', e);
        }
      }
    }),
  );
}

// ---- შედეგის გადატანა ბაზაში ----

async function markFailure(msg, kind, code, message, retryAfterSec) {
  const base = [msg.id, code ?? null, kind, message ?? null];
  if (kind === 'PERMANENT') {
    await query(
      `UPDATE messages SET status='FAILED_PERMANENT', error_code=$2, error_kind=$3, error_message=$4,
         completed_at=now(), updated_at=now() WHERE id=$1`,
      base,
    );
  } else if (kind === 'CONFIG' || kind === 'THROTTLED') {
    // ჩვენი ბრალი არ არის და ცდა არ იხარჯება: დავაბრუნოთ რიგში
    const delay = retryAfterSec ?? (kind === 'CONFIG' ? 300 : 30);
    await query(
      `UPDATE messages SET status='PENDING', attempts=GREATEST(attempts-1,0), error_code=$2, error_kind=$3,
         error_message=$4, next_action_at=now() + make_interval(secs => $5), updated_at=now() WHERE id=$1`,
      [...base, delay],
    );
  } else if (msg.attempts >= config.maxAttempts) {
    await query(
      `UPDATE messages SET status='FAILED_FINAL', error_code=$2, error_kind=$3, error_message=$4,
         completed_at=now(), updated_at=now() WHERE id=$1`,
      base,
    );
  } else {
    const delay = config.retryDelaysSec[msg.attempts - 1] ?? config.retryDelaysSec.at(-1) ?? 60;
    await query(
      `UPDATE messages SET status='PENDING', error_code=$2, error_kind=$3, error_message=$4,
         next_action_at=now() + make_interval(secs => $5), updated_at=now() WHERE id=$1`,
      [...base, delay],
    );
  }
}

const needsReview = (id, code, message) =>
  query(
    `UPDATE messages SET status='NEEDS_REVIEW', error_code=$2, error_kind=NULL, error_message=$3,
       updated_at=now() WHERE id=$1`,
    [id, code, message],
  );

async function handleSendResult(msg, r) {
  if (r.outcome === 'accepted') {
    await query(
      `UPDATE messages SET status='SUBMITTED', beephub_message_id=$2, delivery_status=$3,
         error_code=NULL, error_kind=NULL, error_message=NULL, submitted_at=now(),
         next_action_at=now() + make_interval(secs => $4), updated_at=now() WHERE id=$1`,
      [msg.id, r.messageId, r.deliveryStatus, config.pollIntervalSec],
    );
    // ბალანსს ვაკლებთ მიღებული fragment-ების რაოდენობით (Beephub ხარჯავს fragment-ზე)
    await query(
      `UPDATE cabinets SET balance_gel = balance_gel - $2 * price_per_sms
       WHERE id = (SELECT cabinet FROM campaigns WHERE id=$1)`,
      [msg.campaign_id, msg.fragments],
    );
  } else if (r.outcome === 'rejected') {
    await markFailure(msg, classifySendRejection(r), r.code, r.message);
  } else if (r.outcome === 'http') {
    // 409: ეს reference უკვე მიღებულია, მაგრამ messageId-ს ვერ ვიგებთ - ხელით შესამოწმებელია
    if (r.status === 409) return needsReview(msg.id, r.code, 'Beephub-მა უკვე მიიღო ეს მოთხოვნა, მაგრამ messageId არ გვაქვს');
    await markFailure(msg, classifyHttpError(r.status, r.code), r.code ?? `HTTP_${r.status}`, r.message, r.retryAfterSec);
  } else {
    // ქსელის შეცდომა/timeout: არ ვიცით მიიღო თუ არა. რჩება SENDING-ში და იგივე reference-ით
    // გამეორდება (Beephub-ის idempotency დუბლს არ დაუშვებს)
    await query(`UPDATE messages SET error_message=$2, updated_at=now() WHERE id=$1`, [msg.id, r.message]);
  }
}

async function handleStatusResult(msg, r) {
  if (r.outcome === 'ok') {
    if (r.deliveryStatus === 'DELIVERED') {
      await query(
        `UPDATE messages SET status='DELIVERED', delivery_status='DELIVERED', error_code=NULL, error_kind=NULL,
           error_message=NULL, completed_at=now(), updated_at=now() WHERE id=$1`,
        [msg.id],
      );
    } else if (r.deliveryStatus === 'FAILED' || r.deliveryStatus === 'EXPIRED') {
      await query(`UPDATE messages SET delivery_status=$2 WHERE id=$1`, [msg.id, r.deliveryStatus]);
      await markFailure(msg, classifyDeliveryFailure(r.deliveryStatus, r.failureReason), r.deliveryStatus, r.failureReason);
    } else {
      const stale = Date.now() - new Date(msg.submitted_at).getTime() > (config.ttlSeconds + 600) * 1000;
      if (stale) return needsReview(msg.id, r.deliveryStatus, 'სტატუსი TTL-ის შემდეგაც არ დასრულდა');
      await postpone(msg.id, r.deliveryStatus);
    }
  } else if (r.outcome === 'http' && r.status === 404) {
    await needsReview(msg.id, 'RESOURCE_NOT_FOUND', 'Beephub-ში ეს messageId ვერ მოიძებნა');
  } else {
    await postpone(msg.id, null);
  }
}

const postpone = (id, deliveryStatus) =>
  query(
    `UPDATE messages SET delivery_status=COALESCE($2, delivery_status),
       next_action_at=now() + make_interval(secs => $3), updated_at=now() WHERE id=$1`,
    [id, deliveryStatus, config.pollIntervalSec],
  );

// ---- ციკლი ----

async function sendDue() {
  // იგივე reference-ით ერთხელ უკვე გავიმეორეთ და ისევ გაურკვეველია - ვჩერდებით
  await query(
    `UPDATE messages SET status='NEEDS_REVIEW', error_code='UNKNOWN_OUTCOME',
       error_message=COALESCE(error_message,'პასუხი ვერ მივიღეთ'), updated_at=now()
     WHERE status='SENDING' AND next_action_at<=now() AND resend_count>=1`,
  );

  const { rows } = await query(
    `WITH due AS (
       SELECT m.id FROM messages m JOIN campaigns c ON c.id=m.campaign_id
       WHERE c.status='ACTIVE' AND c.scheduled_at<=now() AND m.next_action_at<=now()
         AND m.status IN ('PENDING','SENDING')
       ORDER BY m.next_action_at LIMIT $1 FOR UPDATE OF m SKIP LOCKED
     )
     UPDATE messages m SET
       attempts         = CASE WHEN m.status='PENDING' THEN m.attempts+1 ELSE m.attempts END,
       send_seq         = CASE WHEN m.status='PENDING' THEN m.send_seq+1 ELSE m.send_seq END,
       resend_count     = CASE WHEN m.status='SENDING' THEN m.resend_count+1 ELSE 0 END,
       client_reference = CASE WHEN m.status='PENDING' THEN m.id::text || '-s' || (m.send_seq+1) ELSE m.client_reference END,
       status='SENDING',
       next_action_at   = now() + make_interval(secs => $2),
       updated_at       = now()
     FROM due, campaigns c
     WHERE m.id=due.id AND c.id=m.campaign_id
     RETURNING m.*, c.sender`,
    [BATCH, UNKNOWN_RESEND_AFTER_SEC],
  );

  await mapLimit(rows, CONCURRENCY, async (msg) => {
    const r = await sendSms({
      clientReference: msg.client_reference,
      clientMessageId: msg.id,
      from: msg.sender,
      to: msg.to_number,
      text: msg.text,
      ttlSeconds: config.ttlSeconds,
    });
    await handleSendResult(msg, r);
  });
}

async function checkStatuses() {
  const { rows } = await query(
    `UPDATE messages SET next_action_at=now() + make_interval(secs => $2)
     WHERE id IN (SELECT id FROM messages WHERE status='SUBMITTED' AND next_action_at<=now()
                  ORDER BY next_action_at LIMIT $1 FOR UPDATE SKIP LOCKED)
     RETURNING *`,
    [100, config.pollIntervalSec],
  );
  await mapLimit(rows, CONCURRENCY, async (msg) => handleStatusResult(msg, await getSmsStatus(msg.beephub_message_id)));
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await sendDue();
    await checkStatuses();
  } catch (e) {
    console.error('worker tick error:', e);
  } finally {
    running = false;
  }
}

export function startWorker() {
  setInterval(tick, TICK_MS);
  tick();
}
