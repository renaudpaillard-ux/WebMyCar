# WebMyCar

Application desktop macOS de gestion de véhicule personnel.

## Objectif

WebMyCar permet de gérer localement :

- les véhicules
- les relevés kilométriques
- les pleins
- les entretiens
- les échéances
- les documents
- un tableau de bord synthétique

Application **local-first**, sans dépendance cloud.

---

## Stack technique

- Tauri v2
- React
- TypeScript
- Vite
- Rust
- SQLite

---

## Prérequis

- macOS
- Xcode Command Line Tools
- Homebrew
- Node.js (>= 20)
- Rust / Cargo

---

## Installation

```bash
npm install
```

---

## Lancer en développement

```bash
npm run tauri dev
```

---

## Build

```bash
npm run tauri build
```

---

## Structure du projet

```text
src/           # Frontend React
src-tauri/     # Backend Tauri (Rust)
docs/          # Documentation technique et fonctionnelle
```

---

## Conventions

- TypeScript strict
- composants React simples et lisibles
- logique métier côté Tauri / Rust
- stockage monétaire en centimes
- dates métier au format ISO `YYYY-MM-DD`

---

## Fonctionnalités prévues (V1)

- [ ] gestion des véhicules
- [ ] pleins (carburant)
- [ ] entretiens
- [ ] relevés kilométriques
- [ ] échéances (assurance, contrôle technique…)
- [ ] documents (factures, contrats…)
- [ ] tableau de bord
- [ ] sauvegarde / restauration

---

## Roadmap

Voir : `docs/ROADMAP.md`

---

## Licence

Propriétaire (à définir)

---

## Auteur

Renaud Paillard
