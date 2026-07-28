/* ============================================================
   VOICE OF GOD — Couche base de donnees
   - Si DATABASE_URL est defini  -> PostgreSQL (production / Render)
   - Sinon                       -> SQLite local (./data/vog.db)
   Meme API asynchrone dans les deux cas.
   Tables : candidatures, membres, presences.
   ============================================================ */
'use strict';

const USE_PG = !!process.env.DATABASE_URL;

const COLUMNS = [
  'nom', 'age', 'sexe', 'ville', 'tel', 'email',
  'eglise', 'conversion', 'bapteme', 'departement', 'tessiture',
  'instrument', 'niveau', 'experience', 'dispo', 'motivation', 'engagement',
];

const PRES_COLS = [
  'membre_id', 'nom', 'poste', 'date_seance', 'type_seance', 'statut',
  'motif_categorie', 'retard_minutes', 'prevenu', 'details',
  'justificatif_nom', 'justificatif_type', 'justificatif_data', 'justificatif_taille',
  'verdict', 'verdict_score', 'verdict_categorie', 'verdict_explication', 'verdict_facteurs', 'moteur',
];

let pool = null; // pg
let sdb = null;  // sqlite

async function init() {
  if (USE_PG) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidatures (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        nom TEXT, age INTEGER, sexe TEXT, ville TEXT, tel TEXT, email TEXT,
        eglise TEXT, conversion TEXT, bapteme TEXT, departement TEXT, tessiture TEXT,
        instrument TEXT, niveau TEXT, experience TEXT, dispo TEXT, motivation TEXT,
        engagement BOOLEAN DEFAULT FALSE, status TEXT DEFAULT 'nouveau'
      )`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membres (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        nom TEXT NOT NULL, poste TEXT, telephone TEXT, actif BOOLEAN DEFAULT TRUE
      )`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS presences (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        membre_id INTEGER,
        nom TEXT, poste TEXT, date_seance TEXT, type_seance TEXT, statut TEXT,
        motif_categorie TEXT, retard_minutes INTEGER, prevenu BOOLEAN DEFAULT FALSE, details TEXT,
        justificatif_nom TEXT, justificatif_type TEXT, justificatif_data BYTEA, justificatif_taille INTEGER,
        verdict TEXT, verdict_score INTEGER, verdict_categorie TEXT,
        verdict_explication TEXT, verdict_facteurs TEXT, moteur TEXT
      )`);
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        nom TEXT, age INTEGER, sexe TEXT, ville TEXT, tel TEXT, email TEXT,
        eglise TEXT, conversion TEXT, bapteme TEXT, departement TEXT, tessiture TEXT,
        instrument TEXT, niveau TEXT, experience TEXT, dispo TEXT, motivation TEXT,
        engagement INTEGER DEFAULT 0, status TEXT DEFAULT 'nouveau'
      );
      CREATE TABLE IF NOT EXISTS membres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        nom TEXT NOT NULL, poste TEXT, telephone TEXT, actif INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS presences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        membre_id INTEGER,
        nom TEXT, poste TEXT, date_seance TEXT, type_seance TEXT, statut TEXT,
        motif_categorie TEXT, retard_minutes INTEGER, prevenu INTEGER DEFAULT 0, details TEXT,
        justificatif_nom TEXT, justificatif_type TEXT, justificatif_data BLOB, justificatif_taille INTEGER,
        verdict TEXT, verdict_score INTEGER, verdict_categorie TEXT,
        verdict_explication TEXT, verdict_facteurs TEXT, moteur TEXT
      );
    `);
    console.log('[db] SQLite pret ->', file);
  }
}

/* ---------------- Candidatures ---------------- */

async function insertCandidature(d) {
  const values = COLUMNS.map((c) => {
    if (c === 'engagement') return USE_PG ? !!d.engagement : (d.engagement ? 1 : 0);
    if (c === 'age') return d.age == null || d.age === '' ? null : Number(d.age);
    const v = d[c];
    return v == null ? null : String(v);
  });
  if (USE_PG) {
    const ph = COLUMNS.map((_, i) => '$' + (i + 1)).join(', ');
    const res = await pool.query(`INSERT INTO candidatures (${COLUMNS.join(', ')}) VALUES (${ph}) RETURNING id`, values);
    return res.rows[0].id;
  }
  const ph = COLUMNS.map(() => '?').join(', ');
  return sdb.prepare(`INSERT INTO candidatures (${COLUMNS.join(', ')}) VALUES (${ph})`).run(...values).lastInsertRowid;
}

async function listCandidatures() {
  if (USE_PG) {
    const res = await pool.query('SELECT * FROM candidatures ORDER BY created_at DESC, id DESC');
    return res.rows.map(normCand);
  }
  return sdb.prepare('SELECT * FROM candidatures ORDER BY id DESC').all().map(normCand);
}

async function updateStatus(id, status) {
  if (USE_PG) await pool.query('UPDATE candidatures SET status = $1 WHERE id = $2', [status, id]);
  else sdb.prepare('UPDATE candidatures SET status = ? WHERE id = ?').run(status, id);
}

async function deleteCandidature(id) {
  if (USE_PG) await pool.query('DELETE FROM candidatures WHERE id = $1', [id]);
  else sdb.prepare('DELETE FROM candidatures WHERE id = ?').run(id);
}

/* ---------------- Membres ---------------- */

async function insertMembre(d) {
  const vals = [String(d.nom || '').trim(), d.poste || null, d.telephone || null, USE_PG ? true : 1];
  if (USE_PG) {
    const res = await pool.query('INSERT INTO membres (nom, poste, telephone, actif) VALUES ($1,$2,$3,$4) RETURNING id', vals);
    return res.rows[0].id;
  }
  return sdb.prepare('INSERT INTO membres (nom, poste, telephone, actif) VALUES (?,?,?,?)').run(...vals).lastInsertRowid;
}

async function listMembres(onlyActive) {
  if (USE_PG) {
    const q = onlyActive ? 'SELECT * FROM membres WHERE actif = TRUE ORDER BY nom' : 'SELECT * FROM membres ORDER BY nom';
    return (await pool.query(q)).rows.map(normMembre);
  }
  const q = onlyActive ? 'SELECT * FROM membres WHERE actif = 1 ORDER BY nom' : 'SELECT * FROM membres ORDER BY nom';
  return sdb.prepare(q).all().map(normMembre);
}

async function deleteMembre(id) {
  if (USE_PG) await pool.query('DELETE FROM membres WHERE id = $1', [id]);
  else sdb.prepare('DELETE FROM membres WHERE id = ?').run(id);
}

/* ---------------- Presences ---------------- */

async function insertPresence(d) {
  const values = PRES_COLS.map((c) => {
    if (c === 'prevenu') return USE_PG ? !!d.prevenu : (d.prevenu ? 1 : 0);
    if (c === 'membre_id' || c === 'retard_minutes' || c === 'justificatif_taille' || c === 'verdict_score') {
      return d[c] == null || d[c] === '' ? null : Number(d[c]);
    }
    if (c === 'justificatif_data') return d.justificatif_data || null; // Buffer
    if (c === 'verdict_facteurs') return d.verdict_facteurs == null ? null : JSON.stringify(d.verdict_facteurs);
    const v = d[c];
    return v == null ? null : String(v);
  });
  if (USE_PG) {
    const ph = PRES_COLS.map((_, i) => '$' + (i + 1)).join(', ');
    const res = await pool.query(`INSERT INTO presences (${PRES_COLS.join(', ')}) VALUES (${ph}) RETURNING id`, values);
    return res.rows[0].id;
  }
  const ph = PRES_COLS.map(() => '?').join(', ');
  return sdb.prepare(`INSERT INTO presences (${PRES_COLS.join(', ')}) VALUES (${ph})`).run(...values).lastInsertRowid;
}

/* Liste sans le BLOB (leger). */
async function listPresences() {
  const cols = `id, created_at, membre_id, nom, poste, date_seance, type_seance, statut,
    motif_categorie, retard_minutes, prevenu, details,
    justificatif_nom, justificatif_type, justificatif_taille,
    verdict, verdict_score, verdict_categorie, verdict_explication, verdict_facteurs, moteur`;
  if (USE_PG) {
    const res = await pool.query(`SELECT ${cols} FROM presences ORDER BY created_at DESC, id DESC`);
    return res.rows.map(normPres);
  }
  return sdb.prepare(`SELECT ${cols} FROM presences ORDER BY id DESC`).all().map(normPres);
}

async function getJustificatif(id) {
  if (USE_PG) {
    const res = await pool.query('SELECT justificatif_nom, justificatif_type, justificatif_data FROM presences WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  return sdb.prepare('SELECT justificatif_nom, justificatif_type, justificatif_data FROM presences WHERE id = ?').get(id) || null;
}

async function deletePresence(id) {
  if (USE_PG) await pool.query('DELETE FROM presences WHERE id = $1', [id]);
  else sdb.prepare('DELETE FROM presences WHERE id = ?').run(id);
}

/* ---------------- Normalisation ---------------- */

function normCand(r) {
  return { ...r,
    engagement: r.engagement === true || r.engagement === 1 || r.engagement === '1',
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at };
}
function normMembre(r) {
  return { ...r, actif: r.actif === true || r.actif === 1 || r.actif === '1',
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at };
}
function normPres(r) {
  let facteurs = [];
  try { facteurs = r.verdict_facteurs ? JSON.parse(r.verdict_facteurs) : []; } catch (e) { facteurs = []; }
  return { ...r,
    prevenu: r.prevenu === true || r.prevenu === 1 || r.prevenu === '1',
    has_justificatif: !!r.justificatif_nom,
    verdict_facteurs: facteurs,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at };
}

module.exports = {
  init,
  insertCandidature, listCandidatures, updateStatus, deleteCandidature,
  insertMembre, listMembres, deleteMembre,
  insertPresence, listPresences, getJustificatif, deletePresence,
  COLUMNS,
};
