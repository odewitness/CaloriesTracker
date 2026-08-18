import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '../lib/push'

// ─────────────────────────────────────────────────────────────────────────────
// usePushSubscription — abonnement de CET appareil aux notifications push
// (rappels + activité sociale, voir ProfilePage). `subscribed` reflète l'état
// réel du navigateur (PushManager), pas juste une préférence enregistrée :
// si la permission est révoquée depuis les réglages système, on le détecte.
// ─────────────────────────────────────────────────────────────────────────────
export function usePushSubscription() {
  const { user } = useAuth()
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  )
  const [permission, setPermission] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'denied'))
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkSubscribed = useCallback(async () => {
    if (!supported || !user?.id) { setSubscribed(false); setLoading(false); return }
    setLoading(true)
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    setSubscribed(!!sub)
    setLoading(false)
  }, [supported, user?.id])

  useEffect(() => { checkSubscribed() }, [checkSubscribed])

  const subscribe = async () => {
    if (!supported || !user?.id) return { error: 'Non supporté sur cet appareil/navigateur' }

    const result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') return { error: 'Permission refusée' }

    const registration = await navigator.serviceWorker.ready
    let sub = await registration.pushManager.getSubscription()
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    )
    if (error) return { error }
    setSubscribed(true)
    return { error: null }
  }

  const unsubscribe = async () => {
    if (!supported) return
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    setSubscribed(false)
  }

  return { supported, permission, subscribed, loading, subscribe, unsubscribe }
}
