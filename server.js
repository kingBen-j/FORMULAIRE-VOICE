/* ============================================================
   VOICE OF GOD — Serveur
   Sert le site public, recoit les candidatures, protege le
   tableau de bord admin par mot de passe (session).
   ============================================================ */
'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'VOG2026';
const CONTACT = {
  whatsapp: process.env.CONTACT_WHATSAPP || '2250711025713',
  email: process.env.CONTACT_EMAIL || '',
};

/* Derriere le proxy Render (HTTPS) : indispensable pour les cookies "secure". */
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

app.use(
  session({
    name: 'vog.sid',
    secret: process.env.SESSION_SECRET || 'vog-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: 1000 * 60 * 60 * 8, // 8 h
    },
  })
);

/* -------------------- Utilitaires -------------------- */

const STATUSES = ['nouveau', 'vu', 'retenu', 'refuse'];

function clean(v, max = 2000) {
  if (v == null) return '';
  return String(v).trim().slice(0, max);
}

function joinList(v, max = 600) {
  if (Array.isArray(v)) return v.map((x) => clean(x, 120)).filter(Boolean).join(', ').slice(0, max);
  return clean(v, max);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non authentifie.' });
  return res.redirect('/admin/login');
}

/* Petit garde-fou anti-force-brute sur le login. */
const loginHits = new Map(); // ip -> { count, until }
function loginThrottle(req, res, next) {
  const ip = req.ip || 'x';
  const rec = loginHits.get(ip);
  if (rec && rec.until > Date.now()) {
    return res.status(429).json({ error: 'Trop de tentatives. Reessaie dans un instant.' });
  }
  next();
}
function noteLoginFail(ip) {
  const rec = loginHits.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 6) {
    rec.until = Date.now() + 60 * 1000; // 1 min de pause
    rec.count = 0;
  }
  loginHits.set(ip, rec);
}

/* -------------------- Sante -------------------- */

app.get('/healthz', (req, res) => res.json({ ok: true }));

/* -------------------- Config publique -------------------- */
/* Le pied de page recupere le contact ici (pas de secret expose). */
app.get('/api/config', (req, res) => {
  res.json({ whatsapp: CONTACT.whatsapp, email: CONTACT.email });
});

/* -------------------- Soumission publique -------------------- */

app.post('/api/candidatures', async (req, res) => {
  try {
    const b = req.body || {};

    // Honeypot anti-spam : champ cache "website". Si rempli -> bot.
    if (clean(b.website)) return res.json({ ok: true });

    const nom = clean(b.nom, 120);
    const ville = clean(b.ville, 120);
    const tel = clean(b.tel, 60);
    const departement = joinList(b.departement);
    const motivation = clean(b.motivation, 4000);
    const engagement = b.engagement === true || b.engagement === 'true' || b.engagement === 'on' || b.engagement === 1;

    const errors = [];
    if (!nom) errors.push('Le nom est obligatoire.');
    if (!ville) errors.push('La ville est obligatoire.');
    if (!tel) errors.push('Le telephone est obligatoire.');
    if (!departement) errors.push('Choisis au moins un departement.');
    if (!motivation) errors.push('La motivation est obligatoire.');
    if (!engagement) errors.push("L'engagement doit etre coche.");

    let age = clean(b.age, 4);
    if (age && (isNaN(Number(age)) || Number(age) < 5 || Number(age) > 120)) {
      errors.push("L'age n'est pas valide.");
    }

    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const id = await db.insertCandidature({
      nom,
      age: age === '' ? null : Number(age),
      sexe: clean(b.sexe, 40),
      ville,
      tel,
      email: clean(b.email, 160),
      eglise: clean(b.eglise, 160),
      conversion: clean(b.conversion, 80),
      bapteme: joinList(b.bapteme),
      departement,
      tessiture: clean(b.tessiture, 80),
      instrument: clean(b.instrument, 200),
      niveau: clean(b.niveau, 80),
      experience: clean(b.experience, 2000),
      dispo: joinList(b.dispo),
      motivation,
      engagement,
    });

    res.json({ ok: true, id });
  } catch (err) {
    console.error('[POST /api/candidatures]', err);
    res.status(500).json({ error: "Une erreur est survenue. Reessaie dans un instant." });
  }
});

/* -------------------- Admin : auth -------------------- */

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/admin/login', loginThrottle, (req, res) => {
  const pass = clean(req.body && req.body.password, 200);
  if (pass && pass === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  noteLoginFail(req.ip || 'x');
  return res.status(401).json({ error: "Mot de passe incorrect." });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

/* -------------------- Admin : pages & API -------------------- */

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/candidatures', requireAuth, async (req, res) => {
  try {
    const rows = await db.listCandidatures();
    res.json({ candidatures: rows });
  } catch (err) {
    console.error('[GET /api/admin/candidatures]', err);
    res.status(500).json({ error: 'Erreur de lecture.' });
  }
});

app.post('/api/admin/candidatures/:id/status', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = clean(req.body && req.body.status, 20);
    if (!Number.isInteger(id) || !STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Requete invalide.' });
    }
    await db.updateStatus(id, status);
    res.json({ ok: true });
  } catch (err) {
    console.error('[status]', err);
    res.status(500).json({ error: 'Erreur.' });
  }
});

app.delete('/api/admin/candidatures/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Requete invalide.' });
    await db.deleteCandidature(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[delete]', err);
    res.status(500).json({ error: 'Erreur.' });
  }
});

/* Export CSV (Excel-friendly, separateur ";", BOM UTF-8). */
app.get('/api/admin/export.csv', requireAuth, async (req, res) => {
  try {
    const rows = await db.listCandidatures();
    const headers = [
      'id', 'date', 'nom', 'age', 'sexe', 'ville', 'telephone', 'email',
      'eglise', 'conversion', 'bapteme', 'departements', 'tessiture',
      'instrument', 'niveau', 'experience', 'disponibilite', 'motivation', 'engagement', 'statut',
    ];
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const lines = [headers.join(';')];
    for (const r of rows) {
      lines.push([
        r.id, r.created_at, r.nom, r.age, r.sexe, r.ville, r.tel, r.email,
        r.eglise, r.conversion, r.bapteme, r.departement, r.tessiture,
        r.instrument, r.niveau, r.experience, r.dispo, r.motivation,
        r.engagement ? 'oui' : 'non', r.status,
      ].map(cell).join(';'));
    }
    const csv = '﻿' + lines.join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="candidatures-vog-${stamp}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[export]', err);
    res.status(500).send('Erreur export.');
  }
});

/* -------------------- Statique -------------------- */
/* Sert public/ (index.html, app.js, logo...). Place APRES les routes admin
   pour que /admin ne soit pas capte par un eventuel fichier statique. */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

/* -------------------- Demarrage -------------------- */

db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`[vog] En ligne sur http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('[vog] Echec init base de donnees :', err);
    process.exit(1);
  });
