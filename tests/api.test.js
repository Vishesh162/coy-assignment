import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createHandlers } from '../server/http.js';
import { profiles, incomingLikes, publicProfile } from '../server/profiles.js';

async function fixture(t, dataFile) {
  const folder = dataFile ? null : await mkdtemp(path.join(os.tmpdir(), 'coy-test-'));
  const file = dataFile || path.join(folder, 'state.json');
  const handlers = createHandlers(file);
  // Exercise the same Web Request/Response handlers exported by Next.js routes.
  const server = createServer(async (incoming, outgoing) => {
    const url = new URL(incoming.url, `http://${incoming.headers.host}`);
    const route = { '/feed': handlers.feed, '/swipe': handlers.swipe, '/matches': handlers.matches }[url.pathname];
    const request = new Request(url, {
      method: incoming.method, headers: incoming.headers,
      ...(incoming.method === 'POST' ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
    });
    const response = await route(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); if (folder) await rm(folder, { recursive: true, force: true }); });
  const request = async (route, body) => {
    const response = await fetch(`${url}${route}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) } : undefined);
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  return { file, request };
}

test('seed has at least 30 complete adult profiles and private incoming likes', () => {
  assert.ok(profiles.length >= 30); assert.equal(new Set(profiles.map(p => p.id)).size, profiles.length);
  for (const p of profiles) { assert.ok(p.name && p.age >= 18 && p.photo && p.bio && p.city && p.college && p.interests.length); }
  assert.ok(incomingLikes.size > 0 && incomingLikes.size < profiles.length);
  const dto = publicProfile({ ...profiles[0], likedYou: true, privateEmail: 'secret', incomingLike: true });
  assert.deepEqual(Object.keys(dto).sort(), ['age', 'bio', 'city', 'college', 'id', 'interests', 'name', 'photo'].sort());
});

test('feed never discloses incoming likes; no matches exist before a reciprocal swipe', async t => {
  const { request } = await fixture(t);
  const result = await request('/feed');
  assert.equal(result.status, 200); assert.equal(result.body.profiles.length, profiles.length);
  for (const p of result.body.profiles) assert.deepEqual(Object.keys(p).sort(), Object.keys(publicProfile(profiles[0])).sort());
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await request('/matches')).body, { matches: [] });
});

test('liking an incoming like creates exactly one mutual match', async t => {
  const { request } = await fixture(t);
  const first = await request('/swipe', { profileId: 'p01', action: 'like' });
  assert.equal(first.status, 200); assert.equal(first.body.createdMatch, true); assert.equal(first.body.matched, true);
  assert.equal(first.body.match.profile.id, 'p01');
  const second = await request('/swipe', { profileId: 'p01', action: 'like' });
  assert.equal(second.body.matched, true); assert.equal(second.body.createdMatch, false); assert.equal(second.body.alreadySwiped, true);
  assert.equal((await request('/matches')).body.matches.length, 1);
  assert.ok(!(await request('/feed')).body.profiles.some(p => p.id === 'p01'));
});

test('a one-sided like is private and passing an incoming like never matches', async t => {
  const { request } = await fixture(t);
  for (const swipe of [{ profileId: 'p02', action: 'like' }, { profileId: 'p01', action: 'pass' }]) {
    const result = await request('/swipe', swipe);
    assert.equal(result.body.matched, false); assert.equal(result.body.createdMatch, false); assert.equal(result.body.match, null);
  }
  assert.deepEqual((await request('/matches')).body.matches, []);
  assert.ok(!(await request('/feed')).body.profiles.some(p => ['p01', 'p02'].includes(p.id)));
});

test('both passes and matches survive a new server instance', async t => {
  const first = await fixture(t);
  await first.request('/swipe', { profileId: 'p01', action: 'like' });
  await first.request('/swipe', { profileId: 'p02', action: 'pass' });
  const second = await fixture(t, first.file);
  const feed = (await second.request('/feed')).body.profiles;
  assert.equal(feed.length, profiles.length - 2); assert.ok(!feed.some(p => ['p01', 'p02'].includes(p.id)));
  assert.equal((await second.request('/matches')).body.matches[0].profile.id, 'p01');
});

test('invalid actions, malformed JSON and nonexistent profiles change no data', async t => {
  const { request } = await fixture(t);
  for (const body of [{}, { profileId: 'p01', action: 'superlike' }, { profileId: 1, action: 'like' }, { profileId: 'p01' }, 'oops']) {
    assert.equal((await request('/swipe', body)).status, 400);
  }
  assert.equal((await request('/swipe', { profileId: 'missing', action: 'like' })).status, 404);
  assert.equal((await request('/feed')).body.profiles.length, profiles.length);
});

test('oversized and non-object JSON requests are rejected without recording a swipe', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/swipe', { profileId: 'p01', action: 'like', extra: 'x'.repeat(8192) })).status, 413);
  for (const body of ['null', '[]', '"like"']) assert.equal((await request('/swipe', body)).status, 400);
  assert.equal((await request('/feed')).body.profiles.length, profiles.length);
  assert.deepEqual((await request('/matches')).body.matches, []);
});

test('Next.js health route returns JSON and prevents response caching', async () => {
  const { GET } = await import('../app/health/route.js');
  const response = await GET(new Request('http://localhost/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('content-type').includes('application/json'));
});

test('a conflicting repeat returns 409 and cannot change a pass into a like', async t => {
  const { request } = await fixture(t);
  await request('/swipe', { profileId: 'p01', action: 'pass' });
  assert.equal((await request('/swipe', { profileId: 'p01', action: 'like' })).status, 409);
  assert.deepEqual((await request('/matches')).body.matches, []);
});

test('concurrent duplicate swipes create one match and preserve all distinct swipes', async t => {
  const { request } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, () => request('/swipe', { profileId: 'p01', action: 'like' })));
  assert.equal(results.filter(r => r.body.createdMatch).length, 1);
  await Promise.all(profiles.slice(1, 10).map(p => request('/swipe', { profileId: p.id, action: 'pass' })));
  assert.equal((await request('/feed')).body.profiles.length, profiles.length - 10);
  assert.equal((await request('/matches')).body.matches.length, 1);
});

test('two app instances safely serialize writes to the same data file', async t => {
  const a = await fixture(t); const b = await fixture(t, a.file);
  await Promise.all(profiles.map((p, index) => (index % 2 ? a : b).request('/swipe', { profileId: p.id, action: 'like' })));
  assert.deepEqual((await a.request('/feed')).body.profiles, []);
  assert.equal((await a.request('/matches')).body.matches.length, incomingLikes.size);
  assert.equal(Object.keys(JSON.parse(await readFile(a.file, 'utf8')).swipes).length, profiles.length);
});

test('exhausting the feed returns an empty array with no recycled profiles', async t => {
  const { request } = await fixture(t);
  for (const p of profiles) await request('/swipe', { profileId: p.id, action: 'pass' });
  assert.deepEqual((await request('/feed')).body.profiles, []);
  assert.deepEqual((await request('/matches')).body.matches, []);
});

test('corrupt persisted data returns an error instead of silently resetting choices', async t => {
  const { request, file } = await fixture(t);
  await request('/swipe', { profileId: 'p01', action: 'like' });
  await writeFile(file, 'invalid-json');
  assert.equal((await request('/feed')).status, 500);
  assert.equal(await readFile(file, 'utf8'), 'invalid-json');
});
