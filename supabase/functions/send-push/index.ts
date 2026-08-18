// Endpoint générique appelé par les triggers SQL (via pg_net) pour pousser
// une notification à un ou plusieurs utilisateurs — voir push_notify() dans
// supabase/sql/push_notifications_setup.sql. Pas de JWT Supabase standard :
// l'appelant est Postgres, pas un navigateur, authentifié par un secret
// partagé (PUSH_TRIGGER_SECRET) plutôt que le service_role key directement,
// pour limiter les dégâts si ce secret venait à fuiter.
import { sendToUsers } from '../_shared/webpush.ts'

const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== PUSH_TRIGGER_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const { user_ids, title, body, url } = await req.json()
  if (!Array.isArray(user_ids) || user_ids.length === 0 || !title) {
    return new Response('bad request', { status: 400 })
  }

  await sendToUsers(user_ids, { title, body, url })
  return new Response('ok')
})
