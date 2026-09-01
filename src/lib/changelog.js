// Journal des nouveautés affiché dans la page "Nouveautés" (icône cloche du
// header). Chaque entrée = une évolution visible pour l'utilisatrice, PAS
// les refactors/nettoyages internes sans impact sur l'usage de l'app.
//
// Convention : ordre du plus récent au plus ancien, `date` au format
// YYYY-MM-DD. Voir CLAUDE.md pour la consigne "ajouter une entrée à chaque
// push".
export const CHANGELOG = [
  {
    date: '2026-09-01',
    title: 'Une photo pour tes recettes',
    description: "Quand tu crées ou modifies une recette, tu peux maintenant lui ajouter une photo. Elle s'affiche en haut de la fiche, en vignette dans ta liste de recettes, et sur la recette quand tu la partages avec tes amies.",
  },
  {
    date: '2026-09-01',
    title: 'Ta photo de profil',
    description: "Dans « Profil », touche ta pastille tout en haut (ou la petite icône appareil photo) pour choisir une photo. Elle apparaît partout où on te voit : le bouton rond en haut de l'app, tes partages dans le fil, tes commentaires, et la liste de tes amies — qui peuvent elles aussi mettre la leur. Un bouton « Retirer la photo » revient à l'affichage avec tes initiales.",
  },
  {
    date: '2026-09-01',
    title: 'Menus : détail nutritionnel de la semaine + fiches des plats combinés',
    description: "Sous le résumé de la semaine, la carte « Détail nutritionnel » (la même que sur la page du jour : vitamines, minéraux, sucres, acides gras avec les jauges de couleur) montre ta moyenne par jour planifié. Et quand un repas prévu regroupe plusieurs recettes sur une même ligne (« Curry + Riz »), tu peux maintenant toucher le nom pour choisir quelle fiche ouvrir.",
  },
  {
    date: '2026-09-01',
    title: 'Menus & génération de plan : plus clair, moins chargé',
    description: "L'onglet Menus est allégé : chaque jour ne montre que ses repas prévus (fini la liste de créneaux vides), avec un lien « Ajouter un repas » pour compléter, et un résumé de semaine avec une petite barre de progression. La génération de plan a été simplifiée : l'écran de réglages tient en trois choix (nombre de jours, date de début, générer), tout le reste est rangé sous « Options avancées ». Dans l'aperçu, chaque jour affiche juste ses calories, et le détail protéines / glucides / lipides s'ouvre d'un tap si tu veux le voir.",
  },
  {
    date: '2026-09-01',
    title: 'Menus : touche un plat pour voir sa fiche',
    description: "Dans « Menus », le nom entier de chaque plat prévu est visible, et si tu le touches ça ouvre directement la fiche de la recette ou du repas type. Pour retirer un plat, passe par les trois petits points à côté. « Modifier mon plan » est descendu en bas, juste avant le bouton rouge pour retirer le plan.",
  },
  {
    date: '2026-09-01',
    title: 'Menus : les compléments ne faussent plus le résumé',
    description: "Les compléments que tu planifies à l'avance ne sont plus comptés dans le résumé de la semaine (repas planifiés, moyenne kcal/jour) ni dans les calories affichées par jour — seuls les vrais repas comptent.",
  },
  {
    date: '2026-09-01',
    title: 'Plan de repas : liste de courses « à neuf » + plans enregistrés visibles',
    description: "Au moment de générer la liste de courses depuis un plan, une case « Vider cette liste avant d'ajouter » (cochée d'office quand tu remplaces un plan) permet de repartir de zéro plutôt que d'empiler par-dessus l'ancienne. Et dans les réglages du planificateur, la section « Reprendre un plan enregistré » est maintenant dépliée et mise en avant : touche un plan pour le rouvrir, l'ajuster et l'appliquer à la semaine que tu veux.",
  },
  {
    date: '2026-09-01',
    title: 'Menus : « Modifier mon plan » et retrait plus clair',
    description: "Quand une semaine a déjà un plan généré, le bouton du haut devient « Modifier mon plan » et rouvre ton plan tel quel pour l'ajuster ; en le ré-appliquant, l'ancien est retiré et remplacé automatiquement (tes repas ajoutés à la main restent). Le bouton « Retirer le plan généré » est descendu tout en bas, bien visible en rouge. Et la moyenne kcal/jour du résumé ne compte plus les jours encore vides.",
  },
  {
    date: '2026-09-01',
    title: 'Liste de courses : quantités enfin correctes',
    description: "Correction d'un bug : quand une recette revenait plusieurs fois dans la semaine, ou qu'un ingrédient était partagé entre plusieurs recettes, la liste de courses ne comptait que la première fois. Les grammages sont maintenant bien additionnés sur tout ce que tu prévois.",
  },
  {
    date: '2026-09-01',
    title: 'Calendrier & Menus : réorganisation',
    description: "Deux onglets au lieu de trois : « Calendrier » (avec un bouton Mois / Semaine à l'intérieur) et « Menus ». Dans « Menus », un résumé de semaine en haut (repas planifiés, moyenne kcal/jour vs ton objectif avec code couleur), les boutons d'action regroupés, les noms de repas ne se coupent plus sur deux lignes, et chaque jour affiche ses calories planifiées par rapport à ta cible.",
  },
  {
    date: '2026-09-01',
    title: 'Plan de repas : garde tes plans favoris',
    description: "Dans l’aperçu d’un plan généré, « Enregistrer ce plan » le sauvegarde sous un nom. Tu retrouves tes plans enregistrés en haut des réglages du planificateur : un tap pour rouvrir l’aperçu, le modifier, le ré-appliquer à la semaine que tu veux, ou repartir de lui. Tu peux les renommer et les supprimer.",
  },
  {
    date: '2026-09-01',
    title: 'Ma fournée : les repas types aussi',
    description: "Tu peux maintenant ajouter des repas types à « Ma fournée », pas seulement des recettes — dans le sélecteur d’ajout comme depuis un plan de repas appliqué. Ils apparaissent dans la liste avec la mention « repas type », et leurs ingrédients (mis à l’échelle des portions à préparer) s’affichent dans le Plan de cuisine.",
  },
  {
    date: '2026-09-01',
    title: 'Un plantage n’efface plus tout l’écran',
    description: "Si un écran ou une fenêtre bugue, tu vois maintenant un petit message avec un bouton « Réessayer » au lieu d’une page blanche — et le reste de l’app continue de fonctionner. Le message affiche aussi un « détail technique » : si tu me le copies, ça m’aide à corriger.",
  },
  {
    date: '2026-09-01',
    title: 'Plan de repas : des menus qui collent mieux du premier coup',
    description: "La génération a été retravaillée : le plan cherche maintenant à ne pas dépasser tes calories et tes macros (mieux vaut un peu en dessous qu'au dessus), essaie plusieurs combinaisons en coulisse et garde la meilleure, et privilégie les recettes qui laissent de la marge. Tu devrais avoir besoin de « régénérer » beaucoup moins souvent. Si une catégorie a peu de recettes, un message te le signale — c'est ce qui limite le plus le résultat.",
  },
  {
    date: '2026-09-01',
    title: 'Liste de courses : grammages arrondis',
    description: "Fini les « 33,33333 g » : les quantités de la liste de courses sont maintenant arrondies au gramme.",
  },
  {
    date: '2026-09-01',
    title: 'Ma fournée : un plan de cuisine à réorganiser',
    description: "Depuis « Ma fournée », le bouton « Plan de cuisine » met bout à bout toutes les étapes de tes recettes. Tu les remontes ou descends avec les flèches pour les faire dans l’ordre qui t’arrange, tu coches au fur et à mesure, et chaque étape garde la couleur de sa recette pour t’y retrouver. Les grammages sont écrits dans les étapes, à l’échelle des portions à préparer, et un panneau dépliable liste les ingrédients de chaque recette.",
  },
  {
    date: '2026-09-01',
    title: 'Ma fournée : ouvrir une recette d’un tap',
    description: "Dans « Ma fournée », touche le nom d’une recette pour ouvrir sa fiche (ingrédients, étapes, valeurs) sans quitter ta liste. Elle s’ouvre directement au nombre de portions que tu as noté à préparer, donc les quantités d’ingrédients sont déjà les bonnes.",
  },
  {
    date: '2026-09-01',
    title: 'Reprendre la semaine précédente en un geste',
    description: "Dans le Calendrier, onglet « Menus », quand la semaine d'avant contient des repas prévus, un bouton « Reprendre la semaine précédente » les recopie tous sur la semaine affichée. Les créneaux déjà occupés et les jours exclus sont laissés tranquilles, et tu peux tout retirer d'un coup comme un plan généré.",
  },
  {
    date: '2026-09-01',
    title: 'Ma fournée se remplit toute seule depuis ton plan',
    description: "Quand tu appliques un plan de repas au calendrier, ses recettes partent automatiquement dans « Ma fournée » avec le nombre de portions à préparer pour la semaine. Depuis l’aperçu du plan, un bouton « Ajouter à Ma fournée » fait la même chose sans passer par le calendrier.",
  },
  {
    date: '2026-09-01',
    title: 'Ma fournée : ta liste de recettes à cuisiner',
    description: "Dans le Calendrier, onglet « Menus », le bouton « Ma fournée » ouvre une check-list où tu ajoutes les recettes que tu comptes préparer et tu les coches au fur et à mesure, avec une barre d’avancement. Tu peux noter combien de portions préparer pour chacune. Chaque semaine a sa propre fournée (elle suit la semaine affichée dans « Menus »). La liste te suit d’un appareil à l’autre.",
  },
  {
    date: '2026-09-01',
    title: 'Plan de repas : 2 portions d’un même plat quand ça aide',
    description: "Quand un repas reste bien en-dessous de tes objectifs, le plan peut maintenant te proposer d’en manger 2 portions du plat plutôt que d’empiler des aliments en plus. Dans l’aperçu, ouvre un plat pour régler toi-même 1 ou 2 portions. Le plan évite aussi de te faire cuisiner des quantités bancales (une recette prévue pour 4 utilisée 5 fois). Tu peux désactiver le tout avec la case « Autoriser 2 portions d’un même plat » dans les réglages.",
  },
  {
    date: '2026-08-31',
    title: 'Plan de repas : liste de courses dans une nouvelle liste',
    description: "Au moment de générer la liste de courses depuis ton plan de repas, tu peux maintenant créer une nouvelle liste sur place (avec le nom que tu veux) au lieu de devoir choisir parmi tes listes existantes.",
  },
  {
    date: '2026-08-31',
    title: 'Une recette prévue au menu = une seule ligne',
    description: "Quand tu coches « mangé » sur une recette prévue par le plan de repas, elle arrive maintenant dans ta journée comme une seule ligne (le nom de la recette et son grammage), comme quand tu ajoutes une recette à la main — fini la longue liste de chaque ingrédient. La liste de courses, elle, continue de détailler tous les ingrédients à acheter.",
  },
  {
    date: '2026-08-31',
    title: 'Plan de repas : impose tes recettes et affine',
    description: "Quand tu prépares un plan de repas, tu peux maintenant imposer une ou plusieurs recettes : sous chaque repas, « Imposer une recette » te laisse cocher celles que tu veux absolument au menu cette semaine-là — elles seront toujours dans le plan et ne bougent pas quand tu régénères. Tu peux aussi limiter le temps de cuisine (par exemple « ≤ 30 min ») pour n'avoir que des recettes rapides. Et si tu le laisses coché, le plan complète tes journées avec un ou deux aliments de tes favoris pour combler tes manques en vitamines et minéraux, en plus des calories et des protéines.",
  },
  {
    date: '2026-08-31',
    title: 'Génère ton plan de repas de la semaine',
    description: "Dans le Calendrier, onglet « Menus », le bouton « Générer un plan de repas » compose pour toi des menus sur 1 à 7 jours à partir de tes recettes et de tes repas types, en essayant de coller au mieux à tes objectifs de calories et de macros. Tu choisis le nombre de jours, la date de début, le nombre de personnes, la saison, et pour chaque repas ce que tu veux (par exemple 1 plat + 1 dessert au déjeuner) et combien de recettes différentes sur la semaine. L'aperçu te montre les macros par repas, par jour et sur la semaine, avec un code couleur d'écart à l'objectif ; chaque repas est complété par un ou deux aliments de tes favoris pour combler les manques. Tu peux verrouiller un jour ou un repas qui te plaît puis régénérer le reste, remplacer une recette par une autre, puis « Appliquer au calendrier », générer la liste de courses et, si besoin, retirer tout le plan d'un coup.",
  },
  {
    date: '2026-08-31',
    title: 'Modifier une recette plus vite',
    description: "Dans la liste de tes recettes, le petit menu « ⋮ » d'une recette propose maintenant « Modifier » directement, sans avoir à ouvrir la recette d'abord.",
  },
  {
    date: '2026-08-31',
    title: 'Une saison pour tes recettes et tes repas types',
    description: "Quand tu crées ou modifies une recette ou un repas type, tu peux maintenant cocher une ou plusieurs saisons (printemps, été, automne, hiver). Elles s'affichent sur la fiche, et le bouton de tri te permet de n'afficher que les recettes ou repas d'une saison donnée. Pratique pour retrouver tes idées de plats d'hiver quand il fait froid.",
  },
  {
    date: '2026-08-31',
    title: 'Alimentation ou compléments : qui apporte quoi',
    description: "Dans Historique › Nutrition, le « Détail nutritionnel » montre maintenant, pour chaque vitamine et chaque minéral, la part qui vient de ton alimentation et celle qui vient de tes compléments (en violet). En haut, un résumé t'indique quelle proportion de tes vitamines et minéraux vient des compléments sur la période.",
  },
  {
    date: '2026-08-31',
    title: 'Des rappels pour tes compléments',
    description: "Dans « Mes aliments », ouvre un complément : tu peux lui mettre un ou plusieurs rappels dans la journée (le fer le matin, le magnésium le soir…) et choisir les jours. Quand tu programmes un complément dans le calendrier, son rappel s'active tout seul. Tu retrouves tous tes rappels dans Profil › Notifications › Rappels compléments.",
  },
  {
    date: '2026-08-31',
    title: 'La collation, jour par jour',
    description: "Sur ta journée, la carte « Collation » a maintenant son propre interrupteur. Tu peux la couper les jours où tu ne grignotes pas et la remettre quand tu veux, sans toucher à ton réglage habituel. Chaque jour est indépendant, et quand la collation est coupée ses calories et ses protéines sont réparties sur tes autres repas.",
  },
  {
    date: '2026-08-30',
    title: 'La fenêtre de partage ne déborde plus',
    description: "Depuis la page principale, quand tu touches « Partager » dans le petit menu en haut (ou le partage d'un repas), la fenêtre qui s'ouvrait décalée et coupée sur les côtés s'affiche maintenant bien centrée.",
  },
  {
    date: '2026-08-30',
    title: 'Planifie tes menus de la semaine',
    description: "Dans le Calendrier, un nouveau bouton « Menus » (à côté de Mois et Semaine) affiche ta semaine jour par jour avec une ligne par repas. Touche le « + » d'une case pour prévoir un repas ce jour-là, à cet horaire précis (le jour et le repas sont déjà choisis pour toi). Touche un repas prévu pour le retirer ou le marquer mangé.",
  },
  {
    date: '2026-08-30',
    title: 'Ta liste de courses à partir de tes repas prévus',
    description: "Dans Mes courses, ouvre une liste, touche le « + » puis « Depuis mes repas prévus ». Choisis une période (deux semaines par défaut) et tous les aliments des repas que tu as planifiés partent dans la liste d'un coup. Si un aliment revient dans plusieurs repas, il n'apparaît qu'une fois avec les quantités additionnées.",
  },
  {
    date: '2026-08-30',
    title: 'Une projection de ton poids',
    description: "Dans Mensurations, sous la courbe de poids, une nouvelle carte « Projection » prolonge la tendance de tes dernières semaines : « ≈ 62,3 kg dans 2 mois », avec une fourchette (parce que le poids bouge chaque jour selon l'eau, le sel, le cycle…) et ton rythme en kg par semaine et par mois. Il faut au moins quatre relevés répartis sur deux semaines pour qu'elle apparaisse. Si ton poids est stable, elle te le dit simplement, sans sortir de chiffre. C'est une indication de cap, pas une prédiction.",
  },
  {
    date: '2026-08-30',
    title: 'Ouvre un jour depuis l\'historique',
    description: "Dans l'Historique, onglet Résumé, la liste « Détail par jour » est maintenant cliquable : touche une journée et tu arrives directement dessus dans la page principale, avec tous tes repas et le détail. Une petite flèche à droite de chaque ligne te montre qu'elle est cliquable.",
  },
  {
    date: '2026-08-30',
    title: 'Les raccourcis du jour plus compacts',
    description: "Quand tu ouvres le menu « … » en haut de la page du jour, les raccourcis (exclure ce jour, relevé de poids, planifier un repas, cycle, partager) s'affichent maintenant en petites pastilles rondes avec juste l'icône, sans le texte. Ça prend beaucoup moins de place. Le nom de chaque raccourci apparaît si tu restes appuyée dessus.",
  },
  {
    date: '2026-08-30',
    title: 'La collation se place avant le dîner',
    description: "Dans tes repas du jour, la collation apparaît maintenant entre le déjeuner et le dîner, comme dans une vraie journée. Et si tu ne l'as pas activée (depuis Profil), elle ne s'affiche plus du tout sur la page du jour : plus de carte grisée qui traîne. Pareil pour un autre repas que tu désactiverais. Un repas désactivé qui contient encore des aliments reste visible pour que tu puisses les retrouver.",
  },
  {
    date: '2026-08-30',
    title: 'La partie « Activité » allégée',
    description: "La carte Activité de ta page du jour était trop chargée. Elle ne garde plus que l'essentiel : ta progression de la semaine en haut, tes pas du jour sur une seule ligne, et tes séances. Le petit bilan d'énergie (ce que tu manges face à ce que tu dépenses, ou ton objectif ajusté si tu as choisi « manger selon l'effort ») s'affiche maintenant en une ligne juste sous ton cercle de calories ; touche-la pour voir le détail.",
  },
  {
    date: '2026-08-30',
    title: 'Ajout rapide depuis « À combler aujourd\'hui » réparé',
    description: "Depuis la page du jour, quand tu touchais le « + » d'une suggestion de « À combler aujourd'hui » (ou le bouton « … » pour voir tous tes manques), la petite fenêtre qui s'ouvrait était décalée et rognée sur les côtés : le bouton « Ajouter » se retrouvait hors de l'écran. Elle s'affiche de nouveau correctement, bien centrée.",
  },
  {
    date: '2026-08-30',
    title: 'Le calendrier remis au propre',
    description: "La page Calendrier a été revue. En vue Semaine tu vois maintenant aussi ta phase de cycle et tes séances de sport, comme en vue Mois. Les repères sur les jours sont plus lisibles : une place fixe pour chaque info (repas prévu en haut à droite, séance en haut à gauche, phase de cycle en barre sous le chiffre) et une petite « Légende » à déplier si besoin. Un bouton « ↩ Aujourd'hui » apparaît dès que tu t'éloignes du mois en cours pour y revenir d'un geste. Quand tu touches un jour, l'aperçu en dessous est plus court (tes calories, tes repas en résumé, ton cycle et ton activité s'ils sont suivis) ; « Ouvrir cette journée » t'emmène directement sur ce jour dans la page principale pour le détail. Et les deux gros boutons de planification laissent la place à un simple « Planifier… ».",
  },
  {
    date: '2026-08-30',
    title: 'Vois ce que tu manges face à ce que tu dépenses',
    description: "Dans l'Historique, onglet Résumé, un nouveau bouton « Dépense » pose sur ta courbe de calories une ligne de ce que ton corps brûle environ : ton métabolisme de base plus tes pas et tes séances. Quand une barre dépasse la ligne, tu as mangé plus que dépensé ; en dessous, l'inverse. En touchant une barre tu vois les deux chiffres et l'écart. En vue Semaine et Mois c'est jour par jour (avec tes phases de cycle en fond), en vue Année c'est la moyenne par mois. C'est une estimation (±20 %) qui ne change pas ton objectif.",
  },
  {
    date: '2026-08-30',
    title: 'Le calendrier de régularité va de nouveau jusqu\'à aujourd\'hui',
    description: "Sur les longues périodes, surtout en vue Année, le calendrier des couleurs se figeait en plein mois et les jours récents restaient blancs même quand tu avais bien loggé tes repas. C'était une limite de chargement qui coupait les données les plus récentes. C'est réparé : le calendrier, la série en cours et le record prennent maintenant en compte toutes tes journées.",
  },
  {
    date: '2026-08-30',
    title: "L'Historique est rangé en onglets",
    description: "La page Historique devenait longue à faire défiler. Elle est maintenant découpée en onglets, sous le choix Semaine / Mois / Année : « Résumé » (ta courbe de calories, tes stats clés, le calendrier et le détail jour par jour), « Nutrition » (tes moyennes, le détail des vitamines et minéraux, la répartition par repas, ton profil par jour de semaine, tes aliments les plus fréquents), « Activité » (ton sport et tes pas) et « Cycle » (tes calories et ton poids selon ta phase). Les onglets Activité et Cycle n'apparaissent que si tu suis le sport ou ton cycle. Rien n'a disparu, tout est juste mieux rangé. Au passage, les barres du « profil par jour de semaine » qui restaient toutes minuscules sont réparées.",
  },
  {
    date: '2026-08-30',
    title: 'Le calendrier de régularité montre aussi les jours en dessous',
    description: "Dans l'Historique, le calendrier des couleurs ne distinguait que les jours dans l'objectif et ceux au-dessus. Maintenant tu vois aussi les jours où tu es passée en dessous : bleu clair quand c'est un peu en dessous (jusqu'à 600 kcal sous ton objectif), bleu foncé quand c'est nettement en dessous. Pratique pour repérer les journées où tu n'as pas assez mangé.",
  },
  {
    date: '2026-08-30',
    title: 'Tes pas et ton sport dans l\'Historique',
    description: "Dans l'Historique, la partie sport a un vrai graphique : tu choisis ce que tu veux voir — minutes actives, nombre de pas, ou calories dépensées — par jour, par semaine ou par mois. Tu peux poser ta courbe de poids par-dessus pour repérer un lien, avec les périodes de ta phase lutéale grisées en fond. Et le résumé « ton cycle sur cette période » indique maintenant aussi tes pas et tes calories dépensées selon la phase. Bonus : ces stats s'affichent même sur une période où tu n'as pas noté tes repas.",
  },
  {
    date: '2026-08-30',
    title: 'Tes pas du jour, et deux sports en plus',
    description: "Dans le bloc Activité de la page du jour, tu peux maintenant noter ton nombre de pas (recopié depuis ton téléphone ou ta montre) et te fixer un objectif quotidien. Pilates et tapis de marche s'ajoutent à la liste des activités. Et si tu notes à la fois une séance de marche et ton total de pas, tu peux cocher « déjà compté dans mes pas » sur la séance pour éviter de compter la même chose deux fois dans le bilan. Tout ça se règle dans Profil › Sport.",
  },
  {
    date: '2026-08-30',
    title: 'Tes portions personnalisées sont bien gardées',
    description: "Quand tu ajoutais une portion à un aliment (par exemple « 1 tranche · 30 g ») au moment de l'ajouter à ton journal, ou depuis sa fiche, elle s'affichait sur le moment mais repartait au rechargement suivant. C'est corrigé : les portions que tu crées sont maintenant vraiment enregistrées et te seront reproposées la prochaine fois.",
  },
  {
    date: '2026-08-30',
    title: 'Partage tes séances avec tes amies',
    description: "Tu peux maintenant partager une séance sur le fil : ouvre-la (bloc Activité de la page du jour) et touche « Partager avec mes amies ». Ou partage un résumé de ta semaine (temps total, nombre de séances) avec « Partager ma semaine » sous le bloc Activité. Tes amies peuvent réagir et commenter, comme pour un repas ou une recette.",
  },
  {
    date: '2026-08-30',
    title: 'Manger selon l\'effort (nouvelle option)',
    description: "Dans Profil › Sport, un 3ᵉ choix pour les calories : « Manger selon l'effort ». Ton objectif de base repasse à un équivalent sédentaire (ce que tu dépenses sans sport), et tes séances du jour viennent s'ajouter, dans une limite que tu règles. Résultat : les jours sans séance ton objectif est plus bas, les jours chargés plus haut. Ça ne s'applique que sur la page du jour — ton historique et ton calendrier gardent ton objectif habituel. Opt-in, désactivable en un geste, et l'écran te montre les chiffres avant / après.",
  },
  {
    date: '2026-08-30',
    title: 'Un bilan énergétique du jour, si tu veux',
    description: "Dans Profil › Sport, tu peux activer une ligne « bilan » sur le bloc Activité : ce que tu as mangé face à ta dépense estimée (métabolisme + séances du jour). C'est purement indicatif — ton objectif de calories ne change pas, et comme ta dépense de base intègre déjà une part d'activité, mieux vaut ne pas cumuler les deux dans ta tête. Désactivé par défaut.",
  },
  {
    date: '2026-08-30',
    title: 'Ton sport, phase par phase',
    description: "Si tu suis à la fois ton cycle et ton sport, l'Historique montre maintenant comment tes séances se répartissent entre tes phases (règles, folliculaire, ovulation, lutéale), avec pour chacune un petit repère sur l'activité à ce moment du cycle. C'est indicatif, pas un programme à suivre — écoute d'abord tes sensations.",
  },
  {
    date: '2026-08-30',
    title: 'Tes jours de sport sur tes courbes',
    description: "Dans l'Historique, les jours où tu as fait une séance sont maintenant marqués d'un petit tiret vert sous le graphique des calories, et une phrase compare tes calories moyennes les jours avec sport et les jours sans (et ton poids, si tu le notes). Le même tiret vert apparaît sur ta courbe de poids (Poids & mensurations) pour les pesées faites un jour de séance.",
  },
  {
    date: '2026-08-30',
    title: 'Ton sport, semaine après semaine',
    description: "Le bloc « Activité » affiche maintenant un anneau : tes minutes actives de la semaine par rapport à ton objectif (réglable dans Profil › Sport, ou « Aucun » si tu préfères sans). Et dans l'Historique, une section « Sport » récapitule tes minutes et tes séances sur la période choisie, avec un petit graphique par jour, par semaine ou par mois, et le nombre de semaines d'affilée où tu as tenu ton objectif.",
  },
  {
    date: '2026-08-30',
    title: 'Note tes séances de sport',
    description: "Un nouveau bloc « Activité » arrive sur ta page du jour (à activer dans Profil › Sport). Tu y ajoutes tes séances en quelques secondes : type (course, muscu, yoga, vélo…), durée, ressenti, et l'app estime les calories dépensées — tu peux les corriger. Tu vois tes minutes actives de la semaine, avec un objectif si tu en veux un, et les jours où tu as bougé sont marqués d'un point vert sur le calendrier. Ça ne change rien à tes objectifs de calories.",
  },
  {
    date: '2026-08-30',
    title: 'Réorganise ta page du jour',
    description: "Dans Profil › Page du jour, tu peux maintenant choisir l'ordre des blocs de l'écran principal (phase du cycle, bilan des calories, détail des nutriments, à combler aujourd'hui, repas du jour, compléments, eau) avec de petites flèches haut/bas. L'ordre que tu choisis s'applique à tous les jours.",
  },
  {
    date: '2026-08-30',
    title: 'Sport et symptômes selon ta phase',
    description: "Sur la page du jour, la pastille de phase (« Règles », « Phase lutéale »…) se déplie maintenant en un clic : tu y trouves une explication de la phase et des repères sport adaptés. Pendant tes règles, tu peux aussi marquer ou retirer le jour, noter l'intensité de ton flux et cocher tes symptômes (crampes, fatigue, maux de tête…) — avec la possibilité d'en ajouter d'autres à la main. Ces notes ne sont visibles que par toi.",
  },
  {
    date: '2026-08-29',
    title: 'Note l\'intensité de tes règles',
    description: "Dans la liste de tes règles (Profil › Cycle & alimentation), chaque épisode a maintenant trois petits boutons : Léger, Moyen, Abondant. C'est facultatif. Si tu les renseignes, l'app estime la quantité de fer que tu perds en moyenne par cycle et te le rappelle, pour que tu penses aux aliments riches en fer au bon moment.",
  },
  {
    date: '2026-08-29',
    title: 'Coller une liste de dates de règles',
    description: "Pour ne pas avoir à tout retaper jour par jour sur le calendrier, tu peux maintenant coller une liste de dates dans Profil › Cycle & alimentation (bouton « Coller une liste de dates »). Une date par ligne, plusieurs formats acceptés (2026-08-03, 03/08/2026, 3/8/26) et même des plages du type « 03/08/2026 - 07/08/2026 ». L'app te dit combien de jours seront ajoutés avant que tu valides. Un bouton « Copier mes dates » fait l'inverse si tu veux récupérer ta liste ailleurs.",
  },
  {
    date: '2026-08-29',
    title: 'Ton cycle apprend de ton historique',
    description: "Au fil des cycles que tu notes, l'app affiche maintenant ta longueur de cycle moyenne, son amplitude (de tant à tant de jours) et si tes cycles sont plutôt réguliers ou pas — dans Profil › Cycle & alimentation. La fourchette des prochaines règles s'ajuste à cette régularité. Dans l'Historique, un encart « Ton cycle sur cette période » compare tes calories (et ton poids, si tu le notes) en phase lutéale et sur le reste du cycle. Et si aucune règle n'est notée depuis plus de 45 jours, un message bienveillant t'invite à en parler à un·e professionnel·le si ce n'est pas un simple oubli de saisie.",
  },
  {
    date: '2026-08-29',
    title: 'Des aliments à privilégier selon ta phase',
    description: "Pendant tes règles et pendant la phase lutéale, la pastille de cycle sur la page du jour devient dépliable : touche-la pour voir, parmi tes favoris, ceux à privilégier selon le moment — du fer (et de la vitamine C) pendant les règles, du calcium et du magnésium en phase lutéale. Dans « Détail nutritionnel », ces nutriments sont aussi repérés d'un point violet. Tu peux masquer tout ça dans Profil › Cycle & alimentation.",
  },
  {
    date: '2026-08-29',
    title: 'Option : un peu plus de calories en phase lutéale',
    description: "Dans Profil › Cycle & alimentation, tu peux maintenant activer « Adapter mes calories à ma phase lutéale ». Quand c'est activé, uniquement pendant les jours qui précèdent tes règles, ton objectif de calories du jour est relevé (de +120 kcal par défaut, réglable). Tes objectifs de protéines, glucides et lipides ne bougent pas. Une petite étiquette « +120 kcal » apparaît sur la pastille de cycle de la page du jour ces jours-là. C'est désactivé par défaut et la base scientifique reste modeste (environ +150 kcal/j en moyenne dans les études) : à essayer seulement si ça te parle.",
  },
  {
    date: '2026-08-29',
    title: 'Suis ton cycle et adapte ton assiette',
    description: "Dans Profil, une nouvelle rubrique « Cycle & alimentation ». Tu y marques tes jours de règles toi-même (l'app ne se connecte à aucune autre appli), y compris plusieurs cycles passés pour bien caler les estimations. L'app t'indique alors où tu en es dans ton cycle — règles, phase folliculaire, ovulation, phase lutéale — avec une petite pastille sur la page du jour et des couleurs sur le calendrier. Sur tes courbes de poids, les jours d'avant-règles sont surlignés : c'est le moment où le poids peut monter de 1 kg d'eau sans que ce soit de la graisse. Une page d'explications te résume, sans jargon, ce qui change côté alimentation à chaque phase et ce que la science dit vraiment (les effets sont réels mais modestes). Pour l'instant tes objectifs de calories ne changent pas : c'est purement informatif.",
  },
  {
    date: '2026-08-29',
    title: 'Ton historique fait peau neuve',
    description: "La page Historique a été repensée. Un graphique montre tes calories jour par jour (ou mois par mois sur l'année) avec ta ligne d'objectif : touche une barre pour voir juste au-dessus la date, les calories et ton poids à ce moment-là. Tu peux superposer ta courbe de poids à tes calories. Les jours où tu n'as rien noté apparaissent en gris et sont comptés à part, pour ne pas te faire croire que tu as moins mangé que dans la réalité. Un calendrier colore chaque journée selon que tu étais dans l'objectif ou au-dessus, pour voir ta régularité d'un coup d'œil. Et tu retrouves ton bilan par rapport à l'objectif, ta comparaison avec la période précédente, ta répartition moyenne par repas, ton profil par jour de semaine et tes aliments les plus fréquents. L'onglet « Jour » a été retiré : pour revoir une journée précise, ouvre-la depuis le calendrier en haut de la page du jour.",
  },
  {
    date: '2026-08-29',
    title: 'Ton profil est réorganisé',
    description: "Fini le long défilement : ton profil s'ouvre maintenant sur une liste claire. Tu choisis ce que tu veux régler — tes informations, tes objectifs, la répartition par repas, l'hydratation, les notifications, ce qui s'affiche sur la page du jour — et tu entres dans un écran dédié, juste pour ça. Chaque ligne te montre déjà l'essentiel (ton objectif de calories, ton objectif d'eau…). Le calculateur de besoins caloriques est rangé dans « Objectifs nutritionnels », derrière un bouton, pour ne le sortir que quand tu en as besoin. Rien n'a disparu, tout est simplement mieux rangé.",
  },
  {
    date: '2026-08-29',
    title: 'Des raccourcis rapides sur la page du jour',
    description: "Touche le bouton « ⋯ » (trois points) en haut à droite, à côté de la date, pour dérouler une petite rangée de raccourcis pour le jour affiché. « Exclure » retire ce jour de tes moyennes et de ta série en cours (« Réinclure » pour annuler). « Relevé » ouvre ta page poids et mensurations. « Planifier » te laisse prévoir un repas sur ce jour. « Partager » envoie ta journée à tes amies. La rangée reste repliée tant que tu ne l'ouvres pas.",
  },
  {
    date: '2026-08-29',
    title: "La liste des boissons ne montre plus que les eaux",
    description: "Quand tu ouvres « Autre boisson » depuis la carte Eau, la liste ne t'affiche plus que les eaux (robinet, source, minérales) au lieu de tout mélanger avec les sodas, jus et sirops. Les autres boissons restent là : tape leur nom dans la barre de recherche pour les retrouver. La section Compléments a aussi un fond blanc, comme la carte Eau.",
  },
  {
    date: '2026-08-29',
    title: 'Suis ton eau depuis la page du jour',
    description: "Une carte « Eau » est apparue sur la page du jour : appuie sur Verre, Bouteille ou Gourde pour ajouter une portion en un seul geste, la jauge se remplit au fur et à mesure. Le bouton « Autre boisson » ouvre le détail : tu y choisis ta boisson (eau du robinet par défaut, eaux minérales, thé, café… depuis la base Ciqual), tu ajustes la quantité et tu crées tes propres portions. Les minéraux et vitamines de tout ce que tu bois comptent dans tes stats, comme un aliment. Dans Profil > Hydratation, tu règles ton objectif du jour et des rappels pour penser à boire (toutes les X heures, une fois par jour, ou seulement si tu n'as pas assez bu).",
  },
  {
    date: '2026-08-29',
    title: 'Ajouter un aliment juste après minuit tombe sur le bon jour',
    description: "Si tu notais un aliment entre minuit et 2h du matin, l'app te proposait par défaut la veille : le bouton \"Aujourd'hui\", la date pré-remplie pour un repas type ou une recette, et l'historique pouvaient tous être décalés d'un jour. C'est corrigé, la nuit comme le reste de la journée.",
  },
  {
    date: '2026-08-29',
    title: 'Plus de compléments dans les suggestions "À combler aujourd\'hui"',
    description: "Les compléments alimentaires n'apparaissent plus dans les suggestions de la section \"À combler aujourd'hui\" : elles s'affichaient avec une quantité en grammes (\"100 g\") qui n'avait aucun sens pour des gélules ou des comprimés. Tes compléments restent gérés comme avant dans leur propre section, avec le compteur de doses.",
  },
  {
    date: '2026-08-29',
    title: 'Touche une pastille de nutriment pour filtrer les suggestions',
    description: "Dans \"À combler aujourd'hui\", toucher une pastille de nutriment (vitamine D, fer...) ne t'envoie plus vers une autre page : ça affiche directement, juste en dessous, tes favoris riches en ce nutriment. Tu peux en toucher plusieurs à la fois : l'app cherche alors en priorité les aliments qui les couvrent tous. La pastille \"…\" ouvre la liste complète des vitamines et minéraux qui te manquent pour en choisir un autre. Touche à nouveau une pastille pour l'enlever.",
  },
  {
    date: '2026-08-29',
    title: 'Choisis quels aliments te propose "À combler aujourd\'hui"',
    description: "Deux icônes sont apparues à côté du titre de la section \"À combler aujourd'hui\". Celle en forme de réglages te laisse choisir dans quels favoris elle pioche ses suggestions : ceux que tu as mangés récemment, ceux que tu manges le plus souvent, ou au contraire ceux que tu n'as jamais notés — ton choix est gardé en mémoire et retrouvé au prochain lancement. Celle en forme de flèches croisées te propose 3 autres aliments au hasard, toujours selon ce réglage.",
  },
  {
    date: '2026-08-29',
    title: 'Les pastilles de nutriments défilent sans changer de jour',
    description: "Quand tu faisais glisser la rangée de pastilles de nutriments de \"À combler aujourd'hui\" pour voir les suivantes, l'app changeait de jour. Maintenant tu peux la faire défiler tranquillement sans quitter la journée.",
  },
  {
    date: '2026-08-26',
    title: 'Exclue un jour de tes stats sans perdre ce que tu as loggé',
    description: "Sur la page du jour ou dans le calendrier, tu peux maintenant marquer un jour comme \"exclu\" (par exemple une journée où tu n'as loggé qu'à moitié) : il n'entrera plus dans tes moyennes, ta série ou tes jours objectif, mais tu peux toujours voir et ajouter des aliments dessus. Le jour apparaît barré dans le calendrier, avec une pastille \"Exclu\" dans l'historique — un bouton \"Réinclure\" permet de revenir en arrière à tout moment.",
  },
  {
    date: '2026-08-22',
    title: 'Corrige les notifications qui ne partaient jamais',
    description: "Les notifications d'activité (réactions, commentaires sur tes partages) ne t'arrivaient jamais à cause d'un bug côté serveur. C'est corrigé : tu devrais maintenant bien les recevoir sur ton téléphone.",
  },
  {
    date: '2026-08-22',
    title: 'La section "À combler aujourd\'hui" se souvient si tu l\'as repliée',
    description: "Si tu replies la section \"À combler aujourd'hui\" sur ta page du jour, elle reste repliée la prochaine fois que tu ouvres l'app (et inversement si tu la laisses ouverte).",
  },
  {
    date: '2026-08-20',
    title: 'Les suggestions "À combler aujourd\'hui" tiennent compte de tes calories restantes',
    description: "Sur ta page du jour, les suggestions pour combler tes manques nutritionnels évitent maintenant de te proposer un aliment qui te ferait dépasser ton objectif de calories, quand une autre option tout aussi efficace existe.",
  },
  {
    date: '2026-08-20',
    title: 'Des suggestions dans ta liste de courses',
    description: "Ta liste de courses affiche maintenant une section \"Suggestions\" : les aliments qui reviennent le plus souvent dans les conseils \"À combler aujourd'hui\" de ta page du jour (par exemple des sardines si tu manques souvent de vitamine D). Un tap sur le \"+\" les ajoute directement à ta liste.",
  },
  {
    date: '2026-08-20',
    title: "Le grammage qui comble ton manque, même sans limite de calories",
    description: "Dans l'Explorer, quand tu sélectionnes un manque, chaque aliment t'indique maintenant directement le nombre de grammes qui le comble, à la place du taux pour 100 g — plus besoin de cocher \"tient dans mes calories restantes\" pour l'avoir.",
  },
  {
    date: '2026-08-20',
    title: 'Des suggestions plus variées dans "À combler aujourd\'hui"',
    description: "Les suggestions d'aliments proposaient souvent la même vitamine à chaque fois, toujours pour la même quantité. Elles portent maintenant sur plusieurs manques différents, et changent un peu à chaque fois que tu ouvres l'app. La fenêtre qui s'ouvre quand tu appuies sur le \"+\" est aussi corrigée : elle ne dépassait plus de l'écran sur certains téléphones.",
  },
  {
    date: '2026-08-20',
    title: "Des conseils nutritionnels directement sur ta page du jour",
    description: "Sur ta page du jour, un nouveau bandeau te montre ce qu'il te manque aujourd'hui (fer, vitamine C, fibres...), avec une suggestion parmi ce que tu manges déjà pour le combler en un tap. Et quand tu ajoutes un aliment, tu vois maintenant s'il est riche en un nutriment, et éventuellement la quantité qui comble ton manque du jour — comme dans l'Explorer.",
  },
  {
    date: '2026-08-20',
    title: 'Vitamines, minéraux, sucres et graisses réunis dans un seul encart',
    description: "Les sections \"Vitamines & Minéraux\" et \"Détail sucres & acides gras\" ne font plus qu'un, sous le titre \"Détail nutritionnel\". Quatre boutons en haut (Vitamines, Minéraux, Sucres, Acides gras) te permettent de basculer entre les catégories, comme avant.",
  },
  {
    date: '2026-08-20',
    title: "L'écran d'accueil réorganisé pour gagner de la place",
    description: "La date du jour s'affiche maintenant en haut à gauche de l'écran, et suit le jour affiché quand tu swipes pour changer de jour (tape dessus pour revenir à aujourd'hui). Le cercle des calories et tes macros (protéines, glucides, lipides, fibres) sont regroupés dans un seul encart, avec les flèches pour changer de jour de chaque côté — le swipe reste bien sûr disponible. Et le bouton \"Ajouter un repas type\" dans le menu \"...\" d'un repas ne se coupe plus quand la section est repliée.",
  },
  {
    date: '2026-08-20',
    title: 'Tes repas types enfin accessibles depuis le jour',
    description: "Appuie sur le bouton \"...\" à côté du + d'un repas, sur l'écran principal : tu peux maintenant ajouter directement un de tes repas types à ce repas, ou créer un nouveau repas type à partir de ce que tu as déjà noté ce jour-là. Plus besoin de passer par \"Mes aliments\" pour t'en servir.",
  },
  {
    date: '2026-08-18',
    title: 'Un calculateur pour trouver tes calories',
    description: "Dans Profil, un nouveau calculateur estime tes besoins caloriques à partir de ton sexe, ton âge, ta taille, ton poids et ton niveau d'activité (à renseigner une fois dans tes informations personnelles). Choisis perte de poids, maintien ou prise de muscle, et applique le résultat directement à tes objectifs en un clic. Les anciens boutons de préréglages ont disparu au profit de ce calcul personnalisé.",
  },
  {
    date: '2026-08-18',
    title: 'Des notifications pour ne rien manquer',
    description: "Tu peux maintenant activer les notifications depuis Profil > Notifications. Elles te préviennent si tu n'as encore rien noté en fin d'après-midi (ou si un repas planifié attend d'être marqué mangé), et quand une amie partage quelque chose, réagit ou commente un de tes partages. Ça marche mieux si tu ajoutes l'app à ton écran d'accueil.",
  },
  {
    date: '2026-08-18',
    title: "Des suggestions dans l'écran d'ajout",
    description: "Quand tu appuies sur le + d'un repas pour ajouter un aliment, une section « Suggestions » te propose maintenant ceux que tu manges le plus souvent à ce repas-là, juste après tes favoris — pratique pour retrouver vite tes habitudes du quotidien.",
  },
  {
    date: '2026-08-18',
    title: 'Ajoute tes propres portions sur un aliment Ciqual',
    description: "Beaucoup d'aliments de la base Ciqual n'ont pas de portion usuelle renseignée. Tu peux maintenant appuyer sur « Modifier » à côté de « Portions courantes » pour en ajouter toi-même (ex : « 1 tranche · 30 g ») — aussi bien depuis la fiche d'un aliment dans Explorer qu'au moment de l'ajouter à ton suivi du jour. Elles servent ensuite de quantité par défaut partout où cet aliment est utilisé.",
  },
  {
    date: '2026-08-18',
    title: 'Scan de code-barres plus fiable',
    description: "Le scanner de code-barres attend maintenant de lire deux fois le même code avant de le valider, pour éviter qu'une mauvaise lecture affiche un produit qui ne correspond pas du tout à ce que tu as scanné.",
  },
  {
    date: '2026-08-18',
    title: 'Recherche Open Food Facts plus fiable, avec filtres',
    description: "Le « erreur réseau » qui apparaissait souvent en cherchant un produit emballé devrait être bien plus rare : l'app réessaie maintenant automatiquement avant d'abandonner. Et quand une recherche ramène plusieurs résultats, deux listes déroulantes apparaissent pour filtrer par marque ou par catégorie et retrouver plus vite ce que tu cherches.",
  },
  {
    date: '2026-08-17',
    title: 'Favoris plus faciles à parcourir',
    description: "Quand tu ajoutes un aliment à ton journal, la liste de tes favoris ne s'affiche plus qu'en partie (les 20 premiers) avec un bouton pour voir les suivants — plus pratique maintenant que tu en as beaucoup. Le nombre total de favoris est aussi indiqué à côté du titre. Et le bouton + de la page Explorer a maintenant le même style que celui d'Aujourd'hui.",
  },
  {
    date: '2026-08-17',
    title: 'Quatre nouveautés dans Explorer',
    description: "Un bouton + est apparu sur chaque carte de l'explorateur : il ajoute direct l'aliment à ton journal, avec la quantité déjà calculée si tu combles un manque. Tu peux maintenant trier par « les plus utilisés » pour retrouver tes habitudes en un coup d'œil. Quand aucun aliment seul ne comble bien un manque dans tes calories restantes, l'explorateur te propose parfois deux aliments à combiner. Et sur la fiche d'un aliment, s'il existe une variante de la même famille nettement plus riche en ce qui te manque aujourd'hui, elle t'est suggérée — un appui dessus l'affiche à sa place.",
  },
  {
    date: '2026-08-17',
    title: 'Explorer te dit combien manger',
    description: "Dans l'explorateur, quand tu tapes sur un (ou plusieurs) nutriment qui te manque aujourd'hui et que tu coches « tient dans mes calories restantes », chaque aliment de la liste affiche maintenant directement le grammage qu'il faudrait manger pour combler ce(s) manque(s) sans dépasser tes calories restantes — si tu en choisis deux à la fois, le grammage couvre les deux en même temps, pas l'un après l'autre. Si un aliment ne peut pas tout combler dans ce budget, tu vois la quantité maximale qui rentre quand même et le pourcentage du manque que ça couvre.",
  },
  {
    date: '2026-08-17',
    title: 'La page Explorer est plus facile à lire',
    description: "Chaque aliment s'affiche maintenant sur sa propre carte, avec une pastille colorée qui rappelle sa famille (viandes, légumes, produits laitiers...) et un badge quand il est riche en protéines, en fibres ou en un nutriment intéressant. Ce qui te manque aujourd'hui tient sur une seule ligne qui défile sur le côté, et les boutons Trier et Filtrer ont été réduits à l'essentiel : tu vois les premiers aliments tout de suite, sans faire défiler. Dans les réglages, les longues listes de vitamines, de minéraux et de catégories sont repliées — tu les ouvres d'un appui quand tu en as besoin, et un petit chiffre te dit si tu y as laissé un filtre. Rien n'a disparu, tout est juste plus rapide à trouver.",
  },
  {
    date: '2026-08-17',
    title: 'Explore les aliments pour combler tes manques',
    description: "Une boussole est apparue en haut de l'écran : elle ouvre une nouvelle page pour fouiller dans la base des aliments et trouver quoi manger selon ce dont tu as besoin. Tout en haut, tu vois ce qui te manque aujourd'hui — fer, magnésium, protéines... — et il suffit de taper dessus pour ne garder que les aliments qui en sont riches. Tu peux classer la liste par n'importe quelle vitamine, minéral ou macro, dans les deux sens, et choisir comment comparer : pour 100 g, pour un budget de calories que tu fixes (50, 100, 200 ou 500), ou par portion. Ce choix compte : à calories égales, chaque aliment t'indique la quantité qu'il faudrait manger, ce qui évite de te faire miroiter des épices que tu ne mangeras jamais par 100 g. Côté filtres, tu peux demander « riche en » un nutriment précis, choisir une catégorie, ne voir que tes favoris, ou trier entre le cru, le cuit et ce qui est à cuire. Tes favoris gardent leur étoile, et tu peux ajouter un aliment à ton journal sans quitter la page.",
  },
  {
    date: '2026-08-15',
    title: 'Fini les chiffres soulignés en bleu sur iPhone',
    description: "Sur iPhone, Safari transformait parfois des nombres (calories, dates...) en liens bleus soulignés comme s'il s'agissait d'un numéro de téléphone. C'est corrigé, le texte garde sa couleur normale partout dans l'app.",
  },
  {
    date: '2026-08-15',
    title: 'Un onglet "Activité" dans ton espace Amies',
    description: "Un nouvel onglet \"Activité\" est apparu à côté de \"Fil\" et \"Amies\" : tu y retrouves qui a réagi ou commenté sur tes recettes et tes journées partagées, et qui a répondu à tes commentaires. Tape sur une notification pour ouvrir directement le partage concerné.",
  },
  {
    date: '2026-08-15',
    title: 'Partage aussi tes journées et tes repas',
    description: "En plus des recettes, tu peux maintenant partager une journée complète ou un seul repas (petit-déj, déjeuner, dîner, collation) avec tes amies. Depuis la page du jour ou le calendrier, une icône de partage apparaît sur chaque repas rempli et à côté de \"Repas du jour\" pour la journée entière. Tu choisis à chaque fois si tu montres seulement tes macros ou le détail de tes aliments. Le bouton \"Partager\" d'une recette est aussi accessible directement depuis la liste (menu \"...\" sur une carte), sans avoir à l'ouvrir.",
  },
  {
    date: '2026-08-15',
    title: 'Partage tes recettes avec tes amies',
    description: "Une nouvelle icône est apparue en haut, à côté du calendrier : elle ouvre ton espace \"Amies\". Choisis-toi un pseudo pour que tes amies puissent te trouver (onglet \"Amies\"), envoie et accepte des demandes, puis partage une recette depuis son menu \"...\" (\"Partager\") — elle apparaît dans le \"Fil\" de tes amies, avec ses ingrédients et sa préparation. Tu peux réagir avec des emojis directement depuis le fil, commenter et répondre aux commentaires, et une amie peut ajouter une recette que tu as partagée directement dans ses propres recettes en un clic. Un point rouge sur l'icône te prévient dès qu'une amie réagit ou commente chez toi.",
  },
  {
    date: '2026-08-15',
    title: 'Vois toutes tes programmations en un coup d\'œil',
    description: "Sur la page Calendrier, un nouveau bouton \"Mes programmations\" liste tous tes repas et compléments programmés à l'avance — les programmations récurrentes tiennent sur une seule ligne. Tu peux supprimer une programmation entière (toutes ses occurrences) en un clic, pratique si tu t'es trompée en programmant plusieurs jours d'un coup.",
  },
  {
    date: '2026-08-15',
    title: 'Modifie tes compléments directement depuis l\'accueil',
    description: "Tu peux maintenant taper sur un complément déjà pris ou programmé pour changer sa dose (gélules, comprimés...), avec le même écran que quand tu l'ajoutes, %AJR des vitamines et minéraux inclus.",
  },
  {
    date: '2026-08-14',
    title: 'Ajuste une recette sans la modifier',
    description: "Quand tu ajoutes une recette au journal (depuis son détail ou depuis le \"+\" de l'accueil), tu peux maintenant corriger le grammage d'un ou plusieurs ingrédients juste pour cette fois — par exemple si tu as mis moins de riz que prévu. Tape sur le grammage pour le modifier ; la recette enregistrée, elle, ne change pas. Depuis l'accueil, un bouton \"Modifier les quantités\" ouvre ce réglage.",
  },
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
