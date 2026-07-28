/* ============================================================
   VOICE OF GOD — Serveur
   Site public + candidatures + presences (avec analyse IA)
   + tableau de bord admin protege + PWA.
   ============================================================ */
'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const db = require('./db');
const analyzer = require('./analyze-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'VOG2026';
const CONTACT = {
  whatsapp: process.env.CONTACT_WHATSAPP || '2250711025713',
  email: process.env.CONTACT_EMAIL || '',
};

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: true, limit: '128kb' }));

app.use(session({
  name: 'vog.sid',
  secret: process.env.SESSION_SECRET || 'vog-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 1000 * 60 * 60 * 8 },
}));

/* Upload en memoire (le fichier est stocke en base). Max 6 Mo. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|heic|heif)$|^application\/pdf$/.test(file.mimetype);
    cb(ok ? null : new Error('Format non accepte (images ou PDF seulement).'), ok);
  },
});

/* -------------------- Utilitaires -------------------- */
const STATUSES = ['nouveau', 'vu', 'retenu', 'refuse'];
const clean = (v, max = 2000) => (v == null ? '' : String(v).trim().slice(0, max));
const joinList = (v, max = 600) =>
  Array.isArray(v) ? v.map((x) => clean(x, 120)).filter(Boolean).join(', ').slice(0, max) : clean(v, max);

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non authentifie.' });
  return res.redirect('/admin/login');
}

const loginHits = new Map();
function loginThrottle(req, res, next) {
  const rec = loginHits.get(req.ip || 'x');
  if (rec && rec.until > Date.now()) return res.status(429).json({ error: 'Trop de tentatives. Reessaie dans un instant.' });
  next();
}
function noteLoginFail(ip) {
  const rec = loginHits.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 6) { rec.until = Date.now() + 60000; rec.count = 0; }
  loginHits.set(ip, rec);
}

/* -------------------- Sante & config -------------------- */
app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => res.json({ whatsapp: CONTACT.whatsapp, email: CONTACT.email, ia: analyzer.aiEnabled() }));

/* -------------------- Candidatures (public) -------------------- */
app.post('/api/candidatures', async (req, res) => {
  try {
    const b = req.body || {};
    if (clean(b.website)) return res.json({ ok: true });

    const nom = clean(b.nom, 120), ville = clean(b.ville, 120), tel = clean(b.tel, 60);
    const departement = joinList(b.departement), motivation = clean(b.motivation, 4000);
    const engagement = b.engagement === true || b.engagement === 'true' || b.engagement === 'on' || b.engagement === 1;
    const errors = [];
    if (!nom) errors.push('Le nom est obligatoire.');
    if (!ville) errors.push('La ville est obligatoire.');
    if (!tel) errors.push('Le telephone est obligatoire.');
    if (!departement) errors.push('Choisis au moins un departement.');
    if (!motivation) errors.push('La motivation est obligatoire.');
    if (!engagement) errors.push("L'engagement doit etre coche.");
    let age = clean(b.age, 4);
    if (age && (isNaN(Number(age)) || Number(age) < 5 || Number(age) > 120)) errors.push("L'age n'est pas valide.");
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const id = await db.insertCandidature({
      nom, age: age === '' ? null : Number(age), sexe: clean(b.sexe, 40), ville, tel,
      email: clean(b.email, 160), eglise: clean(b.eglise, 160), conversion: clean(b.conversion, 80),
      bapteme: joinList(b.bapteme), departement, tessiture: clean(b.tessiture, 80),
      instrument: clean(b.instrument, 200), niveau: clean(b.niveau, 80), experience: clean(b.experience, 2000),
      dispo: joinList(b.dispo), motivation, engagement,
    });
    res.json({ ok: true, id });
  } catch (err) {
    console.error('[POST /api/candidatures]', err);
    res.status(500).json({ error: 'Une erreur est survenue. Reessaie dans un instant.' });
  }
});

/* -------------------- Membres (liste publique pour le formulaire) -------------------- */
app.get('/api/membres', async (req, res) => {
  try {
    const rows = await db.listMembres(true);
    res.json({ membres: rows.map((m) => ({ id: m.id, nom: m.nom, poste: m.poste })) });
  } catch (err) {
    console.error('[GET /api/membres]', err);
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* -------------------- Presence (public, questionnaire + upload) -------------------- */
app.post('/api/presence', (req, res) => {
  upload.single('justificatif')(req, res, async (uErr) => {
    try {
      if (uErr) return res.status(400).json({ error: uErr.message || 'Fichier invalide.' });
      const b = req.body || {};
      if (clean(b.website)) return res.json({ ok: true }); // honeypot

      const nom = clean(b.nom, 120);
      const poste = clean(b.poste, 120);
      const date_seance = clean(b.date_seance, 20);
      const statut = clean(b.statut, 20);
      if (!nom) return res.status(400).json({ error: 'Ton nom est obligatoire.' });
      if (!['present', 'absent', 'retard'].includes(statut)) return res.status(400).json({ error: 'Statut invalide.' });
      if (!date_seance) return res.status(400).json({ error: 'La date de la seance est obligatoire.' });

      const motif_categorie = clean(b.motif_categorie, 120);
      const details = clean(b.details, 3000);
      const prevenu = b.prevenu === 'true' || b.prevenu === 'on' || b.prevenu === '1' || b.prevenu === true;
      const retard_minutes = clean(b.retard_minutes, 5);

      if (statut !== 'present' && !motif_categorie && !details) {
        return res.status(400).json({ error: 'Indique un motif ou une explication.' });
      }

      const file = req.file;
      const hasJustificatif = !!file;

      const analyse = await analyzer.analyse({
        statut, motif_categorie, details, prevenu, hasJustificatif,
        retard_minutes: retard_minutes ? Number(retard_minutes) : 0,
      });

      const id = await db.insertPresence({
        membre_id: b.membre_id ? Number(b.membre_id) : null,
        nom, poste, date_seance, type_seance: clean(b.type_seance, 60), statut,
        motif_categorie: statut === 'present' ? null : motif_categorie,
        retard_minutes: statut === 'retard' && retard_minutes ? Number(retard_minutes) : null,
        prevenu, details: statut === 'present' ? null : details,
        justificatif_nom: file ? file.originalname.slice(0, 200) : null,
        justificatif_type: file ? file.mimetype : null,
        justificatif_data: file ? file.buffer : null,
        justificatif_taille: file ? file.size : null,
        verdict: analyse.verdict, verdict_score: analyse.score, verdict_categorie: analyse.categorie,
        verdict_explication: analyse.explication, verdict_facteurs: analyse.facteurs, moteur: analyse.moteur,
      });

      res.json({
        ok: true, id,
        verdict: analyse.verdict, score: analyse.score, categorie: analyse.categorie,
        explication: analyse.explication, facteurs: analyse.facteurs, moteur: analyse.moteur,
      });
    } catch (err) {
      console.error('[POST /api/presence]', err);
      res.status(500).json({ error: 'Une erreur est survenue. Reessaie dans un instant.' });
    }
  });
});

/* -------------------- Admin : auth -------------------- */
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.post('/admin/login', loginThrottle, (req, res) => {
  const pass = clean(req.body && req.body.password, 200);
  if (pass && pass === ADMIN_PASSWORD) { req.session.admin = true; return res.json({ ok: true }); }
  noteLoginFail(req.ip || 'x');
  res.status(401).json({ error: 'Mot de passe incorrect.' });
});
app.post('/admin/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

/* -------------------- Admin : pages (servies depuis views/, protegees) -------------------- */
const view = (name) => (req, res) => res.sendFile(path.join(__dirname, 'views', name));
app.get('/admin', requireAuth, view('admin.html'));
app.get('/admin/presences', requireAuth, view('presences.html'));
app.get('/admin/membres', requireAuth, view('membres.html'));

/* -------------------- Admin : API candidatures -------------------- */
app.get('/api/admin/candidatures', requireAuth, async (req, res) => {
  try { res.json({ candidatures: await db.listCandidatures() }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erreur de lecture.' }); }
});
app.post('/api/admin/candidatures/:id/status', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id), status = clean(req.body && req.body.status, 20);
    if (!Number.isInteger(id) || !STATUSES.includes(status)) return res.status(400).json({ error: 'Requete invalide.' });
    await db.updateStatus(id, status); res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});
app.delete('/api/admin/candidatures/:id', requireAuth, async (req, res) => {
  try { await db.deleteCandidature(Number(req.params.id)); res.json({ ok: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});

/* -------------------- Admin : API membres -------------------- */
app.get('/api/admin/membres', requireAuth, async (req, res) => {
  try { res.json({ membres: await db.listMembres(false) }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});
app.post('/api/admin/membres', requireAuth, async (req, res) => {
  try {
    const nom = clean(req.body && req.body.nom, 120);
    if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire.' });
    const id = await db.insertMembre({ nom, poste: clean(req.body.poste, 120), telephone: clean(req.body.telephone, 60) });
    res.json({ ok: true, id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});
app.delete('/api/admin/membres/:id', requireAuth, async (req, res) => {
  try { await db.deleteMembre(Number(req.params.id)); res.json({ ok: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});

/* -------------------- Admin : API presences -------------------- */
app.get('/api/admin/presences', requireAuth, async (req, res) => {
  try { res.json({ presences: await db.listPresences() }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});
app.delete('/api/admin/presences/:id', requireAuth, async (req, res) => {
  try { await db.deletePresence(Number(req.params.id)); res.json({ ok: true }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Erreur.' }); }
});
app.get('/api/admin/presences/:id/justificatif', requireAuth, async (req, res) => {
  try {
    const j = await db.getJustificatif(Number(req.params.id));
    if (!j || !j.justificatif_data) return res.status(404).send('Aucun justificatif.');
    res.setHeader('Content-Type', j.justificatif_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(j.justificatif_nom || 'justificatif').replace(/"/g, '')}"`);
    res.send(Buffer.isBuffer(j.justificatif_data) ? j.justificatif_data : Buffer.from(j.justificatif_data));
  } catch (err) { console.error(err); res.status(500).send('Erreur.'); }
});

/* -------------------- Export CSV -------------------- */
const cell = (v) => '"' + (v == null ? '' : String(v)).replace(/"/g, '""') + '"';
function sendCsv(res, name, headers, rows) {
  const lines = [headers.join(';')].concat(rows.map((r) => r.map(cell).join(';')));
  const csv = '﻿' + lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}
app.get('/api/admin/export.csv', requireAuth, async (req, res) => {
  try {
    const rows = await db.listCandidatures();
    sendCsv(res, 'candidatures-vog',
      ['id', 'date', 'nom', 'age', 'sexe', 'ville', 'telephone', 'email', 'eglise', 'conversion', 'bapteme', 'departements', 'tessiture', 'instrument', 'niveau', 'experience', 'disponibilite', 'motivation', 'engagement', 'statut'],
      rows.map((r) => [r.id, r.created_at, r.nom, r.age, r.sexe, r.ville, r.tel, r.email, r.eglise, r.conversion, r.bapteme, r.departement, r.tessiture, r.instrument, r.niveau, r.experience, r.dispo, r.motivation, r.engagement ? 'oui' : 'non', r.status]));
  } catch (err) { console.error(err); res.status(500).send('Erreur export.'); }
});
app.get('/api/admin/presences.csv', requireAuth, async (req, res) => {
  try {
    const rows = await db.listPresences();
    sendCsv(res, 'presences-vog',
      ['id', 'date', 'nom', 'poste', 'seance', 'type', 'statut', 'motif', 'retard_min', 'prevenu', 'details', 'justificatif', 'verdict', 'score', 'moteur'],
      rows.map((r) => [r.id, r.created_at, r.nom, r.poste, r.date_seance, r.type_seance, r.statut, r.motif_categorie, r.retard_minutes, r.prevenu ? 'oui' : 'non', r.details, r.has_justificatif ? 'oui' : 'non', r.verdict, r.verdict_score, r.moteur]));
  } catch (err) { console.error(err); res.status(500).send('Erreur export.'); }
});

/* -------------------- Statique + PWA + 404 -------------------- */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

/* -------------------- Demarrage -------------------- */
db.init()
  .then(() => app.listen(PORT, () => console.log(`[vog] En ligne sur http://localhost:${PORT} — IA: ${analyzer.aiEnabled() ? 'activee (' + analyzer.MODEL + ')' : 'reglee (regles)'}`)))
  .catch((err) => { console.error('[vog] Echec init base :', err); process.exit(1); });
