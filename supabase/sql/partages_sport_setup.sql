-- =============================================
-- FIL SOCIAL — PARTAGE DE SPORT (chantier « Suivi de l'activité sportive »,
-- Palier 8). Trois tables calquées à l'IDENTIQUE sur le trio
-- partages_journal / reactions_journal / commentaires_journal, y compris les
-- policies RLS (visibilité « auteure ou amie acceptée » via la fonction
-- `is_friend_with(uuid)` déjà présente en base). Voir docs/suivi-sport.md §6.
--
-- Écrit le 2026-08-30. À exécuter une fois, à la main, dans le SQL editor
-- Supabase. Un partage = SOIT une séance (`kind = 'seance'`), SOIT un résumé
-- de semaine (`kind = 'semaine'`). Snapshot au moment du partage : reste
-- affiché même si la séance source est ensuite modifiée/supprimée.
-- =============================================

create table if not exists partages_sport (
  id uuid default gen_random_uuid() primary key,
  auteur_id uuid not null references auth.users(id),
  auteur_pseudo text,
  auteur_prenom text,
  kind text not null default 'seance', -- 'seance' | 'semaine'
  -- kind = 'seance'
  date date,
  type text,                -- clé de SPORT_TYPES (src/lib/sport.js)
  duree_min numeric,
  distance_km numeric,
  intensite text,           -- 'faible' | 'moderee' | 'elevee'
  energie_kcal numeric,
  -- kind = 'semaine'
  semaine_debut date,       -- lundi de la semaine résumée
  total_min numeric,
  nb_seances integer,
  total_kcal numeric,
  -- commun
  message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_partages_sport_auteur on partages_sport (auteur_id);
create index if not exists idx_partages_sport_created on partages_sport (created_at desc);

create table if not exists reactions_sport (
  id uuid default gen_random_uuid() primary key,
  partage_id uuid not null references partages_sport(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  emoji text not null, -- même CHECK que reactions_journal (REACTION_EMOJIS, src/lib/reactions.js)
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

-- =============================================
-- RLS — réplique EXACTE des policies de partages_journal & co.
-- (extrait de pg_policies fourni le 2026-08-30).
-- =============================================
alter table partages_sport enable row level security;
alter table reactions_sport enable row level security;
alter table commentaires_sport enable row level security;

-- partages_sport : select = auteure OU amie ; insert/delete = auteure. Pas d'update.
create policy "partages_sport_select" on partages_sport
  for select using ((auteur_id = auth.uid()) or is_friend_with(auteur_id));
create policy "partages_sport_insert" on partages_sport
  for insert with check (auteur_id = auth.uid());
create policy "partages_sport_delete" on partages_sport
  for delete using (auteur_id = auth.uid());

-- reactions_sport : select/insert gardés par la visibilité du partage parent ;
-- delete = sur ses propres réactions.
create policy "reactions_sport_select" on reactions_sport
  for select using (exists (
    select 1 from partages_sport p
    where p.id = reactions_sport.partage_id
      and ((p.auteur_id = auth.uid()) or is_friend_with(p.auteur_id))
  ));
create policy "reactions_sport_insert" on reactions_sport
  for insert with check ((user_id = auth.uid()) and exists (
    select 1 from partages_sport p
    where p.id = reactions_sport.partage_id
      and ((p.auteur_id = auth.uid()) or is_friend_with(p.auteur_id))
  ));
create policy "reactions_sport_delete" on reactions_sport
  for delete using (user_id = auth.uid());

-- commentaires_sport : idem réactions ; delete = sur ses propres commentaires.
create policy "commentaires_sport_select" on commentaires_sport
  for select using (exists (
    select 1 from partages_sport p
    where p.id = commentaires_sport.partage_id
      and ((p.auteur_id = auth.uid()) or is_friend_with(p.auteur_id))
  ));
create policy "commentaires_sport_insert" on commentaires_sport
  for insert with check ((auteur_id = auth.uid()) and exists (
    select 1 from partages_sport p
    where p.id = commentaires_sport.partage_id
      and ((p.auteur_id = auth.uid()) or is_friend_with(p.auteur_id))
  ));
create policy "commentaires_sport_delete" on commentaires_sport
  for delete using (auteur_id = auth.uid());
