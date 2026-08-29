// Formate une Date en 'YYYY-MM-DD' (fuseau local, pas UTC) — le format des
// colonnes `date` Supabase. Si `date` est déjà une chaîne, la renvoie telle
// quelle (permet d'appeler fmt() indifféremment sur une Date ou une string
// déjà au bon format).
export function fmt(date) {
  if (typeof date === 'string') return date
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 'YYYY-MM-DD' (fuseau LOCAL) pour aujourd'hui, avec un décalage optionnel de
// `offsetDays` jours (−1 = hier, +1 = demain). À utiliser partout où l'on veut
// "le jour courant" : `new Date().toISOString().slice(0, 10)` renvoie la date
// UTC et bascule donc d'un jour trop tôt entre minuit et 1h/2h du matin en
// France — ce qui ferait enregistrer un aliment sur la mauvaise journée.
export function todayStr(offsetDays = 0) {
  const d = new Date()
  if (offsetDays) d.setDate(d.getDate() + offsetDays)
  return fmt(d)
}

// "Aujourd'hui" / "Hier" / "Demain" / sinon "lundi 3 mars" (fr-FR).
export function dateLabel(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const diff = (d - today) / 86400000
  if (diff === 0) return "Aujourd'hui"
  if (diff === -1) return 'Hier'
  if (diff === 1) return 'Demain'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
