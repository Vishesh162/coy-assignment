import express from 'express';
import { profiles, incomingLikes, publicProfile } from './profiles.js';
import { JsonStore } from './store.js';

const byId = new Map(profiles.map(profile => [profile.id, profile]));

export function createApp({ dataFile, staticDir } = {}) {
  if (!dataFile) throw new Error('A dataFile is required.');
  const app = express();
  const store = new JsonStore(dataFile);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8kb', strict: true }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.get('/feed', async (req, res) => {
    const state = await store.read();
    res.json({ profiles: profiles.filter(profile => !Object.hasOwn(state.swipes, profile.id)).map(publicProfile) });
  });

  app.post('/swipe', async (req, res) => {
    const { profileId, action } = req.body ?? {};
    if (typeof profileId !== 'string' || !['like', 'pass'].includes(action)) {
      return res.status(400).json({ error: 'Provide a profileId and an action of like or pass.' });
    }
    const profile = byId.get(profileId);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    const result = await store.transaction(state => {
      const previous = state.swipes[profileId];
      // Identical retries return the original outcome without a second match popup.
      if (previous) {
        if (previous.action !== action) return { conflict: true };
        const mutual = previous.action === 'like' && incomingLikes.has(profileId) && Boolean(state.matches[profileId]);
        return { matched: mutual, createdMatch: false, alreadySwiped: true,
          match: mutual ? { profile: publicProfile(profile), matchedAt: state.matches[profileId] } : null };
      }
      const timestamp = new Date().toISOString();
      state.swipes[profileId] = { action, swipedAt: timestamp };
      const matched = action === 'like' && incomingLikes.has(profileId);
      if (matched) state.matches[profileId] = timestamp;
      return { matched, createdMatch: matched, alreadySwiped: false,
        match: matched ? { profile: publicProfile(profile), matchedAt: timestamp } : null };
    });
    if (result.conflict) return res.status(409).json({ error: 'This profile has already been swiped with a different action.' });
    res.json(result);
  });

  app.get('/matches', async (req, res) => {
    const state = await store.read();
    const matches = Object.entries(state.matches)
      .filter(([id]) => byId.has(id) && state.swipes[id]?.action === 'like' && incomingLikes.has(id))
      .map(([id, matchedAt]) => ({ profile: publicProfile(byId.get(id)), matchedAt }))
      .sort((a, b) => b.matchedAt.localeCompare(a.matchedAt));
    res.json({ matches });
  });

  if (staticDir) {
    app.use(express.static(staticDir, { index: false }));
    app.get('/', (req, res) => res.sendFile(`${staticDir}/index.html`));
  }
  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    console.error('Request failed:', error.message);
    res.status(500).json({ error: 'Unable to save or load your data. Please try again.' });
  });
  return app;
}
