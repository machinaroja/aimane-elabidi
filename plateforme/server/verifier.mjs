// Vérification des jetons de connexion.
//  * Supabase (production) : jetons signés ES256 / RS256, clés publiques publiées sur {SUPABASE_URL}/auth/v1/.well-known/jwks.json
//    (ancien mode : HS256 avec secret partagé, accepté seulement si SUPABASE_JWT_SECRET est configuré) ;
//  * L'algorithme accepté est dicté par la CLÉ trouvée (kid), jamais par l'en-tête seul : pas de confusion d'algorithme,
//    pas de « none », pas de HS256 signé avec une clé publique.
//  * Contrôle de l'émetteur (iss), de l'audience (aud = authenticated), de l'expiration et du sujet.
import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from 'node:crypto';

const b64 = (s) => Buffer.from(s, 'base64url');
const parseJson = (buf) => { try { return JSON.parse(buf.toString('utf8')); } catch { return null; } };

export function createVerifier({ issuer = null, audience = 'authenticated', hsSecret = null, jwksUrl = null, fetchImpl = fetch, now = () => Date.now(), jwksTtlMs = 600_000, minRefetchMs = 60_000, onWarn = () => {} } = {}) {
  let keys = new Map(); let fetchedAt = 0; let lastTry = 0; let inflight = null;

  async function loadJwks(force) {
    if (!jwksUrl) return;
    const t = now();
    if (!force && keys.size && t - fetchedAt < jwksTtlMs) return;
    if (t - lastTry < minRefetchMs && keys.size) return;                 // anti-martèlement du serveur de clés
    if (inflight) return inflight;
    lastTry = t;
    inflight = (async () => {
      try {
        const r = await fetchImpl(jwksUrl, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) throw new Error(`JWKS HTTP ${r.status}`);
        const body = await r.json();
        const m = new Map();
        for (const jwk of body.keys ?? []) {
          if (!jwk.kid || !['EC', 'RSA'].includes(jwk.kty)) continue;
          try { m.set(jwk.kid, { alg: jwk.kty === 'EC' ? 'ES256' : 'RS256', key: createPublicKey({ key: jwk, format: 'jwk' }) }); } catch { /* clé illisible : ignorée */ }
        }
        if (m.size) { keys = m; fetchedAt = now(); }
      } catch (e) { onWarn(`récupération des clés de signature impossible : ${e.message}`); }   // on garde les anciennes clés si on en a
      finally { inflight = null; }
    })();
    return inflight;
  }

  return async function verify(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts.some((p) => !p || p.length > 4096)) return null;
    const header = parseJson(b64(parts[0])); const payload = parseJson(b64(parts[1]));
    if (!header || !payload || typeof header.alg !== 'string') return null;
    const data = Buffer.from(`${parts[0]}.${parts[1]}`);
    const sig = b64(parts[2]);
    let ok = false;

    if (header.alg === 'HS256') {
      if (!hsSecret || header.kid) return null;                         // HS256 seulement si un secret est configuré ; un jeton avec « kid » est asymétrique
      const expected = createHmac('sha256', hsSecret).update(data).digest();
      ok = sig.length === expected.length && timingSafeEqual(sig, expected);
    } else if (header.alg === 'ES256' || header.alg === 'RS256') {
      if (!jwksUrl || typeof header.kid !== 'string') return null;
      await loadJwks(false);
      let k = keys.get(header.kid);
      if (!k) { await loadJwks(true); k = keys.get(header.kid); }       // rotation de clé : une tentative de rechargement
      if (!k || k.alg !== header.alg) return null;                      // l'algorithme DOIT correspondre à la clé
      try {
        ok = header.alg === 'ES256' ? cryptoVerify('sha256', data, { key: k.key, dsaEncoding: 'ieee-p1363' }, sig) : cryptoVerify('sha256', data, k.key, sig);
      } catch { ok = false; }
    } else return null;                                                 // « none », HS512, PS256… : refusés
    if (!ok) return null;

    const t = Math.floor(now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= t) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > t + 30) return null;
    if (typeof payload.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.sub)) return null;
    if (issuer && payload.iss !== issuer) return null;
    if (audience && !(Array.isArray(payload.aud) ? payload.aud.includes(audience) : payload.aud === audience)) return null;
    return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email.toLowerCase() : '', exp: payload.exp };
  };
}
