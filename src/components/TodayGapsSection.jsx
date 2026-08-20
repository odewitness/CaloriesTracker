import React, { useState, useMemo, useEffect } from 'react'
import { Lightbulb, Plus, ChevronDown } from 'lucide-react'
import { useFavorites, foodIdentity } from '../hooks/useFavorites'
import { useRecentFoods } from '../hooks/useRecentFoods'
import { useAuth } from '../lib/AuthContext'
import { portionGapCoverage, formatValue } from '../lib/ciqualExplorer'
import { scaleFood } from '../lib/nutrients'
import { logSuggestions } from '../lib/suggestionsLog'
import NutrientGapsBanner from './NutrientGapsBanner'
import AllGapsSheet from './AllGapsSheet'
import AddToJournalSheet from './AddToJournalSheet'

const MAX_SUGGESTIONS = 3

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// TodayGapsSection — ramène sur la page du jour ce qui fait l'intérêt de
// l'Explorer (voir NutrientGapsBanner / ciqualExplorer.js) : les manques
// nutritionnels du jour, et des suggestions concrètes pour les combler à
// partir de ce qu'elle mange déjà (favoris + récents), plutôt qu'un simple
// constat.
//
// N'est monté QUE pour le jour réellement affiché (voir TodayPage.DaySlot) —
// les favoris/récents ne sont donc chargés qu'une fois, pas une fois par slot
// de swipe.
//
// Props :
//   dateStr    — jour concerné (yyyy-mm-dd), sert de journalDate par défaut
//                dans la feuille d'ajout rapide
//   gaps / allGaps — sortie de getNutrientGaps, déjà calculée côté DaySlot —
//                pas de second calcul ici.
//   top10Gaps  — les 10 manques les plus urgents avec leur grammage absolu
//                (voir getGapAmount), sert de vivier au moteur de suggestion
//                ci-dessous (voir `suggestions`).
//   entries    — du jour, sert juste à savoir si "rien de noté aujourd'hui"
//   onAddEntry(entry) — même handler que le "+" des repas (useJournal.addEntry)
//   onNavigateExplorer(gapKey) — ouvre l'Explorer préfiltré sur ce nutriment
// ─────────────────────────────────────────────────────────────────────────────
export default function TodayGapsSection({ dateStr, gaps, allGaps, top10Gaps, entries, onAddEntry, onNavigateExplorer }) {
  const { favorites } = useFavorites()
  const { recents } = useRecentFoods()
  const { user } = useAuth()
  const [open, setOpen] = useState(true)
  const [gapsSheetOpen, setGapsSheetOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState(null) // { food, qty, date, meal, saving } | null

  // On parcourt les manques dans leur ordre d'urgence (top10Gaps est déjà
  // trié du plus urgent au moins urgent, voir getNutrientGaps) et, pour
  // CHAQUE manque, on cherche l'aliment qu'elle mange déjà dont SA PORTION
  // HABITUELLE (voir portionGapCoverage) le couvre le mieux — un aliment
  // déjà retenu pour un manque n'est pas réutilisé pour un autre, pour avoir
  // des suggestions variées plutôt que 3 fois le même aliment/nutriment.
  //
  // Choisir systématiquement le meilleur aliment TOUS MANQUES CONFONDUS (au
  // lieu, comme ici, du meilleur PAR manque pris dans l'ordre d'urgence)
  // faisait converger toutes les suggestions vers le même nutriment : un
  // manque presque comblé (donc trivialement couvert à 100 % par n'importe
  // quel aliment qui en contient un peu) gagnait systématiquement face aux
  // manques réellement importants.
  //
  // Le grammage n'est jamais inventé/plafonné : c'est la portion réelle de
  // l'aliment (déclarée, ou 100 g par défaut), donc il varie naturellement
  // d'un aliment à l'autre au lieu de converger vers un même chiffre.
  //
  // Pour ne pas montrer toujours le même aliment pour un manque donné, on
  // pioche au hasard parmi les meilleurs candidats plutôt que de toujours
  // prendre le premier — recalculé à chaque montage de la section (ouverture
  // de l'app, changement de jour), donc ça varie d'une fois à l'autre.
  const suggestions = useMemo(() => {
    if (!top10Gaps.length) return []
    const candidates = [...favorites.map(f => f.food_data), ...recents]
    const seen = new Set()
    const uniqueCandidates = []
    for (const food of candidates) {
      const key = foodIdentity(food).key
      if (seen.has(key)) continue
      seen.add(key)
      uniqueCandidates.push(food)
    }

    const used = new Set()
    const out = []
    for (const gap of top10Gaps) {
      if (out.length >= MAX_SUGGESTIONS) break
      const matches = []
      for (const food of uniqueCandidates) {
        const key = foodIdentity(food).key
        if (used.has(key)) continue
        const c = portionGapCoverage(food, gap)
        if (c && c.pct > 0) matches.push({ food, coverage: c })
      }
      if (!matches.length) continue
      matches.sort((a, b) => b.coverage.pct - a.coverage.pct)
      const pool = matches.slice(0, Math.min(3, matches.length))
      const pick = pool[Math.floor(Math.random() * pool.length)]
      used.add(foodIdentity(pick.food).key)
      out.push({ food: pick.food, gap, coverage: pick.coverage })
    }
    return out
  }, [top10Gaps, favorites, recents])

  // Trace ce qui a réellement été montré : c'est la matière première de la
  // section "Suggestions" de la liste de courses (voir
  // useGroceriesSuggestions.js), qui fait remonter les aliments les plus
  // fréquents parmi ceux suggérés ici au fil du temps.
  useEffect(() => { logSuggestions(suggestions, user?.id) }, [suggestions, user?.id])

  const handleQuickAdd = (suggestion) => {
    setQuickAdd({
      food: suggestion.food,
      qty: String(Math.max(1, Math.round(suggestion.coverage.grams))),
      date: dateStr,
      meal: 'Déjeuner',
      saving: false,
    })
  }

  const confirmQuickAdd = async () => {
    const q = parseFloat(quickAdd.qty)
    if (!q || q <= 0) return
    setQuickAdd(qa => ({ ...qa, saving: true }))
    await onAddEntry({ meal: quickAdd.meal, ...scaleFood(quickAdd.food, q) })
    setQuickAdd(null)
  }

  const pickGap = (key) => { setGapsSheetOpen(false); onNavigateExplorer(key) }

  return (
    <>
      {/* Fond blanc et repliable comme "Détail nutritionnel" (NutrientPanel) —
          même pattern d'en-tête cliquable + chevron, pour que les deux
          sections de la page se comportent pareil. */}
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>À combler aujourd'hui</span>
          <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {open && (
          <div style={{ padding: '0 16px 14px' }}>
            <NutrientGapsBanner
              gaps={gaps}
              hasMoreGaps={allGaps.length > gaps.length}
              onShowAllGaps={() => setGapsSheetOpen(true)}
              hasEntries={entries.length > 0}
              // Pas de "tient dans mes calories restantes" ici : ce toggle filtre
              // une liste de résultats, qui n'existe pas sur cette page — seule
              // l'Explorer en a l'usage.
              remainingKcal={null}
              activeClaims={[]}
              onPickGap={onNavigateExplorer}
              // Le titre "À combler aujourd'hui" est déjà porté par l'en-tête
              // repliable ci-dessus — éviter de le répéter deux fois.
              hideTitle
            />

            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map(s => (
                  <div
                    key={foodIdentity(s.food).key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: 'var(--green-light)', borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}
                  >
                    <Lightbulb size={15} style={{ color: 'var(--green-dark)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--green-dark)', lineHeight: 1.4 }}>
                      <strong>{formatValue(s.coverage.grams, 'g')}</strong> de <em>{s.food.alim_nom}</em>
                      {s.coverage.pct >= 100
                        ? ` comblent ton manque en ${lowerFirst(s.gap.field.label)}`
                        : ` couvrent ${s.coverage.pct}% de ton manque en ${lowerFirst(s.gap.field.label)}`}
                    </div>
                    <button
                      onClick={() => handleQuickAdd(s)}
                      className="btn-icon"
                      style={{ width: 24, height: 24, flexShrink: 0, background: 'var(--white)', color: 'var(--green-dark)' }}
                      aria-label={`Ajouter ${s.food.alim_nom} au journal`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {gapsSheetOpen && (
        <AllGapsSheet
          gaps={allGaps}
          activeClaims={[]}
          onPick={pickGap}
          onClose={() => setGapsSheetOpen(false)}
        />
      )}

      {quickAdd && (
        <AddToJournalSheet
          nom={quickAdd.food.alim_nom}
          qty={quickAdd.qty}
          onQtyChange={v => setQuickAdd(q => ({ ...q, qty: v }))}
          journalDate={quickAdd.date}
          onDateChange={v => setQuickAdd(q => ({ ...q, date: v }))}
          journalMeal={quickAdd.meal}
          onMealChange={v => setQuickAdd(q => ({ ...q, meal: v }))}
          onConfirm={quickAdd.saving ? () => {} : confirmQuickAdd}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </>
  )
}
