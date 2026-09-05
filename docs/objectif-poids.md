# Chantier « Objectif de poids (relié au cycle) »

Document de conception. Créé le 2026-09-05, à faire évoluer au fil du chantier
(même format que `docs/cycle-menstruel.md`).

---

## 1. Constat de départ

L'utilisatrice a demandé une façon de proposer des **calories adaptées** au
cycle menstruel, au **poids actuel** et au **poids désiré**, et a remarqué
qu'il n'existe **nulle part un endroit où déclarer son poids désiré et le
délai souhaité de façon persistante**.

Vérifié dans le code (2026-09-05) — l'app a déjà trois briques qui se
recoupent mais **ne communiquent pas entre elles** :

1. **`CalorieCalculatorCard`** (`GoalsSection.jsx`) — demande *ponctuellement*
   un poids objectif + un nombre de semaines pour suggérer un `goal_kcal` via
   `computeCalorieNeeds` (Mifflin-St Jeor + règle des 7700 kcal/kg). Rien n'est
   **persisté** : une fois « Appliquer » cliqué, l'objectif de poids et le
   délai sont oubliés, seul le `goal_kcal` résultant reste.
2. **`useWeightProjection` / `WeightProjectionCard`** (page Mensurations) —
   régression linéaire sur les relevés de poids récents, projette une
   tendance (« à ce rythme, tu seras à X kg dans N semaines »). **Ne connaît
   pas d'objectif** : c'est une extrapolation du passé, pas une comparaison à
   un but.
3. **`useGoalAdjustment`** — chaque semaine, compare la tendance de poids
   réelle au rythme *implicite* de l'écart `goal_kcal` / TDEE, et propose un
   micro-ajustement (±100 kcal). Il **réinvente un rythme visé en creux** à
   partir d'un `goal_kcal` qui a pu être saisi à la main, sans lien avec un
   vrai objectif de poids/date.
4. Le **cycle** (`docs/cycle-menstruel.md`, Palier 3) ajuste déjà `goal_kcal`
   de +120 kcal en phase lutéale — mécanisme indépendant, jamais mis en
   regard du plan de poids global.

→ Le vrai manque n'est pas « calculer un objectif calorique », déjà fait, mais
**faire persister un objectif de poids + une échéance, et en faire le pivot**
qui relie calculateur ponctuel, tendance observée, ajustement automatique et
delta de cycle — au lieu de trois logiques parallèles qui ne se parlent pas.

---

## 2. État de la science (synthèse, recherches du 2026-09-05)

### Le modèle statique (7700 kcal/kg) sous-estime l'adaptation métabolique

La règle actuelle (`delta = Δkg × 7700 / (semaines×7)`) suppose un rythme
constant sur toute la durée. En réalité, le corps s'adapte (dépense de repos
en baisse au-delà de la perte de masse elle-même — thermogenèse adaptative),
donc un déficit fixe calculé une fois perd en précision au fil des semaines.

Le modèle de référence dans la littérature est le **NIH Body Weight Planner**
(Kevin Hall, NIDDK), un modèle dynamique validé sur données réelles (étude
CALERIE), nettement plus précis que la règle des 7700 kcal/kg pour prédire un
poids à une échéance donnée — précisément parce qu'il **recalcule** plutôt
que de figer un delta une fois pour toutes.
[Body Weight Simulator — NIDDK](https://www.niddk.nih.gov/research-funding/technology-advancement-transfer/research-materials-licensing/body-weight-simulator-java-applet) ·
[Body Weight Planner — NIH News in Health](https://newsinhealth.nih.gov/2015/09/body-weight-planner)

→ On n'a pas besoin de réimplémenter le modèle physiologique complet de
Hall (masse grasse/maigre séparées, etc. — hors de portée ici, et l'app n'a
pas ces mesures). Mais on peut en garder le **principe directeur** : ne pas
figer le rythme au moment du calcul, **recalculer périodiquement le rythme
nécessaire à partir du poids réel observé** (voir §3). C'est exactement ce que
fait déjà `useGoalAdjustment`, seulement sans référence à un vrai objectif —
le corriger pour qu'il vise le bon point est le cœur de ce chantier.

### Le poids brut au jour le jour est un mauvais signal — encore plus avec le cycle

Le poids affiché par la balance varie de 1 à 3 kg d'un jour à l'autre (eau,
sel, glycogène, transit) sans rapport avec la perte de graisse réelle. La
pratique de référence (Hacker's Diet / apps spécialisées comme Happy Scale,
Libra, MacroFactor, TrendWeight) est de calculer une **moyenne mobile
lissée** (tendance) plutôt que de réagir à la valeur brute du jour.
[Signal and Noise — The Hacker's Diet](https://www.fourmilab.ch/hackdiet/e4/signalnoise.html) ·
[Weight Trend — MacroFactor](https://help.macrofactorapp.com/en/articles/21-weight-trend) ·
[TrendWeight — Help/FAQ](https://trendweight.com/help/)

`useWeightProjection` fait déjà ce lissage (régression sur 42 jours). **Le
cycle menstruel est une cause additionnelle et prévisible de bruit** : la
phase lutéale s'accompagne d'une rétention d'eau documentée chez la grande
majorité des personnes réglées (~92 %), typiquement +0,5 à +1,4 kg (jusqu'à
+2,3 kg), qui disparaît au retour des règles — donc pas de la graisse.
[Weight gain during period — Nutrisense](https://www.nutrisense.io/blog/period-weight-gain) ·
[Do you gain weight on your period — Clue](https://helloclue.com/articles/diet-and-exercise/do-you-gain-weight-on-your-period-here-s-what-to-know)

→ C'est le vrai point d'accroche « cycle × poids désiré » que l'app peut
faire mieux qu'un tracker générique : **elle connaît déjà les phases**
(`regles`, `cycle.js`), donc elle peut éviter de se laisser tromper par une
rétention d'eau lutéale quand elle juge si le rythme réel colle à l'objectif
— voir §3.

### Rythme sûr : raisonner en % du poids, pas en kg fixes

Le garde-fou actuel (`maxSafePaceKg: 1` pour la perte, quel que soit le poids
de la personne) est une simplification. Les repères de littérature sportive
(RED-S / IOC) parlent en **pourcentage du poids corporel** : une perte de
poids « substantielle » (5 à 10 % en un mois) est déjà un signal d'alerte
« modéré » pour le risque de déficit énergétique relatif, en particulier
associé à des cycles irréguliers ou une aménorrhée.
[RED-S — German Journal of Sports Medicine](https://www.germanjournalsportsmedicine.com/archive/archive-2022/issue-7/relative-energy-deficiency-in-sport-red-s-scientific-clinical-and-practical-implications-for-the-female-athlete/) ·
[RED-S — Physiopedia](https://www.physio-pedia.com/Relative_Energy_Deficiency_in_Sport_(RED-S))

→ 1 kg/semaine n'a pas le même poids relatif pour une personne de 55 kg ou de
95 kg. Passer le garde-fou en %/semaine (~0,5–1 %) est plus juste et
s'articule naturellement avec le garde-fou aménorrhée déjà existant
(`amenorrheaNotice`, §8 pt 7 de `docs/cycle-menstruel.md`) : l'app est une des
rares à pouvoir **croiser objectif de poids agressif + signal de cycle
irrégulier**, ce qu'un simple calculateur de calories ne voit jamais.

### Ce qui ne change pas (déjà tranché dans `docs/cycle-menstruel.md`)

Le delta énergétique lutéal (+100–150 kcal, garde-fou « on ajoute en lutéale,
jamais on ne retranche en folliculaire », TCA) reste tel quel. Ce chantier ne
le remet pas en cause, il **le raccorde** à un plan de poids qui, lui,
n'existait pas encore de façon persistante.

---

## 3. Modèle retenu

### Ce qui devient persistant : l'objectif de poids

Nouveau bloc `settings.poids_objectif` (jsonb, même pattern que `cycle` /
`water` / `sport`) :

```jsonc
{
  "poids_desire": null,       // kg, cible
  "date_objectif": null,      // 'YYYY-MM-DD' — date absolue, pas "N semaines
                               // depuis la création" (qui se périme dès le
                               // lendemain et oblige à retenir une date de
                               // départ pour rien)
}
```

L'écran de saisie peut proposer un raccourci « dans combien de temps » (en
semaines, comme le fait déjà `CalorieCalculatorCard`) qui se convertit tout
de suite en `date_objectif` — la persistance, elle, se fait sur la date.

### Rythme nécessaire vs rythme réel — le calcul pivot

```
poidsActuelTendance   = currentTrendKg (déjà calculé par useWeightProjection)
semainesRestantes     = (date_objectif − aujourd'hui) / 7
rythmeNécessaire       = (poids_desire − poidsActuelTendance) / semainesRestantes   // kg/sem, négatif = perte
rythmeRéel             = trendWeekKg (déjà calculé par useWeightProjection)
écart                 = rythmeRéel − rythmeNécessaire
```

Si `écart` est net (mêmes seuils que `useGoalAdjustment` aujourd'hui :
`MIN_GAP_KG_WEEK`, throttle 7 jours) → proposer un ajustement de `goal_kcal`
(±100 kcal max par passe, plancher 1200 kcal — inchangé). **C'est le même
mécanisme qu'aujourd'hui**, seule la référence change : au lieu de
réinventer un rythme visé à partir de l'écart `goal_kcal`/TDEE, on le calcule
directement à partir du vrai couple (poids désiré, date visée). Avantage :
- le rythme nécessaire se **recalcule tout seul** au fil des semaines
  (`semainesRestantes` diminue, donc le rythme nécessaire pour tenir la même
  date se réajuste automatiquement) — c'est le principe du modèle NIH
  transposé à ce que l'app sait faire (régression sur poids observé, pas
  simulation métabolique complète).
- fonctionne même si l'utilisatrice n'a jamais touché manuellement
  `goal_kcal` : le point de départ n'est plus « qu'est-ce que le goal_kcal
  actuel sous-entend », mais « où veut-elle vraiment aller ».
- **rétrocompatible** : si aucun `poids_objectif` n'est défini, on retombe
  exactement sur le comportement actuel de `useGoalAdjustment` (rythme
  inféré depuis `goal_kcal`/TDEE) — pas de régression pour qui ne veut pas
  s'en servir.

### Ne pas se faire tromper par la rétention d'eau lutéale

Pas de tentative de « soustraire l'eau » (fragile, fausse précision — contraire
au garde-fou §8 du chantier cycle). À la place, **exiger une fenêtre
d'observation d'au moins un cycle complet** (réutilise `cycleRegularity` /
longueur de cycle déjà apprise dans `cycle.js`) avant de faire confiance au
`rythmeRéel` pour un ajustement auto, **quand le suivi du cycle est actif**.
Sur un cycle complet, la rétention lutéale se compense (présente au début et
à la fin de la fenêtre), donc le bruit s'annule au lieu de biaiser la pente.
Si le suivi du cycle n'est pas activé, comportement inchangé (fenêtre actuelle
de `useGoalAdjustment`/`useWeightProjection`).

### Garde-fous croisés (nouveaux, en plus de l'existant)

- **Direction cohérente** : `poids_desire` vs poids actuel doit être cohérent
  (repris de la logique `wrongDirection` déjà dans `CalorieCalculatorCard`).
- **Rythme en %/semaine**, pas en kg fixes : remplacer `maxSafePaceKg: 1` par
  un seuil relatif (~0,5–1 % du poids actuel/semaine) dans
  `CALORIE_OBJECTIVES` — plus juste selon la corpulence (voir §2).
- **Croisement avec le signal cycle** : si `amenorrheaNotice` est actif
  (≥45 j sans règles, cycle suivi, pas de contraception) **et** qu'un
  objectif de poids agressif est saisi ou déjà actif → message spécifique,
  plus appuyé que le simple avertissement de rythme, invitant à en parler à
  un·e professionnel·le avant de viser ce rythme. Jamais bloquant, jamais un
  diagnostic — dans l'esprit des garde-fous existants.
- **Échéance dépassée / objectif atteint** : ne jamais glisser silencieusement
  la date. Si `date_objectif` est dépassée sans objectif atteint, ou si
  `poids_desire` est atteint (±0,3 kg de la tendance) avant la date → message
  neutre proposant explicitement de **garder l'objectif** (rythme libre
  ensuite), **le décaler** (nouvelle date), ou **le clore**. Jamais de
  recalcul automatique et silencieux d'une nouvelle date.

---

## 4. Architecture technique (proposée)

### 4.1 Base de données

Aucune nouvelle table. Un bloc de plus dans `settings` (jsonb), pattern
identique à `cycle`/`water`/`sport` — pas de migration SQL nécessaire si la
colonne `settings` accepte déjà n'importe quelle clé jsonb (à vérifier au
moment du code : si `settings` est un jsonb libre comme les autres blocs, rien
à faire côté schéma ; sinon migration triviale identique à
`regles_setup.sql` pour la colonne `settings.cycle`).

### 4.2 Client

- `src/lib/poidsObjectif.js` (nouveau, sur le modèle de `cycle.js`) :
  `mergeGoalWeightSettings` (défauts), `requiredPaceKgPerWeek(poidsDesire,
  dateObjectif, trendKg, today)`, `goalWeightStatus(...)` (atteint / dépassé /
  en cours + les 3 options rythme-libre/décaler/clore).
- `useGoalAdjustment.js` : modifié pour calculer `intendedKgWeek` depuis
  `requiredPaceKgPerWeek(...)` **si** `settings.poids_objectif` est renseigné,
  sinon garder le calcul actuel (rétrocompatible, voir §3).
- `useWeightProjection.js` : **inchangé** dans son calcul — juste consommé par
  un nouveau composant qui affiche la comparaison à l'objectif (pas de
  duplication de la régression).
- Nouveau composant `GoalWeightCard` (ou section dans `GoalsSection.jsx`) :
  saisie poids désiré + date/délai, affichage rythme nécessaire vs
  `useWeightProjection`, messages de statut (§3).
- `cycle.js` : réutiliser `cycleRegularity`/longueur de cycle apprise pour la
  fenêtre « cycle complet » (§3), et `amenorrheaNotice` pour le garde-fou
  croisé — aucune modif de `cycle.js` nécessaire, juste consommé depuis le
  nouveau code.

### 4.3 Points d'accroche UI

| Zone | Fichier | Palier |
|---|---|---|
| Saisie poids désiré + date/délai, persistant | `GoalsSection.jsx` (ou nouvel écran) + `useSettings` | 1 |
| Rythme nécessaire vs rythme réel (réutilise `useWeightProjection`) | Nouveau `GoalWeightCard`, dans `GoalsSection` ou page Mensurations | 1 |
| `useGoalAdjustment` ancré sur l'objectif réel | `useGoalAdjustment.js` | 2 |
| Garde-fou rythme en %/semaine | `nutrients.js` (`CALORIE_OBJECTIVES`) | 2 |
| Fenêtre d'observation ≥ 1 cycle complet si suivi actif | `useGoalAdjustment.js` (lecture `cycle.js`) | 3 |
| Garde-fou croisé aménorrhée × objectif agressif | `GoalWeightCard` / `useGoalAdjustment.js` (lecture `amenorrheaNotice`) | 3 |
| Statut objectif atteint / dépassé (3 choix) | `GoalWeightCard` | 3 |

---

## 5. Workflow git

Chantier de taille moyenne (nouveau bloc settings + retouche d'un hook
existant) → branche dédiée, `npm run build` + test manuel par l'utilisatrice,
merge + push vers `main` après confirmation — même workflow que le chantier
cycle.

---

## 6. Paliers

### Palier 1 — Objectif persistant + comparaison au réel (aucun changement automatique de calories)  ▸ statut : codé (branche `objectif-poids`)
- [x] Bloc `settings.poids_objectif` (`poids_desire`, `date_objectif`) —
      `supabase/sql/poids_objectif_setup.sql`, à appliquer manuellement ;
      `supabase_schema.sql` mis à jour. `src/lib/poidsObjectif.js`
      (`GOAL_WEIGHT_DEFAULTS`, `mergeGoalWeightSettings`, `goalWeightProgress`),
      fusionné dans `useSettings.js` comme `cycle`/`water`/`sport`.
- [x] Écran de saisie (poids désiré + date, avec raccourci « dans 4/8/12
      sem. » qui remplit la date) dans `GoalsSection.jsx` (Profil › Objectifs
      nutritionnels), au-dessus du calculateur ponctuel existant
- [x] `GoalWeightCard.jsx` : rythme nécessaire (poids désiré − tendance
      actuelle) / semaines restantes, comparé au rythme réel de
      `useWeightProjection` (réutilisé tel quel, pas dupliqué). Messages :
      objectif atteint (±0,3 kg), échéance dépassée, pas assez de relevés,
      dans les clous / en avance / en retard (tolérance 0,1 kg/semaine)
- [x] **Retour utilisatrice (2026-09-05, même jour)** : l'affichage seul n'a
      pas d'action concrète perçue (« je veux que ça recadre mes calories »).
      Ajout d'un bouton **« Appliquer à mes objectifs (X kcal/j) »** dans
      `GoalWeightCard` : réutilise `computeCalorieNeeds` (même formule que le
      calculateur plus bas, pas de duplication), déduit perte/prise/maintien
      du signe (poids désiré vs tendance), applique via `calc.onApply` — donc
      **rentre dans `goalsDirty`**, il faut encore cliquer « Enregistrer les
      objectifs » (SaveBar déjà existante) : jamais un changement silencieux
      de `goal_kcal`. Message si le profil (sexe/âge/taille) est incomplet ;
      avertissement si le rythme dépasse `maxSafePaceKg`. Cette action est
      un calcul ponctuel comme le fait déjà le calculateur — l'ajustement
      hebdomadaire *continu* qui affine ce chiffre avec la vraie tendance
      reste le Palier 2.
- [x] Précision « s'enregistre automatiquement » sous les champs poids/date
      (l'utilisatrice cherchait un bouton « sauvegarder » qui n'existe pas :
      ces deux-là écrivent directement en base à chaque changement)
- [x] Entrée changelog (2026-09-05 « Un poids objectif, avec une date »)
- `npm run build` OK. En attente : application SQL par l'utilisatrice, test
  manuel, merge + push après confirmation.

### Palier 2 — Ajustement automatique ancré sur l'objectif réel  ▸ statut : codé (branche `objectif-poids`)
- [x] `requiredPaceKgPerWeek` extrait dans `poidsObjectif.js` (seule source de
      vérité, déjà utilisé par `goalWeightProgress`/`GoalWeightCard`)
- [x] `useGoalAdjustment` calcule `intendedKgWeek` depuis
      `requiredPaceKgPerWeek` quand `settings.poids_objectif` est renseigné
      et la date pas encore dépassée ; repli sur l'ancienne inférence
      goal_kcal/TDEE sinon (rétrocompatible). Champ `source` ajouté à la
      suggestion (`'poids_objectif' | 'goal_kcal'`)
- [x] `GoalAdjustBanner` : phrase adaptée selon `source` (« pour être à X kg
      le [date], il te faudrait plutôt... » au lieu de « ton objectif actuel
      vise... » quand la source est l'objectif de poids réel)
- [x] Garde-fou de rythme passé en %/semaine (`maxSafePacePct` dans
      `CALORIE_OBJECTIVES`, remplace `maxSafePaceKg`) — perte 1 %/semaine,
      prise 0,5 %/semaine, relatif au poids actuel. Messages d'avertissement
      de `CalorieCalculatorCard` et `GoalWeightCard` mis à jour (% + équivalent
      kg affiché)
- [x] Entrée changelog

### Palier 3 — Intégration cycle + fin d'objectif  ▸ statut : codé (branche `objectif-poids`)
- [x] Fenêtre d'observation ≥ 1 cycle complet avant ajustement auto, quand le
      suivi du cycle est actif (hors contraception) : `useGoalAdjustment`
      appelle `cycleInfo` (`cycle.js`) pour la longueur de cycle effective
      (`predictedLen`, observée ou réglée) et élargit `minSpanDays`/`windowDays`
      en conséquence — évite qu'une rétention d'eau lutéale (+0,5 à 2 kg,
      §2) fausse la pente mesurée sur une fenêtre plus courte. Sans suivi
      actif ou sans historique de cycle, comportement inchangé (14 j / 28 j).
- [x] Statut `sans_echeance` dans `goalWeightProgress` (poids désiré sans
      date) — au lieu de renvoyer `null`, affiche le rythme observé sans
      rythme "nécessaire"
- [x] `GoalWeightCard` : statut atteint / échéance dépassée proposent
      explicitement **Garder** (retire la date → `sans_echeance`),
      **Décaler de 4 sem.** (échéance dépassée seulement — nouvelle date
      concrète), **Nouvel objectif** / **Clore** (réinitialise poids +
      date) — jamais de recalcul silencieux
- [x] Garde-fou croisé aménorrhée × objectif agressif : `amenorrheaNotice`
      (déjà utilisé par le chantier cycle) croisé avec le rythme nécessaire
      ici (seuil %/semaine identique à `CALORIE_OBJECTIVES`, calculé sans
      dépendre du profil complet) → avertissement dédié dans `GoalWeightCard`,
      jamais un diagnostic
- [x] Entrée changelog

Rien au-delà pour l'instant — comme pour le chantier cycle, toute nouvelle
idée s'ajoute ici plutôt que d'être codée à la volée.

---

## 7. Garde-fous et alertes ⚠️

1. **Jamais de recalcul silencieux de la date ou de l'objectif** — toujours
   un choix explicite (garder / décaler / clore).
2. **Rythme sûr en %/semaine**, pas en kg fixes — plus juste selon la
   corpulence (§2, §3).
3. **Croisement aménorrhée × objectif agressif** = signal fort, jamais un
   diagnostic — invite à en parler à un·e professionnel·le (même esprit que
   `docs/cycle-menstruel.md` §8 pt 7).
4. **Pas de fausse précision sur le rythme** : toujours une comparaison
   fourchette-à-fourchette (le `lowKg`/`highKg` de `useWeightProjection`
   existe déjà, à réutiliser), jamais un chiffre sec.
5. **Rétrocompatible** : sans `poids_objectif` renseigné, tout se comporte
   exactement comme aujourd'hui.
6. **Pas un dispositif médical**, comme le reste de l'app.

---

## 8. Sources consultées (2026-09-05)

- [Body Weight Simulator — NIDDK](https://www.niddk.nih.gov/research-funding/technology-advancement-transfer/research-materials-licensing/body-weight-simulator-java-applet)
- [Body Weight Planner — NIH News in Health](https://newsinhealth.nih.gov/2015/09/body-weight-planner)
- [Signal and Noise — The Hacker's Diet](https://www.fourmilab.ch/hackdiet/e4/signalnoise.html)
- [Weight Trend — MacroFactor](https://help.macrofactorapp.com/en/articles/21-weight-trend)
- [TrendWeight — Help/FAQ](https://trendweight.com/help/)
- [Period weight gain — Nutrisense](https://www.nutrisense.io/blog/period-weight-gain)
- [Do you gain weight on your period — Clue](https://helloclue.com/articles/diet-and-exercise/do-you-gain-weight-on-your-period-here-s-what-to-know)
- [RED-S female athlete — German Journal of Sports Medicine](https://www.germanjournalsportsmedicine.com/archive/archive-2022/issue-7/relative-energy-deficiency-in-sport-red-s-scientific-clinical-and-practical-implications-for-the-female-athlete/)
- [RED-S — Physiopedia](https://www.physio-pedia.com/Relative_Energy_Deficiency_in_Sport_(RED-S))
- Voir aussi les sources déjà réunies dans `docs/cycle-menstruel.md` §2
  (variations énergie/macros par phase), non reprises ici.

---

## 9. Journal des décisions

- **2026-09-05** — **Troisième correctif** (retour utilisatrice : « 28 jours
  c'est trop peu, il faut se baser sur l'historique entier », proposition de
  baisse jugée « trop drastique »). Deux changements distincts :
  - `PACE_WINDOW_DAYS` passé de 28 à **90 jours**. Raison : un plateau de
    perte de poids (2-4 semaines sans baisse malgré un vrai déficit —
    phénomène courant, documenté) tombant dans une fenêtre de 28 j peut à lui
    seul faire croire à un rythme réel bien plus lent qu'il ne l'est
    vraiment, et donc déclencher une correction inutilement lourde. Sur 90 j,
    un plateau de quelques semaines pèse moins dans la pente globale. Pas
    littéralement « tout l'historique » : au-delà de quelques mois, le mode
    de vie a pu changer, une moyenne trop longue refléterait un passé peu
    pertinent aujourd'hui — mais pour qui trace depuis moins de 90 j, la
    fenêtre se réduit d'elle-même à ce qui existe (le filtre par date), donc
    ça revient déjà à « tout l'historique » dans ce cas.
  - Le bouton "Appliquer" de `GoalWeightCard` plafonne maintenant sa
    correction à ±`MAX_MANUAL_DELTA_KCAL` (200 kcal), au lieu d'appliquer
    l'écart réel/nécessaire en entier quel que soit son ampleur. Raison : un
    gros écart se traduisait par une correction en un clic pouvant dépasser
    -300/-400 kcal — un changement brutal, à l'opposé de l'esprit du reste
    de l'app (jamais de changement brutal, toujours par petits pas). Si le
    véritable écart dépasse ce plafond, un message le signale et invite à
    revenir ajuster à nouveau dans quelques semaines plutôt que de tout
    changer d'un coup.
  `npm run build` OK. En attente de retest.
- **2026-09-05** — **Deuxième correctif de cohérence, plus profond** (retour
  utilisatrice : « sur quel poids se base-t-il ? », après le premier
  correctif jugé insuffisant). Analyse : même après avoir unifié la formule
  de conversion rythme→kcal, `useGoalAdjustment` et `GoalWeightCard`
  calculaient chacun leur PROPRE tendance de poids, à partir de DEUX bases
  différentes — `useGoalAdjustment` réimplémentait sa propre régression sur
  le dernier relevé BRUT (`pts[pts.length-1].y`) sur une fenêtre de 28 j (ou
  plus si cycle actif) ; `GoalWeightCard` utilisait `useWeightProjection`
  (tendance LISSÉE, régression) sur une fenêtre fixe de 42 j. Deux bases de
  poids différentes + deux fenêtres différentes ⇒ deux rythmes réels
  différents, même avec la même formule de conversion. Correctif : fenêtre
  paramétrable ajoutée à `useWeightProjection` (`windowDays`), nouvelle
  constante partagée `PACE_WINDOW_DAYS` (28 j) + fonction `cycleAwareWindowDays`
  (`cycle.js`, élargit à un cycle complet si le suivi est actif) — les DEUX
  appellent maintenant exactement le même hook avec exactement la même
  fenêtre, donc régressent sur EXACTEMENT les mêmes relevés. `useGoalAdjustment`
  ne réimplémente plus sa propre régression. Seule différence assumée et
  documentée : le bandeau plafonne l'ajustement à ±100 kcal/semaine (douceur),
  le bouton applique la correction complète en une fois (action volontaire).
  `npm run build` OK. En attente de retest par l'utilisatrice.
- **2026-09-05** — **Premier correctif de cohérence** (retour utilisatrice
  après test du Palier 3, sur la branche `objectif-poids`) : le bandeau
  d'ajustement hebdo (page du jour) et le bouton "Appliquer à mes objectifs"
  (`GoalWeightCard`) proposaient deux nombres différents pour le même
  objectif de poids (ex. 1760 vs 2010 kcal) — l'un basé sur la vraie tendance
  de poids (`useGoalAdjustment`), l'autre sur la formule théorique de
  Mifflin-St Jeor (`computeCalorieNeeds`), qui peuvent légitimement diverger
  de plusieurs centaines de kcal si le métabolisme réel s'écarte de
  l'estimation théorique. Extrait `goalKcalDeltaForPace` dans
  `poidsObjectif.js` (seule formule de conversion rythme→kcal, réutilisée par
  les deux) : le bouton "Appliquer" se base maintenant sur `currentGoal` +
  l'écart réel/nécessaire dès qu'un rythme de poids réel est connu
  (`observedKgWeek`), et ne retombe sur la formule théorique que tant qu'il
  n'y a pas encore assez d'historique (statut `pas_assez_de_donnees`) — donc
  un vrai calcul de démarrage à froid, pas un second avis contradictoire.
  `npm run build` OK. **Insuffisant** : réglait la formule de conversion mais
  pas la tendance de poids elle-même, encore calculée deux fois différemment
  (voir correctif suivant, plus haut).
- **2026-09-05** — Palier 3 codé sur la branche `objectif-poids` (même jour,
  après validation du Palier 2). Fenêtre d'observation de `useGoalAdjustment`
  élargie à un cycle complet (`cycleInfo`) quand le suivi du cycle est actif,
  pour ne pas confondre rétention d'eau lutéale et vrai plateau/perte.
  `goalWeightProgress` gagne le statut `sans_echeance` (poids désiré sans
  date). `GoalWeightCard` : boutons garder/décaler/clore sur les statuts
  atteint et échéance dépassée (jamais de recalcul silencieux), et garde-fou
  croisé aménorrhée × objectif agressif (réutilise `amenorrheaNotice` du
  chantier cycle). `npm run build` OK. En attente : test manuel, merge + push
  après confirmation. Chantier considéré complet aux 3 paliers prévus —
  toute nouvelle idée s'ajoute en §7 plutôt que d'être codée à la volée.
- **2026-09-05** — Palier 2 codé sur la branche `objectif-poids` (même jour,
  SQL du Palier 1 appliquée par l'utilisatrice) : `useGoalAdjustment` vise
  désormais directement le rythme nécessaire pour l'objectif de poids réel
  (`requiredPaceKgPerWeek`, extrait dans `poidsObjectif.js`) quand il est
  défini et pas dépassé, au lieu de le réinventer depuis l'écart
  goal_kcal/TDEE — rétrocompatible (ancien calcul si aucun objectif défini).
  `GoalAdjustBanner` reformulé selon la source. Garde-fou de rythme passé en
  %/semaine du poids actuel (`maxSafePacePct`, 1 % perte / 0,5 % prise) au
  lieu d'un forfait en kg fixe — plus juste selon la corpulence, messages mis
  à jour partout où affiché. `npm run build` OK. En attente : test manuel,
  merge + push après confirmation. Palier 3 (fenêtre cycle complet + garde-fou
  aménorrhée + statut atteint/dépassé) pas commencé.
- **2026-09-05** — Palier 1 codé sur la branche `objectif-poids` : bloc
  `settings.poids_objectif` (migration `poids_objectif_setup.sql`),
  `src/lib/poidsObjectif.js`, `GoalWeightCard.jsx` branché dans
  `GoalsSection.jsx` (poids désiré + date, comparaison rythme
  nécessaire/réel via `useWeightProjection`). Aucun changement automatique de
  `goal_kcal` à ce stade (prévu Palier 2). `npm run build` OK. En attente :
  application SQL en base par l'utilisatrice, test manuel, merge + push après
  confirmation.
- **2026-09-05** — Document créé suite à la demande de l'utilisatrice
  (« proposer des calories adaptées au cycle, au poids actuel et au poids
  désiré » + constat qu'il n'existe pas d'endroit pour déclarer poids désiré
  et délai). Audit du code existant : trois briques déjà présentes
  (`CalorieCalculatorCard` ponctuel, `useWeightProjection` sans objectif,
  `useGoalAdjustment` qui infère un rythme visé en creux) qui ne
  communiquent pas. Décision de conception : objectif de poids **persistant**
  (`settings.poids_objectif`) comme pivot, `useGoalAdjustment` recalculé
  dessus (rétrocompatible), fenêtre d'observation étendue à un cycle complet
  pour ne pas confondre rétention d'eau lutéale et vrai plateau, garde-fou de
  rythme passé en %/semaine, garde-fou croisé aménorrhée × objectif agressif.
  Paliers 1→3 proposés. En attente de cadrage avec l'utilisatrice avant de
  coder.
