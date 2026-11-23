import { profiles, incomingLikes, publicProfile } from './profiles.js';
import { JsonStore } from './store.js';

const byId = new Map(profiles.map(profile => [profile.id, profile]));

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createService(dataFile) {
  const store = new JsonStore(dataFile);
  return {
    async feed() {
      const state = await store.read();
      return { profiles: profiles.filter(profile => !Object.hasOwn(state.swipes, profile.id)).map(publicProfile) };
    },
    async swipe(body) {
      const { profileId, action } = body ?? {};
      if (typeof profileId !== 'string' || !['like', 'pass'].includes(action)) {
        throw new ApiError(400, 'Provide a profileId and an action of like or pass.');
      }
      const profile = byId.get(profileId);
      if (!profile) throw new ApiError(404, 'Profile not found.');
      const result = await store.transaction(state => {
        const previous = state.swipes[profileId];
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
      if (result.conflict) throw new ApiError(409, 'This profile has already been swiped with a different action.');
      return result;
    },
    async matches() {
      const state = await store.read();
      return { matches: Object.entries(state.matches)
        .filter(([id]) => byId.has(id) && state.swipes[id]?.action === 'like' && incomingLikes.has(id))
        .map(([id, matchedAt]) => ({ profile: publicProfile(byId.get(id)), matchedAt }))
        .sort((a, b) => b.matchedAt.localeCompare(a.matchedAt)) };
    },
  };
}
