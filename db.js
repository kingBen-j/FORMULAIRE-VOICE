/* ============================================================
   VOICE OF GOD — Couche base de donnees
   - Si DATABASE_URL est defini  -> PostgreSQL (production / Render)
   - Sinon                       -> SQLite local (./data/vog.db)
   Meme API asynchrone dans les deux cas.
   ============================================================ */
'use strict';

const USE_PG = !!process.env.DATABASE_URL;

/* Colonnes stockees (dans l'ordre d'insertion). */
const COLUMNS = [
  'nom', 'age', 'sexe', 'ville', 'tel', 'email',
  'eglise', 'conversion', 'bapteme', 'departement', 'tessiture',
  'instrument', 'niveau', 'experience', 'dispo', 'motivation', 'engagement'
];

let pool = null; // pg
let sdb = null;  // sqlite

async function init() {
  if (USE_PG) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Render Postgres requiert SSL ; en local sur pg pur on desactive.
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidatures (
        id          SERIAL PRIMARY KEY,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        nom         TEXT,
        age         INTEGER,
        sexe        TEXT,
        ville       TEXT,
        tel         TEXT,
        email       TEXT,
        eglise      TEXT,
        conversion  TEXT,
        bapteme     TEXT,
        departement TEXT,
        tessiture   TEXT,
        instrument  TEXT,
        niveau      TEXT,
        experience  TEXT,
        dispo       TEXT,
        motivation  TEXT,
        engagement  BOOLEAN DEFAULT FALSE,
        status      TEXT DEFAULT 'nouveau'
      )
    `);
    console.log('[db] PostgreSQL pret.');
  } else {
    const Database = require('better-sqlite3');
    const fs = require('fs');
    const path = require('path');
    const dir = process.env.DB_DIR || path.join(__dirname, 'data');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'vog.db');
    sdb = new Database(file);
    sdb.pragma('journal_mode = WAL');
    sdb.exec(`
      CREATE TABLE IF NOT EXISTS candidatures (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        nom         TEXT,
        age         INTEGER,
        sexe        TEXT,
        ville       TEXT,
        tel         TEXT,
        email       TEXT,
        eglise      TEXT,
        conversion  TEXT,
        bapteme     TEXT,
        departement TEXT,
        tessiture   TEXT,
        instrument  TEXT,
        niveau      TEXT,
        experience  TEXT,
        dispo       TEXT,
        motivation  TEXT,
        engagement  INTEGER DEFAULT 0,
        status      TEXT DEFAULT 'nouveau'
      )
    `);
    console.log('[db] SQLite pret ->', file);
  }
}

/* Insere une candidature. Renvoie l'id cree. */
async function insertCandidature(d) {
  const values = COLUMNS.map((c) => {
    if (c === 'engagement') return USE_PG ? !!d.engagement : (d.engagement ? 1 : 0);
    if (c === 'age') return d.age == null || d.age === '' ? null : Number(d.age);
    const v = d[c];
    return v == null ? null : String(v);
  });

  if (USE_PG) {
    const placeholders = COLUMNS.map((_, i) => '$' + (i + 1)).join(', ');
    const sql = `INSERT INTO candidatures (${COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING id`;
    const res = await pool.query(sql, values);
    return res.rows[0].id;
  } else {
    const placeholders = COLUMNS.map(() => '?').join(', ');
    const sql = `INSERT INTO candidatures (${COLUMNS.join(', ')}) VALUES (${placeholders})`;
    const info = sdb.prepare(sql).run(...values);
    return info.lastInsertRowid;
  }
}

/* Liste toutes les candidatures, plus recentes d'abord. */
async function listCandidatures() {
  if (USE_PG) {
    const res = await pool.query('SELECT * FROM candidatures ORDER BY created_at DESC, id DESC');
    return res.rows.map(normalizeRow);
  } else {
    return sdb.prepare('SELECT * FROM candidatures ORDER BY id DESC').all().map(normalizeRow);
  }
}

/* Met a jour le statut (nouveau / vu / retenu / refuse). */
async function updateStatus(id, status) {
  if (USE_PG) {
    await pool.query('UPDATE candidatures SET status = $1 WHERE id = $2', [status, id]);
  } else {
    sdb.prepare('UPDATE candidatures SET status = ? WHERE id = ?').run(status, id);
  }
}

/* Supprime une candidature. */
async function deleteCandidature(id) {
  if (USE_PG) {
    await pool.query('DELETE FROM candidatures WHERE id = $1', [id]);
  } else {
    sdb.prepare('DELETE FROM candidatures WHERE id = ?').run(id);
  }
}

/* Normalise engagement en booleen et created_at en ISO. */
function normalizeRow(r) {
  return {
    ...r,
    engagement: r.engagement === true || r.engagement === 1 || r.engagement === '1',
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

module.exports = {
  init,
  insertCandidature,
  listCandidatures,
  updateStatus,
  deleteCandidature,
  COLUMNS,
};
