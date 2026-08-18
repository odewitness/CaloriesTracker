-- =============================================
-- NOTIFICATIONS PUSH — mise en place complète
-- Écrit le 2026-08-18. À exécuter une fois, à la main, dans le SQL editor
-- Supabase (pas de CLI connectée depuis Claude Code — voir CLAUDE.md).
-- Référence pour Claude Code par la suite, pas un script à rejouer tel quel
-- sur une base déjà migrée (mêmes conventions que supabase_schema.sql).
--
-- Pré-requis avant d'exécuter :
--   1. Les Edge Functions send-push et daily-reminder doivent être déployées
--      (voir supabase/functions/) AVEC LA VÉRIFICATION JWT DÉSACTIVÉE
--      ("Enforce JWT Verification" décoché dans le dashboard, ou
--      --no-verify-jwt en CLI) : elles sont appelées par pg_net depuis
--      Postgres, pas par le navigateur, donc pas de JWT Supabase à
--      présenter — la protection vient du header x-push-secret vérifié dans
--      le code de chaque fonction.
--   2. Leurs secrets définis (dashboard → Edge Functions → Secrets) :
--      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_TRIGGER_SECRET.
--      SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont déjà injectées
--      automatiquement par Supabase, pas besoin de les définir.
--   3. PUSH_TRIGGER_SECRET doit être IDENTIQUE à la valeur codée en dur
--      ci-dessous — même convention que les identifiants Supabase déjà en
--      dur dans src/lib/supabase.js (app perso, pas de .env, pas de
--      séparation dev/prod).
-- =============================================

-- 1. TABLE PUSH_SUBSCRIPTIONS ------------------------------------------------
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on push_subscriptions
  for delete using (auth.uid() = user_id);
-- Pas de policy update : le client supprime + réinsère plutôt que de modifier
-- (voir usePushSubscription.js). Les Edge Functions lisent/écrivent via la
-- service_role key, qui contourne RLS de toute façon.

-- 2. COLONNES SETTINGS --------------------------------------------------------
alter table settings add column if not exists notif_reminder_enabled boolean not null default true;
alter table settings add column if not exists notif_social_enabled boolean not null default true;
alter table settings add column if not exists last_reminder_sent_date date;

-- 3. EXTENSION PG_NET (appels HTTP sortants depuis des triggers) -------------
create extension if not exists pg_net;

-- 4. HELPERS -------------------------------------------------------------------

-- Amies acceptées d'un utilisateur (les deux sens de la relation amities).
create or replace function push_friend_ids(p_user_id uuid)
returns table(friend_id uuid) language sql stable as $$
  select destinataire_id from amities where demandeur_id = p_user_id and statut = 'acceptee'
  union
  select demandeur_id from amities where destinataire_id = p_user_id and statut = 'acceptee'
$$;

-- Envoie une notification push aux user_ids donnés, en respectant
-- notif_social_enabled de chacun. Fire-and-forget (pg_net est asynchrone) :
-- un échec d'envoi ne doit jamais faire échouer l'insertion qui a déclenché
-- le trigger (partage, réaction, commentaire...).
create or replace function push_notify(p_user_ids uuid[], p_title text, p_body text, p_url text)
returns void language plpgsql as $$
declare
  v_ids uuid[];
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then return; end if;

  select array_agg(s.user_id) into v_ids
  from settings s
  where s.user_id = any(p_user_ids) and coalesce(s.notif_social_enabled, true);

  if v_ids is null or array_length(v_ids, 1) is null then return; end if;

  perform net.http_post(
    url := 'https://afczgttnakutfqoctumu.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', 'VbaSQ8Kz_puHmTQDsKdvZ0NYk40AZHsN'
    ),
    body := jsonb_build_object('user_ids', to_jsonb(v_ids), 'title', p_title, 'body', p_body, 'url', p_url)
  );
end;
$$;

-- 5. NOUVEAU PARTAGE → notifie les amies acceptées de l'auteure --------------
create or replace function push_on_new_partage()
returns trigger language plpgsql as $$
declare
  v_friends uuid[];
begin
  select array_agg(friend_id) into v_friends from push_friend_ids(new.auteur_id);
  if v_friends is null then return new; end if;

  if TG_TABLE_NAME = 'partages_recettes' then
    perform push_notify(v_friends, coalesce(new.auteur_prenom, 'Une amie') || ' a partagé une recette', new.nom, '/social');
  else
    perform push_notify(v_friends, coalesce(new.auteur_prenom, 'Une amie') || ' a partagé son repas', coalesce(new.meal, 'Journée entière'), '/social');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_push_on_new_partage on partages_recettes;
create trigger trg_push_on_new_partage after insert on partages_recettes for each row execute function push_on_new_partage();
drop trigger if exists trg_push_on_new_partage on partages_journal;
create trigger trg_push_on_new_partage after insert on partages_journal for each row execute function push_on_new_partage();

-- 6. NOUVELLE RÉACTION → notifie l'auteure du partage -------------------------
create or replace function push_on_new_reaction()
returns trigger language plpgsql as $$
declare
  v_author uuid;
begin
  if TG_TABLE_NAME = 'reactions_partages' then
    select auteur_id into v_author from partages_recettes where id = new.partage_id;
  else
    select auteur_id into v_author from partages_journal where id = new.partage_id;
  end if;

  if v_author is null or v_author = new.user_id then return new; end if;
  perform push_notify(array[v_author], coalesce(new.user_prenom, 'Une amie') || ' a réagi à ton partage', new.emoji, '/social');
  return new;
end;
$$;

drop trigger if exists trg_push_on_new_reaction on reactions_partages;
create trigger trg_push_on_new_reaction after insert on reactions_partages for each row execute function push_on_new_reaction();
drop trigger if exists trg_push_on_new_reaction on reactions_journal;
create trigger trg_push_on_new_reaction after insert on reactions_journal for each row execute function push_on_new_reaction();

-- 7. NOUVEAU COMMENTAIRE / RÉPONSE → notifie l'auteure ciblée -----------------
create or replace function push_on_new_comment()
returns trigger language plpgsql as $$
declare
  v_target uuid;
begin
  if new.parent_id is null then
    if TG_TABLE_NAME = 'commentaires_partages' then
      select auteur_id into v_target from partages_recettes where id = new.partage_id;
    else
      select auteur_id into v_target from partages_journal where id = new.partage_id;
    end if;
  else
    if TG_TABLE_NAME = 'commentaires_partages' then
      select auteur_id into v_target from commentaires_partages where id = new.parent_id;
    else
      select auteur_id into v_target from commentaires_journal where id = new.parent_id;
    end if;
  end if;

  if v_target is null or v_target = new.auteur_id then return new; end if;
  perform push_notify(
    array[v_target],
    coalesce(new.auteur_prenom, 'Une amie') || (case when new.parent_id is null then ' a commenté ton partage' else ' a répondu à ton commentaire' end),
    new.contenu,
    '/social'
  );
  return new;
end;
$$;

drop trigger if exists trg_push_on_new_comment on commentaires_partages;
create trigger trg_push_on_new_comment after insert on commentaires_partages for each row execute function push_on_new_comment();
drop trigger if exists trg_push_on_new_comment on commentaires_journal;
create trigger trg_push_on_new_comment after insert on commentaires_journal for each row execute function push_on_new_comment();

-- 8. CRON — rappel quotidien ---------------------------------------------------
-- Nécessite l'extension pg_cron (activable depuis Database > Extensions dans
-- le dashboard Supabase, ou `create extension if not exists pg_cron;` si les
-- droits le permettent). Tourne toutes les heures ; daily-reminder se gate
-- elle-même sur l'heure locale Europe/Paris (voir son code).
select cron.schedule(
  'daily-reminder-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://afczgttnakutfqoctumu.supabase.co/functions/v1/daily-reminder',
    headers := '{"Content-Type": "application/json", "x-push-secret": "VbaSQ8Kz_puHmTQDsKdvZ0NYk40AZHsN"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
