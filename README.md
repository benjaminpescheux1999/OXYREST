# OxyRest API

API Node.js/TypeScript pour piloter les utilitaires OXYDRIVER:

- versionning API
- negociation version API <-> version utilitaire
- identification utilitaire par `accessKey`
- mapping `clientToken -> utilitaire`
- proxy des requetes client vers le passe-plat expose par Cloudflare
- gestion de cles API (creation, liste, revocation)

## Installation

```powershell
cd .\OxyRest
npm install
```

Copier ensuite les variables:

```powershell
Copy-Item .env.example .env
```

## Lancer

`npm run dev` (tsx) ou `npm run build && npm start`

Par defaut: `http://localhost:8080`

Variables d'environnement utiles:

- `ADMIN_API_KEY` (defaut dev: `dev-admin-key-change-me`)
- `TOKEN_PEPPER` (defaut dev: `dev-pepper-change-me`)
- `UTILITY_DOWNLOADS_JSON` (catalogue multi-version des binaires utilitaire)
- `SFTP_*` (si tu actives le telechargement SFTP chiffre pour l'update)

## Endpoints

- `GET /system/health`
- `GET /system/versions`
- `POST /utility/negotiate`
- `POST /utility/sync`
- `POST /client/bind`
- `POST /client/proxy`
- `POST /admin/tokens` (admin)
- `GET /admin/tokens` (admin)
- `POST /admin/tokens/:tokenId/revoke` (admin)

## Exemples rapides

Negociation:

```json
POST /utility/negotiate
{
  "utilityVersion": "0.1.0",
  "accessKey": "BREST-UTILITY-KEY"
}
```

Creer une cle API client (admin):

```json
POST /admin/tokens
headers: { "x-admin-key": "dev-admin-key-change-me" }
{
  "label": "Client Brest",
  "scopes": ["sync", "proxy"]
}
```

La reponse renvoie `token` en clair une seule fois. Cette valeur doit etre copiee dans l'utilitaire (champ Cle d'acces).

## Versionning utilitaire -> fonctionnalités

- Utilitaire `0.1.0.0` : `CLIEN.CLIEN`, `CLIEN.NOM`, `CLIEN.PRENO`
- Utilitaire `0.1.0.1` : idem + `CLIEN.TELDO`

Le catalogue fonctionnel est renvoye par:
- `POST /utility/negotiate`
- `POST /utility/sync`

Sync utilitaire:

```json
POST /utility/sync
{
  "app": "OXYDRIVER",
  "utilityVersion": "0.1.0",
  "accessKey": "BREST-UTILITY-KEY",
  "tunnelUrl": "https://xxxx.trycloudflare.com",
  "capabilities": {
    "read": true,
    "write": false
  }
}
```

Binder un token client vers utilitaire:

```json
POST /client/bind
{
  "clientToken": "token-client-espace-brest",
  "accessKey": "BREST-UTILITY-KEY"
}
```

Proxy vers utilitaire cible via token client:

```json
POST /client/proxy
headers: { "x-client-token": "token-client-espace-brest" }
{
  "targetPath": "/health",
  "method": "GET"
}
```

## Stockage

Stockage local JSON dans `./data/db.json`.

## GitHub (publier le repo API seul)

Depuis `OxyRest`:

```powershell
git init
git add .
git commit -m "init: oxyrest typescript api"
git branch -M main
git remote add origin https://github.com/<TON_USER>/<TON_REPO>.git
git push -u origin main
```

## Deploiement Render

Le fichier `render.yaml` est inclus.  
Deux options:

- Blueprint (recommande): Render lit `render.yaml` automatiquement.
- Manuel: creer un "Web Service", root directory `OxyRest`, build `npm ci && npm run build`, start `npm run start`.

Variables a definir dans Render:

- `ADMIN_API_KEY`
- `TOKEN_PEPPER`
- `UTILITY_DOWNLOADS_JSON`
- `SFTP_HOST`, `SFTP_USERNAME`, `SFTP_PASSWORD`, `SFTP_REMOTE_BASE_PATH` (si updates SFTP)

