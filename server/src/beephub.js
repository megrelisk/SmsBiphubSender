import { randomUUID } from 'node:crypto';
import { config } from './config.js';

// Beephub SMS API v2 - https://beephub.ge/docs
// ყველა ფუნქცია აბრუნებს ნორმალიზებულ შედეგს და არასოდეს აგდებს ექსეფშენს:
//   { outcome: 'accepted', messageId, deliveryStatus }       - მიღებულია
//   { outcome: 'rejected', code, message, retryable }         - ამ მესიჯს კონკრეტულად უარი უთხრეს
//   { outcome: 'http', status, code, message, retryAfterSec } - სერვერმა შეცდომით უპასუხა
//   { outcome: 'unknown', message }                           - ქსელი/timeout: არ ვიცით მიიღო თუ არა

const TIMEOUT_MS = 20_000;

async function call(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(config.baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json, retryAfter: Number(res.headers.get('retry-after')) || null };
  } catch (e) {
    return { network: true, message: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

const problem = (r) => ({
  outcome: 'http',
  status: r.status,
  code: r.json?.errorCode || r.json?.code || null,
  message: r.json?.detail || r.json?.title || r.json?.message || `HTTP ${r.status}`,
  retryAfterSec: r.retryAfter,
});

async function realSend({ clientReference, from, text, to, clientMessageId, ttlSeconds }) {
  const r = await call('POST', '/api/v2/sms:send', {
    clientReference,
    from,
    text,
    ttlSeconds,
    messages: [{ clientMessageId, to }],
  });
  if (r.network) return { outcome: 'unknown', message: r.message };
  const m = r.json?.messages?.[0];
  if (m?.state === 'ACCEPTED') return { outcome: 'accepted', messageId: m.messageId, deliveryStatus: m.deliveryStatus };
  if (m?.state === 'REJECTED') {
    return { outcome: 'rejected', code: m.error?.code, message: m.error?.message, retryable: m.error?.retryable };
  }
  return problem(r);
}

async function realStatus(messageId) {
  const r = await call('GET', `/api/v2/sms/${encodeURIComponent(messageId)}`);
  if (r.network) return { outcome: 'unknown', message: r.message };
  if (r.status === 200) {
    return { outcome: 'ok', deliveryStatus: r.json.deliveryStatus, failureReason: r.json.failureReason };
  }
  return problem(r);
}

// ---- Mock (BEEPHUB_MOCK=1) - ნომრის ბოლო ციფრით ვმართავთ სცენარს ----
//  0: მიწოდება ვერ მოხერხდა (დროებითი)   9: მიწოდება ვერ მოხერხდა (მუდმივი)
//  8: გაგზავნისას INVALID_PHONE_NUMBER    7: პირველ ცდაზე HTTP 500
//  დანარჩენი: 5 წამში DELIVERED
const mockMsgs = new Map();
const mockRefs = new Set();
const mock500Seen = new Set();

async function mockSend({ clientReference, to }) {
  if (mockRefs.has(clientReference)) {
    return { outcome: 'http', status: 409, code: 'IDEMPOTENCY_KEY_REUSE_CONFLICT', message: 'duplicate reference' };
  }
  const last = to.slice(-1);
  if (last === '8') return { outcome: 'rejected', code: 'INVALID_PHONE_NUMBER', message: 'invalid number', retryable: false };
  if (last === '7' && !mock500Seen.has(to)) {
    mock500Seen.add(to);
    return { outcome: 'http', status: 500, code: 'INTERNAL_ERROR', message: 'mock failure' };
  }
  mockRefs.add(clientReference);
  const messageId = randomUUID();
  mockMsgs.set(messageId, { to, at: Date.now() });
  return { outcome: 'accepted', messageId, deliveryStatus: 'ACCEPTED' };
}

async function mockStatus(messageId) {
  const m = mockMsgs.get(messageId);
  if (!m) return { outcome: 'http', status: 404, code: 'RESOURCE_NOT_FOUND', message: 'not found' };
  if (Date.now() - m.at < 5000) return { outcome: 'ok', deliveryStatus: 'SENT', failureReason: null };
  const last = m.to.slice(-1);
  if (last === '0') return { outcome: 'ok', deliveryStatus: 'FAILED', failureReason: 'SUBSCRIBER_ABSENT' };
  if (last === '9') return { outcome: 'ok', deliveryStatus: 'FAILED', failureReason: 'INVALID_DESTINATION' };
  return { outcome: 'ok', deliveryStatus: 'DELIVERED', failureReason: null };
}

export const sendSms = (args) => (config.mock ? mockSend(args) : realSend(args));
export const getSmsStatus = (id) => (config.mock ? mockStatus(id) : realStatus(id));
