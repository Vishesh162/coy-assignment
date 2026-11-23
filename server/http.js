import path from 'node:path';
import { ApiError, createService } from './service.js';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

async function readJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Invalid JSON body.');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new ApiError(413, 'Request body is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object');
    return body;
  } catch { throw new ApiError(400, 'Invalid JSON body.'); }
}

export function createHandlers(dataFile) {
  const service = createService(dataFile);
  const endpoint = work => async request => {
    try { return Response.json(await work(request), { headers }); }
    catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status, headers });
      console.error('Request failed:', error.message);
      return Response.json({ error: 'Unable to save or load your data. Please try again.' }, { status: 500, headers });
    }
  };
  return {
    feed: endpoint(() => service.feed()),
    swipe: endpoint(async request => service.swipe(await readJson(request))),
    matches: endpoint(() => service.matches()),
    health: endpoint(() => ({ status: 'ok' })),
  };
}

// Each Next.js route uses the same persistent file. Incoming likes stay server-only.
export const handlers = createHandlers(process.env.DATA_FILE || path.join(process.cwd(), 'data', 'state.json'));
