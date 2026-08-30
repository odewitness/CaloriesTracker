# Chantier « Suivi de l'activité sportive »

Document de conception + suivi d'avancement. À faire évoluer au fil du chantier.
Créé le 2026-08-30.

**État au 2026-08-30 :** Paliers 1–4, 6, 7 déployés. Palier 8 (social) codé sur
`suivi-sport-p8` (migration `partages_sport_setup.sql` à appliquer). Palier 5
(Strava) abandonné. Palier 9 (rappels push) en attente — demande un déploiement
Edge Function + cron Supabase (friction équivalente à Strava).

---

## 1. Objectif et périmètre

Ajouter à l'app un suivi des séances de sport : les saisir, les visualiser sur la
page du jour / le calendrier / l'historique, se fixer un objectif hebdomadaire,
et — plus tard, avec beaucoup de précautions — relier la dépense estimée aux
cibles caloriques.

**Décisions cadrées avec l'utilisatrice (2026-08-30) :**

- **Pas d'app native.** On reste une PWA (cohérent avec la décision du chantier
  cycle, 2026-08-29 : un wrapper natif « changerait la nature du projet — build
  natif, stores »). Conséquence directe : **Health Connect, Apple Santé, Mi
  Fitness en direct et Garmin Connect en direct sont hors de portée** (APIs sur
  l'appareil ou réservées aux partenaires B2B). Voir §4.4.
- **Saisie manuelle = source de vérité** (Palier 1), comme pour la table
  `regles`. La base est conçue pour qu'un import (Strava, plus tard autre chose)
  alimente **la même table `activites_sport`** sans refonte.
- ~~**Strava en option** (Palier 5)~~ — **abandonné** (décision utilisatrice,
  2026-08-30) : trop de plomberie à mettre en place côté Strava + Supabase
  (création d'une app Strava, déploiement d'Edge Functions, secret, cron). La
  saisie manuelle couvre le besoin. §4.4 conservée pour référence si on y
  revient un jour. **Aucun autre palier ne dépendait de Strava.**
- **« Manger selon l'effort » visé à terme, mais reconnu comme un piège.** Le
  `goal_kcal` actuel **intègre déjà** l'activité sportive (multiplicateur
  `ACTIVITY_LEVELS` ×1.2 → ×1.9 dans `computeCalorieNeeds`). Ajouter les séances
  par-dessus = **double comptage**. → On fait d'abord un **bilan en lecture
  seule** (Palier 6), et la vraie bascule de modèle (Palier 7) reste une option
  tardive, explicite et encadrée. Voir §3.2 et §8.
- **Deux utilisatrices** (comptes distincts). Toutes les nouvelles tables sont
  **par utilisatrice, RLS « own »** (pattern `mensurations` / `regles`), jamais
  le pattern mono-utilisateur de `journal` / `settings`.
- **On avance par paliers** (voir §6). Ce qui n'est pas encore fait est en §7.

---

## 2. Repères (estimations & modèles de budget)

### 2.1 Estimer les calories d'une séance

Formule MET (Compendium of Physical Activities), avec le poids déjà connu du
profil :

```
kcal ≈ MET × 3,5 × poids_kg / 200 × durée_min
```

- Précision réelle : **±15 à 30 %**. Les kcal affichées par les montres (surtout
  l'entrée de gamme Xiaomi) ne sont **pas plus fiables**.
- → Toujours afficher « ≈ », jamais une valeur sèche. Ne **jamais** bâtir une
  cible d'apport dessus sans garde-fou (§8).
- L'intensité ressentie module un peu l'estimation : `faible ×0,85`,
  `modérée ×1,0`, `élevée ×1,15` (grossier, assumé).

### 2.2 Les deux modèles de budget calorique (mutuellement exclusifs)

| Modèle | Principe | État dans l'app |
|---|---|---|
| **A — « activité incluse » (TDEE)** | `niveau_activite` multiplie le métabolisme de base ; l'objectif est **plat tous les jours**, le sport habituel est déjà dedans. Ça se compense sur la semaine. | **Utilisé aujourd'hui.** `computeCalorieNeeds` + `ACTIVITY_LEVELS` dans `src/lib/nutrients.js`, appliqué en one-shot par le bouton « Appliquer » du calculateur (Profil › Objectifs) → `goal_kcal` fige le multiplicateur. |
| **B — base + « eat-back »** | L'objectif de base ne couvre que la vie hors sport (≈ sédentaire / léger). Chaque séance **s'ajoute** au budget du jour où elle a lieu. Le budget suit l'activité réelle. | Non implémenté. C'est le Palier 7 (option). |

**Le bug à éviter :** faire tourner les deux en même temps (garder un
`niveau_activite` « modéré » = sport 3–5 j/sem **et** créditer chaque séance).

---

## 3. Modèle retenu

### 3.1 Données d'une séance

- **type** : clé prédéfinie (`SPORT_TYPES` dans `src/lib/sport.js`), avec libellé
  FR, icône, valeur MET, booléen « a une distance ». Jeu de départ :
  `course`, `marche`, `velo`, `natation`, `muscu`, `yoga`, `hiit`, `danse`,
  `rando`, `sport_co`, `autre`.
- **durée** (min, obligatoire), **date** (obligatoire), **heure de début**
  (optionnelle), **distance** (km, optionnelle selon le type), **intensité**
  (optionnelle : `faible` / `moderee` / `elevee`), **notes** (optionnelles).
- **energie_kcal** : estimée à la saisie (MET), **éditable**. Pour une séance
  importée, on prend la valeur de la source si elle existe.
- **fc_moyenne** / **fc_max** : optionnelles, surtout utiles à l'import.
- **source** : `manuel` | `strava`. **source_id** : id externe (dédup imports).

### 3.2 Sport ↔ cibles caloriques : la progression

`settings.sport.mode_energie` ∈ :

- **`aucun`** (défaut) — le sport n'a **aucun effet** sur les cibles. Palier 1.
- **`bilan`** — ligne indicative « apports vs dépense estimée (métabolisme +
  séances) », avec la mention *« recouvrement avec ton niveau d'activité — ne
  pas cumuler mentalement »*. **`goal_kcal` inchangé.** Palier 6.
- **`manger_selon_effort`** — bascule vers le modèle B : la cible de base est
  **recalculée sur `niveau_activite` = sédentaire**, puis les séances du jour
  sont créditées, **plafonnées** à `depense_max_creditee_kcal`, jamais sous le
  minimum habituel. Écran de réglage avec **avant / après chiffré**. Palier 7
  (option), à décider après quelques semaines de `bilan`.

---

## 4. Architecture technique

### 4.1 Base de données

**Nouvelle table `activites_sport`** — 1 ligne = 1 séance. Champs en français.
RLS « own » **select / insert / update / delete** (l'`update` est nécessaire,
contrairement à `regles` : on édite une séance). SQL dans
`supabase/sql/sport_setup.sql`, à exécuter à la main dans Supabase, puis reporter
dans `supabase_schema.sql`.

```sql
create table if not exists activites_sport (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  heure_debut time,               -- nullable
  type text not null,             -- clé de SPORT_TYPES
  duree_min numeric not null,
  distance_km numeric,            -- nullable
  intensite text,                 -- nullable : 'faible' | 'moderee' | 'elevee'
  energie_kcal numeric,           -- nullable : estimée (MET) ou source, éditable
  fc_moyenne integer,             -- nullable
  fc_max integer,                 -- nullable
  source text not null default 'manuel',   -- 'manuel' | 'strava'
  source_id text,                 -- nullable : id externe, pour la déduplication
  modifie_manuellement boolean not null default false,  -- séance importée puis retouchée : une resync ne l'écrase pas
  notes text,                     -- nullable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_activites_sport_source
  on activites_sport (user_id, source, source_id) where source_id is not null;
create index if not exists idx_activites_sport_user_date
  on activites_sport (user_id, date desc);

alter table activites_sport enable row level security;
-- policies select / insert / update / delete "own" (auth.uid() = user_id)
```

**Réglages : bloc `sport` dans `settings`** (colonne `jsonb`, même pattern que
`settings.water` / `settings.cycle` — fusion client avec des défauts via
`mergeSportSettings`, robuste si la colonne est absente).

```jsonc
{
  "enabled": false,                    // toute la feature est opt-in
  "objectif_hebdo_minutes": 150,       // 0 = pas d'objectif en minutes
  "objectif_hebdo_seances": 0,         // 0 = pas d'objectif en nombre de séances
  "afficher_page_jour": true,
  "afficher_calendrier": true,
  "mode_energie": "aucun",             // 'aucun' | 'bilan' | 'manger_selon_effort'
  "depense_max_creditee_kcal": 400,    // plafond quand mode_energie = 'manger_selon_effort'
  "rappels": { "enabled": false, "jours": [], "heure": 18 },
  "strava": {                          // affichage seulement — AUCUN token ici
    "connected": false,
    "athlete_nom": null,
    "derniere_synchro": null,
    "auto": true
  }
}
```

**Table `connexions_sport`** — ~~Palier 5, tokens OAuth~~ — **non créée**
(Strava abandonné). Schéma conservé pour référence :

```sql
create table if not exists connexions_sport (
  user_id uuid not null references auth.users(id),
  fournisseur text not null,           -- 'strava'
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  external_athlete_id text,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, fournisseur)
);
alter table connexions_sport enable row level security;
-- AUCUNE policy pour anon / authenticated : lecture + écriture réservées aux
-- Edge Functions (service_role contourne RLS). Le client ne voit que l'état
-- "connecté" + nom d'athlète, via settings.sport.strava.
```

Tables sociales `partages_sport` / `reactions_sport` / `commentaires_sport` :
seulement au Palier 8, calquées sur `partages_journal` & co.

### 4.2 Client

- `src/lib/sport.js` — fonctions pures : `SPORT_TYPES`, `SPORT_DEFAULTS`,
  `mergeSportSettings(raw)`, `estimateKcal({ type, poidsKg, dureeMin, intensite })`,
  `weeklyStats(activites, weekStart)`, `phaseForActivite` (Palier 4).
- `src/hooks/useSport.js` — CRUD sur `activites_sport` pour une plage de dates
  (`add` / `update` / `remove`), sur le modèle de `useCycle` / `useMeasurements`.
- Réglages via `useSettings` (bloc `sport`) : ajouter `SPORT_DEFAULTS` /
  `mergeSportSettings` à `DEFAULTS` et à `withWater` dans `src/hooks/useSettings.js`.
- `src/lib/todaySections.js` — ajouter la clé `'sport'` à `TODAY_SECTION_KEYS`,
  `TODAY_SECTION_LABELS` (« Activité ») et `DEFAULT_TODAY_SECTIONS_ORDER`.
  `normalizeTodaySectionsOrder` réinsère déjà une clé nouvelle à sa place chez
  les utilisatrices ayant un ordre enregistré — rien d'autre à faire.
- Feuille de saisie : nouveau composant **monté via `createPortal(...,
  document.body)`** (contrainte CLAUDE.md sur les modales de `TodayPage` — sinon
  cassée par le slider de jours).

### 4.3 Points d'accroche UI

| Zone | Fichier | Palier |
|---|---|---|
| Feuille « Ajouter une séance » (type, durée, distance, intensité, kcal estimé éditable, notes) | nouveau `SportEntrySheet.jsx` (portal) | 1 |
| Bloc « Activité » sur la page du jour (séances du jour + ajout rapide) | `TodayPage.jsx` DaySlot + nouveau `SportSection.jsx` ; clé `sport` dans `todaySections.js` | 1 |
| Pastille « séance » sur la grille du mois | `CalendarMonthGrid.jsx` (prop `sportByDate`) + `CalendarPage.jsx` | 1 |
| Écran Profil › Sport (activation, objectif hebdo minutes) | `ProfilePage.jsx` + `src/components/profile/SportSection.jsx` | 1 |
| Entrée changelog (`src/lib/changelog.js`) à chaque palier visible | `src/lib/changelog.js` | 1+ |
| Anneau « minutes actives cette semaine » vs objectif + série discrète | `SportSection.jsx` / `TodayOverviewCard.jsx` | 2 |
| Historique : minutes & séances par semaine / mois, courbe | `HistoryPage.jsx` + composant graphe | 2 |
| Corrélations sport ↔ poids / énergie + annotation des graphes les jours de séance | `HistoryPage.jsx`, `MetricChart.jsx` | 3 |
| Boucle cycle : rattacher chaque séance à sa phase, rétrospectif « ton sport selon ta phase » face à `PHASE_SPORT_GUIDANCE` | `src/lib/cycle.js`, `CyclePhaseBadge.jsx`, `HistoryPage.jsx` | 4 |
| ~~Connexion Strava~~ | — | ~~5~~ abandonné |
| Bilan énergétique lecture seule (`mode_energie: 'bilan'`) | `SportSection.jsx` / `TodayOverviewCard.jsx` | 6 |
| « Manger selon l'effort » : base recalculée sur sédentaire + crédit séances, plafonné | `nutrients.js` (`computeCalorieNeeds` base sédentaire), `TodayPage` `daySettings`, `computeMealTargets`, gaps | 7 (option) |
| Partage social d'une séance / résumé hebdo | tables sociales + `useFeed.js` + `SocialPage.jsx` | 8 (option) |
| Rappels push « tu n'as pas bougé » / objectif hebdo | `push_subscriptions` + Edge Function cron | 9 (option) |

### 4.4 Intégration Strava — ABANDONNÉE (2026-08-30)

> Décision utilisatrice : trop de mise en place (app Strava, Edge Functions,
> secret Supabase, cron). La saisie manuelle suffit. Section conservée telle
> quelle au cas où on y reviendrait — rien n'en dépend ailleurs.

**Pré-requis (une fois) :** créer une application sur
`https://www.strava.com/settings/api` → `Client ID`, `Client Secret`, domaine de
callback autorisé (celui de l'Edge Function). Une appli « single athlete »
fonctionne sans demande d'accès étendu ; au-delà, formulaire à remplir.

**Flow OAuth (Edge Function `strava-oauth`) :**

1. Le client ouvre `https://www.strava.com/oauth/authorize?client_id=…&redirect_uri=<edge fn>&response_type=code&scope=activity:read_all&approval_prompt=auto`.
2. Strava redirige vers `strava-oauth` avec `?code=…`.
3. L'Edge Function échange `code` → `access_token` + `refresh_token`
   (POST `https://www.strava.com/oauth/token` **avec le `client_secret`**, jamais
   exposé au client), écrit dans `connexions_sport`, met
   `settings.sport.strava.connected = true` + `athlete_nom`.

**Synchro (Edge Function `strava-sync`) :**

- Rafraîchit le token via `refresh_token` (les tokens Strava expirent toutes les
  ~6 h).
- `GET https://www.strava.com/api/v3/athlete/activities?after=<ts derniere_synchro>&per_page=…`
  → mapping vers `activites_sport` (type Strava → clé `SPORT_TYPES`,
  `moving_time` → `duree_min`, `distance` → `distance_km`,
  `average_heartrate` / `max_heartrate`, `calories` via `/activities/{id}` si
  besoin, `id` → `source_id`).
- Insert avec `on conflict (user_id, source, source_id) do nothing` (dédup). Une
  resync ne réécrit **jamais** une séance `modifie_manuellement = true`.
- Déclenchement : **cron `pg_cron`** toutes les X h (infra déjà en place pour le
  rappel d'eau) pour démarrer. Le webhook Strava (push à chaque nouvelle
  activité, avec réponse au challenge de validation) est une amélioration
  ultérieure.
- Limites de débit Strava (100 req / 15 min, 1000 / j en lecture) : très
  largement suffisantes pour 2 comptes.

**CGU Strava (nov. 2024) :** données affichées uniquement à l'athlète
propriétaire, pas d'agrégation inter-utilisatrices, pas d'entraînement d'IA. OK
pour l'usage perso ici. Le fil social (Palier 8) ne partage donc **que** des
séances saisies manuellement, ou un **résumé agrégé** que l'utilisatrice publie
elle-même — pas de rediffusion brute de données Strava d'une utilisatrice à
l'autre.

---

## 5. Workflow git

Gros chantier → **branche dédiée** (`suivi-sport`, ou une branche par palier),
`npm run build` + validation manuelle par l'utilisatrice sur `localhost:5173`,
puis merge + push vers `main` après confirmation. Migration SQL = étape manuelle
à faire exécuter par l'utilisatrice dans Supabase **avant** que le code qui en
dépend ne parte en prod. Toujours demander confirmation avant `git push`.

---

## 6. Paliers

### Palier 1 — Saisie manuelle + affichage (aucun effet sur les cibles) ▸ statut : codé (branche `suivi-sport`), en attente d'application SQL + test manuel + merge
- [x] `supabase/sql/sport_setup.sql` (table `activites_sport` + colonne
      `settings.sport` + nouveau défaut `ordre_sections_jour`) + MAJ
      `supabase_schema.sql` — **application manuelle dans Supabase encore à faire**
- [x] `src/lib/sport.js` (`SPORT_TYPES`, `SPORT_INTENSITES`, `SPORT_DEFAULTS`,
      `mergeSportSettings`, `estimateKcal`, `weekStart`/`weekEnd`, `weeklyStats`,
      `formatDuree`, `sortActivites`)
- [x] `src/hooks/useSport.js` : `useSport(dateStr)` (séances du jour + agrégats
      de la semaine + CRUD) et `useSportRange(start, end)` (calendrier)
- [x] Bloc `settings.sport` + fusion défauts dans `useSettings.js`
      (`mergeSportSettings` dans `withWater`)
- [x] Clé `'sport'` dans `src/lib/todaySections.js` (label « Activité »,
      insérée entre `repas` et `complements`)
- [x] `SportEntrySheet.jsx` (feuille ajout/édition, montée via `createPortal`) —
      type, durée (+ chips), distance (types concernés), intensité, heure,
      kcal estimé éditable avec « Réestimer », notes ; suppression en édition
- [x] Bloc « Activité » sur la page du jour (`SportSection.jsx` repliable +
      wiring dans `TodayPage` `DaySlot`, poids courant via `useMeasurements`)
- [x] Point vert « séance » sur `CalendarMonthGrid` (prop `sportByDate`) +
      `CalendarPage` (via `useSportRange`, respecte `afficher_calendrier`)
- [x] Écran Profil › Sport (`src/components/profile/SportSection.jsx`) :
      interrupteur `enabled`, objectifs hebdo (minutes / séances), toggles
      d'affichage + `NavRow` dans le hub Profil
- [x] Entrée changelog (2026-08-30 « Note tes séances de sport »)

### Palier 2 — Objectifs & historique ▸ statut : codé (branche `suivi-sport-p2`)
- [x] Anneau « minutes actives cette semaine » vs `objectif_hebdo_minutes` dans
      `SportSection` (composant `WeekRing`, SVG inline) + reste à faire / objectif
      atteint. `sport.js` : `statsByWeek`, `streakWeeks` (semaines consécutives
      dans l'objectif — sobre, aucun message de « série cassée »), `addWeeks`.
- [x] `useSport.js` : `useSportStreak(weeks)` (charge ~16 semaines pour la série).
- [x] Section « Sport » dans la page Historique
      (`src/components/history/SportHistorySection.jsx`) : tuiles temps total /
      séances / moy. par séance / semaines de suite, + histogramme des minutes
      actives (par jour en vue Semaine, par semaine en vue Mois, par mois en vue
      Année). Gardée par `settings.sport.enabled`.
      **Limite connue** : rendue à l'intérieur du bloc « il y a des données
      journal » de `HistoryPage` — une période avec du sport mais aucun repas
      loggé n'affiche pas encore la section (hoisting hors de ce bloc = Palier
      ultérieur si besoin).
- [x] Entrée changelog (2026-08-30 « Ton sport, semaine après semaine »)

### Palier 3 — Corrélations ▸ statut : codé (branche `suivi-sport-p3`)
- [x] Encart « Sport & calories sur cette période » dans `HistoryPage` : compare
      les kcal moy. (et le poids moy.) des **jours avec séance** vs **jours
      sans**, hors vue Année, min. 2 + 2 jours notés. Formulation « simple
      observation, pas une cause à effet ».
- [x] Annotation `CalorieTrendChart` : prop `sportDates` (Set) → tiret vert sous
      les barres des jours de séance (vues Semaine / Mois) + légende.
- [x] Annotation `MetricChart` (courbe de poids uniquement) : prop `sportDates`
      → tiret vert sous les relevés faits un jour de séance + légende.
      `MeasurementsPage` charge `useSportRange` sur la fenêtre des relevés.
- [x] Entrée changelog (2026-08-30 « Tes jours de sport sur tes courbes »)

### Palier 4 — Boucle cycle ▸ statut : codé (branche `suivi-sport-p4`)
- [x] Rattachement séance → phase via `phaseForDate` (cycle.js, déjà existant —
      pas de nouveau helper nécessaire)
- [x] `src/components/history/SportPhaseSection.jsx` : rétrospectif « Ton sport
      selon ta phase » dans `HistoryPage` — minutes / séances par phase (règles,
      folliculaire, ovulation, lutéale) + mini-barre + note `PHASE_SPORT_GUIDANCE`
      par phase. Hors vue Année. Ne s'affiche que si cycle actif (hors
      contraception) + sport actif + ≥ 3 séances rattachables sur la période.
      Note de bas de bloc « pas un programme à suivre ».
- [x] Entrée changelog (2026-08-30 « Ton sport, phase par phase »)
- Pas de modif de la pastille de phase (`CyclePhaseBadge`) au Palier 4 : le
  rétrospectif vit dans l'Historique, la pastille du jour garde le cadrage
  cycle existant (Palier 8 du chantier cycle).

### Palier 5 — Connexion Strava ▸ statut : ABANDONNÉ (2026-08-30)
Décision utilisatrice : trop de mise en place (app Strava, Edge Functions,
secret Supabase, cron) pour le gain. La saisie manuelle (Palier 1) couvre le
besoin. Voir §4.4 (conservée pour référence). La table `connexions_sport` n'est
pas créée. Aucun autre palier n'en dépendait. Les artefacts prévus
(`modifie_manuellement` sur `activites_sport`, `source`/`source_id`, valeur
`'strava'` de `mode_energie`… non, `mode_energie` n'a rien à voir) restent en
base : `activites_sport.source` vaut toujours `'manuel'`, `source_id` /
`modifie_manuellement` sont simplement inutilisés — inoffensifs, gardés au cas
où un import (texte, autre) arriverait plus tard.

### Palier 6 — Bilan énergétique (lecture seule) ▸ statut : codé (branche `suivi-sport-p6`)
- [x] Toggle « Afficher le bilan du jour » dans Profil › Sport → bascule
      `mode_energie` entre `'aucun'` et `'bilan'` (le 3ᵉ mode
      `'manger_selon_effort'` reste pour le Palier 7).
- [x] `sport.js` : `dayEnergyBalance({ consumedKcal, maintenanceKcal, sportKcal })`
      (pure, lecture seule, null si pas de maintenance).
- [x] Bloc « Bilan du jour · approximatif » dans `SportSection` (page du jour) :
      mangé vs dépense estimée (`maintenance` = TDEE via `computeCalorieNeeds` +
      kcal des séances du jour), surplus / déficit, + garde-fou d'affichage
      « ta dépense d'entretien intègre déjà une part d'activité — ne cumule pas ;
      ton objectif ne change pas ». `TodayPage` calcule `maintenanceKcal` depuis
      `useProfile` + dernier poids.
- [x] `goal_kcal` strictement inchangé — aucune écriture, aucun recalcul de cible.
- [x] Entrée changelog (2026-08-30 « Un bilan énergétique du jour, si tu veux »)

### Palier 7 — « Manger selon l'effort » ▸ statut : codé (branche `suivi-sport-p6`, avec le Palier 6)
- [x] `sport.js` : `sportBaseFrom({ goalKcal, profile, weightKg })` (équivalent
      sédentaire = `goalKcal − (TDEE actuel − TDEE sédentaire)`, planché à
      `max(1200, BMR)`) et `sportAdjustedSettings(settings, { profile, weightKg,
      sportKcalToday })` (renvoie `settings` inchangé si mode ≠
      `manger_selon_effort` ou profil incomplet).
- [x] Chaîné dans `TodayPage` **après** `cycleAdjustedSettings` : le sport
      travaille sur l'objectif déjà ajusté par le cycle. `_sportKcalAdjust` /
      `_sportBaseGoal` / `_sportCredit` exposés pour l'affichage. `computeMealTargets`,
      gaps, `remainingKcal`, `TodayOverviewCard` suivent `daySettings.goal_kcal`.
- [x] `HistoryPage` / calendrier : **rien** — gardent `settings.goal_kcal` à plat.
- [x] Profil › Sport : sélecteur 3 modes (`Aucun` / `Bilan indicatif` /
      `Manger selon l'effort`). Mode 3 **désactivé si profil incomplet**. Aperçu
      chiffré avant/après (base jour sans séance vs objectif habituel), stepper
      du plafond `depense_max_creditee_kcal` (100–700), avertissement ambré si
      `niveau_activite` ∉ {sédentaire, léger} (baisse marquée les jours off),
      mention « base scientifique modeste, ±25 %, page du jour seulement, plancher
      {floor} kcal, désactivable ».
- [x] Bloc explicatif « Objectif du jour · manger selon l'effort » dans
      `SportSection` (page du jour) : base + crédit = objectif, delta vs habituel.
- [x] Garde-fous §8 pt 3–4 respectés : opt-in, plafond, plancher `max(1200, BMR)`,
      soustraction de la part d'activité (jamais les deux modèles en même temps),
      désactivable en un geste, jour-page uniquement.
- [x] Entrée changelog (2026-08-30 « Manger selon l'effort (nouvelle option) »)

### Palier 8 — Social ▸ statut : codé (branche `suivi-sport-p8`)
Policies RLS du fil social fournies par l'utilisatrice le 2026-08-30
(`pg_policies`) → répliquées à l'identique.
- [x] `supabase/sql/partages_sport_setup.sql` : `partages_sport` (un partage =
      séance `kind='seance'` OU résumé de semaine `kind='semaine'`),
      `reactions_sport`, `commentaires_sport` + RLS `select = auteure OR
      is_friend_with(auteur)`, insert/delete gardés comme le trio `journal`.
      MAJ `supabase_schema.sql` (tables 29-31).
- [x] `useFeed.js` : `sport` ajouté aux maps `POST_/REACTION_/COMMENT_TABLE`,
      au chargement du fil et aux réactions/compteurs ; nouvelle `shareSport({
      kind, message, ...payload })`. `deletePartage` / `toggleReaction` déjà
      génériques.
- [x] `useSportPartageDetail.js` (miroir de `useJournalPartageDetail`, sans
      table de détail).
- [x] `SportPartageCard.jsx` + `SportPartageDetailModal.jsx` (gèrent les deux
      `kind`).
- [x] `SocialPage.jsx` : `SportPartageDetailContainer`, rendu dans `FilTab`
      (switch `_type`), branche `selected._type === 'sport'`, texte du fil vide.
- [x] `useSocialNotifications.js` : 3ᵉ entrée `PARTAGE_SOURCES` + `targetLabel`
      sport → réactions/commentaires sur un partage sport notifient l'auteure
      (onglet Activité + pastille cloche).
- [x] Points d'entrée : bouton « Partager avec mes amies » dans
      `SportEntrySheet` (édition d'une séance), lien « Partager ma semaine » dans
      `SportSection` ; `ShareSportModal` (message optionnel) monté via portal
      depuis `TodayPage`.
- [x] Entrée changelog (2026-08-30 « Partage tes séances avec tes amies »)

### Palier 9 — Rappels push (option) ▸ statut : EN ATTENTE (friction infra)
Rappel « tu n'as pas bougé aujourd'hui » / « objectif hebdo à X min ».
**Coût :** nouvelle Edge Function `sport-reminder` (sur le modèle de
`supabase/functions/water-reminder`) + Cron Job Supabase + colonne
`settings.sport_last_reminder_at` (migration) — c'est-à-dire **le même type de
mise en place manuelle côté Supabase que Strava**, que l'utilisatrice a écartée.
Côté client (léger) : réglages `rappels` dans Profil › Sport.
- [ ] À faire seulement si l'utilisatrice veut assumer le déploiement Edge
      Function + cron.

---

## 7. Reste à faire (vue rapide)

- Palier 1 : mergé dans `main` en local (SQL `sport_setup.sql` appliqué par
  l'utilisatrice, testé). Reste : `git push` vers `main` (à confirmer).
- Paliers 1 → 4, 6, 7 : mergés + poussés sur `main` (déployés Netlify).
- **Palier 5 (Strava) : abandonné.**
- **Palier 8 (social)** : codé sur `suivi-sport-p8`. Migration
  `partages_sport_setup.sql` à appliquer par l'utilisatrice. Reste : test
  manuel, merge + push.
- **Palier 9 (rappels push)** : en attente — demande un déploiement Edge Function
  + cron Supabase (friction équivalente à Strava). À faire sur demande.

---

## 8. Garde-fous et alertes ⚠️

1. **kcal = estimation.** Jamais une valeur sèche ; « ≈ » systématique. MET comme
   montre : ±15–30 %.
2. **Par défaut (`mode_energie: 'aucun'`), le sport n'a aucun effet sur les
   cibles d'apport.** Aucune injonction (« bouge plus », « rattrape-toi »). Ton
   neutre, formulations souples (esprit `jours_exclus`).
3. **« Manger selon l'effort » = bascule de modèle explicite** (base recalculée
   sur sédentaire) + opt-in + plafond + jamais sous le minimum habituel +
   désactivable en un geste. Écran de réglage avec avant / après chiffré. Même
   philosophie que le delta énergétique lutéal du chantier cycle.
4. **Ne jamais faire tourner les deux modèles de budget en même temps.** Si
   `mode_energie = 'manger_selon_effort'` et `niveau_activite` ≠ sédentaire /
   léger → avertir.
5. **Objectifs hebdo = encouragement doux.** Pas de culpabilisation si non
   atteint. Série (streak) **discrète**, pas de « tu as cassé ta série ! », pas
   de gamification agressive.
6. **Pas un dispositif médical.** FC et zones à titre indicatif, disclaimer clair.
7. **Compensation / surentraînement.** Suivre à la fois les apports *et* la
   dépense peut nourrir un rapport anxieux à l'équilibre énergétique — c'est
   exactement ce qu'une app de calories doit prendre au sérieux (cf. garde-fou
   aménorrhée du chantier cycle). Ne pas sur-solliciter.
8. **Séances importées.** Une resync Strava n'écrase jamais une valeur corrigée à
   la main (`modifie_manuellement`).
9. **Multi-utilisatrices.** `activites_sport` et `connexions_sport` en RLS
   « own » strict (pattern `mensurations` / `regles`). Tokens Strava
   inaccessibles au client (Edge Functions / `service_role` uniquement).

---

## 9. Journal des décisions

- **2026-08-30** — Palier 8 (social) débloqué : l'utilisatrice a fourni le
  `pg_policies` du trio `journal`. Migration `partages_sport_setup.sql` (RLS
  répliquée à l'identique, `is_friend_with`), + mirroring complet (`useFeed`,
  `useSportPartageDetail`, `SportPartageCard`, `SportPartageDetailModal`,
  `SocialPage`, `useSocialNotifications`, `ShareSportModal`, points d'entrée
  séance/semaine). Un partage = séance OU résumé de semaine (`kind`). `npm run
  build` OK. En attente : application SQL + test manuel + merge/push.
- **2026-08-30** — Paliers 6 & 7 mergés + poussés sur `main`. Palier 8 (social)
  d'abord mis en attente (policies RLS non versionnées), Palier 9 (rappels push)
  en attente (friction infra type Strava).
- **2026-08-30** — Palier 7 (« manger selon l'effort ») codé avec le Palier 6
  sur `suivi-sport-p6`. Modèle retenu : `base = goal_kcal − (TDEE_actuel −
  TDEE_sédentaire)` planché à `max(1200, BMR)`, `+ min(kcal séances du jour,
  plafond)`. Chaîné après le cycle. Page du jour uniquement. Sélecteur 3 modes
  + aperçu chiffré + avertissement si niveau d'activité élevé. `goal_kcal` en
  base jamais modifié. `npm run build` OK. En attente : test manuel + merge/push
  (avec le Palier 6).
- **2026-08-30** — Palier 4 mergé + poussé. Palier 6 codé sur la branche
  `suivi-sport-p6` : toggle `mode_energie` `aucun`/`bilan` dans Profil › Sport,
  `dayEnergyBalance` (pur), bloc « Bilan du jour · approximatif » dans
  `SportSection` (mangé vs TDEE + séances, surplus/déficit, garde-fou
  « ne cumule pas / objectif inchangé »). `goal_kcal` jamais touché. `npm run
  build` OK. En attente : test manuel + merge/push.
- **2026-08-30** — **Palier 5 (Strava) abandonné** (décision utilisatrice) :
  trop de plomberie (app Strava + Edge Functions + secret + cron) pour le gain.
  §4.4 conservée pour référence. Aucun autre palier n'en dépendait ; la table
  `connexions_sport` n'est pas créée. Suite envisageable : Palier 6 (bilan
  énergétique en lecture seule).
- **2026-08-30** — Palier 3 mergé + poussé. Palier 4 codé sur la branche
  `suivi-sport-p4` : `SportPhaseSection` dans `HistoryPage` (répartition
  minutes/séances par phase du cycle + repère `PHASE_SPORT_GUIDANCE` par phase,
  ≥ 3 séances rattachables, hors Année). Pas de modif de `CyclePhaseBadge` — le
  rétrospectif reste dans l'Historique. `npm run build` OK. En attente : test
  manuel + merge/push.
- **2026-08-30** — Paliers 1 & 2 mergés + poussés sur `main` (déployés). Palier 3
  codé sur la branche `suivi-sport-p3` : encart « Sport & calories sur cette
  période » (jours avec séance vs sans, kcal + poids moy.) dans `HistoryPage`,
  tiret vert sous les jours de séance sur `CalorieTrendChart` (prop `sportDates`)
  et sur la courbe de poids de `MetricChart`. Choix : corrélation au niveau
  **jour** (séance vs repos), pas semaine — plus lisible et fonctionne dès une
  seule semaine. `npm run build` OK. En attente : test manuel + merge/push.
- **2026-08-30** — Palier 1 mergé dans `main` (local, SQL appliqué + testé par
  l'utilisatrice, push en attente). Palier 2 codé sur la branche
  `suivi-sport-p2` : anneau minutes/semaine (`WeekRing` dans `SportSection`),
  `statsByWeek` / `streakWeeks` / `addWeeks` dans `sport.js`, `useSportStreak`,
  section « Sport » dans `HistoryPage` (`SportHistorySection` : tuiles +
  histogramme par jour/semaine/mois). Streak volontairement sobre. `npm run
  build` OK. En attente : test manuel + merge/push.
- **2026-08-30** — Palier 1 codé sur la branche `suivi-sport` : migration
  `sport_setup.sql` (table `activites_sport` RLS « own », colonne
  `settings.sport`, défaut `ordre_sections_jour` élargi à `sport`),
  `src/lib/sport.js`, `src/hooks/useSport.js` (`useSport` + `useSportRange`),
  `SportEntrySheet` (portal), `SportSection` (carte page du jour repliable),
  point vert sur `CalendarMonthGrid`, écran Profil › Sport
  (`components/profile/SportSection.jsx`) + `NavRow` dans le hub, entrée
  changelog. `mode_energie` présent dans les réglages mais **sans effet** au
  Palier 1. `npm run build` OK. En attente : application SQL par l'utilisatrice,
  test manuel, merge + push après confirmation.
- **2026-08-30** — Cadrage initial. App native **écartée** (on reste PWA,
  cohérent avec la décision du chantier cycle) → Health Connect / Apple Santé /
  Mi Fitness direct / Garmin direct hors de portée. **Saisie manuelle = source
  de vérité** (Palier 1). **Strava en option** (Palier 5) via Edge Functions :
  couvre la Garmin de la 2ᵉ utilisatrice proprement, la montre Xiaomi de la 1ʳᵉ
  partiellement (Mi Fitness → Strava limité aux sports GPS, instable en 2026).
  **« Manger selon l'effort »** reconnu comme un piège de double comptage (le
  `goal_kcal` intègre déjà l'activité via `ACTIVITY_LEVELS`) → **bilan en lecture
  seule d'abord** (Palier 6), bascule de modèle explicite ensuite (Palier 7,
  option non tranchée). **Deux utilisatrices** confirmé → toutes les tables en
  RLS « own ». Ce document créé.
