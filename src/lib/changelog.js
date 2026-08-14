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
    title: 'Les catégories sont plus faciles à repérer',
    description: "Dans Aliments et Recettes, chaque catégorie a maintenant un petit emoji et une pastille de couleur devant son nom, pour mieux distinguer les groupes quand tu parcours la liste.",
  },
  {
    date: '2026-08-14',
    title: 'Suis ton poids et tes mensurations dans le temps',
    description: "Depuis ton Profil, la ligne \"Poids & mensurations\" ouvre un nouvel écran : ajoute un relevé daté (poids, poitrine, taille, hanches, bras, cuisses...), rien n'est obligatoire. Une courbe suit leur évolution : tape sur une puce en haut pour changer la donnée affichée, sur un point de la courbe pour voir sa valeur exacte, et choisis la période (1 mois, 3 mois, 6 mois, 1 an, tout).",
  },
  {
    date: '2026-08-14',
    title: 'Le point rouge sur la cloche ne ratait plus les nouveautés',
    description: "Quand plusieurs nouveautés arrivaient le même jour, le petit point rouge sur la cloche ne s'affichait pas si tu avais déjà consulté la page \"Nouveautés\" une première fois dans la journée. C'est corrigé : chaque nouvelle entrée déclenche bien le point rouge, même le même jour.",
  },
  {
    date: '2026-08-14',
    title: 'Un mode cuisine pour garder l\'écran allumé',
    description: "Quand tu regardes une recette, une icône toque de cuisinier est apparue en haut de l'écran : active-la pour empêcher ton téléphone de s'endormir pendant que tu cuisines. Elle se désactive automatiquement quand tu quittes la recette.",
  },
  {
    date: '2026-08-14',
    title: 'Tes recettes ne se réinitialisent plus si ton écran s\'éteint',
    description: "Avant, si ton téléphone s'endormait pendant que tu regardais ou créais une recette, l'onglet et le nombre de portions que tu avais choisis repartaient à zéro. C'est corrigé. L'ouverture d'une recette est aussi plus fluide, sans petit écran de chargement qui change d'apparence au passage.",
  },
  {
    date: '2026-08-14',
    title: 'Trier et filtrer tes aliments, en plus simple',
    description: "Dans \"Mes aliments\", la fenêtre de tri et de filtre reprend maintenant le même fonctionnement que celle des recettes : deux onglets \"Filtrer\" et \"Trier\", et un résumé de tes choix en haut que tu peux retirer d'un tap sans rouvrir toute la fenêtre.",
  },
  {
    date: '2026-08-14',
    title: 'Tes repas types ont eux aussi un nouveau look',
    description: "Dans \"Mes aliments\", l'onglet Repas types reprend le style des Aliments et des Recettes : les macros de la portion s'affichent directement sur chaque carte, avec un badge quand le repas est riche en protéines ou en fibres. Les boutons modifier, planifier et supprimer sont regroupés dans le menu \"...\" en haut de la carte, et tu peux maintenant créer un repas type directement depuis le bouton \"Nouveau\" en haut de la page.",
  },
  {
    date: '2026-08-14',
    title: 'Tes aliments personnalisés ont le même look que tes recettes',
    description: "La liste de tes aliments personnalisés reprend le style des recettes : macros pour 100 g et pour une portion en pastilles, et un badge quand un aliment est riche en protéines ou en fibres. Et pour la marque, tu n'as plus besoin de la retaper à chaque fois : elle te propose maintenant tes marques déjà utilisées dans un menu déroulant, ou tu peux en créer une nouvelle directement.",
  },
  {
    date: '2026-08-14',
    title: 'Les noms de recettes ne sont plus coupés',
    description: "Dans la liste de tes recettes, les noms trop longs passaient à la ligne suivante avec des points de suspension. Maintenant ils s'affichent en entier, sur plusieurs lignes si besoin.",
  },
  {
    date: '2026-08-14',
    title: 'Tes recettes en un coup d\'œil',
    description: "La liste de tes recettes a un nouveau look : les calories et les macros pour 100 g et pour une portion s'affichent directement sur chaque carte, sans avoir à l'ouvrir. Un petit badge t'indique aussi quand une recette est riche en protéines ou en fibres.",
  },
  {
    date: '2026-08-14',
    title: 'La croix pour fermer les fenêtres était cachée sur iPhone',
    description: "Sur certains iPhone, la croix en haut des fenêtres (fiche recette, fiche aliment...) était cachée sous l'encoche ou la barre du haut, ce qui empêchait de refermer une fenêtre. C'est corrigé.",
  },
  {
    date: '2026-08-14',
    title: 'Trier et filtrer tes recettes, en plus simple',
    description: "La fenêtre pour trier et filtrer tes recettes est plus claire : deux onglets bien séparés, et tes filtres actifs s'affichent en haut sous forme de puces que tu peux enlever d'un tap.",
  },
  {
    date: '2026-08-14',
    title: 'La fiche recette fait peau neuve',
    description: "Quand tu ouvres une recette, tu peux basculer entre la vue par portion et la vue pour 100 g, les infos et les instructions sont dans des onglets séparés, et un bouton te permet de l'ajouter direct à ton journal.",
  },
  {
    date: '2026-08-14',
    title: 'Le poids de chaque ingrédient affiché dans les instructions',
    description: "Dans les instructions d'une recette, le grammage de chaque ingrédient s'affiche maintenant automatiquement. Tu peux aussi ajouter une source (un lien ou un livre) à tes recettes pour te souvenir d'où elles viennent.",
  },
  {
    date: '2026-08-14',
    title: 'Des instructions étape par étape et les temps de prépa',
    description: "Tes recettes peuvent désormais avoir des instructions numérotées, ainsi que les temps de préparation, cuisson et repos. Tu peux aussi filtrer tes recettes selon ces temps.",
  },
  {
    date: '2026-08-13',
    title: 'Mot de passe oublié ? Tu peux le réinitialiser toi-même',
    description: "Depuis l'écran de connexion, un lien te permet de réinitialiser ton mot de passe si tu l'as oublié.",
  },
  {
    date: '2026-08-13',
    title: 'Retrouve plus facilement tes aliments personnalisés',
    description: "Les aliments que tu as ajoutés toi-même se recherchent, se trient et se regroupent par catégorie, comme les autres.",
  },
  {
    date: '2026-08-13',
    title: 'Des catégories quand tu ajoutes un aliment',
    description: "Quand tu ajoutes un aliment, tu choisis maintenant sa catégorie (aliment classique ou complément), avec une saisie par dose pour les compléments.",
  },
  {
    date: '2026-08-13',
    title: 'La planification des repas fait peau neuve',
    description: "Compléments, répétition automatique, calendrier cliquable, validation directement depuis la page du jour : planifier tes repas est plus simple et plus rapide.",
  },
  {
    date: '2026-08-13',
    title: 'Des catégories pour tes recettes',
    description: "Tes recettes sont maintenant classées par catégorie, et tu peux filtrer dessus. Par défaut, elles s'affichent regroupées par catégorie.",
  },
  {
    date: '2026-08-13',
    title: 'Nouvelles façons de trier recettes et favoris',
    description: "Tu peux trier tes recettes par portion en plus du 100 g. Tes favoris se trient par défaut sur \"Top\", avec un bouton pour inverser le sens de tri.",
  },
  {
    date: '2026-08-13',
    title: 'Quelques corrections',
    description: "La dernière quantité utilisée pour un favori remonte maintenant correctement, le bug qui empêchait d'ajouter un nouvel aliment est corrigé, et l'affichage de la vitamine K est réparé.",
  },
]

export function getLatestChangelogDate() {
  return CHANGELOG.reduce((max, e) => (e.date > max ? e.date : max), '')
}

// Identifiant de la dernière entrée (utilisé pour le badge "non lu" sur la
// cloche) : basé sur le titre plutôt que sur la seule date, car plusieurs
// entrées peuvent partager la même date (plusieurs pushs le même jour) — une
// comparaison par date seule raterait alors les nouvelles entrées du jour.
export function getLatestChangelogKey() {
  const latest = CHANGELOG[0]
  return latest ? `${latest.date}::${latest.title}` : ''
}
