import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Heart, Home, LockKeyhole, MapPin, Sparkles, X, Check, GraduationCap, LoaderCircle, EyeOff, UserRoundPlus } from 'lucide-react';

async function api(route, options = {}) {
  const response = await fetch(route, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: options.signal || AbortSignal.timeout(12000) });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error || 'Something went wrong. Please try again.'); error.status = response.status; throw error; }
  return body;
}

function Portrait({ profile, ...props }) {
  return <img {...props} src={profile.photo} alt={`Portrait of ${profile.name}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/portrait-fallback.svg'; }} />;
}

function ConnectionPattern() {
  return <div className="connection-pattern" aria-hidden="true">
    {Array.from({ length: 27 }, (_, index) => <span key={index} className={index === 12 || index === 13 ? 'connected-dot' : ''} />)}
  </div>;
}

function MatchDialog({ match, onClose, onView }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="match-dialog" aria-labelledby="match-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="icon-button dialog-close" aria-label="Close match notification" onClick={onClose}><X size={20} /></button>
    <div className="match-spark"><Sparkles size={28} /></div>
    <p className="eyebrow">The feeling is mutual</p>
    <h2 id="match-title">It’s a match!</h2>
    <div className="matched-portraits"><div className="your-portrait">You</div><div className="heart-seal"><Heart size={22} fill="currentColor" /></div><Portrait profile={match.profile} /></div>
    <p>You and <strong>{match.profile.name}</strong> liked each other.<br />Time to see where it goes.</p>
    <button className="primary-button" autoFocus onClick={onView}>See your matches <ArrowRight size={18} /></button>
    <button className="text-button" onClick={onClose}>Keep discovering</button>
  </dialog>;
}

function EmptyState({ kind, onDiscover }) {
  const finished = kind === 'feed';
  return <div className="empty-state" role="status">
    <div className="empty-icon">{finished ? <Check size={32} /> : <Heart size={32} />}</div>
    <h2>{finished ? 'You’ve met everyone for now.' : 'Your first match starts here.'}</h2>
    <p>{finished ? 'You’re all caught up. Your mutual connections are waiting in Matches.' : 'Like someone in Discover. When they like you too, you’ll find each other here.'}</p>
    {!finished && <button className="primary-button" onClick={onDiscover}>Find someone <ArrowRight size={18} /></button>}
  </div>;
}

export default function App() {
  const [tab, setTab] = useState('discover');
  const [view, setView] = useState('feed');
  const [feed, setFeed] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exit, setExit] = useState(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [match, setMatch] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const gesture = useRef(null);
  const locked = useRef(false);
  const card = useRef(null);
  const profile = feed[0];

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const [newFeed, newMatches] = await Promise.all([api('/feed', { signal }), api('/matches', { signal })]);
      setFeed(newFeed.profiles); setMatches(newMatches.matches);
    } catch (failure) { if (failure.name !== 'AbortError') setError('Couldn’t load your profiles. Check the server and try again.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (!locked.current) load(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load]);

  const swipe = useCallback(async (action) => {
    if (!profile || locked.current || match || tab !== 'discover' || view !== 'feed') return;
    locked.current = true; setBusy(true); setError(''); setExit(action); setDragging(false); gesture.current = null;
    try {
      const [result] = await Promise.all([
        api('/swipe', { method: 'POST', body: JSON.stringify({ profileId: profile.id, action }) }),
        new Promise(resolve => setTimeout(resolve, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280)),
      ]);
      setFeed(current => current.filter(person => person.id !== profile.id));
      setAnnouncement(action === 'like' ? `Liked ${profile.name}.` : `Passed on ${profile.name}.`);
      if (result.matched && result.match) {
        setMatches(current => [result.match, ...current.filter(item => item.profile.id !== profile.id)]);
        if (result.createdMatch) setMatch(result.match);
      }
    } catch (failure) {
      if (failure.status === 409) { await load(); setError('This profile was already swiped in another tab. Your feed is updated.'); }
      else setError('Couldn’t save your swipe. Please try again; your choice won’t be counted twice.');
    } finally { setExit(null); setDrag(0); setBusy(false); locked.current = false; }
  }, [profile, match, tab, view, load]);

  useEffect(() => {
    const onKey = event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (tab === 'discover' && view === 'feed' && !match && profile) {
        if (event.key === 'ArrowRight') { event.preventDefault(); swipe('like'); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); swipe('pass'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swipe, tab, view, match, profile]);

  function startDrag(event) {
    if (locked.current || event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function moveDrag(event) {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    const dx = event.clientX - gesture.current.x;
    const dy = event.clientY - gesture.current.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 24) { gesture.current = null; setDragging(false); setDrag(0); return; }
    setDrag(dx);
  }
  function endDrag(event) {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    const dx = event.clientX - gesture.current.x;
    const threshold = Math.min(100, (card.current?.clientWidth || 400) * 0.24);
    gesture.current = null; setDragging(false);
    if (Math.abs(dx) >= threshold) swipe(dx > 0 ? 'like' : 'pass');
    else setDrag(0);
  }
  function cancelDrag() { gesture.current = null; setDragging(false); setDrag(0); }
  function navigate(nextTab) { cancelDrag(); setTab(nextTab); if (nextTab === 'discover') setView('feed'); }
  function showMatches() { cancelDrag(); setTab('discover'); setView('matches'); }

  return <div className="app-shell">
    <header className="sidebar">
      <a className="wordmark" href="/" aria-label="Coy Discover">coy<span aria-hidden="true" /></a>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={tab === 'home' ? 'nav-item active' : 'nav-item'} aria-current={tab === 'home' ? 'page' : undefined} onClick={() => navigate('home')}><Home size={21} /><span>Home</span></button>
        <button className={tab === 'discover' ? 'nav-item active' : 'nav-item'} aria-current={tab === 'discover' ? 'page' : undefined} onClick={() => navigate('discover')}><Compass size={21} /><span>Discover</span><span className="nav-dot" /></button>
      </nav>
      <div className="sidebar-bottom"><div className="user-avatar">Y</div><div><strong>Your space</strong><span>Just be you.</span></div></div>
    </header>

    <main id="main" className={tab === 'home' ? 'main-content home-blank' : 'main-content'} tabIndex={-1} aria-label={tab === 'home' ? 'Home' : 'Discover'}>
      {tab === 'discover' && <>
        <header className="page-header"><div><p className="eyebrow">{view === 'matches' ? 'You both said yes' : 'Meet someone new'}</p><h1>{view === 'matches' ? 'Your matches' : 'Discover'}<span className="heading-dot">.</span></h1></div>
          <button className={view === 'matches' ? 'matches-toggle selected' : 'matches-toggle'} onClick={() => view === 'matches' ? setView('feed') : showMatches()} aria-label={view === 'matches' ? 'Back to Discover' : `View matches, ${matches.length} mutual connections`}>
            {view === 'matches' ? <ArrowLeft size={18} /> : <Heart size={18} />}<span>{view === 'matches' ? 'Discover' : 'Matches'}</span>{view === 'feed' && <span className="match-count">{matches.length}</span>}
          </button>
        </header>

        <div className="privacy-line"><LockKeyhole size={14} /><span>Your likes stay private until they’re mutual.</span></div>
        {error && <div className="error-banner" role="alert"><p>{error}</p>{!profile && <button className="text-button" onClick={() => load()}>Try again</button>}</div>}

        {loading ? <div className="loading-state" role="status"><LoaderCircle className="spinner" size={30} /><p>Finding your next connection…</p></div> : view === 'matches' ? <>
          <p className="matches-intro">{matches.length > 0 ? `${matches.length} ${matches.length === 1 ? 'connection' : 'connections'}, and a feeling you share.` : 'Good things happen when you both say yes.'}</p>
          {matches.length ? <div className="matches-grid">{matches.map(item => <article className="match-card" key={item.profile.id}>
            <div className="match-photo"><Portrait profile={item.profile} loading="lazy" /><span className="mutual-badge"><Heart size={13} fill="currentColor" /> Mutual match</span></div>
            <div className="match-details"><h2>{item.profile.name}<span>, {item.profile.age}</span></h2><p><MapPin size={14} />{item.profile.city}</p><p className="match-bio">{item.profile.bio}</p><div className="interest-list">{item.profile.interests.map(interest => <span key={interest}>{interest}</span>)}</div></div>
          </article>)}</div> : <EmptyState kind="matches" onDiscover={() => setView('feed')} />}
        </> : <div className="discovery-layout"><section className="deck-area" aria-label="Profile discovery">
          {profile ? <>
            <div className="deck"><div className="card-shadow card-shadow-back" /><div className="card-shadow" />
              <article ref={card} key={profile.id} className={`profile-card ${dragging ? 'dragging' : ''} ${exit ? `exit-${exit}` : ''}`} style={{ '--drag-x': `${drag}px`, '--drag-rotation': `${Math.max(-12, Math.min(12, drag / 22))}deg` }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} aria-label={`${profile.name}, ${profile.age}, ${profile.city}`} tabIndex={0}>
                <Portrait className="profile-photo" profile={profile} draggable={false} fetchPriority="high" />
                <div className="photo-topline"><span className="profile-label"><Sparkles size={14} /> New to your feed</span><span className="profile-number">{String(33 - feed.length).padStart(2, '0')} / 32</span></div>
                <div className={`swipe-stamp stamp-like ${drag > 35 || exit === 'like' ? 'visible' : ''}`}><Heart size={22} fill="currentColor" /> Like</div>
                <div className={`swipe-stamp stamp-pass ${drag < -35 || exit === 'pass' ? 'visible' : ''}`}><X size={22} /> Pass</div>
                <div className="profile-info"><h2>{profile.name}<span>, {profile.age}</span></h2><p className="location"><MapPin size={16} />{profile.city}<span>·</span><GraduationCap size={16} />{profile.college}</p><p className="profile-bio">{profile.bio}</p><div className="interest-list">{profile.interests.map(interest => <span key={interest}>{interest}</span>)}</div></div>
              </article>
            </div>
            <div className="swipe-actions"><button className="swipe-button pass-button" disabled={busy} onClick={() => swipe('pass')} aria-label={`Pass on ${profile.name}`}><X size={25} strokeWidth={2.5} /><span>Pass</span></button><button className="swipe-button like-button" disabled={busy} onClick={() => swipe('like')} aria-label={`Like ${profile.name}`}><Heart size={25} strokeWidth={2.5} fill="currentColor" /><span>Like</span></button></div>
            <p className="keyboard-hint"><kbd>←</kbd> pass <span>·</span> like <kbd>→</kbd></p>
          </> : <EmptyState kind="feed" />}
        </section><aside className="discovery-note">
          <ConnectionPattern />
          <h2>A connection<br />takes two.</h2>
          <ul className="connection-steps">
            <li><span className="step-icon"><UserRoundPlus size={24} strokeWidth={2} /></span><p>Like someone who catches your eye.</p></li>
            <li><span className="step-icon"><EyeOff size={24} strokeWidth={2} /></span><p>Your likes stay private.</p></li>
            <li><span className="step-icon"><Heart size={24} strokeWidth={2} fill="var(--accent)" /></span><p>If they like you too, it’s a match.</p></li>
          </ul>
          <div className="remaining-profiles"><span className="status-dot" />{feed.length ? `${feed.length} people to discover` : 'You’re all caught up'}</div>
        </aside></div>}
      </>}
    </main>
    <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    {match && <MatchDialog match={match} onClose={() => setMatch(null)} onView={() => { setMatch(null); showMatches(); }} />}
  </div>;
}
