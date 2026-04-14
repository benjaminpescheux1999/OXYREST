# Securite du mot de passe UI - OXYDRIVER

Ce document explique le mecanisme de securite lie au mot de passe d'acces a l'interface OXYDRIVER, ainsi que le flux complet entre l'API `OxyRest` et l'application desktop.

## Objectifs

- Generer un mot de passe initial de maniere aleatoire et securisee.
- Eviter la conservation durable du mot de passe cote API.
- Transmettre ce mot de passe une seule fois via la synchronisation API.
- Forcer l'utilisateur a changer ce mot de passe a la premiere connexion.
- Gerer le cas "mot de passe oublie" avec un message explicite.

## Vue d'ensemble du flux

1. Un token est cree cote admin API.
2. Un mot de passe UI temporaire est genere de facon securisee.
3. Lors d'une synchronisation `POST /utility/sync`, ce mot de passe est renvoye a OXYDRIVER.
4. Juste apres lecture, l'API efface ce mot de passe temporaire (one-shot).
5. OXYDRIVER le sauvegarde localement et marque `UiPasswordMustChange = true`.
6. A la connexion suivante, l'utilisateur doit definir un nouveau mot de passe.
7. Une fois modifie, le flag est retire (`UiPasswordMustChange = false`).

---

## Cote API (`OxyRest`)

### 1) Generation securisee du mot de passe temporaire

Lors de la creation du token, l'API genere un mot de passe avec :

- `crypto.randomBytes(18).toString("base64url")`

Cela fournit une entropie elevee et une valeur non previsible.

### 2) Envoi one-shot a OXYDRIVER

Dans la route de sync (`/utility/sync`) :

- l'API lit le mot de passe temporaire associe au token,
- le retourne dans `uiPassword`,
- puis le remet immediatement a vide en base.

Consequence :

- le mot de passe temporaire n'est plus disponible pour les sync suivantes,
- il ne reste pas stocke durablement cote API.

### 3) Reinitialisation admin

En cas d'oubli, la route admin de reset peut poser un nouveau mot de passe temporaire.  
Ce nouveau mot de passe suit ensuite le meme cycle one-shot a la prochaine sync.

---

## Cote OXYDRIVER (application desktop)

### 1) Reception du `uiPassword`

Pendant la synchronisation API :

- si `uiPassword` est present dans la reponse,
- OXYDRIVER met a jour `Settings.UiPassword`,
- et force `Settings.UiPasswordMustChange = true`.

### 2) Stockage local

Le mot de passe UI est stocke dans `AppSettings` et protege via DPAPI dans `AppSettingsStore` (`Protect/TryUnprotect`).

### 3) Premiere connexion obligatoire avec changement

Au moment de l'authentification :

- l'utilisateur saisit le mot de passe recu,
- si `UiPasswordMustChange` est `true`, une fenetre impose la definition d'un nouveau mot de passe,
- tant que ce changement n'est pas valide, l'acces a l'UI est bloque.

Une fois valide :

- le nouveau mot de passe remplace l'ancien,
- `UiPasswordMustChange` passe a `false`.

### 4) Session

La session UI reste active 30 minutes.  
Au-dela, un nouvel ecran d'authentification est demande.

---

## Mot de passe oublie / recuperation (UI)

Dans la fenetre de login, deux actions sont disponibles :

- **Mot de passe oublie ?**
- **Recuperer via API**

### Bouton "Mot de passe oublie ?"

Au clic, le message affiche est :

> "Veuillez contacter l'editeur pour reinitialiser votre mot de passe."

### Bouton "Recuperer via API"

Ce flux permet de recuperer un mot de passe temporaire **avant** de pouvoir entrer dans l'application.

1. L'utilisateur saisit l'URL API et la cle d'acces (token OXYDRIVER).
2. OXYDRIVER lance une synchronisation API.
3. Si `uiPassword` est present:
   - il est stocke localement,
   - `UiPasswordMustChange = true` est active.
4. L'utilisateur se connecte avec ce mot de passe temporaire.
5. Le changement de mot de passe est ensuite impose.

Si l'API ne renvoie pas de `uiPassword`, cela signifie en pratique qu'aucun mot de passe temporaire n'est disponible (deja consomme ou reset admin non effectue).

---

## Propriete de securite obtenue

- Mot de passe initial aleatoire et robuste.
- Transmission API limitee a une seule utilisation.
- Non conservation durable cote API apres delivrance.
- Rotation forcee au premier usage cote client.
- Flux de recuperation controle (reset admin).

## Limite assumee

Pour permettre la remise lors de la premiere sync, l'API doit conserver temporairement une valeur avant delivrance.  
Le modele actuel minimise cette retention en supprimant la valeur immediatement apres l'envoi.

