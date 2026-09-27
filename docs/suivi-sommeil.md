# Chantier « Suivi du sommeil »

Document de conception + suivi d'avancement. À faire évoluer au fil du chantier.
Créé le 2026-09-27.

**État au 2026-09-27 : chantier terminé.** Paliers 1 à 6 mergés et poussés
sur `main`, testés par l'utilisatrice. Rappel push d'heure de coucher
**abandonné** (décision utilisatrice : pas de rappels). Voir §11.

---

## 1. Objectif et périmètre

Ajouter un **suivi manuel du sommeil** (heure d'endormissement, heure de réveil,
durée de la nuit), puis **croiser** ces données avec ce que l'app sait déjà :

- **sommeil → alimentation** : est-ce que je mange plus / plus sucré / plus
  tard le lendemain d'une nuit courte ?
- **sommeil → dépense** : est-ce que je marche moins, je fais moins de sport,
  le lendemain d'une nuit courte ?
- **journée → nuit suivante** (sens inverse) : sport, dîner copieux, alcool,
  phase du cycle… est-ce que ça change ma nuit ?

**Décisions déjà données par l'utilisatrice (2026-09-27) :**

- **Saisie manuelle.** Même raisonnement que le chantier sport (§4.4 de
  `docs/suivi-sport.md`) : on reste une PWA, Health Connect / Apple Santé /
  Mi Fitness sont hors de portée. On recopie depuis la montre si besoin.
- **Carte accessible aux deux comptes** (pas de feature flag type
  `STOOL_TRACKER_USER_ID`). Table **par utilisatrice, RLS « own »**.
- **Carte de la page du jour, réordonnable** : clé `sommeil` dans
  `TODAY_SECTION_KEYS` + entrée dans `sectionNodes` (règle du CLAUDE.md).

**Principe directeur :** la valeur du chantier est dans les **croisements**,
pas dans le journal de nuits. Or un croisement n'est fiable qu'avec **2 à
3 mois** de données (§5.4). Conséquence pratique : **tout ce dont les analyses
auront besoin plus tard doit être saisi dès le Palier 1** (qualité ressentie,
réveil naturel ou non), sinon on attendra encore 3 mois après chaque palier.

---

## 2. Repères scientifiques (ce qui justifie les analyses)

| Constat | Ordre de grandeur | Source |
|---|---|---|
| Après une restriction partielle de sommeil, l'apport augmente | **+385 kcal/j** en moyenne, **sans hausse significative de la dépense** | Al Khatib 2017, méta-analyse (Eur J Clin Nutr) |
| Le surplus se fait surtout **le soir / la nuit**, en grignotage | augmentation des prises après 22 h | Spaeth 2013 (Sleep) |
| Attrait accru pour les aliments **gras et sucrés** après privation | activité cérébrale de récompense ↑ | Greer 2013 (Nat Commun) |
| La **régularité** des horaires prédit mieux la santé que la durée seule | Sleep Regularity Index (SRI) | Phillips 2017 (Sci Rep), Windred 2024 (Sleep) |
| **« Jet lag social »** (décalage semaine / week-end) associé à un IMC plus élevé | par heure de décalage | Roenneberg 2012 (Curr Biol) |
| Le sommeil se dégrade en **phase lutéale tardive** et pendant les règles (température ↑, douleurs) | qualité ressentie ↓, réveils ↑ | Baker & Driver 2007 (Sleep Med) |
| L'alcool raccourcit la latence mais **fragmente** la 2ᵉ moitié de nuit | dose-dépendant | Ebrahim 2013 (Alcohol Clin Exp Res) |
| Besoin adulte recommandé | **7 à 9 h** | National Sleep Foundation, Hirshkowitz 2015 |

Deux conséquences de conception :

1. **Ne jamais ajuster l'objectif calorique** en fonction du sommeil. La
   dépense ne bouge presque pas, c'est l'appétit qui bouge. Le bon levier est
   **informatif** (« tu risques d'avoir plus faim aujourd'hui, c'est
   normal »), jamais une cible modifiée. Cohérent avec
   `feedback-calcul-poids-calories` : pas de changement brutal, une seule
   source de vérité pour `goal_kcal`.
2. **La « dépense » que l'app peut observer, ce sont les pas et les séances.**
   Le métabolisme de base est une formule (Mifflin-St Jeor), il ne varie pas
   d'un jour à l'autre dans l'app. « Je dépense moins après une nuit courte »
   = « je marche moins / je saute des séances ». C'est d'ailleurs le vrai
   mécanisme (NEAT ↓). L'interface doit le dire clairement.

---

## 3. Modèle de données et conventions

### 3.1 Une nuit = une ligne, rattachée à la **date du réveil**

« La nuit du 26 au 27 » est enregistrée à **`date = 2026-09-27`**.

Pourquoi le réveil plutôt que le coucher :
- on la saisit **le matin**, sur la page du jour qu'on ouvre à ce moment-là ;
- elle influence **la journée qui commence** : la comparaison principale
  « nuit → ce que je mange » se fait alors **sur la même date** (simple et
  sans ambiguïté dans les requêtes) ;
- le sens inverse (« ma journée → ma nuit ») se lit `date J` → `date J+1`.

Contrainte `unique (user_id, date)` : une seule nuit par date → **upsert**.

La carte de la page du jour D affiche donc **la nuit qui s'est terminée le
matin de D** (« Nuit du 26 au 27 »). En swipant sur un jour passé, on voit la
nuit correspondante.

**Tranché (Q1)** : rattachement à la date du réveil.

### 3.2 Champs d'une nuit

| Champ | Type | Obligatoire | Rôle |
|---|---|---|---|
| `heure_endormissement` | `time` | non | régularité, chronotype, suggestion d'heure de coucher |
| `heure_reveil` | `time` | non | idem |
| `duree_min` | `smallint` | **oui** | **source de vérité** pour toutes les stats |
| `qualite` | `smallint 1–5` | non (fortement incité) | 2ᵉ axe d'analyse, souvent plus parlant que la durée |
| `reveil_naturel` | `boolean` | non | nécessaire au calcul du chronotype (§5.3) |
| `facteurs` | `text[]` | non | contexte de la nuit (Palier 4, colonne créée dès P1) |
| `sieste_min` | `smallint` | non | sieste **de la journée D** (option, §4.7) |
| `note` | `text` | non | libre |

Pourquoi stocker `duree_min` **en plus** des deux heures : la fenêtre
endormissement → réveil n'est pas la durée dormie (éveils nocturnes), et
beaucoup de gens recopient simplement la durée affichée par leur montre. Donc :

- les deux heures saisies → durée **pré-calculée**, modifiable ;
- si elle est corrigée à la baisse, l'écart = temps éveillé la nuit
  (affiché : « dont 25 min éveillée ») → **efficacité du sommeil** =
  durée / fenêtre (signalée seulement si < 85 %) ;
- durée seule → acceptée (la nuit compte dans les moyennes, pas dans la
  régularité).

### 3.3 Calcul de la durée : minuit et **changement d'heure**

- Endormissement 23:40 → réveil 07:10 : on passe minuit. Endormissement
  01:15 → réveil 08:00 : on ne le passe pas. Règle : l'endormissement est
  placé le **jour D−1 s'il est après midi**, le **jour D sinon**.
- **Changement d'heure** : le **25 octobre 2026** (dans un mois), la nuit du
  24 au 25 dure 1 h de plus que ce que disent les horloges ; fin mars, 1 h de
  moins. On calcule donc la durée avec de vrais objets `Date` en heure locale
  (`new Date(y, m, d, hh, mm)`), qui gèrent le changement d'heure, **pas** par
  simple soustraction d'heures d'horloge. Test explicite à écrire sur ces
  deux dates.
- Garde-fous de saisie : durée > 14 h ou < 1 h → demande de confirmation (pas
  de blocage : nuit blanche = 0 min est une donnée légitime).

### 3.4 Moyennes d'heures : statistique **circulaire**

La moyenne arithmétique de 23:30 et 00:30 donne 12:00, ce qui est absurde.
Toutes les moyennes et écarts-types d'heures passent par une **moyenne
circulaire** (angles sur 24 h, `atan2(Σsin, Σcos)`) — ou, plus lisible dans le
code, un décalage : minutes depuis **midi** pour les endormissements
(20:00 → 480, 01:00 → 780), ce qui rend la plage continue. Une seule fonction
utilitaire dans `sleep.js`, utilisée partout.

---

## 4. Fonctionnalités

### 4.1 Carte « Sommeil » sur la page du jour (Palier 1)

**Nuit pas encore notée** (cas du matin) :

```
🌙 Sommeil                                     Nuit du 26 au 27
   Comment as-tu dormi ?
   [ Comme d'habitude · 23:15 → 07:05 ]   [ Détailler ]
```

- **« Comme d'habitude »** = enregistrement en **un seul appui**, avec les
  horaires habituels calculés (§5.1). Le but : que noter sa nuit prenne
  2 secondes les jours sans histoire, sinon on arrête au bout d'une semaine.
- **Détailler** ouvre la feuille de saisie (portal, cf. CLAUDE.md).

**Nuit notée :**

```
🌙 Sommeil                           7 h 25   ●●●●○
   23:40 → 07:05 · objectif 8 h (−35 min)
   ▂▅▇▃▆▇█  7 dernières nuits · manque de sommeil : 2 h 10
```

- mini-histogramme des 7 dernières nuits (barre pointillée = objectif) ;
- **manque de sommeil accumulé** (§5.2), affiché seulement s'il dépasse 1 h ;
- repliable, état mémorisé en `localStorage` (même pattern que `StoolSection`).

### 4.2 Feuille de saisie (Palier 1)

- Deux champs heure (endormissement, réveil) **pré-remplis** avec les heures
  habituelles, boutons −15 / +15 min pour ajuster au pouce sans clavier.
- Durée calculée en direct, modifiable (« dont X min éveillée »).
- **Qualité ressentie** : 5 visages (😫 😕 😐 🙂 😄), un appui.
- Case **« Réveil sans alarme »** (pré-cochée le week-end si c'est l'habitude
  observée).
- Note libre.
- Palier 4 : puces « facteurs » (§4.5).

### 4.3 Onglet « Sommeil » de l'Historique (Palier 2)

Nouvel onglet thématique dans `HistoryPage` (à côté de Activité / Cycle /
Digestion), qui suit le sélecteur Semaine / Mois / Année.

1. **Chiffres clés** : durée moyenne, nuits sous 6 h, qualité moyenne, heure
   moyenne d'endormissement et de réveil, nombre de nuits notées / jours de
   la période (honnêteté sur les trous).
2. **« Actogramme »** : une ligne par nuit, une barre de l'endormissement au
   réveil sur un axe 20:00 → 12:00. C'est **la** vue qui fait voir la
   régularité d'un coup d'œil (les barres s'alignent ou partent en
   escalier). Couleur de la barre = qualité ressentie.
3. **Régularité** : score SRI 0–100 (§5.3) avec une phrase (« horaires très
   réguliers » / « assez variables » / « très irréguliers »).
4. **Semaine vs week-end** : durée et heure du milieu de nuit de chaque côté,
   **décalage (« jet lag social »)** en heures (§5.3).
5. **Profil par jour de semaine** (réutiliser le gabarit de
   `WeekdayProfile`) : quelle nuit est la plus courte.
6. **Suggestion d'objectif personnalisé** (§5.5).

### 4.4 Croisements « nuit → journée » (Palier 3, le cœur du chantier)

Cartes dans l'onglet Sommeil, calculées sur une **fenêtre glissante de
90 jours** (pas sur la période sélectionnée : une semaine ne dit rien, cf.
§5.4 et la leçon « fenêtre longue » de `feedback-calcul-poids-calories`).

Carte principale **« Après une nuit courte »** :

> Les jours qui suivent une nuit courte (au moins 45 min sous ton habitude),
> tu manges en moyenne **2 140 kcal** contre **1 870 kcal** après une nuit
> normale (**+270 kcal**), à jour de la semaine comparable.
> Chaque heure de sommeil en moins ≈ **+150 kcal** le lendemain.
> **Lien net** · sur 23 + 41 jours.

Indicateurs croisés, par ordre d'importance :

| Indicateur (jour J) | Pourquoi | Source dans l'app |
|---|---|---|
| **kcal du jour** | l'effet principal documenté | `journal.energie_kcal` |
| **sucres (g)** et **lipides (g)** | appétence gras/sucré | `journal.sucres`, `lipides` |
| **kcal des collations** | le surplus passe par le grignotage | `journal` avec `meal = 'Collation'` |
| **part du dîner + collation** dans le total | glissement vers le soir | idem |
| **protéines (g)** | souvent ↓ quand on grignote | `journal.proteines` |
| **pas du jour** | la vraie « dépense » observable | `pas_jour.nb_pas` |
| **minutes de sport / séances** | séances sautées ? | `activites_sport` |
| **kcal d'activité** | pas + séances dédoublonnés | `dayActivityKcal` (sport.js) |
| **écart à l'objectif** (kcal − goal du jour) | « est-ce que je dépasse ? » | `daySettings.goal_kcal` |

Les mêmes analyses peuvent prendre la **qualité ressentie** comme variable de
départ à la place de la durée (« après une mauvaise nuit (😫/😕) »). C'est
parfois plus parlant : on peut dormir 7 h et se sentir mal.

Affichage : la carte kcal est toujours visible ; les autres indicateurs sont
listés en dessous **seulement s'ils montrent quelque chose** (§5.4), avec un
repli « voir tous les indicateurs ».

### 4.5 Croisements « journée → nuit suivante » (Palier 4)

Deux sources de facteurs :

**a) Facteurs déduits automatiquement** (aucune saisie en plus) :

| Facteur du jour J | Détection |
|---|---|
| Séance de sport | `activites_sport` du jour J |
| Séance **tardive** (après 19 h) | `heure_debut` renseignée ≥ 19:00 |
| Beaucoup de pas (> ton habitude + 30 %) | `pas_jour` |
| **Dîner copieux** (dîner + collation > 45 % des kcal) | `journal` par repas |
| **Alcool** | mots-clés dans `food_name` (vin, bière, cidre, champagne, cocktail, rhum, whisky, apéritif…) — liste dans `sleep.js`, testable |
| Phase du cycle (lutéale, règles) | `phaseForDate` (cycle.js), si le suivi de cycle est actif |
| Symptôme « Sommeil perturbé » déjà noté dans les règles | `regles.symptomes` contient `sommeil` |

**b) Facteurs cochés** dans la feuille de saisie (colonne `facteurs`) :
*café tardif · écrans tard · stress · repas tardif · chaleur · bruit ·
douleurs · malade · réveils la nuit · difficile de s'endormir*.

L'heure des repas n'est **pas** connue de manière fiable
(`journal.created_at` = heure de *saisie*, pas de repas ; les repas planifiés
marqués « mangés » faussent tout). D'où la case « repas tardif » manuelle
plutôt qu'une déduction automatique trompeuse. Idem pour la caféine : on sait
*si* on a bu du café, pas *quand*.

Présentation : une carte « Ce qui accompagne tes nuits » qui liste, pour
chaque facteur **vu au moins 5 fois**, l'écart de durée et de qualité de la
nuit suivante vs les nuits sans ce facteur, triés par ampleur, avec le même
niveau de confiance qu'en §5.4.

> Nuits après un verre d'alcool : **−35 min**, qualité 2,6 vs 3,7 · tendance
> Nuits après une séance tardive : pas de différence visible

### 4.6 Conseils du jour (Palier 5)

Sur le slot **aujourd'hui** uniquement (comme `TodayGapsSection`), désactivable
dans Profil › Sommeil :

- **Après une nuit courte** (≥ 1 h sous l'habitude, ou < 6 h), une ligne dans
  la carte Sommeil :
  - si le Palier 3 a trouvé un lien net ou une tendance **chez elle** :
    « Après une nuit comme celle-ci, tu manges d'habitude **~+270 kcal**,
    surtout en collation. C'est la fatigue qui parle : des protéines au
    petit-déj et une collation prévue à l'avance aident. » ;
  - sinon, repère général sans chiffre personnel : « La fatigue augmente
    souvent la faim, surtout pour le sucré en fin de journée. ».
  - **Aucun changement de l'objectif calorique** (§2, §8).
- **Heure de coucher conseillée**, en soirée (après 19 h) : « Pour tes 8 h
  avant ton réveil habituel de 7:00, vise l'endormissement vers 23:00 »
  (réveil habituel du lendemain selon le type de jour − objectif − latence
  moyenne de 15 min).
- **Manque de sommeil accumulé** élevé (> 5 h sur 7 nuits) : phrase douce,
  pas d'alerte rouge.

### 4.7 Options (Palier 6, à la carte)

- **Point sur le calendrier** pour les nuits courtes (le calendrier a déjà
  les coins cycle / sport — à vérifier qu'il reste de la place lisible).
- **Siestes** (`sieste_min` sur la ligne du jour D) : comptées dans le total
  des 24 h et comme facteur de la nuit suivante (« sieste > 30 min »).
- **Boutons « Je vais dormir » / « Je suis réveillée »** : deux appuis qui
  enregistrent l'heure réelle (l'endormissement = coucher + latence habituelle,
  modifiable). Pratique, mais 2ᵉ mode de saisie à maintenir.
- **Croisement transit** (compte `STOOL_TRACKER_USER_ID` seulement) : nuit
  courte → type Bristol / symptômes du lendemain, dans l'onglet Digestion,
  avec `bucketDaysByMetric` déjà existant.
- **Rappel push d'heure de coucher** : probablement abandonné comme les rappels
  sport (même friction cron / Edge Function) — à ne proposer que si demandé.

---

## 5. Algorithmes

Tout vit dans **`src/lib/sleep.js`** (nuits, horaires, régularité) et
**`src/lib/sleepInsights.js`** (croisements), fonctions pures, testables,
**une seule source de vérité** partagée entre la carte du jour (Palier 5) et
l'Historique (Palier 3) — cf. leçon n°1 de `feedback-calcul-poids-calories`.

### 5.1 Horaires habituels (pré-remplissage, « Comme d'habitude »)

- Type de jour du **réveil** : semaine (lun–ven) ou week-end (sam–dim).
- Heure habituelle = **médiane circulaire** des 14 dernières nuits du même
  type (médiane plutôt que moyenne : une nuit de fête ne déplace pas tout).
- Repli : toutes les nuits récentes → sinon 23:00 / 07:00.
- Même logique pour « réveil sans alarme » pré-coché : coché si ≥ 60 % des
  nuits récentes du même type l'étaient.

### 5.2 Manque de sommeil accumulé (« dette »)

Sur les 7 dernières nuits **notées** :

```
dette = Σ max(0, objectif − durée)  −  0,5 × Σ max(0, durée − objectif)
       bornée à ≥ 0
```

- Une nuit plus longue ne rembourse que **la moitié** de son surplus (on ne
  « stocke » pas du sommeil et on ne rattrape qu'en partie).
- Nuits non notées : ignorées (jamais d'invention de données). Si moins de 4
  nuits notées sur 7, pas d'affichage.

### 5.3 Régularité et chronotype

- **Écart-type circulaire** des heures d'endormissement et de réveil (simple,
  affiché en minutes : « tes heures d'endormissement varient de ±50 min »).
- **Sleep Regularity Index (SRI)** : on découpe chaque journée en tranches de
  15 min marquées « endormie » / « éveillée » d'après les fenêtres
  endormissement → réveil ; SRI = 200 × (proportion de tranches identiques à
  24 h d'écart) − 100, ramené sur 0–100. Calculé **seulement sur les paires de
  nuits consécutives notées avec les deux heures**, ≥ 5 paires. C'est
  l'indicateur de régularité le mieux validé (Phillips 2017, Windred 2024).
- **Milieu de nuit** = endormissement + durée / 2.
- **Jet lag social** = |milieu de nuit des nuits sans alarme − milieu de nuit
  des nuits avec alarme|. Repli si `reveil_naturel` non renseigné : week-end
  vs semaine. Affiché si ≥ 4 nuits de chaque côté ; signalé à partir de 1 h.
- **Chronotype** (MCTQ, Roenneberg) = milieu de nuit des jours libres, corrigé
  de la dette (`MSFsc = MSF − (durée_libre − durée_moyenne) / 2`). Affiché en
  clair : « plutôt du soir » / « intermédiaire » / « plutôt du matin ».
  Informatif seulement.

### 5.4 Le moteur de croisement (Palier 3 et 4)

Fonction générique :

```js
sleepEffect({ nights, outcomeByDate, window = 90, strata, minN })
// → { perHour, shortVsNormal: { meanShort, meanNormal, nShort, nNormal },
//     confidence: 'net' | 'tendance' | 'aucun' | 'pas_assez' }
```

Réutilisée pour chaque indicateur de §4.4 et, en sens inverse, pour chaque
facteur de §4.5. Étapes :

1. **Jours utilisables** : jour non exclu (`jours_exclus`), nuit notée, et
   journée **plausiblement complète** (kcal ≥ 40 % de l'objectif). Sinon un
   jour où on a oublié de noter le dîner passe pour un « jour où l'on mange
   peu », ce qui fausse tout.
2. **Écrêtage** des valeurs extrêmes (5ᵉ–95ᵉ percentile) : un repas de fête ne
   fait pas à lui seul une « tendance ».
3. **Comparaison à situation comparable (le point clé).** Les nuits du
   week-end sont plus longues **et** on mange différemment le week-end ; en
   phase lutéale on dort moins bien **et** on mange plus. Sans correction,
   l'app « découvrirait » des liens qui ne sont que l'effet du week-end ou du
   cycle. On forme donc des **strates** (semaine / week-end × lutéale / reste
   du cycle si le suivi de cycle est actif), et dans chaque strate on
   retranche la moyenne de la strate à la durée **et** à l'indicateur. On ne
   compare plus que des **écarts à l'habitude du même type de jour**.
   Strates de moins de 3 jours : écartées.
4. **Pente** (régression simple sur les écarts) → « chaque heure de sommeil en
   moins ≈ +X kcal ». Erreur-type de la pente → rapport pente / erreur = *t*.
5. **Lecture concrète** : « nuits courtes » = durée ≥ 45 min **sous
   l'habitude de la strate** (seuil personnel, pas un 6 h arbitraire) vs les
   autres → deux moyennes, plus lisibles qu'une pente.
6. **Niveau de confiance**, affiché en mots, jamais de « p-value » :
   - `pas_assez` : < 20 jours utilisables ou < 6 nuits courtes → « encore
     X nuits à noter pour voir un lien » (barre de progression motivante) ;
   - `aucun` : |t| < 1,5 → « pas de différence visible » ;
   - `tendance` : 1,5 ≤ |t| < 2,5 → « tendance, à confirmer » ;
   - `net` : |t| ≥ 2,5 → « lien net ».
   Seuil volontairement exigeant : on teste ~10 indicateurs, et à ce nombre de
   comparaisons une fausse alerte de temps en temps est attendue.

**Ordre de grandeur de données nécessaires** : l'apport varie facilement de
± 400 kcal d'un jour à l'autre ; pour détecter un effet de ~250 kcal il faut
de l'ordre de **25 à 30 nuits courtes et autant de normales**, soit **2 à
3 mois** de saisie régulière. À dire honnêtement dans l'interface.

### 5.5 Objectif de sommeil personnalisé

Suggestion (jamais appliquée d'office, comme `suggestGoalMl` pour l'eau) :
**médiane des nuits sans alarme ET qualité ≥ 4** sur 60 jours, bornée à
[7 h, 9 h]. Affichée si ≥ 6 nuits de ce type : « Les nuits où tu te réveilles
seule et en forme durent 8 h 10 : veux-tu en faire ton objectif ? ». Par
défaut : 8 h.

### 5.6 Score de nuit ? — **non recommandé**

Un « score 0–100 » agrégeant durée, qualité et régularité est tentant mais
opaque (on ne sait jamais pourquoi on a 72). On affiche plutôt les trois
composantes séparément. **Tranché (Q5)** : pas de score.

---

## 6. Architecture technique

### 6.1 Base de données

`supabase/sql/sommeil_setup.sql`, à exécuter à la main, puis reporter dans
`supabase_schema.sql` (règle du CLAUDE.md).

```sql
create table if not exists sommeil (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,                        -- date du RÉVEIL (nuit du 26 au 27 → 27)
  heure_endormissement time,                 -- nullable
  heure_reveil time,                         -- nullable
  duree_min smallint not null check (duree_min between 0 and 1440),
  qualite smallint check (qualite between 1 and 5),  -- nullable
  reveil_naturel boolean,                    -- nullable = non renseigné
  facteurs text[] not null default '{}',     -- clés SLEEP_FACTORS (sleep.js), Palier 4
  sieste_min smallint check (sieste_min between 0 and 600), -- sieste du jour `date`, option
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
-- l'index unique (user_id, date) sert aussi aux requêtes par plage de dates.

alter table sommeil enable row level security;
-- 4 policies « own » select / insert / update / delete (pattern `selles`).
```

Réglages : colonne `settings.sommeil jsonb`, même pattern que `water` /
`sport` / `cycle`, fusionnée côté client avec `SLEEP_DEFAULTS` :

```js
SLEEP_DEFAULTS = {
  card_visible: true,         // carte affichée par défaut (Q3)
  objectif_min: 480,          // 8 h
  seuil_nuit_courte_min: 45,  // sous l'habitude
  conseils_jour: true,        // Palier 5
  afficher_calendrier: false, // Palier 6
}
```

Ajouter `'sommeil'` au défaut de `settings.ordre_sections_jour` n'est pas
nécessaire : `normalizeTodaySectionsOrder` réinsère la clé manquante (§6.2).

### 6.2 Fichiers

| Fichier | Rôle | Palier |
|---|---|---|
| `src/lib/sleep.js` | défauts, calcul de durée (minuit + changement d'heure), stats circulaires, habitudes, dette, SRI, jet lag social, moteur `sleepEffect`, détection alcool, facteurs | 1 → 4 |
| `src/hooks/useSleep.js` | `useSleep(dateStr)` : nuit du jour + 14 dernières (habitudes, histogramme 7 nuits), `save` (upsert) / `remove` ; `useSleepRange(start, end)` pour l'Historique | 1, 2 |
| `src/components/SleepSection.jsx` | carte de la page du jour | 1 (+5) |
| `src/components/SleepEntrySheet.jsx` | feuille de saisie, **via `createPortal`** | 1 (+4) |
| `src/components/profile/SleepSection.jsx` | Profil › Sommeil : objectif, carte visible, conseils | 1 |
| `src/components/history/SleepHistorySection.jsx` | onglet « Sommeil » de l'Historique | 2 → 4 |
| `src/lib/todaySections.js` | clé `sommeil`, libellé « Sommeil » | 1 |
| `src/pages/TodayPage.jsx` | entrée `sommeil` dans `sectionNodes`, état de la feuille | 1 |
| `src/pages/HistoryPage.jsx` | vue `{ key: 'sommeil', label: 'Sommeil' }` ; chargement 90 j pour les croisements | 2, 3 |

Position par défaut de la clé `sommeil` (**tranché, Q4**) : juste **avant
`sport`** (« Activité »). `normalizeTodaySectionsOrder` a été adapté : une
clé manquante d'un ordre enregistré se place désormais juste avant le premier
bloc qui la suit dans l'ordre par défaut et qui est déjà présent (et non plus
à son index par défaut) — « Sommeil » arrive donc avant « Activité » même chez
une utilisatrice qui a réordonné ses blocs.

### 6.3 Performance

Les croisements (Palier 3) demandent le journal sur 90 jours (colonnes
`date, meal, energie_kcal, sucres, lipides, proteines` seulement, paginé via
`fetchAllRows`), les pas et les séances sur 90 jours. Calcul uniquement quand
l'onglet Sommeil est affiché (même garde que `usePeriodFodmap`). Pour le
conseil du jour (Palier 5), résultat mis en cache en `localStorage` pour la
journée plutôt que recalculé à chaque ouverture.

---

## 7. Paliers

| Palier | Contenu | Visible pour l'utilisatrice |
|---|---|---|
| **1 — Saisie** | table + réglages + `sleep.js` (durée, habitudes) + hook + carte réordonnable + feuille + Profil › Sommeil. **Qualité et réveil naturel dès maintenant** (§1). | noter sa nuit en 1 appui, voir 7 nuits |
| **2 — Stats** | onglet Sommeil de l'Historique : chiffres clés, actogramme, régularité (SRI), semaine vs week-end, profil par jour, dette, objectif suggéré | comprendre ses nuits |
| **3 — Nuit → journée** | moteur `sleepEffect`, cartes kcal / sucres / collations / pas / sport, fenêtre 90 j, niveaux de confiance, compteur « encore X nuits » | la question de départ |
| **4 — Journée → nuit** | facteurs automatiques + puces dans la feuille, carte « Ce qui accompagne tes nuits » | ce qui l'aide / la gêne à dormir |
| **5 — Conseils** | message après une nuit courte (personnalisé si P3 a trouvé un lien), heure de coucher conseillée | au quotidien |
| **6 — Options** | calendrier, siestes, boutons coucher/réveil, transit, rappels | à la carte |

Branche dédiée par palier (changement « plus gros » au sens du CLAUDE.md),
entrée `changelog.js` à chaque palier poussé.

Paliers 1 et 2 peuvent être livrés ensemble. Le Palier 3 peut être codé tôt :
son compteur « encore X nuits à noter » est justement ce qui donne envie de
continuer à saisir pendant les semaines où il n'y a pas encore assez de
données.

---

## 8. Garde-fous

- **Aucun effet sur `goal_kcal` ni sur les cibles de macros**, à aucun palier.
  Le sommeil informe, il ne pilote pas (§2).
- **Formulation d'observation**, jamais de causalité : même disclaimer que les
  cartes FODMAP / transit (« simple observation : stress, cycle, week-end et
  bien d'autres choses jouent aussi »).
- **Pas de ton culpabilisant** : pas de rouge, pas de « mauvais score ». Une
  nuit courte est une information, pas une faute.
- **Pas de diagnostic** : si la durée moyenne reste < 5 h 30 sur 30 jours, ou
  si « difficile de s'endormir » revient très souvent, une seule phrase neutre
  suggérant d'en parler à un·e médecin (même esprit que `amenorrheaNotice`).
- **Pas d'invention de données** : nuits non notées = absentes, jamais
  remplacées par l'habitude dans les stats.
- **Données de santé** : RLS « own » stricte, rien dans le social (pas de
  partage prévu).

---

## 9. Hors périmètre

- Import automatique depuis une montre / Health Connect (PWA, cf. chantier
  sport).
- Phases de sommeil (léger / profond / paradoxal) : impossibles à saisir de
  façon fiable à la main.
- Ronflements, apnées : relèvent du médical.
- Modifier l'heure des repas conseillée selon le chronotype : littérature
  encore fragile, et l'heure réelle des repas n'est pas connue (§4.5).

---

## 10. Décisions de cadrage (tranchées le 2026-09-27)

1. **Q1 — Rattachement** : date du **réveil** (nuit du 26 au 27 → 27). ✅
2. **Q2 — Saisie au Palier 1** : durée + heures + **qualité ressentie** +
   **réveil sans alarme** + note. ✅
3. **Q3 — Visibilité** : carte **visible par défaut** pour les deux comptes,
   masquable dans Profil › Sommeil. ✅
4. **Q4 — Position par défaut** : **juste avant la carte Activité** (sport). ✅
5. **Q5 — Score de nuit** : **non**, durée / qualité / régularité séparées. ✅
6. **Q6 — Conseil après une nuit courte** : **oui**, sans aucune modification
   des calories. ✅
7. **Q7 — Options du Palier 6** : **toutes** retenues (siestes, boutons
   « je vais dormir / je suis réveillée », repère sur le calendrier,
   croisement avec le transit ; le rappel push d'heure de coucher reste à
   confirmer séparément). ✅

---

## 11. Suivi d'avancement

### Paliers 1 + 2 — branche `feature/suivi-sommeil` (2026-09-27)

Codés ensemble, build OK. **Reste : exécuter `supabase/sql/sommeil_setup.sql`
AVANT tout test local** (useSettings réécrit tout l'objet settings : sans la
colonne `settings.sommeil`, tous les réglages échouent), test manuel, merge.

- `supabase/sql/sommeil_setup.sql` : table `sommeil` (unique `user_id, date`,
  RLS « own ») + colonne `settings.sommeil`. Reporté dans
  `supabase_schema.sql`.
- `src/lib/sleep.js` : défauts, durée (minuit + changement d'heure, testée
  sur le 25/10/2026 et le 28/03/2027), stats circulaires, horaires habituels,
  dette, SRI, jet lag social, chronotype, objectif suggéré, stats de période.
- `src/hooks/useSleep.js` : `useSleep(dateStr)` (60 j, `save` = upsert,
  `update` = patch partiel, `remove`), `useSleepRange(start, end)`.
- `SleepSection.jsx` (carte, « Comme d'habitude » en 1 appui, qualité en
  ligne si absente, 7 dernières nuits, dette), `SleepEntrySheet.jsx` (portal).
- `profile/SleepSection.jsx` : carte visible, objectif (5 h → 10 h, pas de
  15 min), objectif suggéré.
- `history/SleepHistorySection.jsx` : onglet « Sommeil » (tuiles, régularité
  SRI, une barre par nuit / moyennes mensuelles, semaine vs jours libres +
  chronotype, profil par jour de réveil).
- Entrée `changelog.js` ajoutée.

### Paliers 3 à 6 — mergés sur `main` le 2026-09-27

Build OK, aucune migration (les colonnes `facteurs`, `sieste_min` et les
réglages `conseils_jour` / `afficher_calendrier` existaient dès le Palier 1).
Moteur testé en script sur données simulées : effet injecté de +300 kcal
retrouvé (« lien net »), effet nul → « pas de différence », le piège
« week-end = plus de sommeil ET plus de calories » est bien neutralisé par les
strates.

- **P3** — `src/lib/sleepInsights.js` (`sleepEffect`, `computeSleepInsights`,
  indicateurs kcal / collations / part du soir / sucres / lipides / protéines
  / pas / jours avec séance, prédicteur durée OU qualité), hook
  `src/hooks/useSleepInsights.js` (90 j, journal paginé, chargé seulement à
  l'ouverture de l'onglet), `history/SleepInsightsSection.jsx` (carte
  principale kcal + barres de progression tant qu'il manque des données,
  autres indicateurs filtrés sur ce qui ressort). La journée en cours n'est
  jamais comptée (incomplète).
- **P4** — `factorEffect`, facteurs automatiques (séance la veille, séance
  après 19 h, beaucoup de pas, dîner > 40 % de la journée, alcool détecté
  dans le journal par mots-clés `isAlcoholFood`, sieste > 30 min, règles,
  phase lutéale) + puces « Contexte de la nuit » dans la feuille
  (`SLEEP_FACTORS`). Carte « Ce qui accompagne tes nuits ».
- **P5** — conseil après une nuit courte (`isShortVsHabit` : ≥ 1 h sous la
  durée habituelle du même type de jour, ou < 6 h) sur le slot aujourd'hui,
  personnel si P3 a trouvé un lien/tendance (même `computeSleepInsights`),
  générique sinon ; heure d'endormissement conseillée après 19 h
  (`bedtimeAdvice`) ; phrase sur le manque de sommeil ≥ 5 h ; phrase neutre
  « en parler à un·e médecin » si moyenne < 5 h 30 sur ≥ 14 nuits (hors vue
  Semaine). Réglage Profil › Sommeil › Conseils du jour.
- **P6** — sieste (champ de la feuille, affichée dans la carte, facteur de la
  nuit suivante) ; « Je vais dormir » / « Je suis réveillée » (coucher
  mémorisé en localStorage sur l'appareil, feuille pré-remplie :
  endormissement = coucher + 15 min) ; point bleu « nuit courte » (≥ 1 h sous
  l'objectif) au coin bas-gauche du calendrier, option Profil › Sommeil ;
  carte « Sommeil & transit » dans l'onglet Digestion (compte transit).
- **Abandonné** (décision utilisatrice, 2026-09-27) : rappel push d'heure de
  coucher.

## Sources

- Al Khatib HK et al. *The effects of partial sleep deprivation on energy
  balance: a systematic review and meta-analysis.* Eur J Clin Nutr, 2017.
- Spaeth AM, Dinges DF, Goel N. *Effects of experimental sleep restriction on
  weight gain, caloric intake, and meal timing in healthy adults.* Sleep, 2013.
- Greer SM, Goldstein AN, Walker MP. *The impact of sleep deprivation on food
  desire in the human brain.* Nat Commun, 2013.
- Phillips AJK et al. *Irregular sleep/wake patterns are associated with poorer
  academic performance and delayed circadian and sleep/wake timing.* Sci Rep,
  2017 (définition du SRI).
- Windred DP et al. *Sleep regularity is a stronger predictor of mortality risk
  than sleep duration.* Sleep, 2024.
- Roenneberg T et al. *Social jetlag and obesity.* Curr Biol, 2012.
- Baker FC, Driver HS. *Circadian rhythms, sleep, and the menstrual cycle.*
  Sleep Med, 2007.
- Ebrahim IO et al. *Alcohol and sleep I: effects on normal sleep.* Alcohol
  Clin Exp Res, 2013.
- Hirshkowitz M et al. *National Sleep Foundation's sleep time duration
  recommendations.* Sleep Health, 2015.
