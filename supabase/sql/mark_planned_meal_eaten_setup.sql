-- =============================================
-- MARK_PLANNED_MEAL_EATEN — version ATOMIQUE de markAsEaten
-- (src/hooks/usePlannedMeals.js). Voir docs/analyse-et-roadmap.md §2.2.
--
-- Écrit + appliqué en base le 2026-08-30. À exécuter une fois, à la main, dans
-- le SQL editor Supabase. Référence pour Claude Code ensuite (mêmes
-- conventions que supabase_schema.sql).
--
-- Problème corrigé : markAsEaten faisait 2 requêtes séparées — insert dans
-- `journal`, puis update `repas_planifies.mange = true`. Si la 2e échouait
-- (réseau), les aliments étaient au journal mais le repas restait « à faire »
-- → un 2e « marquer mangé » réinsérait tout (doublons).
--
-- Cette fonction fait les deux dans UNE transaction (bloc plpgsql = atomique).
-- Idempotente : rappelée sur un repas déjà `mange`, elle ne réinsère rien et
-- renvoie la ligne telle quelle.
--
-- security invoker (défaut) : s'exécute avec les droits de l'appelante → les
-- policies RLS « own » de `journal` et `repas_planifies` s'appliquent. Le
-- `where user_id = auth.uid()` + `for update` verrouillent la ligne le temps
-- de l'opération (deux taps concurrents se sérialisent).
--
-- La copie des colonnes passe par jsonb_populate_record(null::journal, ...)
-- pour ne PAS réénumérer les ~70 colonnes de nutriments : les clés du jsonb
-- `items` (produites par scaleFood() côté client) portent déjà les mêmes noms
-- que les colonnes de `journal`. On force juste l'identité
-- (id / user_id / date / meal / created_at) et on retire les clés parasites
-- éventuelles (recette_id, id périmé d'un item copié depuis une recette…).
--
-- Appelée via supabase.rpc('mark_planned_meal_eaten', { p_repas_id }).
-- Retourne la ligne repas_planifies mise à jour (comme l'ancien
-- .update(...).select().single()).
-- =============================================

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

  -- Déjà mangé → rien à faire, on renvoie l'état courant.
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
