# Chantier « Manger en fonction du cycle menstruel »

Document de conception + suivi d'avancement. À faire évoluer au fil du chantier.
Créé le 2026-08-29.

---

## 1. Objectif et périmètre

Adapter l'accompagnement nutritionnel de l'app à la phase du cycle menstruel :
cibles caloriques et macros, et mise en avant de certains minéraux / vitamines.

**Décisions cadrées avec l'utilisatrice (2026-08-29) :**

- **Pas de contraception hormonale** → le cycle naturel s'exprime, la logique de
  phases a du sens. On garde quand même un interrupteur « je suis passée sous
  contraception hormonale » qui neutralise toute la logique de phases (mode
  suivi des règles seul), pour ne pas avoir à re-développer plus tard.
- **Pas de synchronisation possible avec « Mon Calendrier »** (l'app tierce
  utilisée aujourd'hui n'exporte rien). Donc : **saisie manuelle** du 1er jour
  des règles + possibilité de **remonter plusieurs cycles passés** pour amorcer
  les moyennes.
- **On fera tout à terme.** On avance par paliers (voir §6). Ce qui n'est pas
  encore fait est listé en §7.
- La saisie manuelle reste la source de vérité. La base de données est conçue
  pour qu'un import (CSV) ou une lecture Health Connect / Apple Santé via un
  wrapper natif puisse alimenter la **même table `regles`** plus tard, sans
  refonte.

---

## 2. État de la science (synthèse)

**Posture générale à tenir dans l'app :** le « cycle syncing » tel que vendu sur
les réseaux (régime radicalement différent par phase) n'a quasiment aucune base
clinique. Ce qui est réellement documenté, ce sont de **petites variations
physiologiques**, sur des études hétérogènes, avec apports le plus souvent
auto-déclarés et définitions de phases incohérentes. → On **informe** et on
**propose de petits ajustements optionnels**, jamais on n'impose ni ne donne une
fausse précision.

### Ce qui est raisonnablement établi

| Élément | Effet mesuré | Solidité |
|---|---|---|
| Apport énergétique phase lutéale vs folliculaire | **+168 kcal/j** en moyenne (méta-analyse 2025, 15 jeux de données, 330 femmes) | Moyenne — I² = 83 % (très hétérogène), apports auto-déclarés |
| Dépense énergétique de repos en phase lutéale | **+2 à 11,5 %** ; ≈ +120 kcal/j chez femmes minces | Modérée |
| Sensibilité à l'insuline | **Plus élevée en phase folliculaire**, plus basse en lutéale (progestérone → résistance à l'insuline) | Bonne, mécanisme clair |
| Fringales de glucides fin de phase lutéale | Réelles ; liées à la chute de sérotonine | Modérée |
| Catabolisme protéique en phase lutéale | Un peu plus élevé (oxydation AA, besoin en lysine ↑) | Modérée — mais ampleur réelle triviale : **3–5 g de protéines** |
| Pertes en fer pendant les règles | **15–30 mg par cycle** (> 40 mg si règles > 80 mL) | Bonne |
| Rétention d'eau / poids en phase lutéale | **+0,5 à 2 kg d'eau**, ballonnements | Bonne |

**Ordre de grandeur à retenir : ~150 kcal/j et quelques grammes de macros.**
Réel mais modeste.

### Les 4 phases (repère : J1 = 1er jour des règles, cycle « type » 28 j)

La **phase lutéale est la plus stable (~11–14 j)** ; la phase folliculaire varie
beaucoup. → On prédit mieux **en comptant à rebours depuis les prochaines règles
estimées** qu'en avançant depuis les dernières.

1. **Menstruelle (J1–~J5)** — œstrogènes + progestérone au plancher. Pertes de
   fer. Fatigue possible, dysménorrhée.
2. **Folliculaire (~J6–J13)** — œstrogènes montent. Meilleure sensibilité à
   l'insuline, bonne tolérance aux glucides, appétit plutôt bas, énergie en
   hausse.
3. **Ovulatoire (~J14, ±48 h)** — pic œstrogènes puis LH. Peu de données
   nutritionnelles spécifiques (phase souvent exclue des études).
4. **Lutéale (~J15–J28)** — progestérone dominante. Métabolisme de repos un peu
   plus haut, appétit plus élevé, fringales de sucre en fin de phase, résistance
   relative à l'insuline, léger catabolisme protéique, rétention d'eau, transit
   ralenti.

### Adaptations envisagées

**Énergie**
- Phase lutéale : cible **+100 à +150 kcal/j** (option activable, off par
  défaut). Cadrage : on **ajoute en lutéale**, on ne **retranche jamais** en
  folliculaire (garde-fou TCA, voir §8).
- Reste du cycle : cible normale.

**Macronutriments**
- Folliculaire : bon moment pour les glucides. Rien à forcer.
- Lutéale : viser le **haut de la fourchette protéines** ; glucides plutôt
  **complexes / IG bas** et répartis (sans les supprimer — une portion de
  glucides complexes le soir peut aider humeur/sommeil via la sérotonine) ;
  **fibres** un peu plus hautes (transit) ; **modérer le sodium** (ballonnements).

**Micronutriments** (là où l'app a le plus de valeur : elle connaît déjà les
aliments et les apports)

| Nutriment | Repère /j | Phase à appuyer | Note |
|---|---|---|---|
| **Fer** | ~16–18 mg | Pendant + juste après les règles | Aliments riches en fer + vitamine C. **Jamais de supplémentation sans bilan (ferritine)** — excès de fer toxique. |
| **Calcium** | ~1000 mg | Lutéale | Meilleure preuve sur symptômes prémenstruels (essai réf. 1200 mg/j : ~48 % de réduction). |
| **Magnésium** | ~300–360 mg | Lutéale | RCT modestes (± vitamine B6 50 mg) sur anxiété prémenstruelle / rétention d'eau. |
| **Vitamine B6** | besoin 1,5–2 mg | Lutéale | Doses « SPM » 50–100 mg/j **mais neuropathie périphérique au long cours au-delà** → traiter comme « aliments riches en B6 », pas comme un dosage. |
| **Vitamine D** | selon statut | Toute l'année | Effet sur symptômes prémenstruels **seulement si carence** — dépend d'un dosage sanguin. |
| **Oméga-3 (EPA/DHA)** | ~250 mg | Toute l'année, utile lutéale | Quelques RCT sur douleurs / humeur prémenstruelles. |

**Sources de référence pour construire les valeurs :** tables **ANSES**
(références nutritionnelles françaises) et **EFSA** pour les apports ; revues
**Nutrition Reviews (Oxford)** et **Nutrients (MDPI)** pour les variations par
phase. Ne pas figer les chiffres exacts sans recouper ANSES/EFSA au moment de
l'implémentation.

### Références consultées (2026-08-29)

- Effect of the Menstrual Cycle on Energy Intake: Systematic Review & Meta-analysis — Nutrition Reviews, 2025 — https://academic.oup.com/nutritionreviews/article/83/3/e866/7713894
- Dietary energy intake across the menstrual cycle: a narrative review — Nutrition Reviews — https://academic.oup.com/nutritionreviews/article/81/7/869/6823870
- An Overview of the Impact of the Menstrual Cycle on Nutrient Metabolism — Nutrients (MDPI) — https://doi.org/10.3390/nu18071063
- Changes in sleeping energy metabolism and thermoregulation during menstrual cycle — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6981303/
- Changes in insulin sensitivity, secretion and glucose effectiveness during menstrual cycle — https://pubmed.ncbi.nlm.nih.gov/10071420/
- Brain insulin action on peripheral insulin sensitivity depends on menstrual cycle phase — Nature Metabolism — https://www.nature.com/articles/s42255-023-00869-w
- Phase of menstrual cycle affects lysine requirement in healthy women — Am J Physiol Endocrinol Metab — https://journals.physiology.org/doi/abs/10.1152/ajpendo.00262.2003
- ISSN position stand: nutritional concerns of the female athlete — https://www.tandfonline.com/doi/full/10.1080/15502783.2023.2204066
- Muscle Protein Metabolism And Protein Requirements For Female Athletes — Gatorade SSI — https://www.gssiweb.org/en/sports-science-exchange/article/muscle-protein-metabolism-and-protein-requirements-for-female-athletes--aligning-science-with-sex-specific-needs
- Iron requirements in menstruating women — Am J Clin Nutr — https://ajcn.nutrition.org/article/S0002-9165(23)31949-X/abstract
- Magnesium + vitamin B6 on premenstrual syndrome (RCT) — https://pubmed.ncbi.nlm.nih.gov/22069417/
- Vitamin B6 vs Broad-Spectrum Micronutrients for PMS (pilot RCT) — https://pubmed.ncbi.nlm.nih.gov/31928364/
- Nutritional interventions on psychological symptoms of PMS: systematic review of RCTs — Nutrition Reviews — https://academic.oup.com/nutritionreviews/article/83/2/280/7659847
- Vitamin D supplementation for PMS-related inflammation (RCT) — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6797739/
- Top experts debunk the cycle syncing trend — Tom's Guide — https://www.tomsguide.com/wellness/fitness/top-experts-debunk-the-cycle-syncing-trend-the-evidence-just-isnt-there
- Nutrition and the menstrual cycle — Clue — https://helloclue.com/articles/partnerships/nutrition-and-the-menstrual-cycle

---

## 3. Modèle physiologique retenu (calcul)

Entrées : liste des **jours de règles** (`regles.date`) + réglages
(`settings.cycle`). Côté client, on regroupe les jours contigus en **blocs**
`{ start, end, length }` ; `start` de chaque bloc = repère de cycle.

- `blocCourant` = dernier bloc dont `start` ≤ today
- `jourCycle(today)` = (today − `blocCourant.start`) + 1
- `longueurCycleUtilisée` = si un bloc suivant est enregistré, l'écart réel
  `start → start` ; sinon médiane glissante des écarts `start → start` sur les
  ~6 derniers cycles (si `auto_longueur_cycle` et ≥ 2 cycles), sinon
  `longueur_cycle` réglée (défaut 28).
- `prochainesReglesEstimées` = `blocCourant.start` + `longueurCycleUtilisée`
- `débutLutéaleEstimé` = `prochainesReglesEstimées` − `longueur_lutéale` (défaut 14)
- `ovulationEstimée` ≈ `débutLutéaleEstimé` − 1
- `finRegles` = `blocCourant.end` (jours réellement marqués). Pour le cycle EN
  COURS seulement, on tolère jusqu'à `longueur_regles` jours si des jours ne
  sont pas encore marqués.
- **Phase :**
  - today ≤ `finRegles` (ou today est un jour marqué) → **menstruelle**
  - sinon today < `ovulationEstimée` − 1 → **folliculaire**
  - sinon today dans ±1 j de `ovulationEstimée` → **ovulatoire**
  - sinon → **lutéale**
  - aucun bloc ≤ today, ou retard > 7 j sur `prochainesReglesEstimées` →
    **inconnue** (« en attente de tes prochaines règles »)
- `fiabilité` : `bonne` si ≥ 3 cycles historiques et faible variance ; `faible`
  sinon ou en cas de retard important. L'UI affiche toujours une **fourchette**
  et le mot « estimation », jamais une date sèche.

---

## 4. Architecture technique

### 4.1 Base de données

**Nouvelle table `regles`** — **1 ligne = 1 jour de règles** (la durée varie
d'un cycle à l'autre, donc on marque chaque jour plutôt qu'un seul « 1er
jour »). Le calcul de phase regroupe côté client les jours contigus en blocs ;
le 1er jour de chaque bloc sert de repère de cycle. Convention : champs en
français. Mêmes conventions RLS que `jours_exclus`. SQL dans
`supabase/sql/regles_setup.sql`, à exécuter à la main dans Supabase, puis
reporter dans `supabase_schema.sql`.

```sql
create table if not exists regles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_regles_user_date on regles (user_id, date);
alter table regles enable row level security;
-- policies select / insert / delete "own" (auth.uid() = user_id) — pas
-- d'update : un jour est présent ou absent, insert/delete comme jours_exclus.
```

Un futur suivi de flux (intensité par jour) ajouterait une colonne sur cette
même table (Palier 5).

**Réglages : bloc `cycle` dans `settings`** (colonne `jsonb`, même pattern que
`settings.water` — fusion client avec des défauts via une fonction type
`withWater`, robuste si la colonne est absente).

```jsonc
{
  "enabled": false,                    // toute la feature est opt-in
  "sous_contraception": false,         // true => neutralise la logique de phases
  "longueur_cycle": 28,
  "auto_longueur_cycle": true,         // longueur_cycle = moyenne observée si assez d'historique
  "longueur_luteale": 14,
  "longueur_regles": 5,
  "afficher_sur_calendrier": true,
  "afficher_badge_jour": true,
  "afficher_conseils_micro": true,
  "appliquer_delta_energie": false,    // le +100–150 kcal lutéal
  "delta_energie_luteale_kcal": 120
}
```

### 4.2 Client

- `src/lib/cycle.js` — fonctions pures : tri des dates, longueur de cycle
  observée, `cycleInfo(today, dates, cfg)`, `phaseLabel`, `phaseNutritionTargets(base, phase, cfg)`,
  contenu éditorial des conseils par phase.
- `src/hooks/useCycle.js` — lecture/écriture `regles` (liste complète, l'app en a
  besoin pour l'historique de calcul) + `add/update/remove`. Sur le modèle de
  `useExcludedDay` / `useMeasurements`.
- Réglages via `useSettings` (bloc `cycle`), avec un `mergeCycleSettings` dans
  `src/lib/cycle.js` appelé depuis `withWater`-équivalent de `useSettings.js`.

### 4.3 Points d'accroche UI (fichiers concernés)

| Zone | Fichier | Palier |
|---|---|---|
| Marquer / éditer le 1er jour des règles, saisie rétroactive multi-cycles | `CalendarPage.jsx` + `CalendarMonthGrid.jsx` (+ éventuel petit sheet dédié) | 1 |
| Pastille de phase sur la grille du mois | `CalendarMonthGrid.jsx` | 1 |
| Badge « Phase lutéale · J19 · prochaines règles ~3–5 sept » sur la page du jour | `TodayPage.jsx` / `TodayOverviewCard.jsx` | 1 |
| Annotation des phases sur le graphe de poids (rétention d'eau ≠ prise de gras) | `MeasurementsPage.jsx` / `MetricChart.jsx`, et `HistoryPage.jsx` (courbe poids/calories) | 1 |
| Page « Cycle & alimentation » (science + limites + garde-fous, sans jargon) | `src/pages/CycleInfoPage.jsx` + route `/cycle-infos` dans `App.jsx` + bouton dans `CycleSection` | 2 ✅ |
| Entrée changelog (`src/lib/changelog.js`) à chaque palier visible | `src/lib/changelog.js` | 2+ |
| Écran de réglages « Cycle » dans le Profil (liste + écran dédié, pattern actuel) | `src/pages/ProfilePage.jsx` + `src/components/profile/CycleSection.jsx` | 1 ✅ |
| Delta énergie lutéal appliqué aux cibles | ✅ `TodayPage.jsx` DaySlot via `cycleAdjustedSettings` → `TodayOverviewCard`, `computeMealTargets`, gaps. **Volontairement pas** dans `HistoryPage`/calendrier (objectif à plat sur les agrégats) ni `ExplorerPage` | 3 ✅ |
| Nudge macros lutéal | **Indicatif seulement** (page d'info + tagline de phase). Pas de recalcul numérique des macros en Palier 3 | 3 ✅ |
| Suggestions « aliments à privilégier » par phase, **limitées aux favoris** | ✅ `CyclePhaseBadge` dépliable + `CycleNutrientTips`, données de `useFavorites` | 4 ✅ |
| Suivi fer / calcium / magnésium mis en avant selon la phase | ✅ `NutrientPanel.jsx` prop `highlightKeys` (point violet), alimenté par `TodayPage.jsx` | 4 ✅ |

---

## 5. Workflow git

Gros chantier → **branche dédiée** (`cycle-menstruel` ou une branche par palier),
`npm run build` + validation manuelle par l'utilisatrice sur `localhost:5173`,
puis merge + push vers `main` après confirmation. Migration SQL = étape manuelle
à faire exécuter par l'utilisatrice dans Supabase avant que le code qui en dépend
ne parte en prod. Toujours demander confirmation avant `git push`.

---

## 6. Paliers

### Palier 1 — Suivi + info (aucun changement de cibles)  ▸ statut : codé, en attente d'application SQL + test manuel + merge (branche `cycle-menstruel`)
- [x] `supabase/sql/regles_setup.sql` (table `regles` + colonne `settings.cycle`) + MAJ `supabase_schema.sql` — **application manuelle dans Supabase encore à faire par l'utilisatrice**
- [x] `src/lib/cycle.js` (calcul de phase, fonctions pures + contenu éditorial des phases)
- [x] `src/hooks/useCycle.js`
- [x] Bloc `settings.cycle` + fusion défauts dans `useSettings.js` (`mergeCycleSettings`)
- [x] Marquer **chaque jour de règles** depuis un calendrier (écran Profil ›
      Cycle) + **saisie rétroactive multi-cycles** + liste des blocs de règles
      (dates, durée, cycle) avec suppression
- [x] Pastille de phase sur la grille du mois (`CalendarMonthGrid` : prop
      `cycleByDate`, point rouge = jour de règles, bande fine = phase) — branchée
      dans `CalendarPage` et l'écran de réglages
- [x] Badge phase + jour de cycle + fourchette prochaines règles sur la page du
      jour (`CyclePhaseBadge`)
- [x] Interrupteur maître `enabled` + interrupteur `sous_contraception` +
      réglages longueurs + toggles d'affichage (`CycleSection`)
- [x] Annotation de la phase lutéale sur les graphes de poids : bandes violettes
      en fond sur `MetricChart` (courbe Poids de la page Mensurations) et sur
      `CalorieTrendChart` (page Historique, seulement quand la courbe de poids est
      superposée, hors vue Année) + légende « rétention d'eau ≠ prise de gras »

### Palier 2 — Page d'info + réglages  ▸ statut : codé (branche `cycle-menstruel`)
- [x] Page « Cycle & alimentation » (`src/pages/CycleInfoPage.jsx`, route
      `/cycle-infos` en page-modal, ouverte depuis Profil › Cycle via le bouton
      « Comprendre : cycle & alimentation ») : les 4 phases, minéraux/vitamines
      par moment, sections dépliables « ce que la science dit vraiment », « bon à
      savoir », « sources ». Ton tutoiement, sans jargon.
- [x] Écran de réglages « Cycle » dans le Profil — fait au Palier 1
      (`CycleSection`), enrichi ici du lien vers la page d'info.
- [x] Entrée changelog (`src/lib/changelog.js`, 2026-08-29 « Suis ton cycle et
      adapte ton assiette »).

### Palier 3 — Ajustement énergétique + macros (optionnel, off par défaut)  ▸ statut : codé (branche `cycle-delta-energie`)
- [x] Toggle « adapter mes calories à ma phase lutéale » + stepper du montant
      (défaut +120 kcal, 50–250) dans `CycleSection`
- [x] `cycle.js` : `energyDeltaForPhase`, `cycleAdjustedSettings(settings, days,
      dateStr)` — n'ajuste **que `goal_kcal`**, uniquement en phase lutéale
- [x] Appliqué dans **la page du jour** (`TodayPage` DaySlot) : `TodayOverviewCard`,
      `computeMealTargets`, gaps/`remainingKcal` passent par `daySettings`.
      Étiquette « +120 kcal » sur `CyclePhaseBadge`.
- [x] Libellé explicite « base scientifique modeste » dans les réglages
- [x] Entrée changelog
- **Choix assumés (voir §4.3) :** macros non recalculées numériquement (nudge
      protéines/glucides complexes/fibres/sodium reste **indicatif**, porté par la
      page d'info) ; `HistoryPage` et le calendrier gardent l'objectif à plat
      (pas d'ajustement rétro-actif jour par jour sur les agrégats).

### Palier 4 — Focus micronutriments  ▸ statut : codé (branche `cycle-micronutriments`)
- [x] `cycle.js` : `PHASE_MICRO_FOCUS` (règles → fer + vit C ; lutéale → calcium
      + magnésium), `microFocusForPhase(phase, cfg)` (respecte
      `afficher_conseils_micro`) et `cycleNutrientRows(phase, favorites, cfg)`
- [x] Liste « Parmi tes favoris, bon moment pour… » **repliée dans la pastille
      de phase** (`CyclePhaseBadge` devient dépliable quand il y a des favoris
      correspondants) — composant `CycleNutrientTips` réduit à un rendu de `rows`
- [x] **Seuls les aliments en favoris** sont proposés (données de `useFavorites`,
      champ `food_data`), triés par teneur pour 100 g
- [x] `NutrientPanel` : prop `highlightKeys` → point violet + libellé gras sur
      les jauges vitamines/minéraux concernées (rétro-compatible, sans effet
      ailleurs). Alimenté depuis `TodayPage`.
- [x] Toggle « Conseils d'aliments selon la phase » dans `CycleSection`
      (`afficher_conseils_micro`)
- [x] Entrée changelog

### Palier 5 — Apprentissage & corrélations  ▸ statut : codé (branche `cycle-apprentissage`)
- [x] Longueur de cycle apprise + amplitude + régularité : `cycleRegularity(days)`
      dans `cycle.js`, affiché dans `CycleSection` (`PhaseSummary`). La fourchette
      des prédictions utilise déjà `margin = ceil(sd)` (Palier 1).
- [x] Détection retard / absence de règles : `amenorrheaNotice(dateStr, days,
      cfg)` (≥ 45 j) → message bienveillant dans `CyclePhaseBadge` (court) et
      `CycleSection` (complet). Respecte le garde-fou §8 pt 7.
- [x] Corrélation phase ↔ calories / poids : encart « Ton cycle sur cette
      période » dans `HistoryPage` (moyenne lutéale vs reste du cycle, hors vue
      Année, min. 2 + 2 jours notés).
- [x] Entrée changelog
- [ ] **Suivi de flux** (intensité des règles par jour) — reporté : nécessite une
      colonne sur `regles` + UI de saisie. Voir Palier 7.

### Palier 6 — Entrées externes  ▸ statut : import texte codé (branche `cycle-import`)
- [x] **Import manuel par collage** dans `CycleSection` : bouton « Coller une
      liste de dates » → textarea + aperçu (nouveaux / déjà présents / lignes non
      comprises) + « Ajouter ». Parseur `parsePeriodDatesInput` dans `cycle.js`
      (formats `YYYY-MM-DD`, `JJ/MM/AAAA`, `JJ/MM/AA` avec `/ . -`, plages
      `… - …` / `… au …` / `… to …` étendues, max 40 j). Insert en lot via
      `useCycle.addManyDays`.
- [x] **Export texte** : bouton « Copier mes dates » (presse-papier, une date
      par ligne) — permet aussi de sortir les données.
- ~~Wrapper natif (Capacitor) → Health Connect / Apple Santé~~ — **abandonné**
  (décision utilisatrice, 2026-08-29) : changerait la nature du projet
  (build natif, stores). L'import/export texte couvre le besoin.

### Palier 7 — Suivi de flux  ▸ statut : codé (branche `cycle-flux`)
- [x] Colonne `intensite` (`leger` / `moyen` / `abondant`) sur `regles` +
      policy `update` — `supabase/sql/regles_intensite_setup.sql`, à appliquer
      manuellement ; `supabase_schema.sql` mis à jour.
- [x] `useCycle` charge `date, intensite`, expose `intensiteByDate` +
      `setDaysIntensite(arr, level)` (update en lot). Saisie **par bloc** dans
      `CycleSection` (3 boutons Léger/Moyen/Abondant sous chaque épisode).
- [x] `cycle.js` : `PERIOD_FLOW` (fer ≈ 10/20/35 mg par cycle), `blockIntensite`,
      `estimatedIronLoss(days, intensiteByDate)`.
- [x] Nuance du conseil « fer » : ligne d'estimation dans `CycleSection`, hint
      dynamique dans la pastille de phase (`cycleNutrientRows` reçoit `ironLoss`),
      phrase ajoutée dans `CycleInfoPage`.
- [x] Entrée changelog

---

## 7. Reste à faire (vue rapide)

Paliers 1 → 6 **livrés et mergés** sur `main`. Palier 7 (intensité du flux)
codé sur `cycle-flux`, en attente de la migration SQL + du merge.

Rien de prévu au-delà. Le wrapper natif (Health Connect / Apple Santé) est
abandonné. Toute nouvelle idée s'ajoute ici.

---

## 8. Garde-fous et alertes ⚠️

1. **Contraception hormonale** : si `sous_contraception` = true → pas de logique
   de phases, seulement le suivi des dates de règles. Le demander explicitement à
   l'activation.
2. **Risque TCA / orthorexie** : on **ajoute en lutéale**, jamais on ne
   **restreint en folliculaire**. Aucune cible ne descend sous le minimum
   habituel. Formulations souples. Feature entièrement opt-in, désactivable en un
   geste.
3. **Fausse précision** : prédictions à ±2–4 j. Toujours afficher une fourchette
   et le mot « estimation ».
4. **Ampleur modeste** : ~150 kcal, quelques grammes de macros, études
   hétérogènes et auto-déclarées. Ne pas survendre — la page d'info le dit.
5. **Fer / vitamine D / B6** : encourager les **aliments**, jamais une
   supplémentation à l'aveugle. Fer et D passent par un dosage sanguin ; B6
   neurotoxique au long cours au-delà de ~100 mg/j.
6. **Pas un dispositif médical** : aucune valeur de contraception, de fertilité
   ni de diagnostic. Disclaimer clair.
7. **Aménorrhée / cycles absents = signal** : si `enabled`, pas de contraception,
   et aucune règle depuis > 45–60 j → ne pas « prédire dans le vide », inviter
   doucement à en parler à un·e professionnel·le (l'aménorrhée peut signaler un
   déficit énergétique — précisément ce qu'une app de calories doit prendre au
   sérieux).

---

## 9. Journal des décisions

- **2026-08-29** — Palier 6 mergé sur `main` + poussé ; wrapper natif abandonné
  (décision utilisatrice). Palier 7 codé sur la branche `cycle-flux` : colonne
  `regles.intensite` + policy `update` (migration `regles_intensite_setup.sql` à
  appliquer), saisie par bloc dans `CycleSection`, estimation des pertes de fer
  (`estimatedIronLoss`), conseil « fer » nuancé. `npm run build` OK. En attente :
  application SQL + test manuel + merge.
- **2026-08-29** — Palier 5 mergé sur `main` + poussé. Palier 6 : le wrapper
  natif (Health Connect / Apple Santé) reste hors périmètre ; à la place, **import
  par collage de texte** + export presse-papier dans `CycleSection`
  (`parsePeriodDatesInput`, `useCycle.addManyDays`). Aucune migration. `npm run
  build` OK. En attente : test manuel + merge.
- **2026-08-29** — Palier 4 mergé sur `main` + poussé. Palier 5 codé sur la
  branche `cycle-apprentissage` : `cycleRegularity` (moyenne + amplitude +
  régularité, affiché dans `CycleSection`), `amenorrheaNotice` (≥ 45 j sans
  règles → message dans `CyclePhaseBadge` + `CycleSection`), encart « Ton cycle
  sur cette période » dans `HistoryPage` (calories/poids lutéale vs reste). Le
  suivi de flux est repoussé au Palier 7 (nécessite une migration). `npm run
  build` OK. En attente : test manuel + merge.
- **2026-08-29** — Palier 3 mergé sur `main` + poussé. Palier 4 codé sur la
  branche `cycle-micronutriments`, puis retravaillé suite au retour utilisatrice :
  la liste des aliments n'est plus une carte à part mais **repliée dans la
  pastille de phase** (`CyclePhaseBadge` dépliable), elle ne propose **que des
  aliments en favoris** (`useFavorites`), et la mention « pas de compléments /
  bilan sanguin » a été retirée du bloc (elle reste dans la page d'info). Point
  violet sur `NutrientPanel` conservé. `npm run build` OK. En attente : test
  manuel + merge après confirmation.
- **2026-08-29** — Paliers 1 + 2 mergés sur `main` et poussés (déploiement
  Netlify). Palier 3 démarré sur la branche `cycle-delta-energie`.
- **2026-08-29** — Palier 3 codé : option « adapter mes calories à ma phase
  lutéale » (off par défaut) qui relève **uniquement `goal_kcal`** pendant la
  phase lutéale, du montant réglé (défaut +120). Portée limitée à la page du
  jour (`cycleAdjustedSettings`). Macros non recalculées (nudge reste
  indicatif). `HistoryPage`/calendrier gardent l'objectif à plat. Étiquette sur
  la pastille de cycle + entrée changelog. `npm run build` OK.
- **2026-08-29** — Palier 2 codé sur la branche `cycle-menstruel` : page
  d'information `CycleInfoPage` (route `/cycle-infos`, page-modal comme
  `/whatsnew`), ouverte depuis `CycleSection` (bouton « Comprendre : cycle &
  alimentation »). Contenu : 4 phases, minéraux/vitamines par moment, sections
  dépliables sur les limites de la science, les garde-fous et les sources. Entrée
  changelog ajoutée. `npm run build` OK. En attente : test manuel + merge/push
  (avec le Palier 1) après confirmation.


- **2026-08-29** — Cadrage initial. Pas de contraception hormonale côté
  utilisatrice. Pas d'export possible depuis « Mon Calendrier » → saisie manuelle
  + backfill multi-cycles. Objectif : tout faire à terme, par paliers. Table
  `regles` + bloc `settings.cycle`. Ce document créé.
- **2026-08-29** — Palier 1 codé sur la branche `cycle-menstruel` (socle) :
  `regles_setup.sql`, `src/lib/cycle.js`, `src/hooks/useCycle.js`, bloc
  `settings.cycle`, écran Profil › « Cycle & alimentation » (activation, saisie
  manuelle + rétroactive, réglages), `CyclePhaseBadge` sur la page du jour,
  teinte de phase optionnelle sur `CalendarMonthGrid` (+ `CalendarPage`).
  `npm run build` OK. Restent : appliquer le SQL en base (utilisatrice),
  validation manuelle, puis annotation des phases sur les graphes de poids.
  Aucune entrée changelog pour l'instant (prévue au Palier 2 avec la page d'info).
- **2026-08-29** — Annotation phase lutéale sur les graphes de poids
  (`MetricChart` page Mensurations + `CalorieTrendChart` page Historique quand
  la superposition poids est active). Palier 1 **complet côté code**, `npm run
  build` OK. Reste : appliquer `regles_setup.sql` en base, test manuel, merge +
  push après confirmation.
- **2026-08-29** — Modèle de données revu **avant tout usage** à la demande de
  l'utilisatrice : `regles` passe de « 1 ligne = 1er jour (date_debut/date_fin) »
  à **« 1 ligne = 1 jour de règles »**. La durée des règles varie d'un cycle à
  l'autre : on marque chaque jour, et le calcul regroupe les jours contigus en
  blocs (le 1er jour de chaque bloc = repère de cycle). `date_fin` supprimée,
  plus de policy `update`. `cycle.js` : `periodBlocks` / `periodStarts`,
  `finRegles` basée sur les jours réellement marqués (tolérance `longueur_regles`
  pour le cycle en cours seulement). `npm run build` OK.
