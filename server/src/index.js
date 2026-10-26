import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { migrate } from './db.js';
import { api } from './routes.js';
import { startWorker } from './worker.js';

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/api', api);

const dist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'სერვერის შეცდომა' });
});

await migrate();
startWorker();
// მხოლოდ ლოკალურად: გარედან მისაწვდომი არ არის
app.listen(config.port, '127.0.0.1', () => {
  console.log(`http://localhost:${config.port}  (${config.mock ? 'MOCK რეჟიმი' : 'Beephub'})`);
});
