# 🎧 Voice of God — Site + Formulaire (déployable sur Render)

Application web complète pour **Voice of God (VOG)** :

- 🔥 une **page vision** cinématographique (noir + or) : vision, valeurs, objectifs, mission, départements ;
- 📝 un **formulaire d'adhésion** stylé et vibrant ;
- 🗓️ un **espace présence** (`/presence`) : les membres déclarent présence / absence / retard, transfèrent un **justificatif**, et le site **analyse le motif** et dit s'il tient la route ;
- 🤖 une **analyse intelligente** des motifs : **IA Claude** si une clé API est configurée, sinon un moteur de **règles** intégré (gratuit) ;
- 👥 un **registre des membres** (nom + poste) géré depuis l'admin ;
- 🗄️ un **backend** qui enregistre tout dans une **base de données** ;
- 🔐 un **tableau de bord admin** protégé (candidatures, présences, membres, filtres, export Excel/CSV) ;
- 📲 une **PWA installable** : l'app se télécharge sur le téléphone (icône sur l'écran d'accueil).

---

## 📁 Contenu du projet

| Fichier / dossier | Rôle |
|---|---|
| `server.js` | Le serveur (Express) : site, candidatures, présences, admin, upload. |
| `db.js` | Base de données — **PostgreSQL** en ligne, **SQLite** en local (automatique). |
| `analyze.js` | Analyse des motifs par **règles** (repli gratuit). |
| `analyze-ai.js` | Analyse des motifs par **IA Claude** (si `ANTHROPIC_API_KEY`). |
| `public/index.html` | La page publique (vision + valeurs + formulaire). |
| `public/presence.html` · `presence.js` | L'espace présence des membres (questionnaire + verdict). |
| `public/login.html` | La page de connexion admin. |
| `views/admin.html` · `presences.html` · `membres.html` | Les 3 espaces admin (protégés). |
| `public/manifest.webmanifest` · `service-worker.js` · `icons/` | La PWA (installation + hors-ligne). |
| `public/logo-vog.png` | Le logo. |
| `render.yaml` | Configuration automatique pour Render (site + base de données). |
| `.env.example` | Modèle des variables d'environnement. |

---

## 🚀 Déploiement sur Render (méthode simple, recommandée)

> Cette méthode crée **automatiquement** le site **et** une base de données PostgreSQL gratuite, grâce au fichier `render.yaml`.

### 1) Mettre le projet sur GitHub
1. Crée un compte sur [github.com](https://github.com) (gratuit).
2. Crée un dépôt (repository) vide, ex. `voice-of-god`.
3. Envoie ce dossier dedans. Depuis ce dossier, dans un terminal :
   ```bash
   git init
   git add .
   git commit -m "Voice of God — site + formulaire"
   git branch -M main
   git remote add origin https://github.com/TON-COMPTE/voice-of-god.git
   git push -u origin main
   ```

### 2) Créer le service sur Render
1. Crée un compte sur [render.com](https://render.com) (gratuit).
2. Clique **New +** → **Blueprint**.
3. Connecte ton compte GitHub et choisis le dépôt `voice-of-god`.
4. Render lit `render.yaml` et propose de créer : le **site web** + la **base PostgreSQL**. Clique **Apply**.
5. Il te demandera de saisir **`ADMIN_PASSWORD`** → mets **ton mot de passe admin** (celui qui ouvrira le tableau de bord). ⚠️ Note-le bien.
6. Attends quelques minutes : Render installe et met en ligne.

### 3) C'est en ligne 🎉
- Ton site : `https://voice-of-god.onrender.com` (l'adresse exacte s'affiche dans Render).
- Le tableau de bord : `https://voice-of-god.onrender.com/admin` (mot de passe = `ADMIN_PASSWORD`).

---

## 🛠️ Déploiement manuel (si tu ne veux pas utiliser `render.yaml`)

1. **New +** → **Web Service** → choisis ton dépôt GitHub.
2. Réglages :
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
3. **New +** → **PostgreSQL** (plan Free) → crée la base, puis copie son **Internal Database URL**.
4. Dans le Web Service → onglet **Environment**, ajoute :

| Clé | Valeur |
|---|---|
| `DATABASE_URL` | *(colle l'Internal Database URL de ta base Postgres)* |
| `ADMIN_PASSWORD` | *(ton mot de passe admin)* |
| `SESSION_SECRET` | *(une longue chaîne aléatoire quelconque)* |
| `CONTACT_WHATSAPP` | `2250711025713` *(le numéro du groupe, chiffres seulement)* |
| `CONTACT_EMAIL` | *(email du groupe, ou laisse vide)* |
| `ANTHROPIC_API_KEY` | *(facultatif — active l'analyse IA des motifs)* |
| `NODE_ENV` | `production` |

5. **Save** → Render redéploie. ✅

---

## 🔑 Les variables d'environnement

| Clé | À quoi ça sert | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | Mot de passe du tableau de bord `/admin`. **Change-le !** | `VOG2026` |
| `SESSION_SECRET` | Sécurise les sessions admin. Mets une longue chaîne aléatoire. | *(à définir)* |
| `DATABASE_URL` | Base PostgreSQL (fournie par Render). Vide en local → SQLite. | *(vide)* |
| `CONTACT_WHATSAPP` | Numéro WhatsApp affiché en pied de page (chiffres, sans `+`). | `2250711025713` |
| `CONTACT_EMAIL` | Email de contact en pied de page (vide = masqué). | *(vide)* |
| `ANTHROPIC_API_KEY` | *(facultatif)* Active l'analyse **par IA Claude**. Vide → analyse par règles. | *(vide)* |
| `ANALYSE_MODEL` | Modèle IA utilisé. `claude-haiku-4-5` pour réduire le coût. | `claude-opus-4-8` |

---

## 🗓️ Espace présence & analyse des motifs

- Les membres vont sur **`ton-site.onrender.com/presence`** (lien partageable, ou raccourci de l'app installée).
- Ils choisissent **Présent / Absent / En retard**, indiquent un **motif**, une **explication**, et peuvent **transférer un justificatif** (photo ou PDF).
- Le site **analyse le motif** et affiche immédiatement un **verdict** : *Motif valable ✅ / À vérifier ⚠️ / Non valable ❌*, avec les raisons.
- Le responsable retrouve tout dans **Admin → 🗓️ Présences** (statistiques, filtres, verdicts, et les justificatifs à télécharger).
- **Les membres** (nom + poste) s'ajoutent dans **Admin → 👥 Membres** ; ils apparaissent alors en suggestion dans le formulaire de présence.

### 🤖 Analyse par IA (facultatif)

Sans rien configurer, l'analyse marche déjà avec un **moteur de règles** intégré (gratuit). Pour une analyse **par intelligence artificielle (Claude)** :

1. Crée une clé sur **[console.anthropic.com](https://console.anthropic.com)** (avec un peu de crédit).
2. Ajoute la variable **`ANTHROPIC_API_KEY`** sur Render (onglet Environment).
3. Redéploie. Les verdicts porteront alors la mention **« analyse IA »**.

> 💡 Chaque analyse coûte quelques centimes. Pour réduire le coût, mets `ANALYSE_MODEL=claude-haiku-4-5`.

---

## 📲 Installer l'app sur le téléphone (PWA)

L'app est **installable** : sur le téléphone, ouvre le site dans **Chrome (Android)** ou **Safari (iPhone)**.

- **Android / Chrome** : bouton **« ⤓ Installer »** en haut, ou menu ⋮ → *Installer l'application*.
- **iPhone / Safari** : bouton **Partager** → *Sur l'écran d'accueil*.

Une icône VOG apparaît sur l'écran d'accueil, comme une vraie application.

---

## 💾 Où sont stockées les candidatures ?

- **En ligne (Render + PostgreSQL)** : les candidatures sont **conservées durablement** dans la base PostgreSQL. Elles ne se perdent pas quand le service se met en veille ou redémarre.
- **En local (sans `DATABASE_URL`)** : une base **SQLite** est créée dans `./data/vog.db` (utile pour tester sur ton ordinateur).

> 💡 Depuis le tableau de bord, le bouton **« Export Excel/CSV »** télécharge toutes les candidatures — pratique pour garder une copie de sauvegarde.

---

## 🧑‍💻 Tester sur ton ordinateur (facultatif)

Il faut [Node.js](https://nodejs.org) installé. Ensuite, dans ce dossier :

```bash
npm install
npm start
```

Ouvre ensuite **http://localhost:3000**. Le tableau de bord : **http://localhost:3000/admin** (mot de passe par défaut `VOG2026`).

---

## ✏️ Personnaliser

| Je veux changer… | Où |
|---|---|
| Le mot de passe admin | Variable `ADMIN_PASSWORD` (sur Render). |
| Le numéro WhatsApp / l'email | Variables `CONTACT_WHATSAPP` / `CONTACT_EMAIL`. |
| Les textes de la vision | `public/index.html` (les sections `<section class="band">`). |
| Les questions du formulaire | `public/index.html` (le `<form id="vogForm">`). |
| Le logo | Remplace `public/logo-vog.png`. |

Après un changement de fichier : `git add . && git commit -m "maj" && git push` → Render redéploie tout seul.

---

*Que Dieu bénisse VOG. 🙏 « Toucher le monde par l'adoration authentique. »*
