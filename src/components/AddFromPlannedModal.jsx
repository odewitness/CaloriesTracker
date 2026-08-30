import React, { useMemo, useState } from 'react'
import { X, Check, CalendarRange } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { usePlannedMealsRange } from '../hooks/usePlannedMeals'
import { itemIdentity } from '../hooks/useShoppingLists'
import { fmt } from '../lib/dates'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// AddFromPlannedModal (roadmap §M5) — "générer la liste de courses depuis mes
// repas prévus". On choisit une plage de dates, on voit les repas planifiés
// non mangés de cette plage, et on valide : tous leurs aliments partent dans
// la liste (fusion + addition des grammages côté useShoppingListItems.
// addPlannedItems).
//
// Props :
//   onAdd(plannedMeals)  — lignes repas_planifies retenues
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d)
}

function dayLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function AddFromPlannedModal({ onAdd, onClose }) {
  useBackButton(onClose)

  const todayStr = fmt(new Date())
  const [startStr, setStartStr] = useState(todayStr)
  const [endStr, setEndStr] = useState(addDaysStr(todayStr, 13)) // 2 semaines
  const [adding, setAdding] = useState(false)

  // Bornes sûres même si l'utilisatrice inverse les deux dates.
  const lo = startStr <= endStr ? startStr : endStr
  const hi = startStr <= endStr ? endStr : startStr

  const { byDate, loading } = usePlannedMealsRange(lo, hi)

  // Repas planifiés non mangés de la plage, à plat et triés par date.
  const plannedMeals = useMemo(() => {
    const out = []
    for (const d of Object.keys(byDate).sort()) {
      for (const r of byDate[d]) {
        if (!r.mange) out.push(r)
      }
    }
    return out
  }, [byDate])

  const { mealCount, itemCount, distinctCount } = useMemo(() => {
    const ids = new Set()
    let items = 0
    for (const r of plannedMeals) {
      for (const it of (r.items || [])) {
        items += 1
        ids.add(itemIdentity({ food_source: it.food_source, food_ref_id: it.food_ref_id, nom: it.food_name }))
      }
    }
    return { mealCount: plannedMeals.length, itemCount: items, distinctCount: ids.size }
  }, [plannedMeals])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const r of plannedMeals) {
      if (!map.has(r.date)) map.set(r.date, [])
      map.get(r.date).push(r)
    }
    return [...map.entries()]
  }, [plannedMeals])

  const confirm = async () => {
    if (plannedMeals.length === 0) return
    setAdding(true)
    await onAdd(plannedMeals)
    setAdding(false)
    onClose()
  }

  return (
    <div className="page-modal" style={{ zIndex: 60 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Depuis mes repas prévus</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
          Tous les aliments des repas que tu as planifiés sur la période partent dans la liste.
          Un même aliment présent dans plusieurs repas est regroupé, ses grammages additionnés.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <CalendarRange size={16} color="var(--green-dark)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Période
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input
            type="date" className="input" value={startStr}
            onChange={e => setStartStr(e.target.value)} style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-hint)', flexShrink: 0 }}>au</span>
          <input
            type="date" className="input" value={endStr} min={startStr}
            onChange={e => setEndStr(e.target.value)} style={{ flex: 1 }}
          />
        </div>

        {loading && <Loader />}

        {!loading && plannedMeals.length === 0 && (
          <div className="card" style={{ padding: '18px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-hint)' }}>
            Aucun repas prévu (et pas encore mangé) sur cette période.
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Planifie des repas depuis le calendrier ou le plateau de menus.
            </div>
          </div>
        )}

        {!loading && plannedMeals.length > 0 && (
          <>
            <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {mealCount} repas · {itemCount} aliment{itemCount > 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-dark)' }}>
                ≈ {distinctCount} article{distinctCount > 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ marginBottom: 16 }}>
              {grouped.map(([date, repasList]) => (
                <div key={date} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-hint)', textTransform: 'capitalize', marginBottom: 4 }}>
                    {dayLabel(date)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {repasList.map(r => (
                      <span key={r.id} style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>
                        {r.nom} <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}>· {r.meal}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <button
          className="btn-primary"
          onClick={confirm}
          disabled={adding || plannedMeals.length === 0}
          style={{ opacity: adding || plannedMeals.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Check size={16} />
          {adding ? 'Ajout...' : 'Ajouter à la liste'}
        </button>
      </div>
    </div>
  )
}
