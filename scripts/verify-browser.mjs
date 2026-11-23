// Run after npm run build. Tests the real Next.js production server with isolated data.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { profiles, incomingLikes } from '../server/profiles.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, '.taste-skill', `requirements-${randomUUID()}`);
await mkdir(work, { recursive: true });
process.env.DATA_FILE = path.join(work, 'state.json');
process.env.NODE_ENV = 'production';
const { default: next } = await import('next');
const app = next({ dev: false, quiet: true, dir: root });
await app.prepare();
const server = createServer(app.getRequestHandler());
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
const executable = candidates.find(file => file && existsSync(file));
if (!executable) { await app.close(); server.close(); throw new Error('Install Chrome/Edge or set CHROME_PATH to run browser verification.'); }
const profileDir = path.join(work, 'chrome');
const browser = spawn(executable, ['--headless=new', `--user-data-dir=${profileDir}`, '--remote-debugging-port=0',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', '--hide-scrollbars', 'about:blank'],
{ stdio: 'ignore', windowsHide: true });
const checks = [], errors = [], pending = new Map();
let socket, sequence = 0, session, pausedHandler;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => { browser.kill(); server.close(); console.error('Browser verification timed out.'); process.exit(1); }, 180000);
function send(method, params = {}, sessionId = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 12000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function wait(expression, label = expression) {
  for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await sleep(75); }
  throw new Error(`UI did not reach: ${label}`);
}
async function click(selector) {
  const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing control'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function key(key, code, virtualKey) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
}
async function viewport(width, height = 844) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Emulation.setTouchEmulationEnabled', { enabled: width < 600, maxTouchPoints: 1 });
}
async function screenshot(name) {
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(350);
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(work, `${name}.png`), Buffer.from(result.data, 'base64'));
}
async function api(route, body) {
  const response = await fetch(`${base}${route}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  assert.equal(response.status, 200, `API ${route}`);
  return response.json();
}
const current = name => `document.querySelector('.profile-info h2')?.textContent.startsWith(${JSON.stringify(name)})`;
const openMatch = `document.querySelector('dialog.match-dialog')?.open === true`;
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
async function touchDrag(dx, feedback) {
  const point = await evaluate(`(() => {const r=document.querySelector('.profile-card').getBoundingClientRect();return {x:r.x+r.width*${dx < 0 ? '.7' : '.3'},y:r.y+140};})()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
  for (let step = 1; step <= 6; step++) {
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + dx * step / 6, y: point.y, id: 1 }] });
    await sleep(20);
  }
  if (feedback) assert.equal(await evaluate(`document.querySelector('.stamp-${feedback}')?.classList.contains('visible')`), true);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

try {
  let port;
  for (let i = 0; i < 150; i++) {
    try { port = Number((await readFile(path.join(profileDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch {}
    if (port) break;
    await sleep(100);
  }
  assert.ok(port, 'Headless browser started');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timer);
      if (message.error) item.reject(new Error(`${message.error.message}`)); else item.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    else if (message.method === 'Fetch.requestPaused' && pausedHandler) pausedHandler(message.params).catch(error => errors.push(error.message));
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Page.enable'); await send('Runtime.enable');
  await viewport(1440, 900);
  await send('Page.navigate', { url: base });
  await wait(current('Aanya'));
  await evaluate('document.fonts.ready.then(() => true)');
  const seed = await api('/feed');
  assert.equal(seed.profiles.length, 32);
  assert.equal(incomingLikes.size, 9);
  for (const person of seed.profiles) {
    assert.deepEqual(Object.keys(person).sort(), ['id', 'name', 'age', 'photo', 'bio', 'city', 'college', 'interests'].sort());
    assert.ok(person.name && person.age >= 18 && person.bio && person.city && person.college && person.interests.length);
    const photo = await fetch(`${base}${person.photo}`);
    assert.equal(photo.status, 200);
    assert.ok((await photo.arrayBuffer()).byteLength > 0);
  }
  assert.deepEqual((await api('/matches')).matches, []);
  assert.equal(await evaluate(`document.querySelectorAll('.profile-card').length`), 1);
  pass('32 complete profiles, all portraits load, 9 server-only incoming likes, one card at a time');

  for (const [width, height] of [[1440,900], [1024,768], [820,1180], [768,1024], [390,844], [320,844]]) {
    await viewport(width, height); await sleep(80);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `No overflow at ${width}`);
    assert.equal(await evaluate(`document.querySelectorAll('.profile-card').length`), 1);
  }
  await viewport(1440, 900); await screenshot('desktop');
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.profile-card')).transitionDuration`), '0s');
  await click('.like-button');
  assert.equal(await evaluate(`document.querySelector('.profile-card')?.classList.contains('exit-like')`), true);
  assert.equal(await evaluate(`document.querySelector('.stamp-like')?.classList.contains('visible')`), true);
  assert.equal(await evaluate(`document.querySelector('.like-button')?.disabled`), true);
  await wait(openMatch);
  assert.equal(await evaluate(`document.querySelector('#match-title').textContent`), 'It’s a match!');
  assert.ok((await api('/matches')).matches.some(item => item.profile.id === 'p01'));
  await screenshot('match-dialog');
  pass('desktop like animates with feedback and creates the mutual match popup');

  await click('.match-dialog .primary-button');
  await wait(`document.querySelectorAll('.match-card').length === 1`);
  assert.ok(await evaluate(`document.querySelector('.match-card').textContent.includes('Aanya')`));
  await send('Page.reload'); await wait(current('Kabir'));
  assert.equal((await api('/matches')).matches.length, 1);
  assert.ok(!(await api('/feed')).profiles.some(person => person.id === 'p01'));
  await click('.matches-toggle');
  await wait(`document.querySelectorAll('.match-card').length === 1`);
  await click('.matches-toggle'); await wait(current('Kabir'));
  pass('Matches view and browser reload preserve matches and exclude previously swiped profiles');

  await evaluate(`document.querySelector('.profile-card').focus()`);
  await key('ArrowRight', 'ArrowRight', 39); await wait(current('Meera'));
  assert.equal(await evaluate(openMatch), false);
  assert.equal((await api('/matches')).matches.length, 1);
  await click('.pass-button'); await wait(current('Arjun'));
  assert.ok(!(await api('/feed')).profiles.some(person => ['p01', 'p02', 'p03'].includes(person.id)));
  pass('keyboard one-sided like stays private; desktop pass advances without a match');

  await viewport(390, 844); await evaluate('scrollTo(0,0)'); await screenshot('mobile');
  await touchDrag(140, 'like'); await wait(openMatch);
  assert.equal((await api('/matches')).matches.length, 2);
  assert.ok((await api('/matches')).matches.some(item => item.profile.id === 'p04'));
  await key('Escape', 'Escape', 27); await wait(current('Tara'));
  await touchDrag(-140, 'pass'); await wait(current('Ishaan'));
  assert.ok(!(await api('/feed')).profiles.some(person => person.id === 'p05'));
  await touchDrag(25); await sleep(400);
  assert.equal(await evaluate(current('Ishaan')), true);
  assert.equal(await evaluate(`document.querySelector('.profile-card').style.getPropertyValue('--drag-x')`), '0px');
  assert.ok((await api('/feed')).profiles.some(person => person.id === 'p06'));
  pass('real mobile touch: right matches, left passes, short drag returns without recording a swipe');

  pausedHandler = async ({ requestId }) => send('Fetch.fulfillRequest', {
    requestId, responseCode: 503, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify({ error: 'Simulated temporary failure' })).toString('base64'),
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/swipe', requestStage: 'Request' }] });
  await click('.pass-button'); await wait(`!!document.querySelector('.error-banner')`);
  assert.equal(await evaluate(current('Ishaan')), true);
  assert.ok((await api('/feed')).profiles.some(person => person.id === 'p06'));
  await send('Fetch.disable'); pausedHandler = null;
  await click('.pass-button'); await wait(current('Rhea'));
  assert.ok(!(await api('/feed')).profiles.some(person => person.id === 'p06'));
  pass('failed swipe keeps its card; retry records exactly one successful choice');

  await click('.main-nav button:first-child');
  await wait(`document.querySelector('#main').classList.contains('home-blank')`);
  assert.equal(await evaluate(`document.querySelector('#main').innerHTML.trim()`), '');
  await click('.main-nav button:nth-child(2)'); await wait(current('Rhea'));
  pass('Home remains blank and Discover remains reachable');

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.profile-card')).transitionDuration`), '0s');
  await send('Emulation.setEmulatedMedia', { features: [] });
  pass('reduced-motion preference disables card animation');

  for (const person of (await api('/feed')).profiles) await api('/swipe', { profileId: person.id, action: 'pass' });
  await send('Page.reload'); await wait(`!!document.querySelector('.deck-area .empty-state')`);
  assert.equal(await evaluate(`document.querySelectorAll('.profile-card').length`), 0);
  assert.ok(await evaluate(`document.querySelector('.empty-state').textContent.includes('You’ve met everyone for now.')`));
  assert.deepEqual((await api('/feed')).profiles, []);
  assert.equal((await api('/matches')).matches.length, 2);
  await screenshot('empty-feed');
  await click('.matches-toggle'); await wait(`document.querySelectorAll('.match-card').length === 2`);
  const persisted = JSON.parse(await readFile(process.env.DATA_FILE, 'utf8'));
  assert.equal(Object.keys(persisted.swipes).length, profiles.length);
  assert.equal(Object.keys(persisted.matches).length, 2);
  pass('empty state after all 32 swipes; reload never recycles profiles and keeps both mutual matches');
  assert.deepEqual(errors, []);
  pass('no uncaught browser errors');
  await writeFile(path.join(work, 'results.json'), JSON.stringify({ checks, errors, framework: 'Next.js', profiles: profiles.length }, null, 2));
  console.log(`\n${checks.length} browser checks passed. Artifacts: ${work}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close', {}, null); } catch {} socket.close(); }
  if (browser.exitCode === null) {
    await Promise.race([once(browser, 'exit'), sleep(2000)]);
    if (browser.exitCode === null) browser.kill();
  }
  await new Promise(resolve => server.close(resolve));
  await app.close();
  clearTimeout(deadline);
}
