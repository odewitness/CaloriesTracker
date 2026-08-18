// Clé VAPID publique — sans risque à exposer côté client (seule la clé
// privée, connue uniquement de l'Edge Function `send-push`, permet d'envoyer
// des notifications). Générée une seule fois avec `npx web-push
// generate-vapid-keys` ; ne JAMAIS régénérer sans re-générer aussi la clé
// privée côté Supabase, sinon les abonnements existants deviennent invalides.
export const VAPID_PUBLIC_KEY = 'BKmM0omcc8zsUOCfc-knjb1zkg8nUid8TjZ8t28P5A2TUDRl7cGEJNtX4b5_gXj9mC9SraGPZZP_BvaQM-g8YtQ'

// L'API PushManager attend la clé applicationServerKey en Uint8Array, pas en
// base64url — conversion standard recommandée par la doc MDN/web.dev.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
