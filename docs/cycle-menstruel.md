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

Entrées : liste des **dates de 1er jour des règles** (`regles.date_debut`, triées
croissant) + réglages (`settings.cycle`).

- `jourCycle(today)` = (today − dernière `date_debut` ≤ today) + 1
- `longueurCycleUtilisée` = moyenne/médiane glissante des écarts entre `date_debut`
  successifs sur les ~6 derniers cycles si `auto_longueur_cycle` et ≥ 2 cycles
  connus ; sinon `longueur_cycle` réglée (défaut 28).
- `prochainesReglesEstimées` = dernière `date_debut` + `longueurCycleUtilisée`
- `débutLutéaleEstimé` = `prochainesReglesEstimées` − `longueur_lutéale` (défaut 14)
- `ovulationEstimée` ≈ `débutLutéaleEstimé` − 1
- **Phase :**
  - `jourCycle` ≤ `longueur_regles` (défaut 5) → **menstruelle**
  - sinon `today` < `ovulationEstimée` − 1 → **folliculaire**
  - sinon `today` dans ±1 j de `ovulationEstimée` → **ovulatoire**
  - sinon → **lutéale**
  - aucune `date_debut` ≤ `today`, ou retard > `longueurCycleUtilisée` + 7 →
    **inconnue** (afficher « en attente de tes prochaines règles »)
- `fiabilité` : `bonne` si ≥ 3 cycles historiques et faible variance ; `faible`
  sinon ou en cas de retard important. L'UI affiche toujours une **fourchette**
  et le mot « estimation », jamais une date sèche.

---

## 4. Architecture technique

### 4.1 Base de données

**Nouvelle table `regles`** (1 ligne = un début de règles). Convention : nom de
table + champs de données en français, comme le reste de la base. Mêmes
conventions RLS que `jours_exclus` (voir `supabase/sql/jours_exclus_setup.sql`).
SQL complet à écrire dans `supabase/sql/regles_setup.sql`, à exécuter à la main
dans le SQL editor Supabase, puis reporter dans `supabase_schema.sql`.

```sql
create table if not exists regles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date_debut date not null,
  date_fin date,                 -- optionnel (suivi de flux plus tard)
  created_at timestamptz not null default now(),
  unique (user_id, date_debut)
);
create index if not exists idx_regles_user_date on regles (user_id, date_debut);
alter table regles enable row level security;
-- policies select / insert / update / delete "own" (auth.uid() = user_id)
-- update + delete nécessaires : corriger une date, supprimer une saisie erronée,
-- renseigner date_fin après coup.
```

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
| Page « Cycle & alimentation » (science + limites + garde-fous, sans jargon) | nouvelle page `src/pages/CyclePage.jsx` + route dans `App.jsx` + accès depuis Profil | 2 |
| Entrée changelog (`src/lib/changelog.js`) à chaque palier visible | `src/lib/changelog.js` | 2+ |
| Écran de réglages « Cycle » dans le Profil (liste + écran dédié, pattern actuel) | `src/pages/ProfilePage.jsx` + `src/components/profile/` | 2 |
| Delta énergie lutéal appliqué aux cibles | là où `settings.goal_*` est consommé : `TodayOverviewCard.jsx`, `MacroBar.jsx`, `DayRecapPanel.jsx`, `HistoryPage.jsx`, `nutrients.js` (`getDayStatus`) | 3 |
| Nudge macros lutéal | idem | 3 |
| Suggestions « aliments à privilégier » par phase, tirées de Ciqual | proche de `TodayGapsSection.jsx` / `useGroceriesSuggestions.js` | 4 |
| Suivi fer / calcium / magnésium mis en avant selon la phase | `NutrientPanel.jsx` / `ComplementNutrientPills.jsx` | 4 |

---

## 5. Workflow git

Gros chantier → **branche dédiée** (`cycle-menstruel` ou une branche par palier),
`npm run build` + validation manuelle par l'utilisatrice sur `localhost:5173`,
puis merge + push vers `main` après confirmation. Migration SQL = étape manuelle
à faire exécuter par l'utilisatrice dans Supabase avant que le code qui en dépend
ne parte en prod. Toujours demander confirmation avant `git push`.

---

## 6. Paliers

### Palier 1 — Suivi + info (aucun changement de cibles)  ▸ statut : en cours (branche `cycle-menstruel`)
- [x] `supabase/sql/regles_setup.sql` (table `regles` + colonne `settings.cycle`) + MAJ `supabase_schema.sql` — **application manuelle dans Supabase encore à faire par l'utilisatrice**
- [x] `src/lib/cycle.js` (calcul de phase, fonctions pures + contenu éditorial des phases)
- [x] `src/hooks/useCycle.js`
- [x] Bloc `settings.cycle` + fusion défauts dans `useSettings.js` (`mergeCycleSettings`)
- [x] Saisie du 1er jour des règles depuis un calendrier (écran Profil › Cycle) +
      **saisie rétroactive multi-cycles** + liste des cycles avec écart
- [x] Pastille de phase sur la grille du mois (`CalendarMonthGrid` : prop
      `cycleByDate`, point rouge = 1er jour, bande fine = phase) — branchée dans
      `CalendarPage` et l'écran de réglages
- [x] Badge phase + jour de cycle + fourchette prochaines règles sur la page du
      jour (`CyclePhaseBadge`)
- [x] Interrupteur maître `enabled` + interrupteur `sous_contraception` +
      réglages longueurs + toggles d'affichage (`CycleSection`)
- [ ] **Annotation des phases sur les graphes de poids (Historique + Mensurations)**
      — reporté en commit suivant sur la même branche (touche `MetricChart` /
      `HistoryPage`), fait après validation du socle

### Palier 2 — Page d'info + réglages  ▸ statut : à faire
- [ ] Page « Cycle & alimentation » : les 4 phases, ce que dit la science **et
      ses limites**, garde-fous, le tout sans jargon (ton tutoiement de l'app)
- [ ] Écran de réglages « Cycle » dans le Profil
- [ ] Entrée(s) changelog

### Palier 3 — Ajustement énergétique + macros (optionnel, off par défaut)  ▸ statut : à faire
- [ ] Toggle « adapter mes calories à mon cycle » → +100–150 kcal en lutéale
- [ ] Application du delta partout où les cibles `goal_*` sont lues (liste §4.3)
- [ ] Libellé explicite « petit ajustement, base scientifique modeste »
- [ ] Nudge macros lutéal (protéines vers le haut, glucides complexes, fibres +,
      sodium −) — affichage indicatif, pas de recalcul brutal des objectifs
- [ ] Entrée changelog

### Palier 4 — Focus micronutriments  ▸ statut : à faire
- [ ] Suggestions « aliments à privilégier » par phase, tirées de la base Ciqual
      (fer + vitamine C autour des règles ; calcium / magnésium en lutéale)
- [ ] Mise en avant du suivi fer / calcium / magnésium selon la phase sur les
      écrans de nutriments
- [ ] Formulations douces, jamais de dosage de compléments prescrit
- [ ] Entrée changelog

### Palier 5 — Apprentissage & corrélations (plus tard)  ▸ statut : idée
- [ ] Longueur de cycle apprise + lissée, intervalle de confiance sur les prédictions
- [ ] Détection de cycle en retard / absent → message bienveillant (cf. §8 pt 7)
- [ ] Corrélation phase ↔ poids / calories / symptômes si l'utilisatrice les logge
- [ ] (Éventuel) suivi de flux via `regles.date_fin` + intensité

### Palier 6 — Entrées externes (si un jour pertinent)  ▸ statut : idée
- [ ] Import CSV ponctuel de dates de règles (si « Mon Calendrier » ou une autre
      app finit par exporter quelque chose)
- [ ] Wrapper natif (Capacitor) → lecture Health Connect / Apple Santé alimentant
      la table `regles`. Gros changement de nature du projet, hors périmètre actuel.

---

## 7. Reste à faire (vue rapide)

Tout sauf ce qui sera coché au Palier 1 ci-dessus. En résumé, dans l'ordre :
1. **Palier 1** : tracking manuel + calcul de phase + affichage + annotation poids.
2. **Palier 2** : page d'info + réglages + changelog.
3. **Palier 3** : delta énergie lutéal + nudge macros (opt-in).
4. **Palier 4** : suggestions micronutriments par phase.
5. **Palier 5** : apprentissage, corrélations, suivi de flux.
6. **Palier 6** : import CSV / Health Connect via wrapper natif.

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
