# 🎧 Voice of God — Site + Formulaire (déployable sur Render)

Application web complète pour **Voice of God (VOG)** :

- 🔥 une **page vision** cinématographique (noir + or) qui présente la vision, les objectifs, la mission et les départements du groupe ;
- 📝 un **formulaire d'adhésion** stylé et vibrant ;
- 🗄️ un **backend** qui enregistre chaque candidature dans une **base de données** ;
- 🔐 un **tableau de bord admin** protégé par mot de passe (recherche, filtres, statuts, export Excel/CSV).

---

## 📁 Contenu du projet

| Fichier / dossier | Rôle |
|---|---|
| `server.js` | Le serveur (Express) : sert le site, reçoit les candidatures, protège l'admin. |
| `db.js` | Base de données — **PostgreSQL** en ligne, **SQLite** en local (automatique). |
| `public/index.html` | La page publique (vision + formulaire). |
| `public/app.js` | Le script du formulaire (envoi + écran de confirmation). |
| `public/login.html` | La page de connexion admin. |
| `public/admin.html` | Le tableau de bord des candidatures. |
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
