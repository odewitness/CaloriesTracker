-- =============================================
-- CALORIE TRACKER - Schema Supabase
-- Reconstruit le 2026-08-13 depuis l'introspection de la vraie base
-- (information_schema.columns + table_constraints), pas depuis un
-- historique de migrations. Sert de référence pour Claude Code, pas
-- de script d'installation à rejouer tel quel sur une base existante.
-- Complété le 2026-08-17 : tables 15-23 (fil social) + colonne
-- profiles.pseudo, depuis un nouvel export information_schema.columns
-- (pas de table_constraints cette fois — FK/CHECK sur ces tables
-- déduits du code client, marqués "non confirmé" quand incertains).
-- Complété le 2026-08-18 : table 24 (push_subscriptions) + colonnes
-- notif_reminder_enabled/notif_social_enabled/last_reminder_sent_date sur
-- settings, pour les notifications push (rappel quotidien + activité
-- sociale) — voir supabase/sql/push_notifications_setup.sql pour le SQL
-- complet (schéma + triggers + cron), exécuté manuellement, pas encore
-- confirmé appliqué en base au moment de l'écriture de ce fichier.
-- Complété le 2026-08-26 : table 26 (jours_exclus), pas encore confirmée
-- appliquée en base au moment de l'écriture de ce fichier — voir
-- supabase/sql/jours_exclus_setup.sql pour le SQL complet.
-- Complété le 2026-08-30 : table 28 (activites_sport) + colonne settings.sport
-- + nouveau défaut de settings.ordre_sections_jour (ajout de la clé 'sport'),
-- chantier « Suivi de l'activité sportive » Palier 1 — voir
-- supabase/sql/sport_setup.sql et docs/suivi-sport.md. Pas encore confirmé
-- appliqué en base au moment de l'écriture de ce fichier.
-- Complété le 2026-08-30 : tables 29-31 (partages_sport, reactions_sport,
-- commentaires_sport) — fil social du sport, Palier 8, RLS calquée à
-- l'identique sur partages_journal & co. (fonction is_friend_with). Voir
-- supabase/sql/partages_sport_setup.sql.
-- Complété le 2026-08-30 : table 32 (pas_jour) + colonne
-- activites_sport.compte_dans_pas + clés settings.sport (afficher_pas,
-- objectif_pas_jour, pas_seuil_baseline) — chantier « Suivi de l'activité
-- sportive » Palier 10 (pas quotidiens). Voir supabase/sql/pas_jour_setup.sql
-- et docs/suivi-sport.md. SQL appliqué + testé par l'utilisatrice le 2026-08-30.
-- Complété le 2026-08-31 : table 33 (collation_jours) — surcharge « par jour »
-- de l'activation de la Collation (l'interrupteur global settings.meal_enabled
-- reste la valeur par défaut). Voir supabase/sql/collation_jours_setup.sql. Pas
-- encore confirmé appliqué en base au moment de l'écriture de ce fichier.
-- Complété le 2026-08-31 : colonne aliments_custom.rappel + colonnes
-- settings.notif_complements_enabled / settings.complements_reminder_state +
-- cron 'complements-reminder-hourly' (rappels programmables de compléments —
-- Edge Function complements-reminder). Voir
-- supabase/sql/complements_rappels_setup.sql.
-- Complété le 2026-08-31 : colonne `saisons text[]` sur recettes, repas_types
-- et partages_recettes (multi-sélection de saison(s), même modèle que
-- `categories`). Voir supabase/sql/saisons_setup.sql.
-- Confirmé appliqué le 2026-08-31 : colonnes settings.goal_auto_adjust (M3,
-- supabase/sql/goal_auto_adjust_setup.sql — manquait en base, tous les upserts
-- `settings` échouaient en PGRST204), settings.notif_complements_enabled et
-- settings.complements_reminder_state, ainsi que recettes/repas_types/
-- partages_recettes.saisons.
-- =============================================

-- 1. TABLE CIQUAL (aliments de référence)
create table if not exists ciqual (
  id serial primary key,
  alim_code text unique,
  alim_nom text not null,
  alim_nom_eng text,
  categorie text,
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  sucres numeric,
  acides_gras_satures numeric,
  sel numeric,
  calcium numeric,
  fer numeric,
  magnesium numeric,
  potassium numeric,
  zinc numeric,
  vit_c numeric,
  vit_d numeric,
  vit_b1 numeric,
  vit_b2 numeric,
  vit_b6 numeric,
  vit_b12 numeric,
  vit_a numeric,
  vit_e numeric,
  folates numeric,
  portions jsonb default '[]',
  -- Nutriments détaillés (sucres, acides gras, vitamines, minéraux) ajoutés
  -- après la création initiale de la table, tous nullable.
  fructose numeric,
  galactose numeric,
  glucose numeric,
  lactose numeric,
  maltose numeric,
  saccharose numeric,
  amidon numeric,
  polyols numeric,
  ag_monoinsatures numeric,
  ag_polyinsatures numeric,
  ag_4_0 numeric,
  ag_6_0 numeric,
  ag_8_0 numeric,
  ag_10_0 numeric,
  ag_12_0 numeric,
  ag_14_0 numeric,
  ag_16_0 numeric,
  ag_18_0 numeric,
  ag_18_1_oleique numeric,
  ag_18_2_linoleique numeric,
  ag_18_3_ala numeric,
  ag_20_4_arachidonique numeric,
  ag_20_5_epa numeric,
  ag_22_6_dha numeric,
  cholesterol numeric,
  sodium numeric,
  chlorure numeric,
  cuivre numeric,
  iode numeric,
  manganese numeric,
  phosphore numeric,
  selenium numeric,
  retinol numeric,
  beta_carotene numeric,
  vit_d2 numeric,
  vit_d3 numeric,
  vit_e_totale numeric,
  vit_k1 numeric,
  vit_k2 numeric,
  vit_b3 numeric,
  vit_b5 numeric,
  folates_intrinseques numeric,
  acide_folique numeric
);

-- Index pour la recherche rapide
create index if not exists idx_ciqual_nom on ciqual using gin(to_tsvector('french', alim_nom));
create index if not exists idx_ciqual_cat on ciqual(categorie);

-- 2. TABLE JOURNAL (entrées quotidiennes)
create table if not exists journal (
  id uuid default gen_random_uuid() primary key,
  date date not null default current_date,
  meal text not null,
  food_name text not null,
  food_source text default 'ciqual',
  food_ref_id text,
  qty_g numeric not null,
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  vit_c numeric,
  vit_d numeric,
  calcium numeric,
  fer numeric,
  magnesium numeric,
  potassium numeric,
  vit_b12 numeric,
  vit_a numeric,
  vit_e numeric,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id),
  -- Même jeu de nutriments détaillés que ciqual/aliments_custom/recettes,
  -- scalés au grammage de l'entrée (voir ALL_NUTRIENT_KEYS dans src/lib/nutrients.js).
  sucres numeric,
  sel numeric,
  acides_gras_satures numeric,
  zinc numeric,
  vit_b1 numeric,
  vit_b2 numeric,
  vit_b6 numeric,
  folates numeric,
  fructose numeric,
  galactose numeric,
  glucose numeric,
  lactose numeric,
  maltose numeric,
  saccharose numeric,
  amidon numeric,
  polyols numeric,
  ag_monoinsatures numeric,
  ag_polyinsatures numeric,
  ag_4_0 numeric,
  ag_6_0 numeric,
  ag_8_0 numeric,
  ag_10_0 numeric,
  ag_12_0 numeric,
  ag_14_0 numeric,
  ag_16_0 numeric,
  ag_18_0 numeric,
  ag_18_1_oleique numeric,
  ag_18_2_linoleique numeric,
  ag_18_3_ala numeric,
  ag_20_4_arachidonique numeric,
  ag_20_5_epa numeric,
  ag_22_6_dha numeric,
  cholesterol numeric,
  sodium numeric,
  chlorure numeric,
  cuivre numeric,
  iode numeric,
  manganese numeric,
  phosphore numeric,
  selenium numeric,
  retinol numeric,
  beta_carotene numeric,
  vit_d2 numeric,
  vit_d3 numeric,
  vit_e_totale numeric,
  vit_k1 numeric,
  vit_k2 numeric,
  vit_b3 numeric,
  vit_b5 numeric,
  folates_intrinseques numeric,
  acide_folique numeric
);

create index if not exists idx_journal_date on journal(date desc);

-- 3. TABLE REPAS TYPES (groupes d'aliments sauvegardés)
create table if not exists repas_types (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  description text,
  items jsonb not null default '[]',
  -- items = [{ food_name, food_ref_id, food_source, qty_g, energie_kcal, proteines, glucides, lipides, ... }]
  nb_portions integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id),
  categories text[] not null default '{}', -- mêmes valeurs que recettes.categories (voir RECIPE_CATEGORIES dans src/lib/recipeCategories.js) : 'Petit-déjeuner' | 'Collation' | 'Plat' | 'Accompagnement' | 'Boisson' | 'Dessert' | 'Pain / pâtes' (multi)
  saisons text[] not null default '{}' -- multi-sélection de saison(s) (voir SEASONS dans src/lib/seasons.js) : 'Printemps' | 'Été' | 'Automne' | 'Hiver'
);

-- 4. TABLE SETTINGS
create table if not exists settings (
  id integer primary key default 1,
  goal_kcal integer default 1800,
  goal_proteines integer default 100,
  goal_glucides integer default 180,
  goal_lipides integer default 60,
  goal_fibres integer default 30,
  updated_at timestamptz default now(),
  user_id uuid references auth.users(id),
  meal_overrides jsonb not null default '{}',
  meal_enabled jsonb not null default '{"Dîner": true, "Collation": true, "Déjeuner": true, "Compléments": true, "Petit-déjeuner": true}',
  -- Ajoutées le 2026-08-18 pour les notifications push (voir
  -- supabase/sql/push_notifications_setup.sql).
  notif_reminder_enabled boolean not null default true,
  notif_social_enabled boolean not null default true,
  last_reminder_sent_date date,
  -- Ajoutée le 2026-08-30 (roadmap §F9, rappels contextuels — voir
  -- supabase/sql/contextual_reminders_setup.sql). État anti-doublon des deux
  -- checks quotidiens de daily-reminder : { "d":"YYYY-MM-DD", "sent":[...] }
  -- (valeur ignorée si "d" ≠ date du jour).
  notif_reminder_state jsonb not null default '{}'::jsonb,
  -- Ajoutée le 2026-08-20 : affiche/masque la section "À combler aujourd'hui"
  -- (manques nutritionnels + suggestion) sur la page du jour (voir Profil >
  -- Page du jour, et TodayGapsSection côté client).
  afficher_manques_jour boolean not null default true,
  -- Ajoutée le 2026-08-30 (roadmap §M3 — voir supabase/sql/goal_auto_adjust_setup.sql).
  -- { "enabled": bool, "last_prompt": "YYYY-MM-DD" | null }. Opt-in : propose un
  -- ajustement de goal_kcal (±100) selon la tendance de poids. Fusionné client
  -- avec GOAL_AUTO_ADJUST_DEFAULTS (src/hooks/useSettings.js).
  goal_auto_adjust jsonb not null default '{"enabled":false,"last_prompt":null}'::jsonb,
  -- Ajoutée le 2026-08-30 (voir supabase/sql/today_sections_order_setup.sql).
  -- Ordre des blocs de contenu de la page du jour, réglé par l'utilisatrice
  -- depuis Profil > Page du jour. Tableau des clés 'phase' | 'bilan' |
  -- 'nutriments' | 'manques' | 'repas' | 'sport' | 'complements' | 'eau'.
  -- Fusionné côté client avec l'ordre par défaut (normalizeTodaySectionsOrder,
  -- src/lib/todaySections.js). Défaut élargi le 2026-08-30 avec la clé 'sport'
  -- (chantier suivi sport, voir supabase/sql/sport_setup.sql).
  ordre_sections_jour jsonb not null default '["phase","bilan","nutriments","manques","repas","sport","complements","eau"]',
  -- Ajoutées le 2026-08-29 pour le tracker d'eau (voir
  -- supabase/sql/water_tracker_setup.sql).
  -- `water` = bloc unique { goal_ml, default_food_ref_id (alim_code Ciqual de
  -- la boisson par défaut), portions [{id,label,ml}], card_visible, notif
  -- {enabled, mode 'interval'|'once'|'smart', every_h, start_h, end_h, once_h,
  -- smart_h, smart_threshold, stop_when_done} }. Fusionné côté client avec
  -- WATER_DEFAULTS (src/lib/water.js), comme meal_enabled.
  water jsonb not null default '{"goal_ml":2000,"default_food_ref_id":null,"portions":[{"id":"verre","label":"Verre","ml":250},{"id":"bouteille","label":"Bouteille","ml":500},{"id":"gourde","label":"Gourde","ml":750}],"card_visible":true,"notif":{"enabled":false,"mode":"interval","every_h":2,"start_h":8,"end_h":21,"once_h":13,"smart_h":17,"smart_threshold":60,"stop_when_done":true}}',
  -- Horodatage du dernier rappel d'hydratation envoyé (écrit par l'Edge
  -- Function water-reminder, à part du blob `water` que le client édite).
  water_last_reminder_at timestamptz,
  -- Ajoutée le 2026-08-29 (chantier « manger en fonction du cycle menstruel »,
  -- Palier 1 — voir supabase/sql/regles_setup.sql et docs/cycle-menstruel.md).
  -- Bloc unique de réglages du suivi de cycle, même pattern que `water` :
  -- { enabled, sous_contraception, longueur_cycle, auto_longueur_cycle,
  --   longueur_luteale, longueur_regles, afficher_sur_calendrier,
  --   afficher_badge_jour, afficher_conseils_micro, appliquer_delta_energie,
  --   delta_energie_luteale_kcal }. Fusionné côté client avec CYCLE_DEFAULTS
  -- (src/lib/cycle.js). Défaut = suivi désactivé (opt-in).
  cycle jsonb not null default '{"enabled":false,"sous_contraception":false,"longueur_cycle":28,"auto_longueur_cycle":true,"longueur_luteale":14,"longueur_regles":5,"afficher_sur_calendrier":true,"afficher_badge_jour":true,"afficher_conseils_micro":true,"appliquer_delta_energie":false,"delta_energie_luteale_kcal":120}',
  -- Ajoutée le 2026-08-30 (chantier « Suivi de l'activité sportive », Palier 1 —
  -- voir supabase/sql/sport_setup.sql et docs/suivi-sport.md). Bloc unique de
  -- réglages du suivi sport, même pattern que `water` / `cycle` :
  -- { enabled, objectif_hebdo_minutes, objectif_hebdo_seances,
  --   afficher_page_jour, afficher_calendrier, mode_energie
  --   ('aucun'|'bilan'|'manger_selon_effort' — sans effet sur les cibles au
  --   Palier 1), depense_max_creditee_kcal, rappels {enabled, jours, heure},
  --   strava {connected, athlete_nom, derniere_synchro, auto},
  --   afficher_pas, objectif_pas_jour, pas_seuil_baseline (Palier 10, pas
  --   quotidiens — voir supabase/sql/pas_jour_setup.sql) }. Fusionné côté
  -- client avec SPORT_DEFAULTS (src/lib/sport.js). Défaut = suivi désactivé.
  sport jsonb not null default '{"enabled":false,"objectif_hebdo_minutes":150,"objectif_hebdo_seances":0,"afficher_page_jour":true,"afficher_calendrier":true,"afficher_pas":false,"objectif_pas_jour":8000,"pas_seuil_baseline":4000,"mode_energie":"aucun","depense_max_creditee_kcal":400,"rappels":{"enabled":false,"jours":[],"heure":18},"strava":{"connected":false,"athlete_nom":null,"derniere_synchro":null,"auto":true}}',
  -- Ajoutées le 2026-08-31 (rappels de compléments — voir
  -- supabase/sql/complements_rappels_setup.sql).
  -- notif_complements_enabled : interrupteur maître des rappels de compléments
  -- (Profil > Notifications > Rappels compléments). Fusionné côté client par
  -- useSettings DEFAULTS.
  notif_complements_enabled boolean not null default true,
  -- complements_reminder_state : anti-doublon écrit par l'Edge Function
  -- complements-reminder, jamais lu côté client —
  -- { "<aliment_id>|<heure>": "YYYY-MM-DD" } = dernier envoi de chaque créneau.
  complements_reminder_state jsonb not null default '{}'::jsonb,
  -- Ajoutée le 2026-09-05 (chantier « Objectif de poids », Palier 1 — voir
  -- supabase/sql/poids_objectif_setup.sql et docs/objectif-poids.md). Poids
  -- désiré + date visée, saisis une fois et conservés (avant : le
  -- calculateur de calories de Profil > Objectifs demandait déjà ces deux
  -- valeurs, mais seulement pour un calcul ponctuel, jamais persisté).
  -- { poids_desire: number | null, date_objectif: "YYYY-MM-DD" | null }.
  -- Fusionné côté client avec GOAL_WEIGHT_DEFAULTS (src/lib/poidsObjectif.js).
  poids_objectif jsonb not null default '{"poids_desire":null,"date_objectif":null}'::jsonb
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- 5. TABLE ALIMENTS CUSTOM (ajoutés manuellement)
create table if not exists aliments_custom (
  id uuid default gen_random_uuid() primary key,
  nom text not null,
  marque text,
  categorie text default 'Personnalisé',
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  vit_c numeric default 0,
  vit_d numeric default 0,
  calcium numeric default 0,
  fer numeric default 0,
  portions jsonb default '[]',
  created_at timestamptz default now(),
  user_id uuid references auth.users(id),
  -- Même jeu de nutriments détaillés que ciqual (voir plus haut).
  sucres numeric,
  sel numeric,
  acides_gras_satures numeric,
  zinc numeric,
  vit_b1 numeric,
  vit_b2 numeric,
  vit_b6 numeric,
  folates numeric,
  fructose numeric,
  galactose numeric,
  glucose numeric,
  lactose numeric,
  maltose numeric,
  saccharose numeric,
  amidon numeric,
  polyols numeric,
  ag_monoinsatures numeric,
  ag_polyinsatures numeric,
  ag_4_0 numeric,
  ag_6_0 numeric,
  ag_8_0 numeric,
  ag_10_0 numeric,
  ag_12_0 numeric,
  ag_14_0 numeric,
  ag_16_0 numeric,
  ag_18_0 numeric,
  ag_18_1_oleique numeric,
  ag_18_2_linoleique numeric,
  ag_18_3_ala numeric,
  ag_20_4_arachidonique numeric,
  ag_20_5_epa numeric,
  ag_22_6_dha numeric,
  cholesterol numeric,
  sodium numeric,
  chlorure numeric,
  cuivre numeric,
  iode numeric,
  manganese numeric,
  phosphore numeric,
  selenium numeric,
  retinol numeric,
  beta_carotene numeric,
  vit_d2 numeric,
  vit_d3 numeric,
  vit_e_totale numeric,
  vit_k1 numeric,
  vit_k2 numeric,
  vit_b3 numeric,
  vit_b5 numeric,
  folates_intrinseques numeric,
  acide_folique numeric,
  vit_b12 numeric,
  vit_a numeric,
  magnesium numeric,
  potassium numeric,
  vit_e numeric,
  -- Ajoutée le 2026-08-31 (rappels de compléments — voir
  -- supabase/sql/complements_rappels_setup.sql). Pertinent seulement pour
  -- categorie = 'Compléments alimentaires'. Forme :
  --   { "enabled": true, "heures": [8,21], "jours": [0..6], "stop_si_pris": true }
  -- heures : entiers 0-23 (cron horaire). jours : 0=lundi..6=dimanche, vide =
  -- tous les jours. stop_si_pris (défaut true) : pas de rappel si déjà noté ce
  -- jour. null / enabled:false = aucun rappel. Délivré par l'Edge Function
  -- complements-reminder. Normalisé côté client par src/lib/complementReminders.js.
  rappel jsonb
);

-- 6. TABLE PROFILES (infos utilisateur, 1 ligne par compte auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id),
  -- Créée par un trigger sur auth.users (voir AuthContext.jsx), non
  -- présent dans ce fichier — à récupérer séparément si besoin.
  prenom text,
  nom text,
  age integer,
  poids_kg numeric,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Ajoutée après coup pour le fil social (recherche d'amies, affichage des
  -- auteures) ; unicité non confirmée côté base.
  pseudo text,
  -- Ajoutées le 2026-08-18 pour le calculateur de besoins caloriques
  -- (BMR/TDEE, voir supabase/sql/calorie_needs_profile_setup.sql). 'H'/'F'.
  sexe text,
  -- Taille corporelle (hauteur) en cm — à ne pas confondre avec
  -- mensurations.taille_cm qui est le tour de taille.
  taille_cm numeric,
  -- 'sedentaire' | 'leger' | 'modere' | 'actif' | 'tres_actif'
  niveau_activite text,
  -- Ajoutée le 2026-09-01 pour la photo de profil. Horodatage du dernier
  -- upload de l'avatar (null = pas de photo). Sert de cache-buster pour
  -- l'affichage immédiat de SA PROPRE photo ; la photo d'une amie est servie
  -- via l'URL publique nue (cache CDN). Voir src/lib/avatar.js.
  avatar_updated_at timestamptz
);

-- Photo de profil : bucket Storage `avatars` (créé le 2026-09-01), PUBLIC en
-- lecture. Un fichier par compte à `<user_id>/avatar.jpg` (upsert). Policies
-- sur storage.objects (exécutées manuellement dans le SQL editor Supabase) :
--   * SELECT : public (bucket public).
--   * INSERT / UPDATE / DELETE : réservés au propriétaire du dossier,
--     condition `(storage.foldername(name))[1] = auth.uid()::text`.
-- Aucune dénormalisation de l'avatar sur les tables du fil social : chaque
-- ligne porte déjà `auteur_id`, l'URL publique est reconstruite côté client.

-- 7. TABLE RECETTES (plats maison, valeurs nutritionnelles pour 100g)
create table if not exists recettes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  nom text not null,
  portions integer not null default 1,
  poids_cru_g numeric,
  poids_cuit_g numeric,
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  sel numeric,
  sucres numeric,
  acides_gras_satures numeric,
  fructose numeric,
  galactose numeric,
  glucose numeric,
  lactose numeric,
  maltose numeric,
  saccharose numeric,
  amidon numeric,
  polyols numeric,
  ag_monoinsatures numeric,
  ag_polyinsatures numeric,
  ag_4_0 numeric,
  ag_6_0 numeric,
  ag_8_0 numeric,
  ag_10_0 numeric,
  ag_12_0 numeric,
  ag_14_0 numeric,
  ag_16_0 numeric,
  ag_18_0 numeric,
  ag_18_1_oleique numeric,
  ag_18_2_linoleique numeric,
  ag_18_3_ala numeric,
  ag_20_4_arachidonique numeric,
  ag_20_5_epa numeric,
  ag_22_6_dha numeric,
  cholesterol numeric,
  vit_c numeric,
  vit_d numeric,
  vit_e_totale numeric,
  vit_k1 numeric,
  vit_b1 numeric,
  vit_b2 numeric,
  vit_b3 numeric,
  vit_b5 numeric,
  vit_b6 numeric,
  folates numeric,
  vit_b12 numeric,
  vit_a numeric,
  calcium numeric,
  fer numeric,
  magnesium numeric,
  potassium numeric,
  zinc numeric,
  sodium numeric,
  chlorure numeric,
  cuivre numeric,
  iode numeric,
  manganese numeric,
  phosphore numeric,
  selenium numeric,
  retinol numeric,
  beta_carotene numeric,
  vit_d2 numeric,
  vit_d3 numeric,
  vit_k2 numeric,
  folates_intrinseques numeric,
  acide_folique numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tare_g numeric,
  categories text[] not null default '{}', -- 'Petit-déjeuner' | 'Collation' | 'Plat' | 'Accompagnement' | 'Boisson' | 'Dessert' (multi)
  saisons text[] not null default '{}', -- multi-sélection de saison(s) (voir SEASONS dans src/lib/seasons.js) : 'Printemps' | 'Été' | 'Automne' | 'Hiver'
  instructions text,
  temps_preparation_min integer,
  temps_cuisson_min integer,
  temps_repos_min integer,
  source_type text, -- 'lien' | 'livre'
  source_valeur text, -- URL si 'lien', titre du livre si 'livre'
  source_page integer, -- n° de page, utilisé seulement si source_type = 'livre'
  -- Ajoutée le 2026-09-01 pour la photo de recette. Horodatage du dernier
  -- upload (null = pas de photo). Le fichier est dans le bucket Storage
  -- `recette-photos` à `<recette_id>/photo.jpg`. Voir src/lib/recipePhoto.js.
  photo_updated_at timestamptz
);

-- Photo de recette : bucket Storage `recette-photos` (créé le 2026-09-01),
-- PUBLIC en lecture. Un fichier par recette à `<recette_id>/photo.jpg`
-- (upsert). Policies sur storage.objects (exécutées manuellement) :
--   * SELECT : public.
--   * INSERT / UPDATE / DELETE : réservés à la propriétaire de la recette,
--     condition `exists (select 1 from recettes r
--       where r.id::text = (storage.foldername(name))[1] and r.user_id = auth.uid())`.
-- Une recette partagée est relue via partages_recettes.recette_id (même astuce
-- que les avatars) ; partages_recettes.photo_updated_at (ci-dessous) est la
-- copie dénormalisée posée au moment du partage.

-- 8. TABLE RECETTE_INGREDIENTS (lignes d'ingrédients d'une recette)
create table if not exists recette_ingredients (
  id uuid default gen_random_uuid() primary key,
  recette_id uuid not null references recettes(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  food_name text not null,
  food_source text,
  food_ref_id text,
  qty_g numeric not null,
  -- Même jeu de nutriments détaillés que recettes/ciqual, scalés au qty_g.
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  sel numeric,
  sucres numeric,
  acides_gras_satures numeric,
  fructose numeric,
  galactose numeric,
  glucose numeric,
  lactose numeric,
  maltose numeric,
  saccharose numeric,
  amidon numeric,
  polyols numeric,
  ag_monoinsatures numeric,
  ag_polyinsatures numeric,
  ag_4_0 numeric,
  ag_6_0 numeric,
  ag_8_0 numeric,
  ag_10_0 numeric,
  ag_12_0 numeric,
  ag_14_0 numeric,
  ag_16_0 numeric,
  ag_18_0 numeric,
  ag_18_1_oleique numeric,
  ag_18_2_linoleique numeric,
  ag_18_3_ala numeric,
  ag_20_4_arachidonique numeric,
  ag_20_5_epa numeric,
  ag_22_6_dha numeric,
  cholesterol numeric,
  vit_c numeric,
  vit_d numeric,
  vit_e_totale numeric,
  vit_k1 numeric,
  vit_b1 numeric,
  vit_b2 numeric,
  vit_b3 numeric,
  vit_b5 numeric,
  vit_b6 numeric,
  folates numeric,
  vit_b12 numeric,
  vit_a numeric,
  calcium numeric,
  fer numeric,
  magnesium numeric,
  potassium numeric,
  zinc numeric,
  sodium numeric,
  chlorure numeric,
  cuivre numeric,
  iode numeric,
  manganese numeric,
  phosphore numeric,
  selenium numeric,
  retinol numeric,
  beta_carotene numeric,
  vit_d2 numeric,
  vit_d3 numeric,
  vit_k2 numeric,
  folates_intrinseques numeric,
  acide_folique numeric,
  created_at timestamptz not null default now(),
  vit_e numeric
);

-- 9. TABLE FAVORIS
create table if not exists favoris (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  food_source text not null,
  food_ref_id text,
  food_name text not null,
  food_data jsonb not null, -- objet complet de l'aliment/recette favori(te)
  created_at timestamptz not null default now(),
  use_count integer not null default 0,
  last_used_at timestamptz
);

-- 10. TABLE LISTES_COURSES
create table if not exists listes_courses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  nom text not null default 'Ma liste',
  created_at timestamptz not null default now()
);

-- 11. TABLE LISTE_COURSES_ITEMS
create table if not exists liste_courses_items (
  id uuid default gen_random_uuid() primary key,
  liste_id uuid not null references listes_courses(id), -- cascade probable, non confirmé
  user_id uuid not null references auth.users(id),
  nom text not null,
  categorie text default 'Autre',
  qty_g numeric,
  food_source text,
  food_ref_id text,
  recette_noms text[] not null default '{}', -- noms des recettes/repas types ayant contribué à l'article groupé
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- 12. TABLE REPAS_PLANIFIES (calendrier de planification des repas)
create table if not exists repas_planifies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  meal text not null, -- 'Petit-déjeuner' | 'Déjeuner' | 'Dîner' | 'Collation' | 'Compléments'
  nom text not null,
  items jsonb not null default '[]', -- tableau d'aliments scalés, mêmes champs que journal
  source_type text, -- 'libre' | 'recette' | 'repas_type'
  source_id uuid,
  mange boolean not null default false,
  mange_at timestamptz,
  recurrence_group_id uuid, -- non-null quand créé via une planification récurrente : partagé par toutes les occurrences de la série (permet un "supprimer toute la série")
  created_at timestamptz not null default now()
);

create index if not exists idx_repas_planifies_recurrence_group
  on repas_planifies (recurrence_group_id) where recurrence_group_id is not null;

-- 13. TABLE MARQUES (marques d'aliments custom, réutilisables via menu déroulant)
-- aliments_custom.marque reste un champ texte libre (pas de FK) : cette table
-- sert uniquement à peupler le menu déroulant du formulaire (BrandCombobox) et
-- à éviter de retaper une marque déjà utilisée. Ajoutée le 2026-08-14.
create table if not exists marques (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  nom text not null,
  created_at timestamptz not null default now(),
  unique (user_id, nom)
);

-- 14. TABLE MENSURATIONS (poids + mensurations corporelles datés, un relevé
-- par jour max par utilisateur — ressaisir le même jour met à jour l'entrée
-- existante via upsert côté client). Tous les champs de mesure sont
-- nullable : aucune obligation de tout remplir à chaque relevé.
create table if not exists mensurations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null default current_date,
  poids_kg numeric,
  poitrine_cm numeric,
  taille_cm numeric,
  hanches_cm numeric,
  cuisse_droite_cm numeric,
  cuisse_gauche_cm numeric,
  bras_droit_cm numeric,
  bras_gauche_cm numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- 15. TABLE AMITIES (relations d'amitié entre utilisatrices : demande +
-- acceptation mutuelle, voir useFriends.js). Champs pseudo/prenom
-- dénormalisés des deux côtés pour éviter une lecture cross-utilisatrice de
-- `profiles` (RLS probablement restrictif sur profiles).
create table if not exists amities (
  id uuid default gen_random_uuid() primary key,
  demandeur_id uuid not null references auth.users(id),
  destinataire_id uuid not null references auth.users(id),
  demandeur_pseudo text,
  demandeur_prenom text,
  destinataire_pseudo text,
  destinataire_prenom text,
  statut text not null default 'en_attente', -- 'en_attente' | 'acceptee' (CHECK non confirmé)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 16. TABLE PARTAGES_RECETTES (fil social : partage d'une recette, snapshot
-- au moment du partage — reste affiché même si la recette source est
-- ensuite modifiée/supprimée, voir shareRecette dans useFeed.js)
create table if not exists partages_recettes (
  id uuid default gen_random_uuid() primary key,
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  recette_id uuid references recettes(id), -- nullable : la recette source peut disparaître sans supprimer le partage
  -- Ajoutée le 2026-09-01. Copie dénormalisée de recettes.photo_updated_at au
  -- moment du partage : dit s'il faut tenter d'afficher une photo (relue via
  -- recette_id). Peut devenir périmée si l'auteure change/retire sa photo.
  photo_updated_at timestamptz,
  nom text not null,
  portions integer not null default 1,
  poids_cru_g numeric,
  poids_cuit_g numeric,
  tare_g numeric,
  categories text[] not null default '{}',
  saisons text[] not null default '{}', -- snapshot de recettes.saisons au moment du partage
  instructions text,
  temps_preparation_min integer,
  temps_cuisson_min integer,
  temps_repos_min integer,
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  sel numeric,
  sucres numeric,
  acides_gras_satures numeric,
  message text,
  created_at timestamptz not null default now()
);

-- 17. TABLE PARTAGE_RECETTE_INGREDIENTS (ingrédients snapshotés d'un
-- partage de recette)
create table if not exists partage_recette_ingredients (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_recettes(id), -- cascade probable, non confirmé
  food_name text not null,
  food_source text,
  food_ref_id text,
  qty_g numeric not null,
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  ordre integer not null default 0
);

-- 18. TABLE PARTAGES_JOURNAL (fil social : partage d'une journée entière ou
-- d'un seul repas, voir shareJournal dans useFeed.js)
create table if not exists partages_journal (
  id uuid default gen_random_uuid() primary key,
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  date date not null,
  meal text, -- null = journée entière ; sinon 'Petit-déjeuner' | 'Déjeuner' | 'Dîner' | 'Collation'
  include_detail boolean not null default false, -- si vrai, détail aliment par aliment snapshotté dans partage_journal_aliments
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  message text,
  created_at timestamptz not null default now()
);

-- 19. TABLE PARTAGE_JOURNAL_ALIMENTS (aliments snapshotés d'un partage de
-- journée/repas, présents seulement si include_detail = true)
create table if not exists partage_journal_aliments (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_journal(id), -- cascade probable, non confirmé
  meal text not null,
  food_name text not null,
  qty_g numeric not null,
  energie_kcal numeric,
  proteines numeric,
  glucides numeric,
  lipides numeric,
  fibres numeric,
  ordre integer not null default 0
);

-- 20. TABLE REACTIONS_PARTAGES (réactions emoji sur un partage de recette)
create table if not exists reactions_partages (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_recettes(id), -- cascade probable, non confirmé
  user_id uuid not null references auth.users(id),
  -- CHECK confirmé côté base (voir commentaire dans src/lib/reactions.js),
  -- doit rester synchronisé manuellement avec REACTION_EMOJIS.
  emoji text not null,
  created_at timestamptz not null default now(),
  user_pseudo text,
  user_prenom text
);

-- 21. TABLE REACTIONS_JOURNAL (réactions emoji sur un partage de
-- journée/repas — même structure que reactions_partages)
create table if not exists reactions_journal (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_journal(id), -- cascade probable, non confirmé
  user_id uuid not null references auth.users(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  user_pseudo text,
  user_prenom text
);

-- 22. TABLE COMMENTAIRES_PARTAGES (commentaires + réponses sur un partage
-- de recette)
create table if not exists commentaires_partages (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_recettes(id), -- cascade probable, non confirmé
  parent_id uuid references commentaires_partages(id), -- réponse à un commentaire ; suppression en cascade confirmée côté base
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  contenu text not null,
  created_at timestamptz not null default now()
);

-- 23. TABLE COMMENTAIRES_JOURNAL (commentaires + réponses sur un partage de
-- journée/repas — même structure que commentaires_partages)
create table if not exists commentaires_journal (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_journal(id), -- cascade probable, non confirmé
  parent_id uuid references commentaires_journal(id), -- suppression en cascade confirmée côté base
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  contenu text not null,
  created_at timestamptz not null default now()
);

-- 24. TABLE PUSH_SUBSCRIPTIONS (abonnements push par appareil, voir
-- usePushSubscription.js) — un utilisateur peut avoir plusieurs lignes (un
-- téléphone + un ordinateur par ex.), une par endpoint PushManager.
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- 25. TABLE SUGGESTIONS_MANQUES (historique des aliments suggérés pour
-- combler un manque nutritionnel, voir supabase/sql/suggestions_manques_setup.sql
-- pour le SQL complet — écrit le 2026-08-20. Alimentée depuis
-- TodayGapsSection.jsx (voir src/lib/suggestionsLog.js), lue/agrégée par
-- useGroceriesSuggestions.js pour faire remonter les aliments les plus
-- souvent suggérés dans la section "Suggestions" de la liste de courses.
create table if not exists suggestions_manques (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  food_source text not null default 'ciqual', -- 'ciqual' | 'custom' | 'off' (rare)
  food_ref_id text,
  food_name text not null,
  nutrient_key text not null, -- ex. 'vit_d', 'fer' — voir VITAMIN_FIELDS/MINERAL_FIELDS/MACRO_FIELDS dans src/lib/nutrients.js
  created_at timestamptz not null default now()
);

create index if not exists idx_suggestions_manques_user_date
  on suggestions_manques (user_id, created_at desc);

-- 26. TABLE JOURS_EXCLUS (jours marqués "exclus des stats globales", voir
-- supabase/sql/jours_exclus_setup.sql pour le SQL complet — écrit le
-- 2026-08-26. Une ligne = un jour exclu ; absence de ligne = jour compté
-- normalement. N'affecte que les agrégats de HistoryPage.jsx (moyennes,
-- série, jours objectif) — le journal du jour reste inchangé, consultable et
-- modifiable normalement (voir src/hooks/useExcludedDays.js).
create table if not exists jours_exclus (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_jours_exclus_user_date on jours_exclus (user_id, date);

-- 27. TABLE REGLES (jours de règles, saisis à la main — l'app tierce de suivi
-- de cycle utilisée aujourd'hui n'exporte rien. Voir supabase/sql/regles_setup.sql
-- pour le SQL complet — écrit le 2026-08-29, chantier « manger en fonction du
-- cycle menstruel », Palier 1. UNE LIGNE = UN JOUR de règles (la durée varie
-- d'un cycle à l'autre). Le calcul de phase, côté client (src/lib/cycle.js,
-- src/hooks/useCycle.js), regroupe les jours contigus en blocs ; le 1er jour de
-- chaque bloc sert de repère de cycle. Toggle côté client = insert/delete.
-- `intensite` (nullable) ajoutée le 2026-08-29 (Palier 7) : 'leger' | 'moyen'
-- | 'abondant', saisie par bloc côté client — voir supabase/sql/regles_intensite_setup.sql.
-- `symptomes` (nullable, text[]) ajoutée le 2026-08-30 (Palier 8) : clés
-- prédéfinies (PERIOD_SYMPTOMS dans src/lib/cycle.js) et/ou texte libre,
-- saisie par jour depuis la page du jour — voir supabase/sql/regles_symptomes_setup.sql.
create table if not exists regles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  intensite text,
  symptomes text[],
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_regles_user_date on regles (user_id, date);

-- 28. TABLE ACTIVITES_SPORT (séances de sport, saisies à la main — chantier
-- « Suivi de l'activité sportive », Palier 1, voir supabase/sql/sport_setup.sql
-- et docs/suivi-sport.md — écrit le 2026-08-30, pas encore confirmé appliqué en
-- base). UNE LIGNE = UNE SÉANCE. `source` = 'manuel' au Palier 1 ; 'strava'
-- plus tard (Palier 5) avec `source_id` = id de l'activité côté fournisseur
-- pour la déduplication (index unique partiel user_id+source+source_id).
-- `modifie_manuellement` : posé à true si une séance importée est retouchée,
-- pour qu'une resynchro ne l'écrase pas. App à deux comptes → RLS « own »
-- stricte (select/insert/update/delete), comme mensurations.
create table if not exists activites_sport (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null,
  heure_debut time,
  type text not null, -- clé de SPORT_TYPES (src/lib/sport.js) : 'course' | 'marche' | 'tapis' | 'velo' | 'natation' | 'rando' | 'muscu' | 'hiit' | 'pilates' | 'yoga' | 'danse' | 'sport_co' | 'autre'
  duree_min numeric not null,
  distance_km numeric,
  intensite text, -- 'faible' | 'moderee' | 'elevee' (nullable)
  energie_kcal numeric, -- estimée (MET) ou fournie par la source, éditable
  fc_moyenne integer,
  fc_max integer,
  source text not null default 'manuel', -- 'manuel' | 'strava'
  source_id text, -- id externe (nullable), pour la déduplication des imports
  modifie_manuellement boolean not null default false,
  compte_dans_pas boolean not null default false, -- Palier 10 : séance déjà incluse dans le total de pas du jour → pas recomptée en énergie (anti-doublon). Voir supabase/sql/pas_jour_setup.sql
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_activites_sport_source
  on activites_sport (user_id, source, source_id) where source_id is not null;
create index if not exists idx_activites_sport_user_date
  on activites_sport (user_id, date desc);

-- 29-31. FIL SOCIAL DU SPORT (Palier 8 du chantier suivi sport) — trio calqué
-- sur partages_journal / reactions_journal / commentaires_journal, RLS
-- « auteure ou amie acceptée » (is_friend_with). Voir
-- supabase/sql/partages_sport_setup.sql. Un partage = SOIT une séance
-- (kind='seance'), SOIT un résumé de semaine (kind='semaine').
create table if not exists partages_sport (
  id uuid default gen_random_uuid() primary key,
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  kind text not null default 'seance', -- 'seance' | 'semaine'
  date date,                -- kind='seance'
  type text,
  duree_min numeric,
  distance_km numeric,
  intensite text,
  energie_kcal numeric,
  semaine_debut date,       -- kind='semaine'
  total_min numeric,
  nb_seances integer,
  total_kcal numeric,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_partages_sport_auteur on partages_sport (auteur_id);
create index if not exists idx_partages_sport_created on partages_sport (created_at desc);

create table if not exists reactions_sport (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_sport(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  user_pseudo text,
  user_prenom text
);
create index if not exists idx_reactions_sport_partage on reactions_sport (partage_id);

create table if not exists commentaires_sport (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_sport(id) on delete cascade,
  parent_id uuid references commentaires_sport(id) on delete cascade,
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  contenu text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_commentaires_sport_partage on commentaires_sport (partage_id);

-- 32. TABLE PAS_JOUR (total de pas d'une journée — chantier « Suivi de
-- l'activité sportive », Palier 10, voir supabase/sql/pas_jour_setup.sql et
-- docs/suivi-sport.md — écrit le 2026-08-30, appliqué + testé le 2026-08-30).
-- UNE LIGNE = UN JOUR, saisie manuelle. App à deux comptes → RLS « own »
-- stricte, comme activites_sport.
create table if not exists pas_jour (
  user_id uuid not null references auth.users(id),
  date date not null,
  nb_pas integer not null,
  source text not null default 'manuel', -- 'manuel' | (import plus tard)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create index if not exists idx_pas_jour_user_date on pas_jour (user_id, date desc);

-- 33. TABLE COLLATION_JOURS (surcharge « par jour » de l'activation de la
-- Collation — écrit le 2026-08-31, voir supabase/sql/collation_jours_setup.sql).
-- ligne présente = surcharge explicite pour ce jour (`active` true/false) ;
-- ligne absente = on suit le défaut global settings.meal_enabled.Collation.
-- UNE LIGNE = UN JOUR. RLS « own » stricte comme pas_jour.
create table if not exists collation_jours (
  user_id uuid not null references auth.users(id),
  date date not null,
  active boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create index if not exists idx_collation_jours_user_date on collation_jours (user_id, date desc);

-- 34. TABLE BATCH_COOKING_ITEMS (page « Ma fournée » — roadmap §M9, Palier 3
-- du chantier planificateur. Check-list unique des recettes à cuisiner lors
-- d'une session de meal prep, indépendante du planificateur. Écrit le
-- 2026-09-01, voir supabase/sql/batch_cooking_setup.sql).
-- Rattachée à UNE semaine (`semaine` = lundi 'YYYY-MM-DD', convention calendrier) :
-- chaque semaine de la vue Menus a sa propre fournée. UNE LIGNE = UNE RECETTE
-- OU UN REPAS TYPE (une seule des deux réfs non nulle). RLS « own »
-- select/insert/update/delete ; update sert à cocher `fait` et éditer
-- `portions`. Colonne `semaine` + unique par semaine ajoutées le 2026-09-01 ;
-- `repas_type_id` + son unique ajoutés le 2026-09-01 (repas types dans la fournée).
create table if not exists batch_cooking_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  semaine date not null,      -- lundi de la semaine
  recette_id uuid references recettes(id) on delete set null,
  repas_type_id uuid references repas_types(id) on delete set null,
  nom text not null,          -- snapshot du nom (garde la ligne lisible si la source est supprimée)
  portions numeric,           -- quantité à préparer, optionnelle
  fait boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, semaine, recette_id),
  unique (user_id, semaine, repas_type_id)
);
create index if not exists idx_batch_cooking_items_user_semaine on batch_cooking_items (user_id, semaine);

-- 35. TABLE BATCH_COOKING_STEPS (« Plan de cuisine » de Ma fournée — roadmap
-- §M9. Toutes les étapes d'instructions des recettes de la fournée, mises bout
-- à bout puis réorganisées à la main par l'utilisatrice + cochées au fur et à
-- mesure. Écrit le 2026-09-01, voir supabase/sql/batch_cooking_steps_setup.sql).
-- Rattaché à UNE semaine (`semaine` = lundi, comme batch_cooking_items). UNE
-- LIGNE = UNE ÉTAPE (texte = snapshot, reconstruit via un bouton « Régénérer »).
-- RLS « own » s/i/u/d ; update sert à réordonner (`ordre`) et cocher (`fait`).
create table if not exists batch_cooking_steps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  semaine date not null,      -- lundi de la semaine
  recette_id uuid references recettes(id) on delete set null,
  recette_nom text not null,
  texte text not null,
  ordre integer not null default 0,
  fait boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_batch_cooking_steps_user_semaine on batch_cooking_steps (user_id, semaine, ordre);

-- 36. TABLE PLANS_REPAS (plans de repas enregistrés — historique du
-- planificateur, Palier 3. Écrit le 2026-09-01, voir
-- supabase/sql/plans_repas_setup.sql). UNE LIGNE = UN PLAN nommé : `config`
-- (objet de config du planificateur) + `plan` (sortie de buildMealPlan).
-- RLS « own » s/i/u/d ; update = renommer / réenregistrer par-dessus.
create table if not exists plans_repas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  nom text not null,
  config jsonb not null default '{}',
  plan jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plans_repas_user on plans_repas (user_id, updated_at desc);

-- =============================================
-- RLS
-- =============================================
-- RLS activé sur journal / settings / aliments_custom / repas_types / marques
-- le 2026-08-30. Ces tables portent des données personnelles (alimentation
-- quotidienne, objectifs, poids-objectif, compléments) et étaient lisibles par
-- n'importe qui via la Data API avec la clé anon publique tant que le RLS était
-- désactivé (même faille que mensurations, corrigée le 2026-08-17). Policies
-- "own" (select/insert/update/delete pour auth.uid() = user_id), exécutées
-- manuellement dans le SQL editor Supabase.
alter table journal enable row level security;
create policy "journal_own" on journal for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table settings enable row level security;
create policy "settings_own" on settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table aliments_custom enable row level security;
create policy "aliments_custom_own" on aliments_custom for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table repas_types enable row level security;
create policy "repas_types_own" on repas_types for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table marques enable row level security;
create policy "marques_own" on marques for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS activé sur mensurations le 2026-08-17 (données sensibles - poids et
-- mesures corporelles - accessibles sans authentification via la Data API
-- tant que le RLS était désactivé). Policies exécutées manuellement dans le
-- SQL editor Supabase (pas d'accès direct à la base depuis cette session).
alter table mensurations enable row level security;

-- `ciqual` : RLS ACTIVÉ, seule policy = lecture publique. Base de référence
-- ANSES partagée, pas de user_id — l'écriture des "portions courantes" depuis
-- l'app (fiche Explorer + ajout au journal) passe par la fonction security
-- definer `set_ciqual_portions` (voir supabase/sql/ciqual_portions_setup.sql),
-- pas par un UPDATE direct : aucune policy UPDATE, donc un
-- `update ciqual ...` via la Data API touche 0 ligne sans lever d'erreur.
alter table ciqual enable row level security;

create policy "Anyone can read ciqual" on ciqual
  for select using (true);

create policy "mensurations_select_own" on mensurations
  for select using (auth.uid() = user_id);

create policy "mensurations_insert_own" on mensurations
  for insert with check (auth.uid() = user_id);

create policy "mensurations_update_own" on mensurations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "mensurations_delete_own" on mensurations
  for delete using (auth.uid() = user_id);

-- Statut RLS non vérifié pour les 7 tables ajoutées à cette reconstruction
-- (profiles, recettes, recette_ingredients, favoris, listes_courses,
-- liste_courses_items, repas_planifies) — toutes ont un user_id filtré
-- côté client, mais ça ne dit rien sur RLS côté base. À vérifier avant de
-- s'appuyer dessus pour la sécurité.

-- RLS confirmé ACTIF sur les 9 tables du fil social (amities,
-- partages_recettes, partage_recette_ingredients, partages_journal,
-- partage_journal_aliments, reactions_partages, reactions_journal,
-- commentaires_partages, commentaires_journal) : le code client ne filtre
-- jamais par user_id/auteur_id/demandeur_id sur ces tables (voir
-- commentaires dans useFeed.js et usePartageDetail.js — "déjà filtré côté
-- base par RLS"), la visibilité (auteure ou amie acceptée) est donc
-- entièrement portée par des policies RLS non reproduites ici.

-- RLS activé sur push_subscriptions dès sa création (2026-08-18), policies
-- select/insert/delete "own" (voir supabase/sql/push_notifications_setup.sql)
-- — pas de policy update, le client supprime + réinsère plutôt que de
-- modifier une ligne existante.
alter table push_subscriptions enable row level security;

-- RLS activé sur suggestions_manques dès sa création (2026-08-20), policies
-- select/insert "own" (voir supabase/sql/suggestions_manques_setup.sql) — pas
-- de policy update/delete, historique en écriture seule côté client.
alter table suggestions_manques enable row level security;

-- RLS activé sur jours_exclus dès sa création (2026-08-26), policies
-- select/insert/delete "own" (voir supabase/sql/jours_exclus_setup.sql) —
-- pas de policy update, le toggle exclu/inclus est un insert/delete côté
-- client, jamais une modification de ligne existante.
alter table jours_exclus enable row level security;

-- RLS activé sur regles dès sa création (2026-08-29), policies
-- select/insert/delete "own" (voir supabase/sql/regles_setup.sql). Policy
-- update "own" ajoutée le 2026-08-29 (Palier 7) pour l'intensité du flux
-- (voir supabase/sql/regles_intensite_setup.sql) — le reste (présence d'un
-- jour) se fait toujours par insert/delete. Colonne `symptomes` (Palier 8)
-- réutilise cette même policy update, aucune policy supplémentaire.
alter table regles enable row level security;

-- RLS activé sur activites_sport dès sa création (2026-08-30), policies
-- select/insert/update/delete "own" (auth.uid() = user_id) — voir
-- supabase/sql/sport_setup.sql. La policy update sert à l'édition d'une séance
-- (contrairement à regles où un jour est simplement présent ou absent).
alter table activites_sport enable row level security;

-- RLS confirmé ACTIF sur le trio du fil social sport (partages_sport,
-- reactions_sport, commentaires_sport), policies calquées à l'identique sur
-- partages_journal & co. : select = auteure OR is_friend_with(auteur) ;
-- insert/delete réactions & commentaires gardés par la visibilité du partage
-- parent + propriété. Voir supabase/sql/partages_sport_setup.sql.
alter table partages_sport enable row level security;
alter table reactions_sport enable row level security;
alter table commentaires_sport enable row level security;

-- RLS activé sur pas_jour dès sa création (2026-08-30, Palier 10), policies
-- select/insert/update/delete "own" (auth.uid() = user_id) — voir
-- supabase/sql/pas_jour_setup.sql. La policy update sert au ré-enregistrement
-- du total d'un jour (upsert on conflict user_id,date).
alter table pas_jour enable row level security;

-- RLS activé sur collation_jours dès sa création (2026-08-31), policies
-- select/insert/update/delete "own" (auth.uid() = user_id) — voir
-- supabase/sql/collation_jours_setup.sql. La policy update sert au
-- rebasculement de l'interrupteur (upsert on conflict user_id,date).
alter table collation_jours enable row level security;

-- RLS activé sur batch_cooking_items dès sa création (2026-09-01), policies
-- select/insert/update/delete "own" (auth.uid() = user_id) — voir
-- supabase/sql/batch_cooking_setup.sql. La policy update sert à cocher `fait`
-- et à éditer `portions` sur la ligne existante.
alter table batch_cooking_items enable row level security;

-- RLS activé sur batch_cooking_steps dès sa création (2026-09-01), policies
-- select/insert/update/delete "own" (auth.uid() = user_id) — voir
-- supabase/sql/batch_cooking_steps_setup.sql. update = réordonner + cocher.
alter table batch_cooking_steps enable row level security;

-- RLS activé sur plans_repas dès sa création (2026-09-01), policies
-- select/insert/update/delete "own" (auth.uid() = user_id) — voir
-- supabase/sql/plans_repas_setup.sql.
alter table plans_repas enable row level security;

-- =============================================
-- DONNÉES CIQUAL (extrait - voir README pour import complet)
-- =============================================
insert into ciqual (alim_code, alim_nom, categorie, energie_kcal, proteines, glucides, lipides, fibres, sucres, sel, calcium, fer, magnesium, potassium, zinc, vit_c, vit_d, vit_b1, vit_b2, vit_b6, vit_b12, vit_a, vit_e, folates, portions) values
('9510','Oeuf de poule entier, cru','Oeufs et dérivés',143,12.6,0.7,9.9,0,0.7,0.37,56,1.8,12,126,1.3,0,2.0,0.09,0.38,0.17,1.29,160,2.0,65,'[{"label":"1 gros oeuf","g":60},{"label":"1 petit oeuf","g":50}]'),
('9520','Blanc d''oeuf de poule, cru','Oeufs et dérivés',52,10.9,0.7,0.2,0,0.7,0.22,7,0.1,9,147,0.03,0,0,0.02,0.32,0.01,0.09,0,0,9,'[{"label":"1 blanc","g":30}]'),
('9530','Jaune d''oeuf de poule, cru','Oeufs et dérivés',322,15.9,0.3,28.1,0,0.3,0.08,129,4.6,14,104,3.5,0,4.9,0.2,0.46,0.35,3.11,386,4.6,145,'[{"label":"1 jaune","g":20}]'),
('19000','Lait de vache entier, cru','Lait et produits laitiers',64,3.2,4.6,3.6,0,4.6,0.1,119,0.05,11,150,0.4,1.0,0.06,0.04,0.18,0.05,0.36,46,0.09,5,'[{"label":"1 verre","g":200},{"label":"1 tasse","g":250}]'),
('19050','Lait de vache demi-écrémé','Lait et produits laitiers',46,3.2,4.7,1.6,0,4.7,0.1,120,0.04,11,152,0.4,1.0,0.04,0.04,0.18,0.05,0.4,17,0.03,5,'[{"label":"1 verre","g":200},{"label":"1 tasse","g":250}]'),
('19400','Yaourt nature au lait entier','Lait et produits laitiers',61,3.5,4.7,3.5,0,4.7,0.1,121,0.05,12,180,0.5,0.5,0.03,0.03,0.14,0.04,0.3,30,0.1,1,'[{"label":"1 pot","g":125}]'),
('19410','Yaourt nature au lait écrémé','Lait et produits laitiers',42,4.5,6.1,0.2,0,6.1,0.1,143,0.06,16,225,0.6,0.5,0.03,0.16,0.05,0.04,0.32,2,0.07,1,'[{"label":"1 pot","g":125}]'),
('19600','Fromage blanc nature 0% MG','Lait et produits laitiers',45,7.8,4.1,0.2,0,4.1,0.08,95,0.07,10,130,0.4,0,0,0.02,0.12,0.03,0.28,2,0.07,1,'[{"label":"1 pot","g":100}]'),
('19620','Fromage blanc nature 20% MG','Lait et produits laitiers',79,7.5,4.1,3.4,0,4.1,0.1,93,0.07,10,130,0.4,0,0.03,0.02,0.15,0.03,0.28,30,0.1,1,'[{"label":"1 pot","g":100}]'),
('19630','Petite Suisse nature','Lait et produits laitiers',110,7.4,3.4,7.0,0,3.4,0.07,86,0.08,9,120,0.4,0,0.03,0.02,0.14,0.03,0.25,72,0.3,2,'[{"label":"1 petite suisse","g":60}]'),
('20010','Beurre doux','Matières grasses',744,0.5,0.7,82.5,0,0.7,0.05,14,0.2,2,24,0.1,0,1.5,0.01,0.02,0.01,0,680,1.6,2,'[{"label":"1 noisette","g":5},{"label":"1 cuillère à soupe","g":10}]'),
('20100','Huile d''olive vierge extra','Matières grasses',900,0,0,100,0,0,0,1,0.1,0,1,0,0,0,0,0,0,0,0,14.4,0,'[{"label":"1 cuillère à soupe","g":10},{"label":"1 cuillère à café","g":4}]'),
('20200','Huile de colza','Matières grasses',900,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,25.5,0,'[{"label":"1 cuillère à soupe","g":10}]'),
('21010','Emmental','Fromages',380,28.6,0.4,29.7,0,0.4,0.56,1050,0.3,33,88,4.2,0,0.3,0.03,0.39,0.11,1.7,290,1.0,5,'[{"label":"1 tranche","g":30},{"label":"1 portion","g":40}]'),
('21060','Camembert de Normandie','Fromages',264,17.8,0.1,21.5,0,0.1,1.1,355,0.3,18,88,2.1,0,0.5,0.04,0.37,0.26,1.7,261,0.5,60,'[{"label":"1 portion (1/8)","g":30}]'),
('21070','Brie','Fromages',335,18.0,0.5,28.4,0,0.5,0.73,184,0.4,20,152,2.0,0,0.5,0.05,0.45,0.23,1.65,306,0.4,65,'[{"label":"1 portion","g":30}]'),
('21110','Chèvre frais','Fromages',230,13.5,1.0,19.0,0,1.0,0.6,130,1.2,13,110,1.0,0,0.3,0.05,0.3,0.18,0.6,200,0.4,25,'[{"label":"1 portion","g":40}]'),
('21120','Mozzarella','Fromages',253,18.0,2.0,19.0,0,2.0,0.45,475,0.4,20,72,2.5,0,0.3,0.03,0.3,0.05,0.8,180,0.4,7,'[{"label":"1 boule","g":125},{"label":"1 portion","g":50}]'),
('21130','Gruyère','Fromages',413,29.8,0.4,33.3,0,0.4,0.64,1011,0.3,36,96,4.1,0,0.3,0.06,0.5,0.11,1.6,275,0.7,2,'[{"label":"1 tranche","g":30}]'),
('21200','Parmesan râpé','Fromages',431,38.5,0,29.7,0,0,1.6,1182,1.0,44,107,3.0,0,0.5,0.04,0.38,0.11,1.88,207,0.6,7,'[{"label":"1 cuillère à soupe","g":10}]'),
('26010','Poulet, filet, cru','Viandes et charcuteries',107,23.2,0,1.5,0,0,0.06,11,0.45,28,325,0.8,0,0.1,0.06,0.15,0.8,0.25,10,0.3,9,'[{"label":"1 filet","g":150},{"label":"1 petite portion","g":100}]'),
('26020','Poulet, cuisse, cuit rôti, sans peau','Viandes et charcuteries',195,26.5,0,9.7,0,0,0.18,14,1.0,25,280,2.4,0,0.3,0.07,0.25,0.42,0.38,35,0.5,14,'[{"label":"1 cuisse","g":150}]'),
('26030','Dinde, escalope, crue','Viandes et charcuteries',104,22.9,0,1.3,0,0,0.07,7,0.9,26,334,1.5,0,0.1,0.05,0.11,0.74,0.33,0,0.2,8,'[{"label":"1 escalope","g":120}]'),
('26200','Boeuf, steak haché 5% MG, cuit','Viandes et charcuteries',155,26.1,0,5.7,0,0,0.09,10,2.3,24,330,4.8,0,0.1,0.06,0.22,0.36,2.04,0,0.4,10,'[{"label":"1 steak","g":100}]'),
('26210','Boeuf, côte, grillée','Viandes et charcuteries',274,28.0,0,17.8,0,0,0.14,8,2.5,23,304,5.1,0,0.1,0.08,0.25,0.33,2.3,0,0.3,7,'[{"label":"1 portion","g":150}]'),
('26300','Veau, escalope, poêlée','Viandes et charcuteries',175,28.1,0,6.6,0,0,0.12,14,1.5,25,320,4.2,0,0.1,0.09,0.24,0.38,1.2,0,0.3,12,'[{"label":"1 escalope","g":120}]'),
('26400','Agneau, côtelette, grillée','Viandes et charcuteries',253,26.7,0,16.0,0,0,0.23,14,2.0,24,298,3.6,0,0.1,0.13,0.27,0.22,2.3,0,0.3,19,'[{"label":"2 côtelettes","g":150}]'),
('26600','Jambon blanc supérieur','Viandes et charcuteries',107,18.5,1.0,2.6,0,1.0,1.8,15,0.9,19,267,1.8,0.1,0.1,0.78,0.22,0.5,0.34,0,0.2,6,'[{"label":"1 tranche","g":40}]'),
('26620','Jambon de Bayonne','Viandes et charcuteries',196,25.0,0,10.5,0,0,4.5,12,1.5,25,345,2.5,0,0.1,0.7,0.22,0.45,0.45,0,0.3,5,'[{"label":"1 tranche","g":35}]'),
('26630','Lardons fumés, cuits','Viandes et charcuteries',353,19.7,0,30.7,0,0,3.5,8,0.8,18,230,2.5,0,0.1,0.4,0.16,0.3,0.4,0,0.3,5,'[{"label":"1 portion","g":50}]'),
('26700','Saucisse de Francfort','Viandes et charcuteries',275,11.2,3.2,23.7,0,0.8,1.94,28,1.5,14,165,2.0,0.6,0.2,0.14,0.12,0.15,0.6,0,0.3,4,'[{"label":"1 saucisse","g":50}]'),
('26800','Chorizo','Viandes et charcuteries',430,23.0,1.0,37.0,0,0.5,3.5,16,3.0,25,310,4.0,0,0.1,0.36,0.22,0.32,1.5,0,0.3,5,'[{"label":"1 tranche","g":15}]'),
('26810','Saucisson sec','Viandes et charcuteries',435,24.4,0.8,37.4,0,0.8,4.1,18,2.5,22,385,3.5,0,0.1,0.34,0.22,0.27,1.4,0,0.3,3,'[{"label":"2 rondelles","g":20}]'),
('27010','Saumon atlantique, filet, cru','Poissons et produits de la mer',182,19.9,0,11.5,0,0,0.1,15,0.5,29,363,0.6,2.5,10.9,0.22,0.14,0.87,4.15,27,3.5,3,'[{"label":"1 pavé","g":150},{"label":"1 filet","g":200}]'),
('27011','Saumon fumé','Poissons et produits de la mer',156,22.8,0,7.4,0,0,2.5,20,0.8,28,295,0.5,0,11.0,0.16,0.13,0.5,3.2,0,1.5,3,'[{"label":"1 tranche","g":40}]'),
('27020','Thon rouge, cru','Poissons et produits de la mer',136,23.3,0,4.9,0,0,0.05,9,1.5,35,323,0.5,0,4.6,0.25,0.18,0.46,9.4,0,1.5,2,'[{"label":"1 steak","g":150}]'),
('27030','Thon en conserve au naturel','Poissons et produits de la mer',116,25.6,0,1.5,0,0,0.32,28,1.5,30,290,0.9,0,2.5,0.05,0.1,0.37,2.5,0,1.0,4,'[{"label":"1 petite boîte","g":80}]'),
('27040','Cabillaud, filet, cuit vapeur','Poissons et produits de la mer',97,20.7,0,1.3,0,0,0.12,16,0.4,29,407,0.5,0,0.4,0.08,0.07,0.4,0.9,10,0.8,2,'[{"label":"1 pavé","g":150}]'),
('27050','Truite arc-en-ciel, cuite','Poissons et produits de la mer',168,22.9,0,8.6,0,0,0.15,80,0.6,27,370,1.0,0.5,9.5,0.19,0.12,0.44,3.8,20,2.5,2,'[{"label":"1 filet","g":140}]'),
('27060','Sardine en conserve à l''huile','Poissons et produits de la mer',208,23.7,0,13.3,0,0,0.65,382,2.9,37,397,1.5,0,4.8,0.1,0.25,0.32,8.0,54,2.0,4,'[{"label":"1/2 boîte","g":55}]'),
('27070','Crevettes cuites décortiquées','Poissons et produits de la mer',85,18.6,0,1.1,0,0,1.0,70,0.6,32,220,1.0,0,0.3,0.05,0.05,0.15,0.8,0,0.8,1,'[{"label":"1 portion","g":100}]'),
('27080','Moules cuites','Poissons et produits de la mer',86,12.9,3.4,2.1,0,0,0.72,56,3.6,37,320,2.0,0,0.5,0.18,0.25,0.11,12.0,0,1.0,5,'[{"label":"1 portion","g":200}]'),
('27090','Sole, filet, poêlé','Poissons et produits de la mer',124,21.9,0,3.7,0,0,0.28,67,0.4,30,290,0.8,0,0.8,0.08,0.08,0.3,1.5,10,0.7,1,'[{"label":"1 filet","g":120}]'),
('23000','Riz blanc, cuit à l''eau','Céréales et dérivés',130,2.7,28.7,0.3,0.4,0,0,10,0.2,12,35,0.5,0,0,0.01,0.01,0.1,0,0,0.1,0,'[{"label":"1 portion","g":180},{"label":"1 petite portion","g":130}]'),
('23010','Riz basmati, cuit','Céréales et dérivés',135,2.8,29.6,0.3,0.3,0,0,5,0.3,11,33,0.5,0,0,0.01,0.01,0.1,0,0,0.1,0,'[{"label":"1 portion","g":180}]'),
('23020','Riz complet, cuit','Céréales et dérivés',145,2.9,30.0,1.1,1.8,0.3,0,10,0.7,52,86,1.2,0,0,0.09,0.04,0.27,0,0,0.6,0,'[{"label":"1 portion","g":180}]'),
('23100','Pâtes, semoule, cuites à l''eau','Céréales et dérivés',157,5.4,30.6,0.9,2.0,0.4,0,9,0.7,23,45,0.8,0,0,0.02,0.02,0.1,0,0,0.3,0,'[{"label":"1 portion","g":200},{"label":"1 petite portion","g":150}]'),
('23110','Pâtes complètes, cuites','Céréales et dérivés',148,5.5,27.2,1.1,3.3,0.5,0,21,1.3,48,120,1.4,0,0,0.15,0.06,0.2,0,0,0.9,0,'[{"label":"1 portion","g":200}]'),
('23200','Pain de mie complet','Céréales et dérivés',242,8.2,41.5,3.5,5.0,4.2,0.92,140,2.1,60,220,1.4,0,0,0.26,0.1,0.22,0,0,0.8,0,'[{"label":"1 tranche","g":35}]'),
('23210','Baguette tradition française','Céréales et dérivés',274,9.1,55.6,1.2,2.1,1.8,1.1,19,1.2,28,130,0.8,0,0,0.09,0.04,0.1,0,0,0.4,0,'[{"label":"1 tranche","g":30},{"label":"1/4 baguette","g":75}]'),
('23220','Pain de seigle','Céréales et dérivés',241,8.5,45.0,1.7,6.2,2.1,1.1,73,2.9,50,245,2.0,0,0,0.25,0.18,0.25,0,0,0.6,0,'[{"label":"1 tranche","g":35}]'),
('23230','Pain complet','Céréales et dérivés',245,9.0,42.5,2.9,7.4,2.5,1.0,90,2.5,70,250,2.2,0,0,0.35,0.15,0.3,0,0,0.8,0,'[{"label":"1 tranche","g":35}]'),
('23300','Flocons d''avoine','Céréales et dérivés',368,13.2,58.7,7.1,9.7,0.7,0.02,54,3.9,139,362,3.3,0,0,0.76,0.14,0.96,0,0,1.2,0,'[{"label":"1 portion (40g)","g":40},{"label":"1 grande portion","g":60}]'),
('23310','Müesli aux fruits secs','Céréales et dérivés',356,9.8,58.1,9.8,6.8,24.2,0.15,58,4.0,80,395,2.5,5,1.0,0.2,0.1,0.25,0,10,2.0,0,'[{"label":"1 bol","g":60}]'),
('23400','Quinoa, cuit','Céréales et dérivés',120,4.4,21.3,1.9,2.8,0.9,0.01,17,1.5,64,172,1.1,0,0,0.1,0.1,0.22,0,1,0.5,0,'[{"label":"1 portion","g":180}]'),
('23410','Boulgour, cuit','Céréales et dérivés',118,3.9,23.7,0.6,3.0,0.5,0.02,18,0.9,43,100,0.8,0,0,0.08,0.04,0.12,0,0,0.3,0,'[{"label":"1 portion","g":180}]'),
('23500','Semoule de blé dur, cuite','Céréales et dérivés',150,5.2,31.0,0.6,1.0,0.3,0.02,14,0.7,16,60,0.7,0,0,0.05,0.02,0.1,0,0,0.3,0,'[{"label":"1 portion","g":180}]'),
('11000','Pomme de terre vapeur','Légumes et produits dérivés',83,1.8,17.0,0.1,2.0,1.0,0.01,6,0.3,22,418,0.3,13,0,0.09,0.03,0.29,0,0,0.1,0,'[{"label":"1 pomme de terre","g":130},{"label":"2 petites","g":100}]'),
('11010','Pomme de terre, purée, préparée','Légumes et produits dérivés',101,2.5,19.5,2.6,1.7,1.1,0.5,51,0.4,16,346,0.3,8,0.03,0.06,0.05,0.24,0,30,0.3,0,'[{"label":"1 portion","g":200}]'),
('11100','Tomate, crue','Légumes et produits dérivés',17,0.9,2.6,0.2,1.2,2.1,0.02,10,0.3,11,212,0.1,19.1,0,0.05,0.04,0.11,0,42,0.7,0,'[{"label":"1 tomate","g":100},{"label":"1 petite tomate","g":70}]'),
('11110','Tomate cerise, crue','Légumes et produits dérivés',18,0.9,2.4,0.2,1.5,2.1,0.02,11,0.5,12,235,0.1,23,0,0.06,0.05,0.12,0,68,0.8,0,'[{"label":"1 portion (10 tomates)","g":100}]'),
('11200','Carotte, crue','Légumes et produits dérivés',35,0.7,6.8,0.3,2.9,4.7,0.08,27,0.4,12,220,0.2,5.9,0,0.06,0.04,0.14,0,835,0.5,0,'[{"label":"1 carotte","g":80},{"label":"1 grande carotte","g":120}]'),
('11210','Carotte, cuite','Légumes et produits dérivés',27,0.6,5.3,0.2,2.5,3.6,0.08,26,0.4,11,170,0.2,3.6,0,0.04,0.03,0.1,0,852,0.5,0,'[{"label":"1 portion","g":150}]'),
('11300','Brocoli, cuit vapeur','Légumes et produits dérivés',35,3.1,3.4,0.5,3.3,0.8,0.02,47,0.9,20,293,0.5,82,0,0.07,0.19,0.27,0,35,1.5,0,'[{"label":"1 portion","g":150},{"label":"1 fleurette","g":30}]'),
('11310','Épinards, cuits','Légumes et produits dérivés',29,3.0,1.7,0.5,2.6,0.6,0.37,145,3.4,87,466,0.7,15,0,0.07,0.23,0.25,0,524,2.2,0,'[{"label":"1 portion","g":180}]'),
('11320','Haricots verts, cuits','Légumes et produits dérivés',31,1.9,3.6,0.2,3.4,1.7,0.01,40,1.0,25,170,0.4,12,0,0.07,0.1,0.1,0,33,0.3,0,'[{"label":"1 portion","g":150}]'),
('11330','Courgette, cuite','Légumes et produits dérivés',20,1.5,2.1,0.3,1.5,1.4,0.01,21,0.5,18,260,0.3,10,0,0.05,0.08,0.12,0,16,0.2,0,'[{"label":"1 portion","g":150},{"label":"1 courgette","g":200}]'),
('11340','Aubergine, cuite','Légumes et produits dérivés',31,0.9,4.6,0.7,3.4,2.3,0.01,17,0.6,14,188,0.3,1.7,0,0.04,0.04,0.1,0,2,0.5,0,'[{"label":"1 portion","g":150}]'),
('11350','Poivron rouge, cru','Légumes et produits dérivés',27,0.9,4.5,0.3,1.6,3.4,0.02,8,0.4,11,177,0.2,166,0,0.04,0.09,0.29,0,157,1.6,0,'[{"label":"1 poivron","g":120}]'),
('11360','Champignons de Paris, crus','Légumes et produits dérivés',25,2.5,3.3,0.3,1.0,2.3,0.02,5,0.5,11,318,0.4,2.1,0.2,0.09,0.38,0.13,0.04,0,0.1,0,'[{"label":"1 portion","g":100}]'),
('11370','Avocat, cru','Légumes et produits dérivés',160,2.0,1.8,14.7,6.7,0.5,0.04,12,0.6,29,485,0.6,10,0,0.07,0.14,0.29,0,7,2.1,0,'[{"label":"1/2 avocat","g":80},{"label":"1 avocat entier","g":160}]'),
('11380','Concombre, cru','Légumes et produits dérivés',12,0.7,1.4,0.1,0.7,1.4,0.01,16,0.3,13,147,0.2,2.8,0,0.03,0.04,0.04,0,5,0.1,0,'[{"label":"1/2 concombre","g":150}]'),
('11390','Salade verte (laitue), crue','Légumes et produits dérivés',12,1.3,1.2,0.2,1.3,0.8,0.01,33,1.2,13,212,0.4,3.3,0,0.06,0.07,0.09,0,166,0.3,0,'[{"label":"1 bol","g":50}]'),
('11400','Poireau, cuit','Légumes et produits dérivés',31,1.6,4.5,0.4,2.4,2.0,0.01,37,1.2,14,213,0.3,10,0,0.04,0.07,0.17,0,47,0.7,0,'[{"label":"1 portion","g":150}]'),
('11410','Oignon, cru','Légumes et produits dérivés',40,1.1,8.5,0.1,1.7,5.0,0.02,23,0.2,10,157,0.2,7.4,0,0.04,0.03,0.12,0,0,0.2,0,'[{"label":"1 oignon","g":80}]'),
('11420','Ail, cru','Légumes et produits dérivés',149,6.4,24.0,0.5,2.1,1.0,0.02,181,1.7,25,401,1.2,31.2,0,0.2,0.11,1.24,0,0,0.1,0,'[{"label":"1 gousse","g":5}]'),
('11500','Betterave rouge, cuite','Légumes et produits dérivés',44,1.7,8.8,0.1,2.0,6.8,0.24,16,0.8,23,235,0.4,3.9,0,0.02,0.04,0.06,0,1,0.1,0,'[{"label":"1 betterave","g":80}]'),
('11510','Céleri branche, cru','Légumes et produits dérivés',17,0.7,1.8,0.2,1.8,1.7,0.27,40,0.4,11,260,0.2,7.0,0,0.02,0.06,0.09,0,22,0.4,0,'[{"label":"1 branche","g":40}]'),
('11600','Maïs doux, en conserve','Légumes et produits dérivés',86,2.7,16.6,1.2,2.7,5.7,0.3,4,0.4,24,147,0.6,5.3,0,0.02,0.05,0.12,0,6,0.2,0,'[{"label":"1 portion","g":100}]'),
('11700','Petits pois, en conserve','Légumes et produits dérivés',80,5.1,11.5,0.4,5.5,5.5,0.3,18,1.7,29,144,1.0,14,0,0.16,0.09,0.09,0,38,0.3,0,'[{"label":"1 portion","g":100}]'),
('12000','Lentilles vertes, cuites','Légumineuses',116,9.0,14.5,0.4,7.9,1.3,0.01,19,3.3,36,369,1.6,1.5,0,0.17,0.07,0.18,0,3,0.3,0,'[{"label":"1 portion","g":160}]'),
('12010','Lentilles corail, cuites','Légumineuses',127,8.9,16.8,0.6,5.7,1.5,0.01,19,3.0,36,350,1.5,1.4,0,0.16,0.07,0.17,0,4,0.3,0,'[{"label":"1 portion","g":160}]'),
('12020','Pois chiches, cuits','Légumineuses',164,8.9,22.5,2.6,7.6,3.7,0.24,49,2.9,48,291,1.5,1.3,0,0.12,0.06,0.25,0,3,0.4,0,'[{"label":"1 portion","g":150}]'),
('12030','Haricots rouges, cuits','Légumineuses',127,8.7,17.5,0.5,8.7,2.2,0.01,28,2.6,45,405,1.3,1.2,0,0.14,0.06,0.2,0,0,0.3,0,'[{"label":"1 portion","g":150}]'),
('12040','Haricots blancs, cuits','Légumineuses',139,9.3,20.1,0.5,7.4,2.3,0.02,70,3.6,60,561,1.0,0.7,0,0.17,0.06,0.22,0,0,0.2,0,'[{"label":"1 portion","g":150}]'),
('12050','Fèves, cuites','Légumineuses',110,9.0,12.5,0.5,5.7,2.5,0.01,36,2.0,38,330,1.2,20,0,0.09,0.1,0.08,0,47,0.3,0,'[{"label":"1 portion","g":150}]'),
('12100','Tofu nature','Végétalien',80,8.1,0.5,4.8,0.3,0.5,0.01,350,5.4,30,130,1.6,0.2,0,0.08,0.03,0.1,0,1,0.1,0,'[{"label":"1 portion","g":100}]'),
('12110','Tempeh','Végétalien',193,18.5,6.4,10.8,4.1,4.1,0.03,111,2.7,70,412,1.1,0,0,0.08,0.36,0.5,0.08,0,1.9,0,'[{"label":"1 portion","g":100}]'),
('13000','Pomme, crue','Fruits',52,0.3,11.8,0.2,2.4,10.4,0.01,6,0.2,5,107,0.1,4.7,0,0.03,0.02,0.04,0,3,0.2,0,'[{"label":"1 pomme","g":150}]'),
('13010','Poire, crue','Fruits',56,0.4,12.0,0.1,3.1,7.3,0.01,11,0.2,7,119,0.1,4.4,0,0.02,0.04,0.03,0,2,0.2,0,'[{"label":"1 poire","g":150}]'),
('13020','Banane, crue','Fruits',89,1.1,20.1,0.3,2.6,12.2,0.01,5,0.3,27,358,0.2,8.7,0,0.03,0.07,0.37,0,3,0.1,0,'[{"label":"1 banane","g":120}]'),
('13030','Orange, crue','Fruits',47,0.9,8.9,0.2,2.4,7.5,0.01,40,0.1,10,181,0.1,53.2,0,0.07,0.04,0.06,0,11,0.2,0,'[{"label":"1 orange","g":130}]'),
('13040','Fraise, crue','Fruits',32,0.7,5.4,0.4,2.0,5.4,0.01,16,0.5,13,153,0.2,61.0,0,0.02,0.04,0.07,0,1,0.3,0,'[{"label":"1 barquette","g":125}]'),
('13050','Kiwi, cru','Fruits',56,1.1,10.1,0.6,3.0,8.6,0.01,34,0.3,17,295,0.1,92.7,0,0.02,0.05,0.13,0,4,1.5,0,'[{"label":"1 kiwi","g":80}]'),
('13060','Raisin, cru','Fruits',67,0.6,16.5,0.4,0.9,16.5,0.01,10,0.4,7,191,0.1,3.2,0,0.07,0.06,0.07,0,3,0.2,0,'[{"label":"1 grappe","g":100}]'),
('13070','Mangue, crue','Fruits',63,0.8,13.8,0.4,1.6,13.4,0.01,11,0.2,10,156,0.1,27.7,0,0.06,0.06,0.13,0,38,1.1,0,'[{"label":"1 portion","g":150}]'),
('13080','Abricot, cru','Fruits',48,1.4,9.1,0.4,2.0,9.1,0.01,13,0.4,10,259,0.2,5.5,0,0.04,0.06,0.07,0,96,0.9,0,'[{"label":"2 abricots","g":80}]'),
('13090','Myrtille, crue','Fruits',59,0.7,12.7,0.3,2.4,8.7,0.01,6,0.3,6,77,0.2,9.7,0,0.04,0.05,0.05,0,4,0.6,0,'[{"label":"1 portion","g":80}]'),
('13100','Citron, jus','Fruits',28,0.4,5.7,0.3,0.1,1.9,0.01,11,0.1,7,103,0.1,51.4,0,0.03,0.02,0.07,0,1,0.2,0,'[{"label":"1 citron pressé","g":50}]'),
('13110','Ananas, cru','Fruits',50,0.5,11.8,0.1,1.4,9.9,0.01,13,0.3,12,109,0.1,47.8,0,0.08,0.04,0.11,0,4,0.1,0,'[{"label":"1 tranche","g":80}]'),
('13120','Pastèque, crue','Fruits',30,0.6,6.2,0.2,0.4,6.0,0.01,7,0.2,11,112,0.1,8.1,0,0.03,0.02,0.04,0,28,0.05,0,'[{"label":"1 tranche","g":200}]'),
('13200','Avocat, cru','Fruits',160,2.0,1.8,14.7,6.7,0.5,0.04,12,0.6,29,485,0.6,10,0,0.07,0.14,0.29,0,7,2.1,0,'[{"label":"1/2 avocat","g":80},{"label":"1 avocat","g":160}]'),
('14000','Amandes, séchées','Fruits à coque',579,21.2,4.9,49.9,12.2,3.9,0.01,264,3.7,270,705,3.3,0,0,0.21,0.72,0.14,0,0,26.2,0,'[{"label":"1 poignée (20 amandes)","g":28}]'),
('14010','Noix, sèches','Fruits à coque',654,15.2,3.3,65.2,6.7,2.6,0.01,98,2.9,158,441,3.1,1.3,0,0.34,0.15,0.54,0,3,2.1,0,'[{"label":"4-5 cerneaux","g":25}]'),
('14020','Noisettes, séchées','Fruits à coque',628,14.9,7.0,60.8,9.7,4.3,0.01,114,3.4,163,680,2.4,6.3,0,0.43,0.11,0.56,0,1,15.0,0,'[{"label":"1 petite poignée","g":20}]'),
('14030','Noix de cajou, séchées','Fruits à coque',574,18.2,26.7,43.9,3.3,5.4,0.01,37,6.7,292,660,5.8,0.5,0,0.42,0.06,0.42,0,0,0.9,0,'[{"label":"1 petite poignée","g":25}]'),
('14040','Pistaches, séchées','Fruits à coque',557,20.6,16.6,45.0,10.3,5.6,0.01,105,4.2,121,1042,2.2,5.6,0,0.87,0.16,1.12,0,26,2.3,0,'[{"label":"1 petite poignée","g":25}]'),
('14050','Noix du Brésil, séchées','Fruits à coque',659,14.3,3.5,67.1,7.5,2.3,0.01,160,2.4,376,659,4.1,0.7,0,0.62,0.05,0.1,0,0,7.6,0,'[{"label":"2-3 noix","g":20}]'),
('15010','Lait de soja nature','Végétalien',43,3.6,1.9,2.0,0.3,0.7,0.05,14,0.5,19,118,0.5,0,1.0,0.04,0.02,0.07,0,0,0.1,0,'[{"label":"1 verre","g":200}]'),
('15020','Lait d''amande nature','Végétalien',24,0.4,3.2,1.1,0.2,2.8,0.06,120,0.3,15,63,0.6,0,0.75,0.01,0.02,0.01,0,0,11.5,0,'[{"label":"1 verre","g":200}]'),
('15030','Lait de coco (boisson)','Végétalien',22,0.2,3.2,1.0,0,1.7,0.04,2,0.2,6,25,0.2,0,0,0.01,0.01,0.01,0,0,0.1,0,'[{"label":"1 verre","g":200}]'),
('15100','Crème de coco (cuisine)','Végétalien',330,3.6,7.0,32.0,2.0,6.0,0.05,16,1.7,37,263,0.7,1.7,0,0.03,0.02,0.07,0,0,0.5,0,'[{"label":"1 cuillère à soupe","g":20}]'),
('16010','Miel','Sucres et confiseries',304,0.4,82.4,0,0.2,82.4,0.03,6,0.4,2,52,0.2,0.5,0,0,0.04,0.02,0,0,0.1,0,'[{"label":"1 cuillère à café","g":7},{"label":"1 cuillère à soupe","g":21}]'),
('16020','Confiture d''abricots','Sucres et confiseries',264,0.5,65.0,0.1,0.9,62.7,0.04,11,0.3,5,100,0.1,4.0,0,0.02,0.02,0.02,0,25,0.3,0,'[{"label":"1 cuillère à soupe","g":20}]'),
('16100','Chocolat noir 70%','Sucres et confiseries',571,8.0,33.0,38.0,9.2,23.0,0.01,73,6.3,146,572,3.7,0,0,0.07,0.07,0.06,0,3,1.8,0,'[{"label":"1 carré (5g)","g":5},{"label":"4 carrés","g":20}]'),
('16110','Chocolat au lait','Sucres et confiseries',536,7.7,57.8,30.4,3.0,56.0,0.12,214,1.5,63,389,1.5,0,0.4,0.04,0.25,0.05,0.35,75,1.1,0,'[{"label":"1 carré","g":7},{"label":"3 carrés","g":21}]'),
('16200','Gâteau au chocolat maison','Sucreries et pâtisseries',400,6.5,52.0,19.0,2.0,38.0,0.5,60,1.5,20,120,0.8,0,0.2,0.07,0.15,0.05,0.3,65,0.7,0,'[{"label":"1 part","g":80}]'),
('16300','Yaourt aux fruits (sucré)','Lait et produits laitiers',97,3.5,16.2,2.0,0.2,16.0,0.1,120,0.1,11,170,0.5,1.0,0.03,0.04,0.16,0.04,0.25,19,0.1,2,'[{"label":"1 pot","g":125}]'),
('17010','Skyr nature','Lait et produits laitiers',63,11.0,4.0,0.2,0,4.0,0.06,135,0.1,14,170,0.7,0,0,0.04,0.18,0.05,0.45,0,0.1,1,'[{"label":"1 pot","g":150}]'),
('17020','Kéfir nature','Lait et produits laitiers',52,3.3,5.2,1.0,0,5.2,0.05,120,0.1,12,155,0.4,1.0,0.04,0.04,0.14,0.04,0.3,30,0.1,1,'[{"label":"1 verre","g":200}]'),
('17030','Crème fraîche épaisse 30% MG','Lait et produits laitiers',291,2.4,2.7,30.0,0,2.7,0.09,69,0.1,7,99,0.3,1.0,0.4,0.03,0.15,0.03,0.22,278,0.8,1,'[{"label":"1 cuillère à soupe","g":30}]'),
('17040','Crème fraîche légère 15% MG','Lait et produits laitiers',152,3.2,3.4,14.0,0,3.4,0.09,101,0.1,9,132,0.4,1.0,0.2,0.03,0.13,0.04,0.27,119,0.4,1,'[{"label":"1 cuillère à soupe","g":30}]'),
('18010','Protéines de lactosérum (whey)','Compléments',370,80,6.0,5.0,0,4.0,0.5,600,1.5,60,500,2.0,0,0.5,0.35,0.7,0.3,1.5,0,0.5,30,'[{"label":"1 scoop","g":30}]'),
('18020','Protéines de soja (isolat)','Compléments',338,90,0,1.5,0,0,1.0,176,14,80,600,5.0,0,0,0.15,0.1,0.2,0,0,0.5,20,'[{"label":"1 scoop","g":30}]');

-- =============================================
-- FUNCTION : full-text search helper
-- =============================================
create or replace function search_ciqual(query text, lim int default 30)
returns setof ciqual language sql stable as $$
  select * from ciqual
  where to_tsvector('french', alim_nom) @@ plainto_tsquery('french', query)
     or lower(alim_nom) like '%' || lower(query) || '%'
  order by
    case when lower(alim_nom) like lower(query) || '%' then 0 else 1 end,
    alim_nom
  limit lim;
$$;

-- =============================================
-- FUNCTION : set_ciqual_portions
-- =============================================
-- Appelée via supabase.rpc('set_ciqual_portions', { p_alim_code, p_portions })
-- depuis FoodPicker.jsx et ExplorerFoodModal.jsx pour écrire les "portions
-- courantes" d'un aliment ANSES. `ciqual` a RLS activé sans policy UPDATE :
-- security definer pour pouvoir écrire, execute réservé à `authenticated`.
-- Retourne le nombre de lignes modifiées (0 = alim_code inconnu).
-- Voir supabase/sql/ciqual_portions_setup.sql.
create or replace function set_ciqual_portions(p_alim_code text, p_portions jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update ciqual
     set portions = coalesce(p_portions, '[]'::jsonb)
   where alim_code = p_alim_code;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function set_ciqual_portions(text, jsonb) from public, anon;
grant execute on function set_ciqual_portions(text, jsonb) to authenticated;

-- =============================================
-- FUNCTION : find_profile_by_pseudo
-- =============================================
-- Appelée via supabase.rpc('find_profile_by_pseudo', { p_pseudo }) dans
-- useFriends.js pour la recherche d'amies (correspondance exacte,
-- retourne { id, pseudo, prenom } ou aucune ligne). Signature déduite de
-- l'usage client — corps de la fonction non introspecté, à récupérer
-- séparément si besoin (probablement security definer pour contourner RLS
-- de profiles le temps de la recherche).
-- create or replace function find_profile_by_pseudo(p_pseudo text)
-- returns table (id uuid, pseudo text, prenom text) ...

-- =============================================
-- FUNCTION : mark_planned_meal_eaten
-- =============================================
-- Ajoutée le 2026-08-30 (roadmap §2.2). Version ATOMIQUE de markAsEaten
-- (src/hooks/usePlannedMeals.js) : copie les items d'un repas planifié dans
-- `journal` ET passe `mange = true` dans la même transaction → plus de
-- doublons si un 2e « marquer mangé » survient après un échec partiel.
-- Idempotente (repas déjà mangé → ne réinsère rien). security invoker : les
-- policies RLS « own » de journal / repas_planifies s'appliquent.
-- Copie des colonnes via jsonb_populate_record(null::journal, ...) pour ne pas
-- réénumérer les ~70 colonnes de nutriments. Appelée via
-- supabase.rpc('mark_planned_meal_eaten', { p_repas_id }).
-- SQL complet : supabase/sql/mark_planned_meal_eaten_setup.sql — appliqué en
-- base le 2026-08-30.
create or replace function mark_planned_meal_eaten(p_repas_id uuid)
returns repas_planifies
language plpgsql
as $$
declare
  v_repas repas_planifies;
begin
  select * into v_repas
  from repas_planifies
  where id = p_repas_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'repas planifié introuvable ou non autorisé (id=%)', p_repas_id;
  end if;

  if v_repas.mange then
    return v_repas;
  end if;

  if jsonb_typeof(v_repas.items) = 'array' and jsonb_array_length(v_repas.items) > 0 then
    insert into journal
    select (jsonb_populate_record(
              null::journal,
              (item - 'id' - 'created_at' - 'user_id' - 'date' - 'meal')
                || jsonb_build_object(
                     'id',         gen_random_uuid(),
                     'user_id',    auth.uid(),
                     'date',       v_repas.date,
                     'meal',       v_repas.meal,
                     'created_at', now()
                   )
            )).*
    from jsonb_array_elements(v_repas.items) as t(item);
  end if;

  update repas_planifies
  set mange = true, mange_at = now()
  where id = p_repas_id and user_id = auth.uid()
  returning * into v_repas;

  return v_repas;
end;
$$;

grant execute on function mark_planned_meal_eaten(uuid) to authenticated;
