/* ============================================================
   VOICE OF GOD — Analyse des motifs d'absence / de retard
   Systeme de regles transparent (aucune IA externe requise).
   Rend un verdict : 'valable' | 'a_verifier' | 'non_valable'
   avec un score (0-100) et une explication en francais.
   ============================================================ */
'use strict';

/* Retire les accents et met en minuscules pour comparer. */
function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/* Motifs serieux : base = poids de credibilite du motif. */
const MOTIFS_SERIEUX = {
  hospitalisation: { label: 'Hospitalisation', base: 88, kw: ['hospitalis', 'hopital', 'clinique', 'urgences', 'operation', 'chirurgie', 'admis a l', 'perfusion'] },
  maladie:         { label: 'Maladie',         base: 72, kw: ['malad', 'fievre', 'grippe', 'palu', 'covid', 'souffr', 'douleur', 'medecin', 'ordonnance', 'consultation', 'repos medical', 'certificat medical', 'blesse', 'entorse', 'vertige', 'migraine', 'intoxication'] },
  deuil:           { label: 'Deuil / deces d\'un proche', base: 85, kw: ['deuil', 'deces', 'enterrement', 'funerail', 'obseque', 'perdu ma', 'perdu mon', 'perdu un', 'mort de', 'veillee funebre'] },
  urgence_fam:     { label: 'Urgence familiale', base: 74, kw: ['urgence familiale', 'urgence', 'enfant malade', 'accouch', 'mon fils', 'ma fille', 'ma mere malade', 'mon pere malade', 'proche a l', 'garde d\'enfant', 'probleme familial grave'] },
  examen:          { label: 'Examen / cours',   base: 66, kw: ['examen', 'compo', 'composition', 'concours', 'partiel', 'devoir surveille', 'soutenance', 'cours obligatoire', 'ecole', 'universite', 'rattrapage', 'stage obligatoire'] },
  travail:         { label: 'Obligation professionnelle', base: 60, kw: ['travail', 'boulot', 'service', 'garde', 'de garde', 'shift', 'patron', 'employeur', 'reunion de travail', 'mission professionnelle', 'astreinte', 'quart de nuit'] },
  transport:       { label: 'Probleme de transport', base: 46, kw: ['transport', 'panne', 'embouteillage', 'bouchon', 'circulation', 'route barree', 'accident de la route', 'bus', 'gbaka', 'moto en panne', 'vehicule en panne', 'greve des transports'] },
  voyage:          { label: 'Voyage / deplacement', base: 50, kw: ['voyage', 'deplacement', 'hors de la ville', 'au village', 'a l\'etranger', 'etranger', 'absent de la ville', 'en mission a'] },
};

/* Indices d'un motif qui ne tient pas la route. */
const MOTIFS_FAIBLES = ['oubli', 'flemme', 'pas envie', 'envie de rien', 'pas motive', 'dormi', 'dormais', 'reveil', 'pas reveille', 'leve tard', 'paresse', 'sortie entre amis', 'loisir', 'match de foot', 'film', 'serie', 'jeu video', 'trainer', 'traine', 'rien de special', 'ca me disait pas', 'pas eu envie', 'j\'avais la flemme', 'occupe a autre chose', 'fatigue' ];

/* Relie la categorie choisie dans le formulaire a une cle interne. */
function categorieToKey(cat) {
  const c = norm(cat);
  if (c.includes('hospital')) return 'hospitalisation';
  if (c.includes('malad')) return 'maladie';
  if (c.includes('deuil') || c.includes('deces')) return 'deuil';
  if (c.includes('urgence') || c.includes('familial')) return 'urgence_fam';
  if (c.includes('examen') || c.includes('cours') || c.includes('ecole')) return 'examen';
  if (c.includes('professionn') || c.includes('travail')) return 'travail';
  if (c.includes('transport')) return 'transport';
  if (c.includes('voyage') || c.includes('deplacement')) return 'voyage';
  return 'autre';
}

/*
  analyse({ statut, motif_categorie, details, prevenu, hasJustificatif, retard_minutes })
  statut : 'present' | 'absent' | 'retard'
*/
function analyse(input) {
  const statut = input.statut;
  const details = input.details || '';
  const prevenu = !!input.prevenu;
  const hasJustificatif = !!input.hasJustificatif;
  const retardMin = Number(input.retard_minutes) || 0;

  if (statut === 'present') {
    return { verdict: 'present', score: 100, categorie: null,
      explication: 'Presence declaree. Merci pour ta fidelite.' , facteurs: [] };
  }

  const texte = norm((input.motif_categorie || '') + ' ' + details);
  const facteurs = [];
  let score = 0;
  let categorieLabel = null;

  // 1) Poids de la categorie choisie
  const key = categorieToKey(input.motif_categorie);
  if (key !== 'autre' && MOTIFS_SERIEUX[key]) {
    score += MOTIFS_SERIEUX[key].base;
    categorieLabel = MOTIFS_SERIEUX[key].label;
    facteurs.push({ signe: '+', txt: 'Motif serieux : ' + categorieLabel });
  }

  // 2) Recherche de mots-cles serieux dans le texte (utile si "Autre")
  let bestKw = 0, bestLabel = null;
  for (const k in MOTIFS_SERIEUX) {
    const m = MOTIFS_SERIEUX[k];
    if (m.kw.some((w) => texte.includes(w))) {
      if (m.base > bestKw) { bestKw = m.base; bestLabel = m.label; }
    }
  }
  if (bestKw > 0) {
    if (bestKw > score) { score = bestKw; }
    if (!categorieLabel) { categorieLabel = bestLabel;
      facteurs.push({ signe: '+', txt: 'Raison identifiee : ' + bestLabel }); }
  }

  // 3) Motif faible / non credible
  const faible = MOTIFS_FAIBLES.find((w) => texte.includes(w));
  if (faible) {
    score -= 55;
    facteurs.push({ signe: '-', txt: 'La raison evoque un motif de convenance ("' + faible + '").' });
  }

  // 4) Justificatif transfere
  if (hasJustificatif) {
    score += 25;
    facteurs.push({ signe: '+', txt: 'Justificatif fourni.' });
  } else {
    facteurs.push({ signe: '-', txt: 'Aucun justificatif transfere.' });
  }

  // 5) Prevenu a l'avance
  if (prevenu) {
    score += 10;
    facteurs.push({ signe: '+', txt: 'Responsable prevenu a l\'avance.' });
  } else {
    facteurs.push({ signe: '-', txt: 'Absence/retard non annonce a l\'avance.' });
  }

  // 6) Indulgence pour un simple retard
  if (statut === 'retard') {
    score += 15;
    if (retardMin > 0 && retardMin <= 15) { score += 10;
      facteurs.push({ signe: '+', txt: 'Retard court (' + retardMin + ' min).' }); }
    else if (retardMin >= 45) { score -= 10;
      facteurs.push({ signe: '-', txt: 'Retard important (' + retardMin + ' min).' }); }
  }

  // 7) Qualite de l'explication
  const longueur = details.trim().length;
  if (key === 'autre' && longueur < 8) {
    score -= 25;
    facteurs.push({ signe: '-', txt: 'Explication trop vague ou absente.' });
  }

  // Borne
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Verdict
  let verdict;
  if (faible && !hasJustificatif) {
    verdict = 'non_valable';
  } else if (score >= 65) {
    verdict = 'valable';
  } else if (score >= 40) {
    verdict = 'a_verifier';
  } else {
    verdict = 'non_valable';
  }

  const intro = {
    valable: 'Motif valable. Cette ' + (statut === 'retard' ? 'arrivee tardive' : 'absence') + ' parait justifiee.',
    a_verifier: 'Motif plausible mais a confirmer' + (hasJustificatif ? '.' : ' — un justificatif est attendu.'),
    non_valable: 'Motif non valable. La raison avancee ne justifie pas cette ' + (statut === 'retard' ? 'arrivee tardive' : 'absence') + '.',
  }[verdict];

  return { verdict, score, categorie: categorieLabel, explication: intro, facteurs };
}

/* Libelles d'affichage. */
const VERDICT_LABEL = {
  present: 'Present',
  valable: 'Motif valable',
  a_verifier: 'A verifier',
  non_valable: 'Motif non valable',
};

module.exports = { analyse, VERDICT_LABEL };
