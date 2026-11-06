import { HubConnectionBuilder, HttpTransportType, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { AppState } from 'react-native';

import { api, getApiBaseUrl } from '@/api/client';

// The live line (SignalR): the server nudges — "your inbox changed", "match 12 changed" — and the
// screen that cares fetches through the gateway as it always has. Nudges carry ids only, so nothing
// private travels outside the encrypted gateway.
//
// One line for the app, opened when the first screen subscribes and closed a little after the last
// one leaves, and while the app is in the background (a phone in a pocket keeps nothing open). A
// one-minute ticket from LIVE_TICKET opens it — never the session token, which would sit in the
// address. If it can't open (the server has no WebSockets, say) or drops, screens keep polling, only
// slower while it's up; on every (re)connect each subscriber is told once, to catch up.

export type LiveTopic =
  | { kind: 'inbox' }
  | { kind: 'tournament'; tournamentId: number }
  | { kind: 'match'; sport: 'football' | 'cricket'; matchId: number };

type Nudge = { kind: 'inbox' | 'tournament' | 'match'; tournamentId?: number; sport?: string; matchId?: number };

const RETRY_MS = [0, 2000, 5000, 10000];
const STOP_AFTER_MS = 10_000;
const RESTART_MS = 30_000;
const UNWATCH_AFTER_MS = 2000;

const topics = new Map<string, { topic: LiveTopic; listeners: Set<() => void> }>();
const stateListeners = new Set<(open: boolean) => void>();
let connection: HubConnection | null = null;
let connectionId: string | null = null;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let restartTimer: ReturnType<typeof setTimeout> | undefined;

const keyOf = (t: LiveTopic) =>
  t.kind === 'inbox' ? 'inbox' : t.kind === 'tournament' ? `t:${t.tournamentId}` : `m:${t.sport}:${t.matchId}`;

export const isLive = () => connectionId !== null;

function setConnected(id: string | null) {
  connectionId = id;
  stateListeners.forEach((fn) => fn(id !== null));
}

/** Asks the server to send this line nudges about the topic (the inbox needs no asking). */
function watch(topic: LiveTopic) {
  if (!connectionId || topic.kind === 'inbox') return;
  const call =
    topic.kind === 'tournament'
      ? api.call('LIVE_WATCH_TOURNAMENT', { routeParams: { connectionId, id: topic.tournamentId } })
      : api.call('LIVE_WATCH_MATCH', { routeParams: { connectionId, sport: topic.sport, matchId: topic.matchId } });
  call.catch(() => {}); // not allowed, or the line is gone: polling carries on
}

function onHello(id: string) {
  setConnected(id);
  for (const { topic, listeners } of topics.values()) {
    watch(topic);
    listeners.forEach((fn) => fn()); // catch up on whatever happened while the line was down
  }
}

function onNudge(nudge: Nudge) {
  const keys = nudge.kind === 'inbox' ? ['inbox'] : [`t:${nudge.tournamentId}`];
  if (nudge.kind === 'match') keys.push(`m:${nudge.sport}:${nudge.matchId}`);
  for (const key of keys) topics.get(key)?.listeners.forEach((fn) => fn());
}

function retryLater() {
  clearTimeout(restartTimer);
  if (topics.size && AppState.currentState === 'active') restartTimer = setTimeout(start, RESTART_MS);
}

function start() {
  clearTimeout(stopTimer);
  const server = getApiBaseUrl();
  if (connection || !server || AppState.currentState !== 'active') return;
  const c = new HubConnectionBuilder()
    .withUrl(`${server}/hubs/live`, {
      transport: HttpTransportType.WebSockets,
      skipNegotiation: true,
      accessTokenFactory: async () => (await api.call<{ ticket: string }>('LIVE_TICKET')).ticket,
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => RETRY_MS[ctx.previousRetryCount] ?? RESTART_MS })
    .configureLogging(LogLevel.None)
    .build();
  c.on('hello', onHello);
  c.on('nudge', onNudge);
  c.onreconnecting(() => setConnected(null));
  c.onclose(() => {
    setConnected(null);
    if (connection === c) connection = null;
    retryLater(); // closed for good: try again later
  });
  connection = c;
  c.start().catch(() => {
    if (connection === c) connection = null;
    retryLater();
  });
}

function stop() {
  clearTimeout(restartTimer);
  const c = connection;
  connection = null;
  setConnected(null);
  if (c && c.state !== HubConnectionState.Disconnected) c.stop().catch(() => {});
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    if (topics.size) start();
  } else {
    stop();
  }
});

/**
 * Calls `onNudge` whenever the topic changes, and once on every (re)connect. Returns the unsubscribe.
 */
export function subscribe(topic: LiveTopic, onNudge: () => void) {
  const key = keyOf(topic);
  let entry = topics.get(key);
  if (!entry) {
    entry = { topic, listeners: new Set() };
    topics.set(key, entry);
    watch(topic);
  }
  entry.listeners.add(onNudge);
  start();

  const mine = entry;
  return () => {
    mine.listeners.delete(onNudge);
    if (mine.listeners.size) return;
    topics.delete(key);
    // A moment later, and only if nothing has subscribed again: leaving a screen and coming straight
    // back must not have its "stop" land after the new "watch".
    if (topic.kind !== 'inbox') {
      const line = connectionId;
      setTimeout(() => {
        if (topics.has(key) || !line || line !== connectionId) return;
        const body = topic.kind === 'tournament' ? { tournamentId: topic.tournamentId } : { sport: topic.sport, matchId: topic.matchId };
        api.call('LIVE_UNWATCH', { routeParams: { connectionId: line }, body }).catch(() => {});
      }, UNWATCH_AFTER_MS);
    }
    if (!topics.size) {
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => {
        if (!topics.size) stop();
      }, STOP_AFTER_MS);
    }
  };
}

/** Called with true / false as the line opens and closes. Returns the unsubscribe. */
export function onLiveChange(fn: (open: boolean) => void) {
  stateListeners.add(fn);
  return () => {
    stateListeners.delete(fn);
  };
}
