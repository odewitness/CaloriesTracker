# Chantier « Planificateur automatique de repas de la semaine »

Document de conception + suivi d'avancement. À faire évoluer au fil du chantier.
Créé le 2026-08-31.

**État au 2026-09-13 : Paliers 1 à 3 livrés et en prod (historique de plans,
batch cooking, plan de cuisine) ; Palier 4 (corrections de synchronisation
fournée/plan de cuisine + confort d'usage) livré.** Ce document fixe le
périmètre, les décisions prises avec l'utilisatrice, l'algorithme, les zones
d'ombre et le découpage en paliers. Reste : contraintes alimentaires (tags),
sélection multiple de recettes depuis la liste pour la fournée. Voir §7 pour le
détail palier par palier.

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
- **Pas de grammage libre dans le solveur, mais des multiples de demi-portion.**
  Décidé le 2026-08-31 (zone d'ombre A) : le solveur pose des portions entières
  (1×, 2×) et ne réduit jamais (« mange 143 g de gratin » est absurde). **Révisé
  le 2026-09-25** : la contrainte « jamais de baisse, jamais de fraction » se
  traduisait par un vivier trop restreint — une recette trop calorique ou trop
  légère pour la cible d'un repas n'était quasi jamais retenue, même avec
  beaucoup de recettes en base. Le solveur peut désormais ajuster UNE brique
  éligible par repas par **demi-portion, à la hausse ou à la baisse** (0,5× à
  3×, voir `PORTION_SCALE_OPTIONS` dans `mealPlanner.js`) — reste concret à
  servir (« une demi-part », « une part et demie ») sans être un grammage libre
  continu. Le récap **« À préparer »** affiche donc, par recette, le **nombre
  exact de portions** que le plan consomme (désormais possiblement fractionnaire)
  et le **facteur** à appliquer aux ingrédients pour y tomber pile
  (`portionsNeeded / recette.portions` : « recette telle quelle », « 2× la
  recette », « ×1,25 (prévue pour 4) »). La liste de courses est déjà exacte
  (ingrédients mis à l'échelle au prorata des portions utilisées). Une **page
  batch cooking dédiée** (recettes regroupées, cases à cocher) est une piste
  Palier 3. Le solveur préfère aussi les combinaisons où l'usage de chaque
  recette tombe sur un multiple propre de ses portions (`leftoverPortionPenalty`).
- **Réglage « Précision macros » (ajouté le 2026-09-25).** Trois niveaux
  (`config.macroStrictness` → `options.strictness` de `buildMealPlan`, voir
  `STRICTNESS_PRESETS` dans `mealPlanner.js`) : Stricte / Équilibrée (défaut,
  = comportement historique) / Souple. Le niveau agit sur trois leviers à la
  fois — pénalité de dépassement (`overshootPenalty`), plafond kcal autorisé
  pour ajuster une portion (`PORTION_SCALE_KCAL_CEILING`), et le biais du
  tirage pondéré qui choisit les recettes candidates d'une catégorie (moins
  concentré sur les mieux notées en mode Souple). Complète le réglage
  « nbDifferentes » : l'un élargit le NOMBRE de recettes différentes visées,
  l'autre élargit lesquelles PEUVENT matcher en tolérant plus d'écart aux
  cibles.
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
6. **Recherche locale** (améliorée le 2026-09-01, branche `feat-planner-fit`) :
   (a) **balayage glouton** — pour chaque position libre d'un pool, essayer les
   `SWEEP_MAX_ALTS` meilleures alternatives du vivier et garder la meilleure ;
   (b) `LOCAL_SEARCH_ROUNDS` passes **aléatoires** (alternative tirée au hasard,
   plus seulement la première du vivier — corrige une limite de la V1) pour
   sortir des optima locaux. `vivierScored` (candidats triés) mémorisé en
   phase 1 et réutilisé.
7. **Meilleur de N** (`useMealPlanner`, `BEST_OF = 4`) : chaque « Générer » /
   « Régénérer » tire N plans (seeds décalés de `0x9e3779b9`) et garde le
   `weekScore` le plus bas — évite de devoir régénérer à la main.

### 4.2 Fonction de score

Distance pondérée aux cibles, agrégée par jour **et** sur la période :

```
score = Σ_jours Σ_macros  w_macro × |apport - cible| / cible
      + pénalité de DÉPASSEMENT asymétrique (jour + semaine) :
          OVERSHOOT_KCAL_WEIGHT × max(0, apport−cible)/cible sur kcal (1,5)
          OVERSHOOT_MACRO_WEIGHT × idem sur prot/gluc/lip       (0,6)
      + pénalités (répétition, restes/portions, slot non rempli)
```

- Le terme de **dépassement** (2026-09-01) répond au constat « ça dépasse
  souvent les calories/macros » : le solveur ne sait qu'ajouter, jamais retirer,
  donc on rend le dépassement plus coûteux que le déficit. Les candidats de
  pool sont aussi pénalisés si leur portion dépasse déjà la part de cible
  calorique du slot.

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
- **Forme des `items`** (corrigé le 2026-08-31) : une brique recette = **UNE
  ligne agrégée** `food_source: 'recette'` (nom + grammage d'une portion +
  nutriments enrichis via `calcPer100g`), comme une recette ajoutée au journal
  depuis la recherche → « marquer mangé » recopie « Curry — 320 g », pas le
  détail des ingrédients. La **liste de courses** ré-explose cet item en
  ingrédients (`addPlannedItems`, voir §5). Un repas type reste développé en ses
  items (assemblage d'aliments). Aliments « en + » = `scaleFood`.
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

Depuis le 2026-08-31, `addPlannedItems` **ré-explose** tout item
`food_source: 'recette'` en ses `recette_ingredients` mis à l'échelle d'une
portion (`1 / recette.portions`) avant l'aplatissement — les briques recette
sont désormais stockées agrégées dans `repas_planifies.items` (voir §4.4). Les
plans appliqués avant cette date (items déjà explosés, `food_source`
`ciqual`/`custom`) passent inchangés.

---

## 6. Zones d'ombre

- **A. Nombre de portions comme levier — TRANCHÉ.** Pas de mise à l'échelle
  fractionnaire (pénible à présenter). Mais depuis le Palier 2 (2026-09-01) le
  solveur peut poser **1 ou 2 portions** (entières, plafond 2) d'une brique
  éligible (`Plat` / `Petit-déjeuner` / `Collation`) quand le repas reste loin
  sous sa cible et qu'un doublement s'en rapproche sans faire déborder les
  calories (`DOUBLE_KCAL_CEILING`) — une seule brique doublée par repas,
  activable via `allowDoublePortions` (case « Autoriser 2 portions… »).
  Réglage manuel 1 / 2 par brique dans l'aperçu (`setItemPortions`). Une
  pénalité légère en recherche locale (`leftoverPortionPenalty`,
  `LEFTOVER_PORTION_WEIGHT`) privilégie les plans où le total de portions d'une
  recette tombe sur un multiple propre de son rendement. Le récap **« À
  préparer »** (portions exactes + facteur) et une page batch cooking dédiée
  (Palier 3) restent le complément.
- **B. Saison : filtre dur ou bonus ? — TRANCHÉ (2026-08-31) : bonus.** Bonus de
  score, recettes sans saison utilisables. Case « filtre strict » dispo dans la
  config.
- **C. Aliments en + : favoris ou toute la base Ciqual ? — TRANCHÉ (2026-08-31) :
  favoris uniquement.** Pas d'ouverture à Ciqual.
- **D. Micros (vitamines / minéraux) — FAIT (Palier 2, 2026-08-31).** Pas de
  cible personnelle en base (seulement kcal + 4 macros + fibres) → on utilise
  les VNR fixes de l'Explorer (`getNutrientGaps` / `field.ref`). Correction : la
  table `recettes` **porte déjà** toutes les colonnes micro /100 g (comme les
  macros), pas besoin d'agréger `recette_ingredients`. Implémenté comme une
  **passe locale jour par jour** dans le solveur (`fillDayMicros`) après la pose
  des recettes + aliments « en + » macro : on somme les micros du jour, on prend
  les 1–2 manques les plus forts, on ajoute 1–2 favoris riches dans ces
  nutriments (via `gapCoverage`) sans dépasser les calories restantes de la
  journée. Pas dans l'optimisation globale. Activable/désactivable (`fillMicros`).
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
- ✅ **Éditer une brique** dans l'aperçu : remplacer une recette par une autre du
  même groupe (vivier), retirer une recette / un aliment « en + ». Toute
  édition manuelle verrouille le repas.
- ✅ **Cocher / décocher un repas** dans la config (`config.excludedMeals`, sans
  toucher `meal_enabled` global).
- ✅ **Slots regroupés par catégorie** (`slotGroupKey` = la catégorie) : « Plat »
  au déjeuner et au dîner partagent un vivier et un pool de N recettes (pas
  N + N) ; le « N× » se synchronise entre eux dans la config.
- ✅ **Interrupteur unique « piocher aussi dans mes repas types »**
  (`config.includeRepasTypes`, défaut oui) : quand actif, le vivier de chaque
  catégorie = recettes + repas types **de la même catégorie**. Pas de type de
  slot spécial, pas d'option « Un repas type » : un slot = une catégorie.
- ✅ Bouton « Générer un plan » de la vue Menus : date de début pré-réglée au
  1ᵉʳ jour de la semaine affichée.
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

- ✅ **Épingler une recette** avant génération (« je veux ce curry cette
  semaine ») : composant `PinPicker` par brique dans l'éditeur de composition.
  Une imposée entre forcément dans le pool de sa catégorie (même hors saison /
  hors filtre temps, via `candidateFromId`), n'est jamais remplacée par la
  recherche locale (`pinnedByKey`), et force `nbDifferentes` effectif ≥ nombre
  d'imposées. Imposées synchronisées entre briques de même catégorie.
  Rappel : « Plat » déjeuner + dîner = un seul pool → une recette imposée sur le
  déjeuner peut aussi tomber au dîner (comportement pool partagé, pas propre au
  pin). Pour l'avoir à tous les midis : `nbDifferentes` = 1 ou exclure le dîner.
- ✅ **Manques vitamines / minéraux** pris en compte pour les aliments en +
  (`fillDayMicros`, passe locale jour par jour — voir zone d'ombre D).
- ✅ **Filtre temps de cuisine** (`temps_preparation_min` + `temps_cuisson_min`,
  le repos ne compte pas) : segmenté Peu importe / ≤ 15 / 30 / 45 / 60 min.
  Recette sans temps renseigné, ou imposée → passe quand même.
- ✅ **2 portions/jour d'un même plat** (portions entières, plafond 2) : passe de
  doublement par repas dans `buildMealPlan` (`allowDoublePortions`,
  `DOUBLE_ELIGIBLE_CATEGORIES`, `DOUBLE_KCAL_CEILING`) — on double la brique
  éligible qui rapproche le plus le repas de sa cible sans déborder les calories.
  Réglage manuel 1 / 2 dans l'aperçu (`useMealPlanner.setItemPortions`, stepper
  dans `ItemEditor`). La ligne « recette » écrite dans `repas_planifies.items`
  porte le grammage de N portions + une clé `portions` (relue par
  `addPlannedItems` pour la liste de courses). Pénalité anti-restes légère en
  recherche locale (`leftoverPortionPenalty` / `LEFTOVER_PORTION_WEIGHT`) :
  privilégie les totaux de portions multiples du rendement d'une recette.
**Palier 2 : terminé** (2026-09-01).

### Palier 3 — Historique, reconduction & batch cooking

- ⚠️ **« Reprendre la semaine précédente » — RETIRÉ (2026-09-01, commit
  `8d81b71`)**, jugé cassé et inutile après coup. La fonction
  `duplicatePlannedMeals` reste dans `usePlannedMeals.js` (code mort, plus
  appelée nulle part) mais le bouton n'existe plus dans `WeekMenuBoard`. Chemin
  actuel le plus proche pour « reconduire une semaine » : réglages du
  planificateur → « Reprendre un plan enregistré » → charger un plan →
  « Régénérer » (même config, nouveaux tirages) → l'appliquer à la semaine
  voulue. Rien de plus rapide en un seul geste aujourd'hui.
- ✅ **Historique de plusieurs plans nommés** (2026-09-01, branche
  `feat-saved-meal-plans`) : table `plans_repas` (RLS own ; `nom`, `config`
  jsonb, `plan` jsonb = sortie `buildMealPlan`), hook `useMealPlans`
  (`savePlan` / `updatePlan` / `renamePlan` / `deletePlan`). Dans
  `MealPlannerModal` : `SavePlanCard` dans l'aperçu (« Enregistrer » / « Mettre
  à jour » si un plan est chargé / « Nouveau »), `SavedPlansSection` en tête des
  réglages (liste dépliable, ouvrir / renommer inline / supprimer).
  `useMealPlanner.loadSavedPlan(saved)` restaure `config` + `plan` (via
  `recomputePlanAggregates` pour rafraîchir les totaux si des recettes ont
  changé). « Générer » depuis les réglages détache du plan chargé, « Régénérer »
  le garde. Le plan rechargé passe par tous les chemins existants (éditer,
  appliquer à n'importe quelle semaine, liste de courses, fournée).
- ✅ **Page batch cooking** — **V1 livrée le 2026-09-01** (branche
  `feat-batch-cooking`). Page « Ma fournée » indépendante du planificateur
  (`docs/analyse-et-roadmap.md` §M9) : check-list de recettes à cuisiner,
  cochables « faite / à faire », barre d'avancement, portions optionnelles par
  recette. Table dédiée `batch_cooking_items` (RLS « own », voir
  `supabase/sql/batch_cooking_setup.sql`), hook `useBatchCooking`, composant
  `BatchCookingModal`. Entrée : Calendrier → Menus → « Ma fournée ». Ajout de
  recettes via un sélecteur interne. **Rattachée à une semaine** (colonne
  `semaine` = lundi, `unique(user_id, semaine, recette_id)`) : chaque semaine
  de la vue Menus a sa propre fournée ; `WeekMenuBoard` passe `days[0]`,
  `MealPlannerModal` passe `mondayOf(config.startDateStr)` (2026-09-01, branche
  `feat-fournee-per-week`). **Accepte aussi les repas types** (colonne
  `repas_type_id` + son unique, branche `feat-fournee-repas-types` 2026-09-01) :
  `useBatchCooking.addSources({ id, nom, kind })` gère les deux (2 upserts, un
  par contrainte), `MealPlannerModal` verse recettes + repas types du plan.
  Tap sur un repas type → `MealTemplateDetailWrapper`. Dans « Plan de cuisine »,
  un repas type figure dans le panneau « Ingrédients » (ses `items` inline,
  × portions/nb_portions) mais ne contribue **aucune étape** (les repas types
  n'ont pas de champ `instructions`).
- ✅ **« Plan de cuisine »** (2026-09-01, branche `feat-cooking-plan`) : depuis
  Ma fournée, bouton qui met bout à bout **toutes les étapes** des recettes de
  la fournée (`parseInstructionSteps` sur `recette.instructions`), réordonnables
  à la main (flèches ↑↓) + cochables. Chaque étape porte un badge couleur de sa
  recette. Grammages ré-injectés dans le texte (`annotateInstructionSteps`) à
  l'échelle des portions à préparer ; panneau dépliable « Ingrédients par
  recette » (idem échelle). Table dédiée `batch_cooking_steps` (RLS own,
  `supabase/sql/batch_cooking_steps_setup.sql`), hook `useBatchCookingSteps`,
  composant `CookingPlanModal`. V1 = un plan courant, `texte` snapshoté, bouton
  « Régénérer depuis les recettes ». C'est **l'utilisatrice qui fait
  l'entrelacement** (pas d'ordonnancement automatique — voir §8 / paliers
  suivants). Dépend de la qualité des `instructions` (une action par ligne).
- ✅ **Raccordement planificateur → fournée** (2026-09-01, branche
  `feat-planner-to-batch`) : « Appliquer au calendrier » verse aussi les
  recettes ET repas types du plan (récap `batchSummary`) dans
  `batch_cooking_items` avec `portions = portionsNeeded`, silencieusement (un
  seul toast). Bouton « Ajouter à Ma fournée » dans le récap « À préparer » pour
  le faire sans appliquer au calendrier — visible dès que le récap contient au
  moins un élément, recette ou repas type (corrigé le 2026-09-13, voir Palier 4 :
  la condition ne filtrait qu'aux recettes, cachant le bouton pour un plan
  100 % repas types). Dédoublonné (`upsert` ON CONFLICT DO NOTHING sur
  `unique(user_id, recette_id)` — l'état « fait » d'une recette déjà présente
  n'est pas écrasé). Le récap interne « À préparer » de `MealPlannerModal` est
  **conservé** (pas remplacé).
  ~~Reste : sélection multiple depuis la liste des recettes~~ → fait, voir
  Palier 5.
- Contraintes alimentaires (tags simples).

### Palier 4 — Corrections & confort d'usage (2026-09-13)

Suite à un retour utilisatrice (« ce n'est pas toujours pratique ») sur le
planificateur + Ma fournée. Trois bugs de désynchronisation fournée/plan de
cuisine/plan de repas + six améliorations de confort.

- ✅ **Retirer/remplacer le plan de la semaine vide aussi Ma fournée**
  (`batch_cooking_items`) **et le plan de cuisine** (`batch_cooking_steps`) de
  cette semaine. Les trois tables sont indexées indépendamment sur `semaine` /
  `recurrence_group_id`, sans clé étrangère entre elles — sans ce nettoyage
  explicite à chaque point de retrait (`WeekMenuBoard.handleRemovePlan`,
  `MealPlannerModal.handleRemovePlan` et la branche `replacing` de
  `handleApply`), les deux restaient orphelins.
- ✅ **« Plan de cuisine » se resynchronise sans tout casser.** Nouvelle méthode
  `sync` dans `useBatchCookingSteps` : ajoute les étapes des recettes
  nouvellement présentes dans la fournée, retire celles des recettes qui n'y
  sont plus, **sans toucher à l'ordre ni aux cases déjà cochées** des étapes
  qui restent. Appelée automatiquement (`CookingPlanModal`) dès que la
  composition de la fournée change après une première génération. « Régénérer
  depuis les recettes » (reset complet, perd tout) reste disponible pour un
  vrai nouveau départ (ex. instructions d'une recette réécrites).
- ✅ **Bouton « Ajouter à Ma fournée » visible pour un plan 100 % repas types**
  (voir correction ci-dessus, §7 Palier 3).
- ✅ **Réglages du planificateur mémorisés** (`localStorage`,
  `meal-planner:last-config`) : composition des repas, temps de cuisson,
  saison, bascules… sont repris tels quels à la prochaine ouverture (hors date
  de début, toujours celle de la semaine ouverte). Avant : configuration
  entièrement à refaire à chaque nouveau plan, sauf à recharger un plan
  enregistré.
- ✅ **Plafond de portions manuelles relevé** (`MAX_MANUAL_PORTIONS = 6` dans
  `useMealPlanner.js`, contre 2 avant) : le réglage manuel d'une brique dans
  l'aperçu (`ItemEditor`) va au-delà du plafond du solveur automatique (qui
  reste à 2, voir zone d'ombre A) — pour une vraie session de batch cooking
  (« je cuisine ce plat une fois pour 5 jours »).
- ✅ **Ma fournée propose de reprendre les éléments non faits de la semaine
  précédente** quand la fournée de la semaine affichée est vide
  (`BatchCookingModal`, requête sur `batch_cooking_items` de `semaine - 7j`
  filtrée `fait = false`). Remplace en pratique l'ancien « Reprendre la semaine
  précédente » du plan de repas (retiré, voir §7 Palier 3) pour le cas d'usage
  fournée.
- ✅ **Filtre par catégorie dans le sélecteur d'ajout à la fournée**
  (`SourcePicker`) : chips de catégories réellement présentes parmi les
  options restantes, en plus de la recherche texte.
- ✅ **Compteur sur le bouton « Ma fournée »** dans la vue Menus (`fait / total`)
  — savoir d'un coup d'œil s'il y a quelque chose en attente sans ouvrir la
  modale.
- ✅ **Écran de configuration : « Options avancées » repliée par défaut**
  (`Collapsible defaultOpen={false}`) — cohérent avec la mémorisation des
  réglages ci-dessus : une utilisatrice qui revient n'a plus besoin de la
  rouvrir à chaque fois, et un premier essai voit d'abord l'essentiel (jours,
  date de début).

### Palier 5 — Sélecteur de fournée façon « Mes aliments » (2026-09-25)

Branche `feature/fournee-selecteur`. Le mini-sélecteur (liste de 240 px, nom +
puces de catégorie) est remplacé pour choisir ses recettes « intelligemment ».

- ✅ **`BatchSourcePicker`** : page plein écran, onglets Recettes / Repas types.
  Recherche (nom + ingrédients), feuille « Trier & filtrer » réutilisée
  (`SortModal` pour les recettes : catégorie, saison, temps, tri macros ;
  `MealTemplateSortModal` pour les repas types), regroupement repliable par
  catégorie, cartes cochables avec macros d'une portion, badge nutritionnel,
  saison, temps, détail des ingrédients dépliable. Pied de page : nombre de
  sélectionnés + total kcal / protéines d'UNE portion de chacun. Sélection
  conservée en changeant d'onglet. Les éléments déjà dans la fournée sont
  masqués. Macros par portion via `recipePortionMacros` /
  `templateServingMacros` (`mealPlanner.js`). Le picker duplique volontairement
  la carte de `RecipesSection` plutôt que de la refactorer (pas de risque de
  régression sur « Mes aliments »).
- ✅ **Bandeau « Ce que ça représente »** en haut de la fournée : total
  kcal / protéines des portions à préparer (1 par défaut si non renseigné),
  moyenne par jour, et part des objectifs **de la semaine** (`goal_* × 7`,
  sans ajustement cycle/sport) couverte par la fournée. Ton neutre, pas de feu
  tricolore : la fournée ne couvre qu'une partie des repas.
- ✅ **Macros sur chaque ligne** de la fournée (par portion + total si
  portions > 1).
- Pas fait (idées) : filtres rapides « riche en protéines / léger / de saison /
  rapide », stepper de portions au pas de 0,5, « Compléter la fournée »
  (suggestions du solveur).

### Palier 6 — Mode aléatoire, recettes interdites, retour arrière (2026-09-26)

Branche `feature/planner-random-ban-undo`.

- ✅ **Mode « Au hasard, sans contrainte de macros »** (`config.randomMode` →
  `options.randomMode` de `buildMealPlan`). Les filtres restent appliqués
  (catégorie du slot, saison, temps de cuisine, repas types, interdites,
  imposées, `nbDifferentes`, anti-répétition dans la journée). Ce qui est
  coupé : note macro des candidats (tirage dans tout le vivier, uniforme sauf
  les recettes de la saison choisie qui pèsent double → « de saison en
  priorité » garde un sens), ajustement de portions, aliments « en + », passe micros, recherche locale, et
  le « meilleur de N » du hook (1 seul tirage). Le score / feu tricolore restent
  calculés et affichés à titre indicatif. Les recettes sans valeurs
  nutritionnelles ou sans poids de portion restent hors vivier (les macros
  servent encore à l'affichage).
- ✅ **Recettes interdites** (`config.bannedIds`, mémorisé avec les autres
  réglages) : `buildVivier({ bannedIds })` les exclut de tous les viviers, y
  compris des remplacements proposés dans l'aperçu (`swapCandidates`). Un repas
  verrouillé qui en contient une la garde (le verrou prime).
- ✅ **Retour après « Régénérer »** : pile `history` (10 max) dans
  `useMealPlanner`, chaque (re)génération y empile le plan remplacé + ses
  verrous ; `undoGenerate()` le rétablit (bouton « Retour » de l'aperçu, visible
  quand la pile n'est pas vide). Vidée par `reset` et `loadSavedPlan`. Ne
  restaure que le plan, pas la config.

#### Refonte de l'écran de réglages (même branche, 2026-09-26)

Retour utilisatrice : « Options avancées » repliée alors qu'elle s'en sert à
chaque fois, imposées (dans chaque brique) et interdites (dans les options)
éparpillées. Nouveau parcours, un seul écran sans section repliée :

1. **Quand ?** — jours, date de début, personnes (sous-titre = plage de dates).
2. **Comment choisir les plats ?** — deux cartes « Selon mes objectifs » /
   « Au hasard ». Les réglages macros (précision, ajuster les portions,
   vitamines) ne s'affichent que sous « Selon mes objectifs ».
3. **Quels repas ?** — une carte par repas (case « dans ce plan » + briques).
   Sous chaque brique : nombre de recettes possibles avec les filtres du
   moment (`possibleByCategory`, 0 → alerte), imposées qui y tombent, partage
   du pool avec les autres repas de même catégorie.
4. **Quelles recettes ?** — saison (Toutes / 4 saisons, puis « en priorité » /
   « uniquement » au lieu d'une case « stricte »), temps de cuisine, repas
   types ; puis un bloc « Imposées et interdites » (pastilles retirables d'un
   tap) et un bouton vers la page **`PlannerRecipeRulesSheet`** : toutes les
   recettes + repas types, recherche, onglets Toutes / Imposées / Interdites,
   chips de catégorie, deux boutons 📌 / 🚫 par ligne, et la raison pour
   laquelle une recette ne sortirait pas d'elle-même (hors saison, trop longue,
   aucune brique de sa catégorie, sans valeurs nutritionnelles…).

Pied de page fixe : résumé (jours · repas/jour · recettes possibles) + bouton
« Générer le plan » / « Tirer un plan au hasard ». « Reprendre un plan
enregistré » est désormais replié par défaut (usage ponctuel).

**Modèle de données** : les imposées ne sont plus par brique mais une liste
unique `config.pinnedIds`, symétrique de `config.bannedIds` (exclusives,
`setRecipeRule(id, 'pinned' | 'banned' | null)`). `useMealPlanner`
(`distributePinned`) les place dans la brique de la première de leurs
catégories présente dans le plan, et remplit `slot.pinnedIds` pour le solveur
(inchangé). Une imposée sans brique de sa catégorie → `unplacedPinnedIds`
(pastille orange). `normalizeConfig` convertit les configs enregistrées à
l'ancien format (localStorage et `plans_repas.config`). Dans l'aperçu,
l'éditeur d'une brique propose aussi « Ne plus jamais proposer » : interdit la
recette et la remplace aussitôt par une autre de sa catégorie.

**Collation toujours proposée** (bug : elle n'apparaissait pas). Deux causes :
(1) seuls les repas activés dans le profil étaient proposés, or la Collation
s'active souvent jour par jour (`collation_jours`) ; (2) une composition
personnalisée (`config.mealConfig`, mémorisée) figeait la liste des repas.
Désormais `defaultMealConfig(days)` renvoie les 4 repas, `baseMealConfig`
complète la composition enregistrée par les défauts, et la Collation est
toujours listée : décochée si désactivée dans le profil, cochable
(`config.forcedMeals`). Forcée, elle est activée dans les cibles du plan
(`computeMealTargets` avec `meal_enabled.Collation = true`, ses calories prises
sur les autres repas comme sur la page du jour) et, à l'application,
`collation_jours` est mis à `active = true` pour les jours où elle est
planifiée. Retirer le plan ne remet pas ces jours à « désactivée ».

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
