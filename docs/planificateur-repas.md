# Chantier « Planificateur automatique de repas de la semaine »

Document de conception + suivi d'avancement. À faire évoluer au fil du chantier.
Créé le 2026-08-31.

**État au 2026-08-31 : cadrage.** Rien de développé. Ce document fixe le
périmètre, les décisions prises avec l'utilisatrice, l'algorithme envisagé, les
zones d'ombre et le découpage en paliers.

---

## 1. Objectif et périmètre

Générer un plan de repas sur **1 à 7 jours** à partir des recettes et des repas
types de l'utilisatrice, en cherchant à **approcher ses cibles macro**
(`settings.goal_kcal` + `goal_proteines` / `goal_glucides` / `goal_lipides` /
`goal_fibres`), puis à **compléter chaque repas par des aliments « en + »** pour
resserrer l'écart aux cibles et combler les manques en vitamines / minéraux.

Entrées demandées à l'utilisatrice avant génération :

- **Nombre de jours** : 1 à 7.
- **Nombre de personnes** : agit sur les **quantités de la liste de courses**
  (× portions cuisinées), **pas** sur le fit macro (les macros par portion ne
  changent pas). À expliciter dans l'UI pour éviter la confusion.
- **Saison** : `Printemps` / `Été` / `Automne` / `Hiver` (voir
  `src/lib/seasons.js`). Sert à filtrer / bonifier le vivier de recettes.
- **Repas à planifier** : parmi les repas activés (`settings.meal_enabled`, et la
  surcharge par jour `collation_jours` pour la Collation).
- **Composition de chaque repas** (voir §3.1) : quelles « briques » l'utilisatrice
  veut, par catégorie.
- **Nombre de recettes différentes par repas sur la période** : p. ex. « 2 petits
  déjeuners différents sur la semaine », « 1 seul plat pour tous les midis ». Sert
  de contrainte de batch-cooking et **réduit fortement l'espace de recherche**.

Sorties :

- Un **plan** : pour chaque jour × repas, les recettes / repas types retenus +
  les aliments « en + ».
- Un **récapitulatif macro à 3 niveaux** : par repas, par jour, sur la période,
  avec l'écart aux cibles en feu tricolore.
- Un bouton **« Appliquer au calendrier »** → création des `repas_planifies`.
- Un bouton **« Ajouter à la liste de courses »** → réutilise M5 (voir §5).

---

## 2. Décisions cadrées avec l'utilisatrice (2026-08-31)

- **Portions = celles renseignées dans la recette.** Pas de scaling libre du
  grammage (« mange 143 g de gratin » est absurde). Une portion recette = son
  poids par portion (`poids_cuit_g / portions`, ou à défaut `poids_cru_g /
  portions`). L'ajustement fin aux cibles se fait par les **aliments « en + »**,
  pas en étirant les recettes.
- **Composition des repas configurable, pas « 1 recette = 1 repas ».**
  L'utilisatrice choisit, pour chaque repas, les briques qu'elle veut, par
  catégorie de recette. Exemples : petit-déjeuner = 1 recette catégorie
  `Petit-déjeuner` ; déjeuner = 1 `Plat` + 1 `Dessert` ; dîner = 1 `Plat` +
  1 `Accompagnement` ; etc. Voir §3.1.
- **Aliments « en + » : favoris uniquement.** Décidé le 2026-08-31 — on n'ouvre
  pas à toute la base Ciqual (zone d'ombre C close). Moteur `TodayGapsSection` /
  `portionGapCoverage`.
- **Saison = préférence, pas filtre strict.** Décidé le 2026-08-31 (zone d'ombre B
  close) : bonus de score, les recettes sans saison restent utilisables. Une
  option « filtre strict » existe dans l'écran de config pour qui veut.
- **Pas de mise à l'échelle fractionnaire dans le solveur** (décidé le
  2026-08-31, zone d'ombre A) : le solveur pose des portions entières. **Mais
  pas de « rab » non plus** — planifier sert à avoir le bon nombre. Le récap
  **« À préparer »** affiche donc, par recette, le **nombre exact de portions**
  que le plan consomme et le **facteur** à appliquer aux ingrédients pour y
  tomber pile (`portionsNeeded / recette.portions` : « recette telle quelle »,
  « 2× la recette », « ×1,25 (prévue pour 4) »). La liste de courses est déjà
  exacte (ingrédients mis à l'échelle au prorata des portions utilisées). Une
  **page batch cooking dédiée** (recettes regroupées, cases à cocher) est une
  piste Palier 3. Piste Palier 2 : que le solveur préfère les combinaisons où
  l'usage de chaque recette tombe sur un multiple propre de ses portions.
- **On avance par paliers** (voir §7). Palier 1 = macros seulement.
- **Le plan s'écrit dans `repas_planifies`** (pas de nouvelle table de « plans »
  au palier 1), après un écran d'aperçu et validation. Voir §4.4.

---

## 3. Modèle retenu

### 3.1 Composition d'un repas (les « slots »)

Un repas planifié est décrit par une liste de **slots**. Un slot cible soit une
**catégorie de recette**, soit un **repas type**, avec un nombre de recettes
différentes à tirer sur la période.

```
mealPlanConfig = {
  'Petit-déjeuner': [
    { type: 'recette', categorie: 'Petit-déjeuner', nbDifferentes: 2 },
  ],
  'Déjeuner': [
    { type: 'recette', categorie: 'Plat',    nbDifferentes: 3 },
    { type: 'recette', categorie: 'Dessert', nbDifferentes: 2 },
  ],
  'Dîner': [
    { type: 'recette', categorie: 'Plat',           nbDifferentes: 3 },
    { type: 'recette', categorie: 'Accompagnement', nbDifferentes: 2 },
  ],
  'Collation': [
    { type: 'recette', categorie: 'Collation', nbDifferentes: 1 },
  ],
}
```

- Catégories disponibles côté `recettes` : `Petit-déjeuner` | `Collation` |
  `Plat` | `Accompagnement` | `Boisson` | `Dessert`. Côté `repas_types`, en plus :
  `Pain / pâtes`.
- Un slot `{ type: 'repas_type' }` remplit un repas entier avec un repas type
  (ceux-ci portent déjà leurs `items` scalés + tous les nutriments).
- Valeurs par défaut proposées à l'ouverture (modifiables) : 1 brique par repas,
  catégorie déduite du repas (`Petit-déjeuner` → catégorie `Petit-déjeuner`,
  déjeuner / dîner → `Plat`, `Collation` → `Collation`).

### 3.2 Cibles par repas

Répartition des `goal_*` du jour entre les repas activés :

- Si `settings.meal_overrides` porte déjà un split par repas → l'utiliser.
- Sinon, split par défaut sur les repas activés du jour, p. ex. petit-déj 25 % /
  déjeuner 35 % / collation 10 % / dîner 30 % (à ajuster ; renormaliser sur les
  repas réellement activés ce jour-là).
- Cohérence avec le reste de l'app : si le suivi de cycle est actif avec
  `cycle.appliquer_delta_energie`, la cible kcal de certains jours est décalée →
  le planificateur doit repartir de la **même** cible effective que la page du
  jour.

### 3.3 Aliments « en + »

Après avoir posé les recettes d'un repas, on calcule le **reste à cibler** =
cible du repas − apport des recettes, macro par macro. Puis on comble avec le
moteur de suggestion existant (`TodayGapsSection` : `portionGapCoverage`, greedy
par manque, priorité à ce qui tient dans les kcal restantes) :

- Vivier = **favoris** (palier 1). Modes déjà en place : récents / plus consommés
  / jamais consommés.
- Le moteur **ne sait qu'ajouter**, pas retirer. Si les recettes **dépassent**
  déjà la cible → pas d'aliment en + sur ce repas, et signaler l'écart dans
  l'aperçu (l'utilisatrice choisira une recette plus légère ou enlèvera une
  brique).
- Les aliments en + retenus deviennent des `items` libres du `repas_planifie`
  correspondant (donc partent aussi dans la liste de courses).

### 3.4 Contraintes & bonus de sélection des recettes

- **Filtre dur** : catégorie du slot, `energie_kcal` non nul (exclure les
  recettes sans valeurs nutritionnelles ou aberrantes).
- **Saison** : à trancher — filtre dur (`filterBySeasons`, qui exclut les
  recettes sans saison renseignée) ou simple **bonus de score**. Voir §6, zone
  d'ombre B.
- **Bonus** : variété (ne pas répéter la même recette deux repas de suite),
  anti-collision intra-jour (éviter `Plat` pâtes midi + `Plat` pâtes soir),
  éventuellement `temps_preparation_min + temps_cuisson_min` sous un seuil en
  semaine (palier ultérieur).

---

## 4. Algorithme (palier 1, macros seulement)

Problème d'**affectation sous contraintes**, résolu par une **heuristique
gloutonne + recherche locale** (pas d'ILP, pas d'infra ; cohérent avec la fiche
C1 de `docs/analyse-et-roadmap.md`).

### 4.1 Étapes

1. **Vivier** : pour chaque slot, filtrer les recettes / repas types (catégorie,
   saison, valeurs nutritionnelles présentes).
2. **Tirage des recettes de la période** : pour chaque slot, choisir
   `nbDifferentes` recettes. Critère : que leur **profil macro moyen par portion**
   soit le plus proche possible de la part de cible du slot. Tirage aléatoire
   pondéré parmi les meilleures (variété + réponse au bouton « régénérer »).
3. **Affectation aux jours** : répartir les recettes tirées sur les jours (round
   robin, en évitant deux jours consécutifs identiques quand `nbDifferentes` le
   permet).
4. **Nombre de portions par jour** : 1 par défaut. Levier intermédiaire optionnel
   à confirmer — autoriser 0,5 / 1 / 1,5 / 2 portions pour se rapprocher de la
   cible sans étirer le grammage brut (voir §6, zone d'ombre A).
5. **Aliments « en + »** par repas (voir §3.3) sur le reste à cibler.
6. **Recherche locale** : quelques passes de swap (remplacer une recette par une
   autre du vivier, re-répartir, recompter) ; on garde le meilleur score.
   Plafonner les itérations (tourne en JS sur mobile).

### 4.2 Fonction de score

Distance pondérée aux cibles, agrégée par jour **et** sur la période :

```
score = Σ_jours Σ_macros  w_macro × |apport - cible| / cible
      + pénalités (répétition, collision intra-jour, dépassement kcal, slot non rempli)
```

- Pondérer la **protéine** plus fort : c'est la contrainte serrée (objectif type
  100 g sur 1800 kcal ≈ 22 % des calories).
- Score affiché à l'utilisatrice sous forme de **feu tricolore** par repas / jour
  / période, jamais un chiffre sec anxiogène (cohérent avec le ton de C4
  « une projection n'est pas une prédiction »).

### 4.3 Garder la main

- **Régénérer** tout, ou **verrouiller** un jour / un repas / une recette et
  régénérer le reste (pattern `PlannedSeriesModal` + shuffle de
  `TodayGapsSection`).
- **Épingler une recette obligatoire** avant génération (« je veux ce curry cette
  semaine »).
- Après génération : changer une recette, ajuster le nombre de portions, ajouter /
  retirer un aliment en +, le tout avant d'appliquer.

### 4.4 Application au calendrier

- L'aperçu vit en mémoire (ou `localStorage`) jusqu'à **« Appliquer »**.
- « Appliquer » crée les `repas_planifies` (`date`, `meal`, `nom`, `items`,
  `source_type` `'recette'` | `'repas_type'` | `'libre'`, `source_id`), avec un
  `recurrence_group_id` commun à tout le plan (permet un « retirer tout le plan »).
- **Conflits** : si des repas sont déjà planifiés / déjà mangés sur la plage,
  demander (remplacer / garder / compléter les créneaux vides seulement). Ne
  jamais écraser un repas `mange = true`.
- Respecter les **jours exclus** (`jours_exclus`) : pas de plan sur ces jours.

---

## 5. Liste de courses — déjà en place (M5)

Rien à redévelopper côté agrégation. `useShoppingListItems.addPlannedItems`
(livré le 2026-08-30, fiche M5) aplatit les `items` des repas planifiés d'une
plage, résout la catégorie de rayon, fusionne les doublons (grammages
additionnés, noms des repas d'origine listés) et insère dans
`liste_courses_items`. Le planificateur écrit dans `repas_planifies` → il suffit
de rediriger vers ce chemin (ou d'appeler `addPlannedItems` sur le plan fraîchement
appliqué). Multiplication par le **nombre de personnes** à appliquer ici.

---

## 6. Zones d'ombre

- **A. Nombre de portions comme levier — TRANCHÉ (2026-08-31) : non.** L'app
  n'incrémente les portions que de +1 et une recette fait un nombre fixe de
  portions ; une mise à l'échelle fractionnaire serait pénible à présenter. À la
  place : **récap « À préparer »** (batch cooking) dans l'aperçu — nombre de
  fournées entières par recette, portions utilisées, reste. Page batch cooking
  dédiée = piste Palier 3.
- **B. Saison : filtre dur ou bonus ? — TRANCHÉ (2026-08-31) : bonus.** Bonus de
  score, recettes sans saison utilisables. Case « filtre strict » dispo dans la
  config.
- **C. Aliments en + : favoris ou toute la base Ciqual ? — TRANCHÉ (2026-08-31) :
  favoris uniquement.** Pas d'ouverture à Ciqual.
- **D. Micros (vitamines / minéraux).** Pas de cible en base (seulement kcal +
  4 macros + fibres). Les recettes n'ont **pas** les colonnes micro : il faut
  agréger `recette_ingredients`. *Décision : palier 1 = macros seulement. Micros
  au palier 2, via le moteur `TodayGapsSection` appliqué jour par jour après la
  pose des recettes — pas dans l'optimisation globale.*
- **E. Un seul plan à la fois ?** Historique des plans, « reconduire la semaine
  dernière » ? *Palier 1 : un plan courant, écrasé à la regénération avant
  application. Historique = palier ultérieur.*
- **F. Modèle de repas type dans un slot.** Un repas type remplit-il tout le
  repas (exclusif des autres slots) ou peut-il cohabiter avec une brique recette ?
  *Penchant : exclusif — un slot `repas_type` = tout le repas.*
- **G. Restes / batch-cooking.** « 1 seul déj pour la semaine » = cuisiner ×7 d'un
  coup. L'app ne modélise pas les restes / la congélation → formuler comme « tu
  prépares X, tu en manges 1 portion/jour ». La liste de courses, elle, compte
  bien ×7.
- **H. Contraintes alimentaires** (végé, allergies, « pas de poisson le soir ») :
  aucun modèle aujourd'hui. Hors périmètre palier 1.

---

## 7. Paliers

### Palier 1 — Plan macro, portions fixes

- ✅ Écran de config : jours (1–7), **date de début**, personnes, saison (+ case
  filtre strict), composition par briques (catégorie de recette / repas type) +
  nb de recettes différentes par repas.
- ✅ Vivier recettes + repas types, filtre catégorie + valeurs nutritionnelles +
  portion dimensionnable ; saison en bonus.
- ✅ Heuristique gloutonne + recherche locale sur les macros (§4), RNG
  déterministe. Anti-répétition : pas deux fois la même brique dans une journée.
- ✅ Aliments en + parmi les **favoris**, sur le reste à cibler, dédupliqués sur
  la journée.
- ✅ Aperçu 3 niveaux (repas / jour / période) + feu tricolore + récap
  « À préparer » (portions exactes + facteur d'échelle des ingrédients).
- ✅ Régénérer.
- ✅ **Verrouiller** un jour / un repas (cadenas dans l'aperçu) : conservés à la
  régénération, comptés dans l'anti-répétition. `buildMealPlan({ locked })`.
- ✅ **Éditer une brique** dans l'aperçu : remplacer une recette par une autre de
  la même catégorie (vivier), retirer une recette / un aliment « en + ». Toute
  édition manuelle verrouille le repas.
- ✅ « Appliquer au calendrier » → `repas_planifies` avec `recurrence_group_id`,
  conflits (skip / add, jamais d'écrasement) + jours exclus.
- ✅ « Générer la liste de courses » inline (× personnes) + « Retirer tout le
  plan » en un clic dans la modale.
- ✅ Vue Menus : bouton **« Retirer le plan généré de cette semaine »** quand la
  semaine affichée contient des repas d'un plan généré (identifiés par
  `recurrence_group_id` stashé en `localStorage`, `meal-planner:applied-plans`).
**Palier 1 : terminé** (hors épinglage, repoussé au Palier 2 — le verrouillage +
l'édition de brique couvrent le besoin « garder la main »).

### Palier 2 — Micros + confort

- **Épingler une recette** avant génération (« je veux ce curry cette semaine ») :
  le solveur lit déjà `slot.pinnedIds` ; reste l'UI (sélecteur de recette dans
  l'éditeur de composition).
- Manques vitamines / minéraux pris en compte pour les aliments en + (agrégation
  `recette_ingredients` pour les recettes ; `items` déjà OK pour les repas types).
- Solveur : autoriser **2 portions/jour** d'un même plat (portions entières) pour
  mieux coller aux cibles + privilégier les usages tombant sur un multiple propre
  des portions d'une recette.
- Filtre temps de cuisine (`temps_preparation_min` + `temps_cuisson_min`).

### Palier 3 — Historique, reconduction & batch cooking

- Plusieurs plans conservés, « reconduire / repartir de la semaine dernière ».
- **Page batch cooking** : recettes du plan regroupées, quantités à préparer,
  cases à cocher au fur et à mesure (nécessite un stockage — table ou
  `localStorage`).
- Contraintes alimentaires (tags simples).

---

## 8. Alertes / points de vigilance

- **Complexité** : c'est la plus grosse fiche de la roadmap (≥ C1). Tenir le
  découpage en paliers, ne pas tout charger dans le palier 1.
- **Perf mobile** : 7 j × N repas × M recettes en JS sur un téléphone. Filtrer
  tôt, plafonner les itérations, charger la vue + le solveur en **lazy** (bundle
  déjà à 1,49 Mo, pas de code-splitting).
- **Qualité des données recettes** : des macros /100 g fausses ou absentes → un
  plan faux avec aplomb. Exclure et signaler.
- **Résultats « numériquement bons, gastronomiquement douteux »** : la main de
  l'utilisatrice (swap / portions / verrou / régénérer) est le garde-fou, pas une
  option.
- **Attentes** : « intelligent » = scoring déterministe, pas un LLM. Ne pas
  survendre. Une couche langage naturel serait la fiche C2 (coût API, hors sujet).
- **Rapport à la nourriture** : générer des grammages « pour coller aux macros »
  peut nourrir un rapport rigide. Rester sur des **fourchettes** et « objectif
  approché », jamais de culpabilisation sur l'écart (ton déjà tenu ailleurs dans
  l'app).
- **Données** : en restant sur `repas_planifies` / `liste_courses_items`, aucun
  risque RLS nouveau (tables déjà en RLS « own »).

---

## 9. Références code

- Vue semaine + pose des repas : `src/components/WeekMenuBoard.jsx`,
  `src/components/PlanMealModal.jsx`, `src/hooks/usePlannedMeals.js`.
- Liste de courses depuis les repas prévus : `src/hooks/useShoppingLists.js`
  (`addPlannedItems`), `src/components/AddFromPlannedModal.jsx`.
- Moteur d'aliments en + : `src/components/TodayGapsSection.jsx`,
  `src/lib/ciqualExplorer.js` (`portionGapCoverage`).
- Recettes : `src/hooks/useRecipes.js` (`sumIngredients`, `calcPer100g`),
  `supabase_schema.sql` table `recettes` (macros /100 g, `portions`,
  `poids_cuit_g`, `categories`, `saisons`).
- Repas types : `src/hooks/useMealTemplates.js`, table `repas_types`
  (`items` scalés, `nb_portions`, `categories`, `saisons`).
- Saisons : `src/lib/seasons.js`.
- Cibles & répartition : `settings.goal_*`, `settings.meal_overrides`,
  `settings.meal_enabled`, `collation_jours`, `cycle.appliquer_delta_energie`.
- Fiches liées dans `docs/analyse-et-roadmap.md` : **M5** (livré) et **C1**
  (à faire) — ce chantier est leur prolongement.
