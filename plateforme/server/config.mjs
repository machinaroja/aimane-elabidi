// Configuration par variables d'environnement. En production, le serveur REFUSE de démarrer si quelque chose manque
// ou est dangereux (connexion de démonstration, URL non sécurisée…).
export function loadConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const c = {
    prod,
    port: Number(env.PORT || 8787),
    databaseUrl: env.DATABASE_URL || null,
    databaseSsl: env.DATABASE_SSL === '1',
    supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, '') || null,
    anonKey: env.SUPABASE_ANON_KEY || null,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || null,
    jwtSecret: env.SUPABASE_JWT_SECRET || null,          // facultatif : projets anciens en HS256
    siteUrl: (env.SITE_URL || '').replace(/\/+$/, '') || null,
    trustProxy: env.TRUST_PROXY === '1',
    devAuth: env.DEV_AUTH === '1' && !prod,
  };
  const errors = [];
  if (prod) {
    if (env.DEV_AUTH === '1') errors.push('DEV_AUTH=1 est interdit en production (connexion de démonstration)');
    for (const [k, v] of [['DATABASE_URL', c.databaseUrl], ['SUPABASE_URL', c.supabaseUrl], ['SUPABASE_ANON_KEY', c.anonKey], ['SUPABASE_SERVICE_ROLE_KEY', c.serviceKey], ['SITE_URL', c.siteUrl]]) if (!v) errors.push(`${k} manquant`);
    const local = (u) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u || '');
    if (c.siteUrl && !/^https:\/\//.test(c.siteUrl) && !local(c.siteUrl)) errors.push('SITE_URL doit être en https');
    if (c.supabaseUrl && !/^https:\/\//.test(c.supabaseUrl) && !local(c.supabaseUrl)) errors.push('SUPABASE_URL doit être en https');
    if (c.databaseUrl && /(^|[:@/])(postgres|service_role|supabase_admin|supabase_auth_admin|supabase_storage_admin)(\.[a-z0-9_-]+)?(:|@)/.test(c.databaseUrl.replace(/^postgres(ql)?:\/\//, ''))) errors.push('DATABASE_URL ne doit pas utiliser un rôle administrateur : créez le rôle « gateway » (voir DEPLOIEMENT.md)');
  } else if (!c.devAuth && !c.supabaseUrl) {
    errors.push('ni DEV_AUTH=1 (démonstration) ni SUPABASE_URL (production) : aucune méthode de connexion configurée');
  }
  return { config: c, errors };
}
