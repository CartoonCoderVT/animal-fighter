// Where rooms are opened. A copy of the site served by its own Worker (Cloudflare) answers api/net with
// its rooms server and relay (TURN) servers; anywhere else (GitHub Pages, a plain static server) that
// request fails and the game uses the PeerJS public cloud and its default relays, as it always did.
const TTL = 3600e3;
let cache = null, cachedAt = 0;

async function load() {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 3000);
  try {
    // Relative to the page, so a copy served under a sub-path asks its own server.
    const res = await fetch('api/net', { cache: 'no-store', signal: abort.signal });
    if (!res.ok) { if (res.status !== 404) cachedAt = -Infinity; return null; }
    const cfg = await res.json().catch(() => null);
    if (!cfg || cfg.v !== 1 || typeof cfg.signal !== 'string' || !/^\/(?:[\w-]+\/)*$/.test(cfg.signal) || !Array.isArray(cfg.iceServers)) return null;
    return { signal: cfg.signal, iceServers: cfg.iceServers.filter(s => s && (typeof s.urls === 'string' || Array.isArray(s.urls))) };
  } catch {
    // Offline or too slow: ask again next time instead of keeping the answer for an hour.
    cachedAt = -Infinity;
    return null;
  } finally { clearTimeout(timer); }
}

// The site's network settings, or null without a Worker. Cached for an hour (TURN credentials expire).
export function netConfig() {
  const now = performance.now();
  if (!cache || now - cachedAt > TTL) { cachedAt = now; cache = load(); }
  return cache;
}

// Options for new Peer(...): the room's own signaling channel on this site, or the public cloud.
export async function peerOptions(code) {
  const cfg = await netConfig();
  if (!cfg) return { secure: true, debug: 0 };
  const secure = location.protocol === 'https:';
  return { host: location.hostname, port: Number(location.port) || (secure ? 443 : 80), secure, path: cfg.signal + code + '/', key: 'peerjs', config: { iceServers: cfg.iceServers }, debug: 0 };
}

// Ask early so it is ready before anyone opens the online menu.
netConfig();
