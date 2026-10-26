const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 3001),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smssender',
  apiKey: process.env.BEEPHUB_API_KEY || '',
  baseUrl: (process.env.BEEPHUB_BASE_URL || 'https://sms-api.beephub.ge').replace(/\/$/, ''),
  defaultSender: process.env.DEFAULT_SENDER || 'BEEPHUB',
  mock: process.env.BEEPHUB_MOCK === '1',
  maxAttempts: num(process.env.MAX_ATTEMPTS, 3),
  pollIntervalSec: num(process.env.POLL_INTERVAL_SEC, 30),
  retryDelaysSec: (process.env.RETRY_DELAYS_SEC || '60,300').split(',').map(Number),
  ttlSeconds: num(process.env.TTL_SECONDS, 3600),
};
