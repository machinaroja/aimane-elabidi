// Limiteur à fenêtre fixe, en mémoire (une instance). Pour plusieurs instances : le déplacer vers un stockage partagé.
export function createLimiter({ now = () => Date.now() } = {}) {
  const hits = new Map();
  let lastSweep = now();
  return function hit(key, limit, windowMs) {
    const t = now();
    if (t - lastSweep > 60_000) { for (const [k, v] of hits) if (v.reset <= t) hits.delete(k); lastSweep = t; }
    let e = hits.get(key);
    if (!e || e.reset <= t) { e = { n: 0, reset: t + windowMs }; hits.set(key, e); }
    e.n += 1;
    return { allowed: e.n <= limit, remaining: Math.max(0, limit - e.n), retryAfter: Math.ceil((e.reset - t) / 1000) };
  };
}
