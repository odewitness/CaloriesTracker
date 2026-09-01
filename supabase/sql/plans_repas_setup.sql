-- =============================================
-- PLANS DE REPAS ENREGISTRÉS — historique du planificateur (chantier
-- « Planificateur automatique de repas de la semaine », Palier 3). On
-- enregistre un plan généré (sa config + son aperçu complet) sous un nom,
-- pour le revoir, le renommer, le ré-appliquer à une autre semaine ou
-- repartir de lui plus tard.
--
-- UNE LIGNE = UN PLAN ENREGISTRÉ. `config` = l'objet de configuration du
-- planificateur ; `plan` = la sortie de buildMealPlan (jours, totaux, picks…).
-- Snapshot : si des recettes changent après coup, l'aperçu rechargé est
-- rafraîchi côté client (recomputePlanAggregates).
--
-- Écrit le 2026-09-01. À exécuter à la main dans le SQL editor Supabase
-- (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- =============================================

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

alter table plans_repas enable row level security;

create policy "plans_repas_select_own" on plans_repas
  for select using (auth.uid() = user_id);
create policy "plans_repas_insert_own" on plans_repas
  for insert with check (auth.uid() = user_id);
create policy "plans_repas_update_own" on plans_repas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "plans_repas_delete_own" on plans_repas
  for delete using (auth.uid() = user_id);
