// Journal des nouveautés affiché dans la page "Nouveautés" (icône cloche du
// header). Chaque entrée = une évolution visible pour l'utilisatrice, PAS
// les refactors/nettoyages internes sans impact sur l'usage de l'app.
//
// Convention : ordre du plus récent au plus ancien, `date` au format
// YYYY-MM-DD. Voir CLAUDE.md pour la consigne "ajouter une entrée à chaque
// push".
export const CHANGELOG = [
  {
    date: '2026-08-14',
    title: 'Feuille de tri et filtre des recettes revue',
    description: "La feuille « Trier & filtrer » des recettes passe en deux onglets, et affiche en haut des puces pour retirer un filtre ou un critère de tri actif d'un tap, sans avoir à le rechercher.",
  },
  {
    date: '2026-08-14',
    title: 'Nouvel écran de détail recette',
    description: "La fiche recette est repensée : lecture par portion ou pour 100 g, onglets Infos / Instructions, et un bouton pour ajouter la recette directement au journal.",
  },
  {
    date: '2026-08-14',
    title: 'Grammage automatique et source des recettes',
    description: "Le grammage de chaque ingrédient est maintenant annoté automatiquement dans les instructions, et chaque recette peut avoir une source (lien ou livre).",
  },
  {
    date: '2026-08-14',
    title: 'Instructions et temps de préparation',
    description: "Les recettes ont désormais des instructions numérotées ainsi que les temps de préparation, cuisson et repos, avec des filtres pour les retrouver.",
  },
  {
    date: '2026-08-13',
    title: 'Réinitialisation du mot de passe',
    description: "Un mot de passe oublié ? Une page dédiée est accessible depuis l'écran de connexion pour le réinitialiser.",
  },
  {
    date: '2026-08-13',
    title: 'Recherche et filtres sur les aliments personnalisés',
    description: "Les aliments ajoutés manuellement se recherchent, se trient et se regroupent maintenant par catégorie.",
  },
  {
    date: '2026-08-13',
    title: 'Catégories pour ajouter un aliment',
    description: "Le formulaire d'ajout d'aliment propose des catégories prédéfinies (Ciqual + Compléments), avec une saisie par dose pour les compléments.",
  },
  {
    date: '2026-08-13',
    title: 'Planification repensée',
    description: "Compléments, récurrence, calendrier cliquable et validation directement depuis la page du jour : la planification des repas fait peau neuve.",
  },
  {
    date: '2026-08-13',
    title: 'Catégories sur les recettes',
    description: "Les recettes ont des catégories fixes, filtrables, avec un regroupement par catégorie affiché par défaut.",
  },
  {
    date: '2026-08-13',
    title: 'Tri des recettes et des favoris',
    description: "Les recettes se trient aussi par portion (en plus du 100 g), et les favoris se trient par défaut sur \"Top\" avec un sens de tri inversable.",
  },
  {
    date: '2026-08-13',
    title: 'Corrections diverses',
    description: "La dernière quantité d'un favori remonte maintenant correctement, le bug qui cassait \"Nouvel aliment\" est corrigé, ainsi qu'un souci d'affichage de la vitamine K.",
  },
]

export function getLatestChangelogDate() {
  return CHANGELOG.reduce((max, e) => (e.date > max ? e.date : max), '')
}
