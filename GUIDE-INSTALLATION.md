# 🎧 Voice of God — Guide d'utilisation

Ton site fonctionne en **mode WhatsApp** : quand un jeune remplit le formulaire et clique « Envoyer », sa candidature s'ouvre **déjà rédigée dans WhatsApp**, prête à t'être envoyée. Simple, gratuit, rien à installer. ✅

| Fichier | Rôle |
|---|---|
| `index.html` | Ton site (vision + formulaire + tableau de bord admin) |
| `logo-vog.png` | Ton logo détouré (fond transparent) |
| `google-apps-script.gs` | *(optionnel/avancé)* pour collecter aussi dans un Google Sheet |
| `GUIDE-INSTALLATION.md` | Ce guide |

---

## ⚙️ Étape 1 — Mettre TON numéro WhatsApp (indispensable)

1. Clic droit sur `index.html` → **Ouvrir avec** → **Bloc-notes**.
2. Tout en haut du bloc `CONFIG`, trouve la ligne :

```js
WHATSAPP:    "2250700000000",   // ← ⚠️ REMPLACE par le vrai numéro du groupe
```

3. Remplace `2250700000000` par **le vrai numéro** du groupe, en **chiffres seulement** :
   - indicatif pays **sans le +**, puis le numéro **sans espaces**
   - Exemple Côte d'Ivoire, numéro `07 07 12 34 56` → on écrit **`2250707123456`**
4. (Facultatif) change aussi `EMAIL` et le code `ADMIN_PIN` juste en dessous.
5. **Enregistre** (Ctrl + S).

> 💡 Le même numéro s'affiche automatiquement en bas de la page (bouton WhatsApp du pied de page).

---

## 🧪 Étape 2 — Tester

Double-clique sur `index.html`, remplis le formulaire, clique **Envoyer** :
→ une fenêtre s'ouvre avec le bouton **« Envoyer sur WhatsApp »** → clique-le → WhatsApp s'ouvre avec la candidature déjà écrite. 🎉

---

## 🌍 Étape 3 — Mettre en ligne (pour partager un lien)

Pour que les candidats accèdent au formulaire depuis leur téléphone :

- **Le plus simple — [Netlify Drop](https://app.netlify.com/drop)** : glisse-dépose ton fichier `index.html`, tu obtiens un **lien** à partager (WhatsApp, Instagram, statut…).
  - Astuce : mets `index.html` **et** `logo-vog.png` dans un même dossier, puis glisse le dossier.
- Autres options gratuites : GitHub Pages, Cloudflare Pages, Vercel.

---

## 📊 Ton tableau de bord (bonus)

Même en mode WhatsApp, un tableau de bord est intégré : ajoute **`#admin`** à l'adresse (ou clique « Espace admin »), code **`VOG2026`**.

> Il affiche les candidatures **saisies sur cet appareil** (utile pour des inscriptions en présentiel, ex : une tablette à la sortie du culte). Les candidatures reçues par WhatsApp, elles, restent dans ta conversation WhatsApp.

---

## 🔧 Personnalisation rapide

| Je veux changer… | Où (dans `index.html`) |
|---|---|
| Le numéro WhatsApp | `WHATSAPP` dans le bloc `CONFIG` |
| L'email de contact | `EMAIL` dans le bloc `CONFIG` |
| Le code admin | `ADMIN_PIN` dans le bloc `CONFIG` |
| Les questions du formulaire | Section `<form id="vogForm">` |
| Les textes de la vision | Les sections `<section class="band">` |

---

## 🗄️ (Optionnel / avancé) Tout collecter dans un Google Sheet

Si un jour tu veux **en plus** un tableau Excel/Google Sheet qui rassemble toutes les réponses automatiquement, le fichier `google-apps-script.gs` est prêt. Dis-le-moi, on le mettra en place ensemble — mais ce n'est **pas nécessaire** pour que ton site marche.

---

*Que Dieu bénisse VOG. 🙏 « Toucher le monde par l'adoration authentique. »*
