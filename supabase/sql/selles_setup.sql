-- =============================================
-- SELLES — tracker de transit intestinal (échelle de Bristol, couleur,
-- remarques), saisi à la main. Objectif : croiser avec l'alimentation,
-- l'hydratation et le cycle pour repérer ce qui influence la digestion
-- (ex. constipation).
--
-- UNE LIGNE = UN PASSAGE (plusieurs par jour possibles, pas de contrainte
-- d'unicité par date contrairement à mensurations).
--
-- Fonctionnalité visible pour UN SEUL compte (voir src/lib/featureFlags.js,
-- STOOL_TRACKER_USER_ID) — mais la donnée reste sensible comme les autres
-- tables santé de l'app : RLS « own » stricte, pas de garde côté client
-- seule.
--
-- Écrit le 2026-09-23. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- =============================================

create table if not exists selles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  date date not null default current_date,
  heure time,                              -- nullable
  lieu text,                               -- nullable, texte libre ("Maison", "Extérieur", ...)
  bristol smallint not null check (bristol between 1 and 7),
  couleur text,                            -- nullable : clé de STOOL_COULEURS (src/lib/stool.js)
  effort text,                             -- nullable : 'facile' | 'normal' | 'difficile'
  evacuation_complete boolean,             -- nullable = non renseigné
  -- clés multi-sélection : 'restes_nourriture' | 'douleur' | 'ballonnement' |
  -- 'odeur' | 'sang' | 'mucus' (voir STOOL_REMARQUES dans src/lib/stool.js),
  -- même pattern que regles.symptomes.
  remarques text[] not null default '{}',
  note text,                               -- nullable, texte libre
  created_at timestamptz not null default now()
);

create index if not exists idx_selles_user_date on selles (user_id, date desc);

alter table selles enable row level security;

create policy "selles_select_own" on selles
  for select using (auth.uid() = user_id);
create policy "selles_insert_own" on selles
  for insert with check (auth.uid() = user_id);
create policy "selles_update_own" on selles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "selles_delete_own" on selles
  for delete using (auth.uid() = user_id);
