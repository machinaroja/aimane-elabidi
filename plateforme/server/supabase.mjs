// Client minimal de Supabase Auth (pas de bibliothèque : 3 appels HTTP). La clé « service » ne sort jamais du serveur.
export function createAuthClient({ url, anonKey, serviceKey, fetchImpl = fetch, timeoutMs = 8000 }) {
  const call = async (path, { method = 'POST', key, body } = {}) => {
    const r = await fetchImpl(`${url}${path}`, { method, headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
    let data = null; try { data = await r.json(); } catch { /* corps vide */ }
    return { ok: r.ok, status: r.status, data };
  };
  return {
    // Crée le compte d'authentification d'une adresse AUTORISÉE (invitée) : les inscriptions publiques peuvent rester désactivées.
    async ensureUser(email) {
      const r = await call('/auth/v1/admin/users', { key: serviceKey, body: { email, email_confirm: true } });
      if (r.ok || r.status === 422 || r.status === 409) return true;          // 422 : « déjà enregistré »
      throw new Error(`création du compte impossible (HTTP ${r.status})`);
    },
    async sendLink(email, redirectTo) {
      const r = await call('/auth/v1/otp', { key: anonKey, body: { email, create_user: false, options: { email_redirect_to: redirectTo } } });
      if (!r.ok) throw new Error(`envoi du lien impossible (HTTP ${r.status})`);
    },
    // Échange le jeton d'un lien « cliqué par la personne » (token_hash) contre une session. Fait côté serveur, sur action explicite de
    // l'utilisateur : un robot qui ouvre simplement le lien (antivirus, aperçu) ne le consomme donc pas.
    async verifyLink(tokenHash) {
      const r = await call('/auth/v1/verify', { key: anonKey, body: { type: 'magiclink', token_hash: tokenHash } });
      if (!r.ok || !r.data?.access_token) return null;
      return { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_in: r.data.expires_in };
    },
    async refresh(refreshToken) {
      const r = await call('/auth/v1/token?grant_type=refresh_token', { key: anonKey, body: { refresh_token: refreshToken } });
      if (!r.ok || !r.data?.access_token) return null;
      return { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_in: r.data.expires_in };
    },
  };
}
