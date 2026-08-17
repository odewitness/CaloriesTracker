# CaloriesTracker

App personnelle de suivi calorique. React 18 + Vite, backend Supabase, déployée sur Netlify (auto-deploy sur push vers `main`). Repo GitHub : `odewitness/CaloriesTracker`.

## Commandes

- `npm run dev` — serveur de dev local
- `npm run build` — build de prod. **Erreur connue et sans gravité** : `Dynamic require of "workbox-build" is not supported` (vite-plugin-pwa). Elle existait déjà avant tout refactor, elle ne bloque pas le build Netlify (confirmé en prod) — ignorer cette erreur précise, ne pas essayer de la "corriger" sans que ce soit explicitement demandé.
- Ne pas lancer de serveur de dev ni de tests navigateur automatisés (chromium-cli, Playwright, etc.) : l'utilisateur teste lui-même manuellement sur `http://localhost:5173`. Se limiter à `npm run build` pour vérifier que ça compile, puis laisser l'utilisateur valider le comportement.

## Environnement

- Pas de fichier `.env` : les identifiants Supabase sont en dur dans `src/lib/supabase.js`.
- Il n'y a pas de séparation dev/prod : `npm run dev` en local se connecte à la vraie base de données de production. Prudence sur toute opération destructive testée en local.

## Convention de nommage

- Identifiants de code (variables, fonctions, composants, fichiers) : **en anglais**.
- Champs de données Supabase (ex. `nom`, `nb_portions`, `repas_types`, `repas_planifies`) et tout texte visible par l'utilisateur (UI) : **en français**, ne pas renommer — un renommage de champ Supabase nécessiterait une migration de la vraie base de production, hors de portée d'une session locale.

## Workflow git préféré

- Changements ponctuels/mécaniques (petits refactors, corrections de bug ciblées) : commit direct sur `main`, push après confirmation.
- Changements plus gros ou risqués (migration, découpage de fichiers majeurs) : créer une branche dédiée, vérifier (`npm run build` + test manuel dans le navigateur), puis merge + push vers `main` après confirmation.
- Toujours demander confirmation avant un `git push`, même sur des changements mineurs.

## Changelog "Nouveautés" (icône cloche du header)

- `src/lib/changelog.js` alimente la page "Nouveautés" (icône cloche à droite du calendrier dans le header, `src/pages/WhatsNewPage.jsx`). C'est un fil conducteur destiné à l'utilisatrice de l'app pour qu'elle voie les évolutions sans lire le code.
- **À chaque push sur `main` qui apporte un changement visible pour l'utilisatrice** (nouvelle fonctionnalité, refonte d'écran, correction de bug gênant), ajouter une entrée en tête de `CHANGELOG` dans `src/lib/changelog.js` : `{ date: 'YYYY-MM-DD', title, description }`.
- Ton des entrées : **tutoiement**, écrit directement à l'utilisatrice ("tu peux maintenant...", "quand tu ouvres..."), comme si on lui expliquait de vive voix. Concret et orienté usage : ce que ça change pour elle dans l'app, pas comment c'est construit. Aucun jargon technique (pas de "composant", "refonte", "onglet API", noms de fichiers/commits) — si un terme d'interface est nécessaire (ex. "onglet", "filtre"), l'utiliser tel qu'elle le voit à l'écran, pas comme terme de dev. Titre court et parlant, description en une ou deux phrases simples.
- Ne pas ajouter d'entrée pour les changements purement internes (refactor, nettoyage, migration technique, dépendances) sans impact perceptible par l'utilisatrice.
- Le point rouge sur la cloche (badge "non lu") se base sur la date la plus récente du changelog comparée à une valeur stockée dans `localStorage` — pas d'action requise à ce sujet, ça se met à jour automatiquement dès qu'une nouvelle entrée est ajoutée.

## Schéma Supabase

- `supabase_schema.sql` à la racine documente le schéma de la vraie base de production (tables, colonnes, index, RLS). Ce n'est pas un script d'installation à rejouer tel quel, c'est une référence pour Claude Code.
- **À chaque modification du schéma de la base** (nouvelle table, colonne ajoutée/supprimée, changement de contrainte, RLS activé/désactivé) faite dans le cadre d'une session, mettre à jour `supabase_schema.sql` en conséquence dans le même changement.
- Comme il n'y a pas d'accès direct à la base depuis cette session (pas de CLI Supabase connectée), le fichier peut diverger de la vraie base si des changements sont faits ailleurs (SQL editor Supabase, autre session). Si un doute apparaît sur son exactitude, demander à l'utilisatrice de fournir un extrait à jour plutôt que de supposer.

## Notes utiles

- Le hook `useBackButton.js` gère le bouton retour Android/navigateur via `history.pushState`/`popstate` — indépendant du routing React Router (`react-router-dom`), ne change jamais le pathname de l'URL.
- Pas d'`ErrorBoundary` dans l'app : une erreur non catchée dans un composant produit un écran blanc silencieux (piste d'amélioration identifiée, pas encore traitée).
