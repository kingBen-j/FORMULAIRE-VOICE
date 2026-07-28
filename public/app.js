/* ============================================================
   VOICE OF GOD — Script du site public
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let CONTACT = { whatsapp: '2250711025713', email: '' };

  /* ---------- Annee (pied de page) ---------- */
  const yEl = $('#year');
  if (yEl) yEl.textContent = new Date().getFullYear();

  /* ---------- Contacts (via /api/config) ---------- */
  fetch('/api/config')
    .then((r) => r.json())
    .then((cfg) => {
      CONTACT = cfg || CONTACT;
      const wa = $('#waFooter');
      if (wa && CONTACT.whatsapp) wa.href = 'https://wa.me/' + CONTACT.whatsapp;
      const mail = $('#mailFooter');
      if (mail) {
        if (CONTACT.email) {
          mail.href = 'mailto:' + CONTACT.email;
          mail.textContent = '✉️ ' + CONTACT.email;
        } else {
          mail.style.display = 'none';
        }
      }
    })
    .catch(() => {});

  /* ---------- Nav : ombre au scroll ---------- */
  const nav = $('#nav');
  if (nav) {
    addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 20), { passive: true });
  }

  /* ---------- Reveal a l'apparition ---------- */
  const reveals = $$('[data-reveal]');
  if (reduce) {
    reveals.forEach((el) => el.classList.add('in'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---------- Onde sonore (hero) ---------- */
  (function wave() {
    const cv = $('#wave');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, t = 0;

    function resize() {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = cv.width = innerWidth * d;
      h = cv.height = cv.offsetHeight * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    resize();
    addEventListener('resize', resize);

    function draw() {
      const W = innerWidth, H = cv.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const mid = H * 0.52;
      const layers = [
        { amp: 46, freq: 0.006, sp: 0.9, a: 0.35 },
        { amp: 30, freq: 0.011, sp: 1.5, a: 0.22 },
        { amp: 66, freq: 0.004, sp: 0.5, a: 0.15 },
      ];
      for (const L of layers) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y =
            mid +
            Math.sin(x * L.freq + t * L.sp) * L.amp * Math.sin(x * 0.0016 + t * 0.2);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(212,175,106,' + L.a + ')';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      t += 0.02;
    }

    if (reduce) {
      draw();
    } else {
      (function loop() {
        draw();
        requestAnimationFrame(loop);
      })();
    }
  })();

  /* ---------- Champs conditionnels (chant / instruments) ---------- */
  const depBoxes = $$('input[name="departement"]');
  function syncConditional() {
    const chant = $$('input[name="departement"][data-toggle="chant"]').some((i) => i.checked);
    const instru = $$('input[name="departement"][data-toggle="instru"]').some((i) => i.checked);
    const cChant = $('#cond-chant');
    const cInstru = $('#cond-instru');
    if (cChant) cChant.classList.toggle('show', chant);
    if (cInstru) cInstru.classList.toggle('show', instru);
  }
  depBoxes.forEach((b) => b.addEventListener('change', syncConditional));
  syncConditional();

  /* ---------- Formulaire ---------- */
  const form = $('#vogForm');
  const submitBtn = $('#submitBtn');
  const formError = $('#formError');
  const depErr = $('#depErr');
  const engErr = $('#engErr');

  function collect() {
    const val = (n) => {
      const el = form.querySelector('[name="' + n + '"]');
      return el ? el.value.trim() : '';
    };
    const many = (n) => $$('input[name="' + n + '"]:checked', form).map((i) => i.value);
    return {
      nom: val('nom'),
      age: val('age'),
      sexe: val('sexe'),
      ville: val('ville'),
      tel: val('tel'),
      email: val('email'),
      eglise: val('eglise'),
      conversion: val('conversion'),
      bapteme: many('bapteme'),
      departement: many('departement'),
      tessiture: val('tessiture'),
      instrument: val('instrument'),
      niveau: val('niveau'),
      experience: val('experience'),
      dispo: many('dispo'),
      motivation: val('motivation'),
      engagement: $('#engagement') ? $('#engagement').checked : false,
      website: (form.querySelector('[name="website"]') || {}).value || '',
    };
  }

  function buildWaMessage(d) {
    const L = [];
    L.push('*Nouvelle candidature VOG*');
    L.push('Nom : ' + d.nom);
    if (d.age) L.push('Age : ' + d.age);
    if (d.ville) L.push('Ville : ' + d.ville);
    L.push('Tel : ' + d.tel);
    if (d.departement.length) L.push('Departement(s) : ' + d.departement.join(', '));
    return L.join('\n');
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (formError) formError.textContent = '';
      if (depErr) depErr.textContent = '';
      if (engErr) engErr.textContent = '';

      const data = collect();

      // Departement : au moins un
      if (!data.departement.length) {
        if (depErr) depErr.textContent = 'Choisis au moins un département.';
        const g = $('#depGroup');
        if (g) g.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // Validation native (nom, age, ville, tel, motivation, engagement requis)
      if (!form.checkValidity()) {
        if (engErr && $('#engagement') && !$('#engagement').checked) {
          engErr.textContent = 'Merci de confirmer ton engagement.';
        }
        form.reportValidity();
        return;
      }

      const original = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi…';
      }

      try {
        const res = await fetch('/api/candidatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) {
          throw new Error(out.error || 'Envoi impossible. Réessaie dans un instant.');
        }

        // Succes
        const wa = $('#successWa');
        if (wa) wa.href = 'https://wa.me/' + CONTACT.whatsapp + '?text=' + encodeURIComponent(buildWaMessage(data));
        const scr = $('#successScreen');
        if (scr) {
          scr.classList.add('show');
          scr.setAttribute('aria-hidden', 'false');
        }
        form.reset();
        syncConditional();
      } catch (err) {
        if (formError) formError.textContent = err.message || 'Une erreur est survenue.';
        else alert(err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = original || 'Envoyer ma candidature';
        }
      }
    });
  }

  /* ---------- Fermeture ecran succes ---------- */
  const closeBtn = $('#successClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const scr = $('#successScreen');
      if (scr) {
        scr.classList.remove('show');
        scr.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* ---------- PWA : bouton « Installer » ---------- */
  let deferredPrompt = null;
  const installBtn = $('#installBtn');
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-block';
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }
  addEventListener('appinstalled', () => { if (installBtn) installBtn.style.display = 'none'; });
})();
