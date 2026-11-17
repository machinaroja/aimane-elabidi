// La coupure de connexions inactives par la base (redémarrage) ne doit pas faire tomber la passerelle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { pool } from '../db.mjs';

test('connexions du pool coupées par la base : le processus survit et se reconnecte', async () => {
  const c = await pool.connect(); await c.query('select 1'); c.release();           // une connexion inactive existe
  execSync(`psql -X -At -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '${process.env.PGDATABASE || 'lieusaint_dev'}' and pid <> pg_backend_pid()"`);
  await new Promise((r) => setTimeout(r, 400));                                        // laisse l'événement « error » se produire
  const r = await pool.query('select 1 as ok');                                        // le pool a rouvert une connexion
  assert.equal(r.rows[0].ok, 1);
  await pool.end();
});
