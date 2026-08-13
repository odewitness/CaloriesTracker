# CaloriesTracker

App personnelle de suivi calorique. React 18 + Vite, backend Supabase, déployée sur Netlify (auto-deploy sur push vers `main`). Repo GitHub : `odewitness/CaloriesTracker`.

## Commandes

- `npm run dev` — serveur de dev local
- `npm run build` — build de prod. **Erreur connue et sans gravité** : `Dynamic require of "workbox-build" is not supported` (vite-plugin-pwa). Elle existait déjà avant tout refactor, elle ne bloque pas le build Netlify (confirmé en prod) — ignorer cette erreur précise, ne pas essayer de la "corriger" sans que ce soit explicitement demandé.

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

## Notes utiles

- Le hook `useBackButton.js` gère le bouton retour Android/navigateur via `history.pushState`/`popstate` — indépendant du routing React Router (`react-router-dom`), ne change jamais le pathname de l'URL.
- Pas d'`ErrorBoundary` dans l'app : une erreur non catchée dans un composant produit un écran blanc silencieux (piste d'amélioration identifiée, pas encore traitée).
