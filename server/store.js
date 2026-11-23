import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// All writers using this file serialize across processes with a short-lived lock.
// Commit via an atomic rename: a failed write cannot create a partial state file.
export class JsonStore {
  constructor(file) { this.file = path.resolve(file); this.queue = Promise.resolve(); }

  async read() {
    let state;
    try { state = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return { version: 1, swipes: {}, matches: {} };
      throw error; // Never silently discard corrupt persisted data.
    }
    if (state.version !== 1 || !state.swipes || !state.matches ||
        typeof state.swipes !== 'object' || Array.isArray(state.swipes) ||
        typeof state.matches !== 'object' || Array.isArray(state.matches)) {
      throw new Error('Invalid data file. Restore a backup or explicitly reset demo data.');
    }
    return state;
  }

  transaction(update) {
    const operation = this.queue.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const lockPath = `${this.file}.lock`;
      const deadline = Date.now() + 5000;
      let lock;
      while (!lock) {
        try { lock = await open(lockPath, 'wx'); }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          if (Date.now() >= deadline) throw new Error('Data store is busy. Retry the request.');
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      try {
        const state = await this.read();
        const result = update(state);
        await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
        await rename(temporary, this.file);
        return result;
      } finally {
        await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await lock.close();
        await unlink(lockPath);
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
