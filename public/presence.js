/* ============================================================
   VOICE OF GOD — Formulaire de présence (côté membre)
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Date du jour par défaut */
  const d = new Date();
  $('#date_seance').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  /* Membres -> datalist + auto-remplissage du poste */
  let MEMBRES = [];
  fetch('/api/membres').then((r) => r.json()).then((out) => {
    MEMBRES = out.membres || [];
    $('#membresList').innerHTML = MEMBRES.map((m) => `<option value="${esc(m.nom)}">${esc(m.poste || '')}</option>`).join('');
  }).catch(() => {});

  $('#nom').addEventListener('change', () => {
    const m = MEMBRES.find((x) => x.nom.toLowerCase() === $('#nom').value.trim().toLowerCase());
    if (m) {
      $('#membre_id').value = m.id;
      if (m.poste && !$('#poste').value) $('#poste').value = m.poste;
    } else {
      $('#membre_id').value = '';
    }
  });

  /* Champs conditionnels selon le statut */
  function syncStatut() {
    const val = (document.querySelector('input[name="statut"]:checked') || {}).value;
    $('#cond-motif').classList.toggle('show', val === 'absent' || val === 'retard');
    $('#cond-retard').classList.toggle('show', val === 'retard');
  }
  [...document.querySelectorAll('input[name="statut"]')].forEach((r) => r.addEventListener('change', syncStatut));

  /* Nom du fichier choisi (retour visuel) */
  const fileInput = $('#justificatif');
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f && f.size > 6 * 1024 * 1024) { $('#err').textContent = 'Le fichier dépasse 6 Mo.'; fileInput.value = ''; }
    else { $('#err').textContent = ''; }
  });

  /* Verdict */
  const VMAP = {
    valable: { emo: '✓', titre: 'Motif valable' },
    a_verifier: { emo: '⚠', titre: 'À vérifier' },
    non_valable: { emo: '✕', titre: 'Motif non valable' },
    present: { emo: '🙌', titre: 'Présence enregistrée' },
  };
  function showVerdict(v) {
    const box = $('#verdict');
    box.className = 'card verdict show ' + v.verdict;
    const info = VMAP[v.verdict] || VMAP.present;
    $('#vhalo').textContent = info.emo;
    $('#vtitle').textContent = info.titre;
    $('#vexp').textContent = v.explication || (v.verdict === 'present' ? 'Merci pour ta fidélité. Que Dieu te bénisse.' : '');
    $('#vscore').textContent = (v.verdict !== 'present' && v.score != null) ? 'Crédibilité du motif : ' + v.score + '/100' : '';
    $('#vfact').innerHTML = (v.facteurs || []).map((f) => `<div class="${f.signe === '+' ? 'p' : 'm'}">${f.signe === '+' ? '✔' : '✕'} ${esc(f.txt)}</div>`).join('');
    $('#vengine').textContent = v.moteur === 'ia' ? 'Analyse par intelligence artificielle' : (v.verdict === 'present' ? '' : 'Analyse automatique');
    $('#presForm').style.display = 'none';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#againBtn').addEventListener('click', () => {
    $('#verdict').className = 'card verdict';
    const form = $('#presForm');
    form.reset();
    form.style.display = '';
    $('#membre_id').value = '';
    $('#date_seance').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    syncStatut();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* Soumission */
  const form = $('#presForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#err').textContent = '';
    const statut = (document.querySelector('input[name="statut"]:checked') || {}).value;
    if (!$('#nom').value.trim()) { $('#err').textContent = 'Indique ton nom.'; return; }
    if (!statut) { $('#err').textContent = 'Choisis ta présence, ton retard ou ton absence.'; return; }
    if ((statut === 'absent' || statut === 'retard') && !$('#motif_categorie').value && !$('#details').value.trim()) {
      $('#err').textContent = 'Indique un motif ou une explication.'; return;
    }

    const btn = $('#submitBtn'); const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Analyse en cours…';
    try {
      const fd = new FormData(form);
      const res = await fetch('/api/presence', { method: 'POST', body: fd });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'Envoi impossible. Réessaie.');
      showVerdict(out);
    } catch (e2) {
      $('#err').textContent = e2.message;
    } finally {
      btn.disabled = false; btn.textContent = original;
    }
  });

  /* PWA : bouton installer */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#installBtn').style.display = 'inline-block';
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').style.display = 'none';
  });
})();
