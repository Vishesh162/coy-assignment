import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.DATA_FILE || path.join(root, 'data', 'state.json');
try { await unlink(file); console.log('Demo reset: all profiles are available again.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; console.log('Demo is already fresh.'); }
