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
