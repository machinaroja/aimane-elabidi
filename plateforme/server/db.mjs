import pg from 'pg';
// Développement : socket Unix locale ; production : DATABASE_URL (rôle de connexion dédié, membre de « authenticated »).
import { readFileSync } from 'node:fs';
const ssl = process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== '1', ...(process.env.DATABASE_SSL_CA ? { ca: readFileSync(process.env.DATABASE_SSL_CA, 'utf8') } : {}) } : undefined;
export const pool = new pg.Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX || 10), ssl, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000 }
  : { host: process.env.PGHOST || '/var/run/postgresql', port: Number(process.env.PGPORT || 5432), user: process.env.PGUSER || 'root', password: process.env.PGPASSWORD || undefined, database: process.env.PGDATABASE || 'lieusaint_dev', max: 10 });

// Une connexion INACTIVE coupée par la base (redémarrage, bascule, maintenance) ne doit jamais faire tomber le serveur :
// sans ce gestionnaire, l'événement « error » du pool est une exception non rattrapée.
pool.on('error', (e) => console.error('connexion base inactive perdue (le pool se reconnecte) :', e.code || e.message));

// TOUTE requête métier passe ici : transaction au nom de l'utilisateur, rôle « authenticated »,
// claims JWT posés => c'est la RLS de PostgreSQL qui décide, jamais ce serveur.
export async function withUser(user, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user.sub, email: user.email, role: 'authenticated' })]);
    await c.query('set local role authenticated');
    await c.query("set local statement_timeout = '15s'");                  // une requête lente ne bloque jamais la base
    await c.query("set local idle_in_transaction_session_timeout = '20s'");
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally { c.release(); }
}

// Erreurs PostgreSQL -> réponses HTTP sans fuite de détails internes.
export function httpError(e) {
  if (e.status) return e;
  const m = (e.message || '').replace(/^.*?ERROR:\s*/, '');
  if (e.code === '42501') return { status: 403, message: m.startsWith('new row violates') ? 'Action non autorisée.' : m };
  if (e.code === 'P0001') return { status: /^conflit/.test(m) ? 409 : 400, message: m };
  if (/^23/.test(e.code || '')) return { status: 400, message: 'Données invalides ou déjà existantes.' };
  if (e.code === '22P02' || e.code === '22007' || e.code === '22008') return { status: 400, message: 'Valeur invalide.' };
  console.error('erreur interne', e.code, e.message);
  return { status: 500, message: 'Erreur interne.' };
}
