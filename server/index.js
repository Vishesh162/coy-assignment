import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3107);
const app = createApp({
  dataFile: process.env.DATA_FILE || path.join(root, 'data', 'state.json'),
  staticDir: path.join(root, 'dist'),
});
const server = app.listen(port, '0.0.0.0', () => console.log(`Coy Discover is ready at http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
