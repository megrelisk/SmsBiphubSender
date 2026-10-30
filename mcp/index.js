// MCP სერვერი Claude-ისთვის: SMS-ების გაგზავნა ჩატიდან.
// ის ლოკალურ აპლიკაციას (npm.cmd start, http://127.0.0.1:3001) უკავშირდება, ამიტომ
// გაგზავნის ყველა წესი (ბალანსი, შაბლონები, ხელახალი ცდები, დუბლირებისგან დაცვა) ერთია.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = (process.env.SMS_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

async function api(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, options);
  } catch {
    throw new Error(`SMS აპლიკაცია არ პასუხობს (${BASE}). გაუშვით: cd C:\\Users\\User\\SmsBiphubSender; npm.cmd start`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const skipped = data.skipped?.length ? ` გამოტოვებული: ${JSON.stringify(data.skipped.slice(0, 10))}` : '';
    throw new Error((data.error || `HTTP ${res.status}`) + skipped);
  }
  return data;
}

const post = (path, body) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const text = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const failure = (e) => ({ isError: true, content: [{ type: 'text', text: e.message }] });
const guard = (fn) => async (args) => { try { return await fn(args); } catch (e) { return failure(e); } };

const server = new McpServer({ name: 'sms-biphub', version: '1.0.0' });

server.tool(
  'list_cabinets',
  'აბრუნებს კაბინეტებს (KEA Academy, Mind up): id, გაგზავნის სახელი (sender), ბალანსი ლარებში და დარჩენილი SMS-ების რაოდენობა.',
  {},
  guard(async () => text(await api('/cabinets'))),
);

server.tool(
  'list_templates',
  'აბრუნებს მოცემული კაბინეტის SMS შაბლონებს (სახელი, ტექსტი და {{ცვლადები}}).',
  { cabinet: z.string().describe("კაბინეტის id: 'kea', 'mindup', 'movesummit' ან 'trainup'") },
  guard(async ({ cabinet }) => text(await api(`/templates?cabinet=${encodeURIComponent(cabinet)}`))),
);

server.tool(
  'send_sms',
  [
    'აგზავნის SMS-ს არჩეული კაბინეტის სახელით (KEA Academy ან Mind up), ახლავე ან დაგეგმილად.',
    'ეს რეალურ ფულს ხარჯავს და შეუქცევადია, ამიტომ ჯერ გამოიძახეთ confirm=false: დაგიბრუნებთ გადახედვას',
    '(sender, ტექსტი, SMS-ების რაოდენობა, ღირებულება). აჩვენეთ ის მომხმარებელს და confirm=true მხოლოდ',
    'მისი პირდაპირი დასტურის შემდეგ გამოიყენეთ. კაბინეტი თუ მომხმარებელმა არ დაასახელა, ჰკითხეთ.',
  ].join(' '),
  {
    cabinet: z.string().describe("კაბინეტის id: 'kea' (Kea academy), 'mindup' (Mind up), 'movesummit' (Move Summit) ან 'trainup' (Trainup.ge)"),
    recipients: z
      .array(z.object({
        phone: z.string().describe('ნომერი, მაგ. 555123456 ან 995555123456'),
        vars: z.record(z.string()).optional().describe('ამ მიმღების ცვლადები შაბლონისთვის'),
      }))
      .min(1)
      .describe('მიმღებები'),
    text: z.string().optional().describe('SMS-ის ტექსტი ({{name}} ტიპის ცვლადებით). ან template, ან text'),
    template: z.string().optional().describe('ამავე კაბინეტის შაბლონის სახელი (list_templates-დან)'),
    scheduled_at: z.string().optional().describe('გაგზავნის დრო ISO 8601 ფორმატით, დროის სარტყლით (Asia/Tbilisi = +04:00). არ მიუთითოთ, თუ ახლავე უნდა გაიგზავნოს'),
    campaign_name: z.string().optional(),
    confirm: z.boolean().default(false).describe('false = მხოლოდ გადახედვა, true = რეალურად გაგზავნა'),
  },
  guard(async ({ cabinet, recipients, text: body, template, scheduled_at, campaign_name, confirm }) => {
    if (!body && !template) throw new Error('მიუთითეთ text ან template');
    if (body && template) throw new Error('მიუთითეთ მხოლოდ ერთი: text ან template');
    if (template) {
      const list = await api(`/templates?cabinet=${encodeURIComponent(cabinet)}`);
      const t = list.find((x) => x.name.trim().toLowerCase() === template.trim().toLowerCase());
      if (!t) throw new Error(`შაბლონი „${template}“ ამ კაბინეტში ვერ მოიძებნა. არსებული: ${list.map((x) => x.name).join(', ') || '(არცერთი)'}`);
      body = t.body;
    }
    const payload = { cabinet, name: campaign_name, body, scheduledAt: scheduled_at, recipients };
    if (!confirm) {
      const p = await post('/campaigns/preview', payload);
      return text({
        status: 'PREVIEW_ONLY_NOT_SENT',
        note: 'არაფერი გაგზავნილა. აჩვენეთ მომხმარებელს და დასტურის შემდეგ გაიმეორეთ confirm=true-თი.',
        ...p,
      });
    }
    const out = await post('/campaigns', payload);
    return text({
      status: 'QUEUED',
      campaign_id: out.campaign.id,
      sender: out.campaign.sender,
      scheduled_at: out.campaign.scheduled_at,
      created: out.created,
      skipped: out.skipped,
      estimate: out.estimate,
    });
  }),
);

server.tool(
  'get_status',
  'აჩვენებს გაგზავნის სტატუსს: campaign_id-ით კონკრეტული გაგზავნის შედეგებს, ან ბოლო მესიჯებს კაბინეტის მიხედვით.',
  {
    campaign_id: z.number().int().optional(),
    cabinet: z.string().optional().describe("'kea', 'mindup', 'movesummit' ან 'trainup' (campaign_id-ის გარეშე)"),
    limit: z.number().int().min(1).max(100).default(20),
  },
  guard(async ({ campaign_id, cabinet, limit }) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (campaign_id) params.set('campaignId', String(campaign_id));
    if (cabinet) params.set('cabinet', cabinet);
    const [messages, campaign] = await Promise.all([
      api(`/messages?${params}`),
      campaign_id ? api(`/campaigns/${campaign_id}`) : null,
    ]);
    const rows = messages.rows.map((m) => ({
      to: m.to_number, status: m.status, attempts: m.attempts, error: m.error_code ? `${m.error_kind ?? ''} ${m.error_code}`.trim() : undefined, text: m.text,
    }));
    return text({ campaign, total: messages.total, messages: rows });
  }),
);

await server.connect(new StdioServerTransport());
